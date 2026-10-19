# The scheduler contract — `Task<T>`, `park`, `wake`

**Status:** normative language specification.
**Draft:** 0.6.0c (TensionScript `next`), 2026-10-19.
**First implementation:** Tension 0.7.0.
**Scope:** the semantics a runtime must preserve. Not an implementation.

This document exists because the scheduler has, until now, been defined by its
implementation: a transform that emits a park, a guest table keyed by
`(family, key)`, a host epoch that invokes callbacks, a guest-side tick that
drains a ready queue. Every piece is tested (`4c`'s `ASYNC PASS`, the
cross-thread wake, the drop rule). None of it is specified. This is that
specification, and it is deliberately written so that the shipped mechanism is
one conforming implementation rather than the definition.

A reader should be able to implement this contract for a different engine
(WasmFX, a thread-per-task runtime, a native host) and disagree with none of
its sentences.

---

## 0. Normative language, and what is out of scope

`MUST`, `MUST NOT`, `SHOULD`, `MAY` are used in the RFC 2119 sense.

**In scope.** The meaning of `Task<T>` and `await`; the two calls at the
guest/host seam (`park`, `wake`); the executor's obligations; the invariants a
conforming runtime preserves; the declaration a completion class makes.

**Out of scope, deliberately.**

- How the compiler lowers `async`/`await`. Backend A (a state machine with a
  resume function) and Backend B (WasmFX continuations) are both conforming
  (§7).
- Any record layout, byte offset, symbol name, class id, ring, queue, thread
  count, or buffer size. Those are implementation (§6).
- Cancellation. A task removed from the scheduler while parked is a future
  contract; this one has no cancellation.
- Preemption and metering. The contract is cooperative; a runtime MAY preempt,
  but nothing here requires or forbids it.
- A memory model beyond "a parked task's state is reachable until it resumes".
- Language syntax for error handling. `await` does not throw; the status word
  is the error surface (§1.4).

---

## 1. `Task<T>`

### 1.1 A Task is a descriptor and a continuation

`Task<T>` is the value an `async function f(): T` returns. It is a *handle*, not
the work: it names one pending completion, and it is the handle to **that
particular execution** of `f` — not to the function, and not to a future call.

A Task carries three things:

- **identity** — the `(class, key)` pair naming what is awaited (§1.5);
- **continuation** — how that execution resumes from where it parked (§1.2);
- **result** — a payload and a status (§1.4).

The class's declaration (§5) says how the completion arrives and how many
times.

**Where the Task comes from, and why that is in the contract.** A Task is
created by the **entry of an async function**, not by the caller and not by the
runtime: the call runs the function's synchronous prefix, creates the Task, and
returns it. The language emits that creation and the `park` that follows; a
guest never constructs a Task by hand. What the function does after it resumes
is ordinary code — the contract is only about how it gets there.

This is what makes `Task<T>` a language feature rather than a runtime object: a
Task without a function body's captured state names a completion nobody can
continue, and a function body without a Task has no place to park.

### 1.2 The continuation

A Task's **continuation** is an opaque reference to how its execution resumes.

The contract does **not** say what a continuation is. It says what a
continuation must **do**:

> resume the function's execution **exactly once**, with the completion's
> result, at the point it parked.

Nothing else is normative. A continuation may be a pair of words, a reference
to an engine-level continuation object, a closure, or a table index — the
contract is indifferent. What it may not be is *visible to the guest*: a guest
never inspects, copies, or compares a continuation, which is why its
representation can change between backends without changing a program.

**The continuation is stored, not passed.** It is recorded when the Task is
created and held by the executor under the task id (§2.1). `park` does not
carry it, and `wake` does not receive it — both name the task, and the executor
resolves the name. The reason is in §2.1: the continuation's representation is
the one thing a mechanism *does* change, and an interface that carries it
would have to pick a type for it.

### 1.3 `await`

`await t`, where `t: Task<T>`:

1. If `t` is already settled, produces its value immediately. **No suspension
   happens.** A settled await is ordinary straight-line code.
2. Otherwise the current task suspends: exactly one `park` (§2.1). The task's
   continuation was recorded at the Task's creation (§1.2), so it is already
   reachable when the park registers the task; a completion that arrives during
   the park finds it.
3. The task resumes exactly once, at the continuation, with the result
   available. `await` produces the payload.

`await` never throws. Failure is a status (§1.4), not an exception.

A task that awaits in a loop performs one park per iteration; each park is a
separate unit of exactly-once (§4.1). The task's identity may be stable across
parks; the *suspension* is what is counted.

### 1.4 Result: payload and status

Every completion delivers two words of result:

- **status** — `0` on success; **negative** on failure. The magnitude and
  vocabulary belong to the class's declaration (§5). `-EIO` is a status value
  some runtimes mint; it is not part of this contract.
- **payload** — the producer's data, interpreted by `T` and by the class's
  declaration.

A failure status is delivered, not thrown, and it does not invent a payload:
what the value slot holds on failure is the class's declaration. A capability
that encodes failure as a negative *payload* (the OGRE loader's errno returns)
is a convention layered on this contract, not the contract itself.

### 1.5 Identity: `(class, key)`

- **class** — a completion class declared by the runtime (§5). It names the
  kind of thing that completes and the shape of its wake.
- **key** — the producer's submit-time identifier. It is the producer's, not
  the runtime's: the runtime echoes it, and never mints one.

The pair is the rendezvous. Two awaits with the same class and key are the same
rendezvous, and a runtime MUST refuse a second concurrent park on one pair
(§4.9) rather than silently sharing it.

### 1.6 Wake shapes

A class declares one of three shapes:

- **one-shot** — one completion per park: success or failure. The task is
  resumed once, and the class's key may be reused only after that resume.
- **stream** — the producer may signal repeatedly. Signals **coalesce** per the
  class's declared policy: between two parks, N signals produce at most the
  declared number of wakes (typically one). A claim — the guest draining the
  stream — re-arms the signal. A stream's terminal signal is a separate
  completion on the same family (§5).
- **repeated** — a tick or deadline: the class resumes the task on each tick
  or when a deadline passes, one resume per occurrence.

The language does not enumerate classes. A runtime declares them; a guest
program sees only `Task<T>` and the class's result convention.

### 1.7 Backend-agnostic

The contract is stated in terms of Task, park, and wake — not in terms of a
mechanism. Backend A realizes a park as a call that returns from the resume
function; Backend B realizes it as a continuation suspend. Both MUST satisfy
§2–§4. This is why the contract is Task-first: the mechanism is replaceable,
the guarantees are not.

**The continuation is the seam this rests on.** §1.2 fixes what a continuation
must do and nothing about what it is, so replacing the suspension mechanism —
a state machine for an engine-level continuation — changes the continuation's
representation and changes no line of this contract. §6 lists four
framework-supplied strategies as illustrations.

---

## 2. The interface

The seam has exactly two calls. Anything else a runtime exposes is an
implementation detail, and a guest MUST NOT be required to call it to make
progress.

### 2.1 Guest → host: `park`

```
park(task_id: u64, class: i32, key: i32): void
```

**The continuation is not a parameter, and that is a decision, not an
omission.** The alternative shape — `park(task_id, class, key, continuation)`,
with the continuation in the interface — was measured and rejected: no single
ABI type carries every mechanism's continuation. A state machine's is a pair of
32-bit words; WasmFX's is a `(ref $ct)`, a reference type that cannot be passed
as an integer; a thread-pool dispatch is a slot index or a function reference.
A signature that carried the continuation would have to *choose* a
representation, which is the mechanism leaking into the contract. So the
continuation is recorded at Task creation and held under the task id, and the
interface stays three integers.

- **The executor maintains a task table keyed by `task_id`; each entry carries
  the task's continuation.** This is normative: without it `wake(ids)` has
  nothing to resolve an id to. The table's shape, its size, and what a
  continuation *is* remain the framework's.
- **One call per suspension.** The runtime records `(class, key) → task_id` in
  that table. This record is the only registration; there is no second
  "register" call.
- **Called after the continuation is recorded.** The continuation was recorded
  when the Task was created (§1.2), so the guest MUST be resumable from the
  park the moment the call returns.
- **The call returns.** It does not block the owner thread. The *suspension* is
  the guest returning to the executor, not the host call spinning.
- **At most one outstanding park per `task_id`.** A second park for a live
  task id is a program error; the runtime MUST refuse it deterministically
  (§4.9), not overwrite the first.
- **A key outside the class's declared key space is refused** with the class's
  error (§5). It MUST NOT wait for a completion that cannot arrive.

### 2.2 Host → guest: `wake`

```
wake(ids: u64[]): void
```

- **Called on the Store's owner thread only.** A runtime whose Store is
  single-threaded (every WebAssembly embedding) must not call `wake` from a
  producer or manager thread; the manager hands ids to the owner (§3.4).
- **Each id is resolved through the task table and its continuation invoked
  exactly once**, with its completion's result. *How* the invocation happens —
  a function call, a continuation resume, a dispatch to another thread, a
  callback — is the executor's choice and is not specified here (§6).
- **Batched.** Multiple ids per call are valid and expected. Within a batch,
  resume order is list order (§4.5).
- **An id that is not parked is a runtime error.** The host MUST NOT invent
  ids; the set it passes is exactly the set it matched.
- **No other call is required for progress.** There is no required `tick`,
  `run`, `poll`, or `drain` in the guest program. A runtime MAY expose one for
  its own use; a guest MUST NOT have to call it.

### 2.3 Push, not pull

The contract is push-shaped: **the host names the tasks to resume.** A runtime
may implement this over a ready queue that the host drains, and the guest may
observe that the host called `wake` after some internal batching, but the
observable semantics are: the host decides which tasks resume, and the guest
does not ask "is anything ready?".

A guest that loops `while (state == running) { read(); }` is not conforming
code under this contract, even if it happens to work against one
implementation.

---

## 3. The executor

An **executor** is the component that turns completions into task ids. It is
runtime machinery, not guest code.

### 3.1 Partition by class

- There MAY be one or more executors.
- Each executor owns a **disjoint** set of classes, and the `class → executor`
  function is total and fixed for the session's lifetime.
- A park and a completion for the same class therefore always reach the same
  executor. This is the mechanism behind exactly-once under any executor count
  (§3.5).

### 3.2 Wait on a real primitive

An executor with nothing to do **blocks** on a real primitive: a condition
variable, a channel receive, `epoll`/`kqueue`, vsync, or a timer. It does not
spin, does not `try_recv` in a loop, and does not sleep-and-retry.

### 3.3 Match in bounded, O(1) work

Matching a completion to a parked task is **O(1) in the class's declared
capacity** — bounded work per completion, independent of how many tasks are
parked in other classes. The structure that achieves this is the runtime's
choice (§6): a direct array indexed by key, a tag-verified direct-mapped
cache, a heap for deadlines.

### 3.4 Hand off; never touch the Store

- The executor does **not** touch the Store (the guest's linear memory) and
  does not call guest code.
- It queues the matched ids for the Store's owner thread.
- The owner thread calls `wake(ids)` at a defined boundary: the next frame, the
  next batch, the next epoch.
- When the executor and the owner are the same thread, the separation is
  temporal: match first, then wake, with no guest code interleaved.

### 3.5 Exactly-once under any executor count

Adding executors MUST NOT weaken §4.1. The partition is the proof: a class's
parks and its completions are seen by exactly one executor, so there is no
race to match the same completion twice or to miss it. A runtime that lets two
executors see one class does not conform, however it resolves the race.

---

## 4. Invariants

A conforming runtime preserves all of these for every class it declares.

### 4.1 Exactly-once resume per park

Every `park` is resumed by exactly one `wake`. Not zero (a hang), not two (a
double resume). The unit is the park, not the task: a task that parks in a loop
is resumed once per iteration.

Stated over the mechanism, so it survives a backend swap:

> A Task's continuation is invoked exactly once per park. The mechanism of
> invocation is the framework's choice; the guarantee is the contract's.

### 4.2 Exactly-once delivery

The completion's result — payload and status — is copied to the task exactly
once, and the copy is complete before the resume runs. Deferring the copy to
resume time is not conforming where the underlying transport may reuse the
slot (the arena's sub-ring does: it compacts and rebases).

### 4.3 No lost wakes

A completion that arrives **before** its park is buffered and claimed by that
park. A completion that arrives **after** the park is matched to it. Neither
order may drop the completion.

The buffer is bounded by the class's declared key space (§5): a class that can
have at most `N` live keys needs at most `N` buffered completions (or `N × k`
for a class that declares `k` pending signals per key). A **producer** that
exceeds the declared bound is refused at the producer — the class's
back-pressure — rather than silently dropped. A conforming runtime therefore
has no "buffer full, lose the oldest" path for a well-formed class.

### 4.4 No poll

Every wait blocks on a real primitive (§3.2). No busy-spin; no `try_recv` plus
sleep; no `while` around a wait in guest source; no "ask the state, then ask
again".

### 4.5 Ordering

- **Within a `wake(ids)` batch:** list order.
- **Across batches:** per-class FIFO, or the ordering the class declares. A
  class that declares completion-count ordering (a stream's coalesced signal)
  says so in its declaration.
- A task resumed during a batch and parking again is **not** resumed again in
  the same batch. Each id appears at most once, and each park is one wake.

### 4.6 Single-thread delivery

`wake(ids)` is called on the Store's owner thread only. A runtime that has no
single owner thread does not conform to this contract (it needs a different
one: the Store would need synchronization the WebAssembly embedding does not
provide).

### 4.7 Error surface

A completion that is lost — dropped by a transport, refused by a full class, or
otherwise not deliverable — MUST wake the affected tasks with a **failure
status**, not leave them parked. The contract names the delivery; the code and
its magnitude belong to the class's declaration. A lost completion that
becomes an unbounded wait is the failure this invariant exists to forbid.

### 4.8 A settled await never suspends

`await` on a settled task produces its value immediately and parks nothing. A runtime that
parks and immediately resumes is observably wrong: the continuation must not
run twice, and no park may be registered for a task that did not suspend.

### 4.9 No double park

At most one outstanding park per task id, and at most one concurrent park per
`(class, key)`. A second is refused deterministically with the class's error;
it MUST NOT overwrite, share, or queue behind the first. (A second wait on the
same key is a producer/guest bug: one completion cannot resume two tasks that
both claim it.)

---

## 5. What a class declares

A completion class is runtime-declared. Its declaration MUST state:

| Property | Meaning |
|---|---|
| **id** | the wire identity; stable for the runtime's lifetime |
| **capacity** | the maximum number of live keys (the key space bound) |
| **wake shape** | one-shot, stream, or repeated (§1.6) |
| **coalescing** | for a stream: how many signals may be outstanding per key before a claim |
| **ordering** | per-class FIFO, or another declared order |
| **failure vocabulary** | the status values the class may deliver, by name |
| **delivery mode** | how the transport carries it (implementation-visible, but part of the declaration) |
| **terminality** | whether the class has a terminal completion distinct from data |

A class id is a wire value: adding one is a runtime version change, and every
adapter must agree on the table. In Tension this is the arena's frozen layout;
in another runtime it may be an enum. The contract requires only that the
declaration is **fixed for a session's lifetime** and that adding a class is a
versioned change, never an implicit one.

A park on a key outside the declared key space, or a park on a class whose
capacity is exhausted, is refused with the class's error — never silently
shared or queued unboundedly.

---

## 6. What is implementation, not contract

The following are choices a conforming runtime makes; none of them may be
observed to break §2–§4.

- **The per-class structure.** Direct array, tag-verified direct-mapped cache,
  min-heap, hash table — the contract requires bounded O(1) matching, not a
  shape.
- **The number of executors.** One is conforming; many are conforming if §3.1
  and §3.5 hold.
- **The batching policy.** One id per `wake`, or all ready ids; the contract
  requires only that the batch is a set of parked ids and its order is list
  order.
- **The record layout.** Tension's 32-byte record with `class_`/`key`/`payload`
  /`status`/`f0`/`f1`/`tag`/`done` is a wire detail. The class semantics define
  what the words mean; the offsets define nothing at this level.
- **The symbol names.** `__taskPark`, `__taskDeliver`, `__taskTick` are one
  implementation's names. The contract names `park` and `wake`.
- **The transport.** The arena's sub-rings, callback slots, channels, or
  direct function calls — the contract names the semantics, not the pipe.
- **The buffer's location and size.** In the guest, in the host, or split; the
  contract requires the claim-before-arrival behavior of §4.3.
- **The id allocation.** Sequential, encoded, or opaque.
- **The resume mechanism.** A callback that unblocks, a state-machine resume
  function, a WasmFX `resume`, a dispatch to a thread — the contract names
  `wake`, the executor names how resume happens. See §6.1.

### 6.1 Framework-supplied resume strategies — illustrative, not prescriptive

Each row is one way a framework may satisfy §1.2 and §4.1. None is required;
none is privileged. The point of listing them is to show that the same
contract covers all four, so no reader mistakes any one of them for the rule.

| Strategy | The continuation is | The executor invokes it by |
|---|---|---|
| **State machine** (Backend A) | a state record plus a resume function — `(state_ptr, resume_fn)` | calling `resume_fn(state_ptr)` |
| **WasmFX** (Backend B) | a `(ref $ct)` | executing `resume` on it |
| **Thread pool** | a task id plus a dispatch function — `(task_id, dispatch_fn)` | dispatching to a worker thread |
| **Callback-based** | a registered callback | invoking the callback |

Two consequences worth stating, because they are what the amendment buys:

- **The guest never sees which one is in use.** §1.2 makes the continuation
  opaque to guest code, so a program compiled against one strategy runs
  unchanged against another.
- **Only the strategy knows whether a resume has a stack.** Backend A's resume
  returns *from* a function that parked; WasmFX's `resume` switches *into* a
  suspended continuation; a thread pool's dispatch may run the continuation on
  a different stack entirely. The contract requires exactly-once, so it cannot
  require any of these shapes.

---

## 7. Backend B (WasmFX)

A WasmFX backend implements the same contract with `cont.new` / `suspend` /
`resume` as the mechanism:

- `await` creates or resumes a continuation; a park is a `suspend` of the
  current continuation;
- the executor still matches completions and calls `wake`; the guest's wake
  entry resumes the continuation;
- `Task<T>` semantics — identity, result, wake shape, invariants — are
  unchanged.

Backend B changes **when and how the guest's stack is captured**, not what the
host guarantees. That is the test of whether this contract is a contract: an
implementation may replace the entire suspension mechanism and still be
conforming. If a requirement here cannot survive that replacement, it was an
implementation detail mis-stated as a rule.

---

## 8. The no-poll rule, going forward

The contract's §4.4 is a rule about new code, not only about the scheduler.

1. **Every wait site names its primitive.** A new `wait`, `recv`, `poll`,
   `sleep`, or blocking call MUST say, in the same change, what it blocks on
   (condition variable, channel, epoll, vsync, timer, stdin).
2. **Guest source has zero `while` around a wait.** No state polling, no
   "read until empty then check the state again". A guest task awaits; it does
   not pump.
3. **Host source has no `try_recv` + sleep and no spin.** A bounded wait with a
   predicate is fine; a loop that re-asks without blocking is not.
4. **Verification is grep-able.** The implementation plan names the exact
   greps that must return zero for the examples and for the runtime's
   production code.
5. **A wait site added without a named primitive is a review failure**, not a
   style nit.

---

## 9. Conformance

A runtime conforms if, for every class it declares:

- `park` and `wake` exist with §2's semantics;
- every invariant in §4 holds;
- the class's declaration satisfies §5;
- the executor satisfies §3, including the partition.

Evidence a runtime SHOULD be able to show: exactly-once under repeated
completions; a buffered completion claimed by a later park; ordering across a
batch; a lost completion delivered as a failure status rather than a hang; a
no-poll audit of its host and guest code; and, if it has more than one
executor, the same exactly-once result with the class partitioned.

### 9.1 What conformance does *not* require

- It does not require this document's mechanism. The shipped Tension chain —
  a guest table keyed by `(family, key)`, an epoch that invokes callbacks, a
  guest-side tick — is one implementation. It satisfies §2's *semantics* today
  only through a pull (`__taskTick`) and a guest pump; the migration to the
  push interface is the implementation plan's work, not a change to this
  contract.
- It does not require a particular class table. A runtime with one class and a
  runtime with thirteen both conform if their declarations are honest.

---

## 10. Non-normative: how the shipped implementation maps

This section is a reading aid. It is **not** part of the contract, and the
names here may change without changing any normative sentence above.

| Contract term | Shipped realization (TensionScript 0.5.1 / Tension 0.6.0a, in flight) |
|---|---|
| `Task<T>` | `std/assembly/task.ts`'s `Task<T>` and `TaskRecord` |
| park | `__taskPark(state, awaited)` — `std/assembly/task-rt.ts:193` |
| wake (pull today) | `__taskTick()` — `std/assembly/task-rt.ts:389`; called by `rt.runReady()` |
| delivery | `__taskDeliver(class, a, b, f0, f1)` — `std/assembly/task-rt.ts:264` |
| continuation | `TaskState.resume` — `std/assembly/task-rt.ts:79`, **one instance** of §1.2, not the definition |
| executor | the guest's `waitingByKey` map plus the host epoch's callback invoke |
| class declaration | `arena.rs`'s `CLASSES`, capacities, modes (the frozen layout) |
| class table version | `RECORDED_LAYOUT_HASH` (`arena.rs`) |

The mismatch this table exposes is the point of the contract: the shipped
runtime's *wake* is a drain (`__taskTick`), and the guest must call it. The
contract's `wake(ids)` is push. Closing that gap is Tension 0.7.0's job; the
language-level guarantees above already say what "closed" means.

**`TaskState.resume` is an instance, not the definition.** It is Backend A's
continuation — a function reference stored on the state record. A framework
that resumes differently has a different continuation and satisfies §1.2
identically; nothing in the normative text names this field, and §6 lists the
strategies that replace it.

The same reading applies to `park`: the shipped `__taskPark(state, awaited)`
passes the state record, which is Backend A's continuation-by-argument. The
contract's `park` names only the task (§2.1); the argument is this
implementation's way of satisfying "the task table's entry carries the
continuation", not a requirement the contract makes.
