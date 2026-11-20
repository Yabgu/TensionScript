# The thread ABI

**Status:** normative for `--sharedMemory` builds since 0.14.1 (Gate 4).
**Implementation:** `std/assembly/thread.ts`, the exports listed in
`src/compiler.ts` (`threadFunctions`, `threadGlobals`).
**Tests:** `tests/rt/gate4.js` (rings across threads; a task in both
directions), `tests/rt/arena.js` (the arena half).

This is the contract between a host and a shared-memory TensionScript module.
It says what the host must do, what the guest publishes, and which values may
cross a thread boundary. It is deliberately narrow: it is the seam a pool
builds on, not a scheduler.

---

## 1. The model in one paragraph

A `--sharedMemory` module is instantiated **once per thread over one memory**.
Each instance has its own globals, its own `$~asyncCont` table, its own heap and
its own stack; the linear memory is the only thing they share. A wasm reference
(a continuation, an object) belongs to the store that made it and cannot cross.
An `i32` can. Every cross-thread structure in this document is therefore plain
words at a computed address, and every cross-thread message is an index.

---

## 2. The boot contract

**A shared-memory module runs nothing at instantiation.** There is no start
section: a start section runs on *every* instantiation, so every worker would
run `main` again on its own globals against the same memory. The host chooses
the entry per instance.

### 2.1 Main

```js
const instance = new WebAssembly.Instance(module, { env: { memory, __executorCount, __startThread, ... } });
const e = instance.exports;

e.__threadInit(capacity);                                  // carve, once
e.__arenaInit(e.__mainArenaBase(), e.__mainArenaSize());    // main's slice
e.__start();                                                // boot body + shell
```

`__start() -> i32` runs the module's initialisers, the boot body and the async
shell, and answers the shell's status. It is emitted by the compiler
(`emitStartEntry`), so a program with no code still has it.

**Forgetting `__start()` fails silently.** `@lazy` globals never initialise
(they live in `$~start`), `__arenaHeapBase()` answers `0`, `__asyncStatus` stays
`0`, and a host that waits for work waits forever. Nothing traps.

**`__arenaInit` must run before `__start`, not after.** It discards every
allocation made before it, and the boot body allocates.

### 2.2 A worker

```js
const w = new WebAssembly.Instance(module, { env: { memory, __executorCount, __startThread, ... } }).exports;
w.__arenaInit(w.__workerArenaBase(id), w.__workerArenaSize(id));
w.__workerMain(id);
```

The host's `env.__startThread(id)` import creates that instance and calls those
two functions on it, in that order; the worker's instance has no `__start` call
at all. `__workerMain` answers `0` when its loop ended normally, `-1` for a
shared build/id problem, `-2` when the control block has not been carved, and
`-3` when its arena is missing or does not cover the record — the alternative
would be running on another instance's heap.

**Why the arena is the host's job, not the guest's.** `__arenaInit` moves
`__stack_pointer`. A guest frame addresses its shadow-stack slots as
`__stack_pointer + k`, so calling `__arenaInit` from inside a guest function
moves *that frame* into the arena's heap; under the incremental collector the
frame's live references then fall outside the `visitStack` window and a live
`Executor` is swept (measured). The same rule is why `__threadInit` carves but
does not configure.

---

## 3. The carved control block

`__threadInit(capacity)` carves one contiguous region starting at the first
page boundary at or after `__heap_base`. It grows the memory as needed and
answers `0` (or `-1`/`-2` on a non-shared build / a failed grow). A second call
is a no-op.

Layout, in order:

### 3.1 Header (16 words, 64 bytes)

| word | name |
|---|---|
| 0 | magic, `0x54485244` (`"THRD"`) |
| 1 | `executorTotal` — main plus the pool |
| 2 | `controlStride` — bytes per executor record |
| 3 | `ringCapacity` |
| 4 | `requestCount` |
| 5–15 | reserved, zero |

### 3.2 Per-executor record, `controlStride` bytes each

A ring of `capacity` needs `2 * capacity + 3` words, so
`stride = align16((2 * (2 * capacity + 3) + 6) * 4)`; record `id` is at
`controlBase + 64 + id * stride`.

| offset | field |
|---|---|
| `0` | `ready` ring |
| `(2 * capacity + 3) * 4` | `inbox` ring, same shape |
| `2 * (2 * capacity + 3) * 4` | `signal` word |
| signal `+4` | `arenaBase` |
| signal `+8` | `arenaSize` |
| signal `+12` | `state`: 0 unborn, 1 running, 2 exited |
| signal `+16` | spawn entry (`$starts` index, or `-1`) |
| signal `+20` | spawn argument |

A ring is `[head, tail, capacity, cells…]`, where each cell is two words: a
value and a **sequence stamp**. An empty ring's stamps are `0..capacity-1`; a
producer that reserves index `pos` writes the value and then stamps the cell
`pos + 1`, and a consumer takes a cell only when the stamp says exactly
`pos + 1`, then frees it with `pos + capacity`. The stamp is what makes every
lap distinguishable: with a "not written yet" sentinel, a reserved cell still
holds the previous lap's value and a consumer would read a stale entry and pass
a live reservation (measured — the cross-thread test lost entries).

`push` reserves the tail with a CAS and only then publishes, so several
producers may push concurrently; `pop` advances the head with a plain store,
because exactly one executor drains a given ring. After publishing, a push
bumps `signal` and notifies one waiter.

### 3.3 Request table

Immediately after the last record: `requestCount` slots of four words each —
`funcIndex`, argument, key, origin executor — followed by the free-list ring
(`[head, tail, capacity, cells…]` of request indices). Allocation is a CAS on
the free-list head, so producers on different threads cannot hand out the same
index.

### 3.4 Arenas

After the free list: one arena per worker, `1 MiB` each, then **main's arena is
the rest of the memory**. A worker's bounds are in its record, so it never has
to know where it sits; the host reads them with `__workerArenaBase/Size(id)`.

A worker's arena reserves its stack region exactly as the module's default
layout did, so `visitStack`'s window inside the arena is that thread's stack and
nothing else. Main configures its arena with
`__arenaInit(__mainArenaBase(), __mainArenaSize())`; workers with their own.

**After `__threadInit` returns, nothing allocates in the block.** Every
structure above is written once and then only addressed.

---

## 4. The host imports

```ts
@external("env", "__startThread")
declare function __startThread(execId: i32): i32;

@external("env", "__executorCount")
declare function __executorCount(): i32;
```

`__executorCount()` is how many executors exist: main plus the pool. It is read
once, by `__threadInit`, and decides the header's `executorTotal`.

`__startThread(execId)` is called **after** the guest has filled that executor's
record (arena bounds, rings, spawn entry) and set its state to `1`. The host
writes no guest memory and reads only what the guest published. It creates a new
instance over the same memory, configures the instance's arena from the record,
and calls `__workerMain(execId)` on it. It answers `0` on success; any other
value makes `__spawnThread` mark the executor exited.

Both imports are emitted only under `--sharedMemory`, and only when the module
has an async shell (thread exports are gated on it: a program that merely
imports `SlotRing` has no `$starts` table to serve from).

---

## 5. The exports, and the slot rule

| export | contract |
|---|---|
| `__threadInit(capacity) -> i32` | §3; once, before any spawn |
| `__start() -> i32` | main's boot body and the shell's status (§2.1) |
| `__workerMain(id) -> i32` | a worker's whole life (§2.2) |
| `__spawnThread(id, entryIndex, argSlot) -> i32` | write the record, call `__startThread(id)` |
| `__executorExit(id) -> i32` | end that executor's loop, notify its state word |
| `__threadJoin(id) -> i32` | wait on the state word with `atomicWait` until `2` |
| `__mainArenaBase/Size() -> i32` | main's slice, for the host |
| `__workerArenaBase/Size(id) -> i32` | a worker's slice, for the host |

and the layout globals `__heapBase`, `__controlBase`, `__controlStride`,
`__ringCapacity`, `__executorTotal`.

`__spawnThread(id, entryIndex, argSlot)` serves `entryIndex` once at startup
when it is `>= 0`, with `argSlot` as the argument; pass `-1` for a worker that
only drains its inbox. It refuses (`-2`) an id that is already born.

### 5.1 The slot-numbering rule

**A slot number is only ever written into, and only ever interpreted by, the
executor that owns it.** `$~asyncCont` is a per-instance table, so the same
number means different continuations in different stores.

Cross-thread work therefore carries a **`funcIndex` into `$starts`** — one table,
identical in every instance, which is what makes an index meaningful across
stores — and the receiving store creates its own continuation
(`__serveSlot` → `cont.new`). A continuation never crosses stores; nothing in
the runtime tries.

A request's fourth word is an opaque key chosen by the origin. Its only
cross-store use is the echo: a served body that wants to reply reads
`__serveOrigin()` and `__serveKey()` and posts a request back to that executor
with that key. A `taskKey` is *not* interpreted by the target.

### 5.2 Serving a request

`__drainInbox(e)` pops a request index, copies its four words into this store's
globals, frees the record, and resumes `$starts[funcIndex]` as a continuation.
The served body reads them through `__serveArg()`, `__serveKey()` and
`__serveOrigin()`; read them **before the body's first suspension** if they have
to survive one. Serving is not reentrant: a served body that itself drains an
inbox would overwrite them.

`$starts` entries are canonical `() -> i32`, so a served body takes no operands;
the request's argument word is the "one `i32` in" and its own `__spawnOn` is the
"one `i32` out". References cannot cross, and this channel does not pretend
otherwise.

### 5.3 Waking an executor

`TaskBase.settle` routes each waiter to `waiter.exec` through the wake sink.
Under `--sharedMemory` the sink pushes onto the carved `ready` ring **by
executor number**, with raw atomics, and bumps that record's signal. That is
what lets a worker completing a task make main runnable; the worker still cannot
run main, and main still cannot run a worker.

`waiter.exec` is the id of the store that **parked** the continuation
(`__parkOn`), not the task's `home`: a served continuation has no task object at
all, and a task created by a worker's `f$spawnStart` still carries the default
`home = 0`. Routing by `home` pushed a worker's slot number into main's ready
ring, where it named an unrelated continuation (measured: `resuming an invalid
continuation`).

### 5.4 Awaiting a task that runs elsewhere

`RemotePolicy` (`~lib/thread`, next to `Executor`) is the first real
`TaskPolicy`. `create` posts the task's `$starts` index to the policy's target;
`await` parks and suspends without naming a slot.

The index comes from `TaskBase.entry`, set by the transform in the generated
entry next to `slot` and `bindTask`. Its value is `__spawnIndexOf(f$spawnStart)`
— a compiler-emitted constant, because a `$starts` index is a fact of the module
and therefore identical in every store (a global would be zero in a worker,
whose `$start` never ran). A parameterized async function has no `$spawnStart`
yet, so its tasks keep `entry = -1` and cannot be posted by index.

`__resumeTask` distinguishes three suspension payloads: `>= 0` parks on the
local slot it names (continuation stored back, slot queued); `-1` means the task
resumed to completion (nothing stored, nothing queued); **`-2`** means parked on
something that is not a local slot — the continuation is still stored back at
the task's slot, but nothing is queued, because no slot here can make it
runnable. Programs reach `-2` only through `__suspendParked()`, a builtin with no
argument, so a payload the runtime does not define cannot be spelled.

---

## 6. What the tests observe

`tests/rt/gate4.js`, under Node with `--experimental-wasm-wasmfx` (stack
switching is required; `wasmtime wast` cannot instantiate a shared-memory
module):

- **(c) rings only.** Three `worker_threads` producers push 2,000 values each
  through `SlotRing.at` into one carved ring (capacity 256); the main thread
  drains it. Every value is observed exactly once, nothing is lost, and the
  consumer really did see an empty ring — the ring is the only buffer.
- **(d) a task in both directions.** Main posts a request to a worker; the
  worker computes `42` and posts a delivery request back to main; main serves
  it, records the value and settles a task created in main's store; main then
  posts an acknowledgement back to the worker, which serves it and exits. The
  worker reports the acknowledgement it saw; `__threadJoin(1)` observes the
  exit.
- **(e) a cross-store await.** Main posts a caller to its own executor; the
  caller creates `work() on new RemotePolicy(1, 21, reply)` and awaits it, so the
  body is served in the worker's store and answered with `21 * 2`. The waiting store serves
  the reply, settles the task, and the caller resumes with `42`; the body ran
  **only** there (`bodyRanAtHome == 0`), the caller's continuation resumed
  exactly once, and `__threadJoin(1)` observes the worker's exit.
- **(f) the identifier and the mask arithmetic.** Main reads `0`; a worker
  posts `__selfExecutor()` back and main receives `1`. `executorMask(0) == 1`,
  `executorMask(1) == 2`, `executorMask(32) == 0`; `maskAllows(0, 7)` is true,
  `maskAllows(1, 1)` is false, `maskAllows(2, 1)` is true; `maskUnion(1, 2)`
  is `3`.
- **(g) admission refuses.** `__spawnOnMasked(1, {0}, …)` answers `-1`, the
  refusal count is `1`, and the worker's body never runs; the same call with
  `{1}` answers `0` and the body runs, so the mask, not the channel, was the
  reason.
- **(h) a masked policy places work.** `work() on new MaskedPolicy(1, {1}, 21,
  reply)` from a caller on main's executor: the worker computes `42`, the
  caller's `await` receives it, and the worker's own id (`1`) comes back in the
  request key.
- **(i) a violation is counted.** An unmasked `__spawnOn` places work on worker
  1; there a task whose policy set mask `{0}` parks anyway. The worker's own
  `__maskViolations()` reports `1`, and the task still settles (`answer == 3`).

---

## 7. Identity and masks

### 7.1 The identifier

`__selfExecutor() -> i32` (`~lib/thread`) is this **store's** executor id: `0`
on main, the id `__workerMain` was given in a worker. It is a guest function
over a store-local global, not a host query, so a program can read it without a
new import and without a round trip.

That is the whole identity mechanism. A store-local value cannot be read from
another store — a worker's copy of a global is invisible in main — so anything
a worker must report has to come back as a request argument (`__serveArg`'s
word, or the request key). Gate 4 (f) is that rule made a test: the worker
posts `__selfExecutor()` back and main asserts it received `1`.

### 7.2 The mask

A mask is an `i32` bitmask over executor ids:

```ts
export function executorMask(id: i32): i32;   // 1 << id, or 0 outside 0..31
export function maskAllows(mask: i32, id: i32): bool;
export function maskUnion(a: i32, b: i32): i32;
```

- **Bit `i` set = executor `i` allowed.**
- **`0` means unconstrained**, not "nothing allowed". It is the default value of
  `TaskBase.mask`, so a program that never names a mask pays nothing and is
  never refused. `maskAllows(0, anything)` is `true`. This is the case people
  get wrong; it is the reason the field can be a plain `i32` with no sentinel.
- **32 is the ceiling.** The mask is 32 bits wide, so a process with more than
  32 executors cannot describe an allowed set with it. `executorMask(id)`
  answers `0` outside `0..31`, and `maskAllows(mask, id)` answers `true` for
  such an id: the mask has no opinion, and wrapping `1 << 32` to `1` would
  silently forbid an executor the program meant to allow.
- `maskUnion` treats `0` as absorbing — unconstrained unioned with anything is
  still unconstrained. (The naive `a | b` would narrow `0 | {1}` to `{1}`.)
- Counters are per store: `__maskRefusals()` counts admissions this store
  refused, `__maskViolations()` counts parks this store observed on a
  disallowed executor. A worker's counts are the worker's; to observe them
  from main, post them back.

`TaskBase.mask: i32 = 0` is declared **last**, after `entry`, so no earlier
field's offset moves. A policy's `create` sets it (`MaskedPolicy` does); the
transform does not.

### 7.3 Two enforcement points, and nothing else

**A continuation is store-local.** Only the store that created it can resume
it, so a mask cannot move a running or parked task between stores. It decides
where a task is *placed*, and refuses to place it somewhere forbidden. A mask
that pretended to migrate would be a lie the runtime cannot keep.

1. **Admission** — `__spawnOnMasked(target, mask, funcIndex, argSlot, taskKey)`
   checks `maskAllows(mask, target)` **before** posting. A disallowed target is
   refused and counted: the answer is `-1`, `__maskRefusals()` grows by one, and
   **nothing is posted** — never dropped silently, never redirected.
   Redirection is a policy's choice, not the runtime's. The answer is `0` when
   posted and `-2` when the request table is full. `__spawnOn` keeps its
   signature and behaviour byte for byte: it is the unmasked escape hatch, and
   both functions share the same posting code.

2. **Verification at park** — `__parkOn` checks the **current** task (the one
   about to suspend, not the one it parks on). If the mask forbids this store,
   `__maskViolations()` grows by one **and the park proceeds**. Refusing to
   park would corrupt the continuation protocol, so the guarantee here is
   observability, not prevention: a task marked main-only cannot silently park
   on a worker.

There is deliberately **no second check** on the receiving executor. The
poster's mask named the target; two checks for one rule is how they drift apart.
The receiving check that does exist is the park, and it is about the *task's*
mask, not the request's.

**A mask does not cross with a request.** A request carries four words —
`funcIndex`, argument, key, origin — and no mask. The served task is created in
the target store by `f$spawnStart` with the default `mask = 0`; a mask set on
the origin-side task object is not transferred, because the origin-side object
is not the one that runs. (This is also why a task object itself does not
cross: continuations and references are per store.) A program that needs a
masked task running in a store constructs that task *there*; `(i)` does exactly
that.

### 7.4 `MaskedPolicy`

`MaskedPolicy(target, mask, arg, reply) extends RemotePolicy`. `create` sets
`task.mask = this.mask` and posts through `__spawnOnMasked`. A refusal is
recorded, not thrown: it surfaces as `__maskRefusals()` in the posting store,
and the task simply never settles — a policy that cannot place its work has no
channel to fail through. `await` is inherited, so an allowed reply still
settles the task in the waiting store.

### 7.5 Refusal versus violation

The two counters answer different questions, and `(g)`/`(i)` are the two
directions:

- **A refusal is the runtime's**: a caller used the checked path and named a
  target the mask forbids. `__spawnOnMasked` returned `-1`, the request never
  existed, and the target never saw it.
- **A violation is a program's**: something was already placed — through the
  unmasked `__spawnOn`, or by a policy that did not check — and a task with a
  mask then parked in a store the mask forbids. The park happens; the count is
  the only observable, and it lives in the store that parked.

A test can produce a violation precisely because the unmasked path stays
available; without that escape hatch the park check would be unreachable.
