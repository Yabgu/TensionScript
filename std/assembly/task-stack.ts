/// <reference path="./rt/index.d.ts" />

/**
 * The stackful backend's task table and park primitive.
 *
 * Kept apart from `task-rt.ts` on purpose: that file is Backend A's machine and
 * carries its compiler-visible globals (the record factory and the family map).
 * A stackful program must not pull those in — under `--wasmGc` a nullable
 * function-value global is a representation the flag does not cover, and a
 * program that never uses Backend A should not have to compile it.
 *
 * Everything here is keyed by the task object or its continuation slot. There
 * is no second record and no raw `i32.store` into one.
 */

import { TaskBase, TaskRecord, Waiter } from "./task";

import { MaskBase } from "./mask";

// ── the stackful task object (one object per execution) ─────────────────────
//
// The stackful backend (`--enable stack-switching`) keys everything by the task
// object and its continuation slot: the object *is* the task, there is no
// second record reached by a raw `i32.store`, and the only raw word in the
// protocol is the slot index the continuation table needs.

/** The slot → task table; index 0 is `main`, which has no task object. */
let tasks: Array<TaskBase | null> | null = null;

/** The slot of the task currently executing (set by `__resumeTask`). */
// @ts-ignore: decorator
@builtin
declare function __currentSlot(): i32;

/**
 * The status the last normal `resume` returned. Declared here because the
 * executor (`~lib/thread`) reads it when it serves a request, and `~lib/async`
 * imports `~lib/thread` for the loop.
 */
// @ts-ignore: decorator
@builtin
export declare function __lastStatus(): i32;

/**
 * Turns `$starts[funcIndex]` into a continuation installed at a fresh slot
 * (`docs/task-design.md` §8.5). The index crossed; the reference is made here.
 */
// @ts-ignore: decorator
@builtin
export declare function __serveCont(funcIndex: i32): i32;

/**
 * `__serveSlot` — create the served continuation **in its own function**.
 *
 * V8's wasmfx backend refuses to compile a function that contains both a
 * `cont.new` (with the table read/cast it needs) and a `resume`: measured as
 * `Check failed: !op.Effects().can_write()`, a hard abort of the process, not a
 * `WebAssembly.CompileError`. The builtins inline at their call sites, so
 * `__serveOne` — which must also call `__resumeTask` — cannot hold the creation
 * itself. This wrapper is the seam: `__serveOne` calls it, gets a slot, and
 * resumes; the two operations live in different wasm bodies.
 */
export function __serveSlot(funcIndex: i32): i32 {
  return __serveCont(funcIndex);
}

/**
 * Resumes `table[slot]` with the shell's `$await` handler and answers the
 * awaited slot, or `-1` when the task ran to its own completion.
 *
 * Declared here rather than in `~lib/async` because the executor (`~lib/thread`)
 * is its only caller now, and `~lib/async` imports `~lib/thread` for the loop.
 */
// @ts-ignore: decorator
@builtin
export declare function __resumeTask(slot: i32): i32;

/** `scheduler::park(task_id, class, key)` — the host park the fiber backend uses.
 *  The same import `~lib/task-rt` declares for the Promise backend's push path;
 *  identical module and name, so both shells name one wasm import. */
@external("scheduler", "park")
declare function hostPark(taskId: i64, class_: i32, key: i32): void;

/**
 * `scheduler::completion(task_id) -> i32` — **the payload the wake carried**, read
 * by the task that was just resumed.
 *
 * The park import names a `(class, key)` and nothing else, and that is deliberate:
 * it is the same `(task_id, class, key)` shape the Promise seam already uses, so a
 * host has one park ABI rather than two. But a stackful await must *return a
 * value*, and under this backend the host is the producer — so the value has to
 * come back from the host, and this is the smallest question that fetches it:
 * one `i64` in, one `i32` out, no pointers, nothing to allocate.
 *
 * Called exactly once, immediately after the park returns, by `__parkHost`. The
 * host answers `0` for a task it has no completion for, which is why a keyless
 * park (`__parkYield`) never calls it: no completion exists to ask about.
 */
@external("scheduler", "completion")
declare function hostCompletion(taskId: i64): i32;

/**
 * The fiber backend's **keyed** park: the call a stackful suspension becomes when
 * the host is the thing that suspends.
 *
 * `--stackful-backend=fiber` replaces the wasm `suspend` at a stackful await with
 * a call here. It names the current task slot and the awaited record's
 * `(class, key)` — the host's whole park ABI — then **returns**, and the host's
 * `scheduler::park` is what does not return until the task is woken. The
 * suspension therefore lives in the host, on a fiber, and the guest never sees a
 * suspension instruction; that is what lets the artifact load on an engine with
 * no stack switching (I16, I60).
 *
 * A record with **no producer stamp** (`class_ == 0`) is the one shape that has
 * nothing to name — the same rule `~lib/task-rt`'s `parkState` applies — and the
 * builtin sends those to {@link __parkYield} instead of here, so this function
 * can state its contract without a caveat: it always names a real pair.
 */
export function __parkHost(awaited: TaskRecord): void {
  let id = __currentSlot();
  if (id < 0) return;
  hostPark(<i64>id, awaited.class_, awaited.key);
  // **The line after the suspension is the resume**, and the value is here — not
  // in a continuation that was resumed somewhere else. Same record fields the
  // Promise path's `__taskResume` writes, so `rt.classify` and this agree on
  // what a settled record looks like.
  awaited.payload = hostCompletion(<i64>id);
  awaited.status = 0;
  awaited.done = 1;
}

/**
 * The fiber backend's **keyless** park: suspend this fiber and name nothing.
 *
 * `(class, key) = (0, 0)` is the host's "no producer will ever complete this"
 * shape — the same `class_ == 0` rule `~lib/task-rt`'s `parkState` uses, reached
 * from the other side: it is not a park with a *wrong* key, it is a park on the
 * executor's own continuation. Two callers, both of which have nothing else to
 * say:
 *
 * - the `drive` path (`__suspendAwait`), where a task waits on another **guest**
 *   task and the waiter's slot is queued by `settle` in this store;
 * - a policy `await` whose task carries no producer record.
 *
 * A keyless park is the one the host cannot complete on its own, so a task that
 * makes one and is never resumed is exactly what the executor's strand refusal
 * exists to name (DL25). Returning instead of parking would resume the task with
 * a value that does not exist yet — the I70 defect this backend is for.
 */
/**
 * **Run the task at `slot` on this stack** — the fiber backend's `__resumeTask`
 * (DL40).
 *
 * A slot reaching a ready queue is a task with work to do. The continuation
 * backend resumes the continuation installed at that slot; a fiber build has no
 * table, but it has the task object, and `drive()` on this backend runs the body
 * inline (DL38). So the slot keeps its meaning — "run what is here" — while the
 * mechanism behind it becomes an ordinary call.
 *
 * A slot with no task is a no-op, not a trap: the queue is guest bookkeeping and
 * a stale index is a lost wake, which the executor's strand refusal reports by
 * name rather than this function aborting the store.
 */
export function __driveSlot(slot: i32): void {
  let taskOrNull = __taskAt(slot);
  if (taskOrNull) changetype<TaskBase>(taskOrNull).drive();
}

export function __parkYield(): void {
  let id = __currentSlot();
  if (id < 0) return;
  hostPark(<i64>id, 0, 0);
}

/**
 * The fiber backend's suspension for a policy `await`: park on the awaited
 * task's producer pair when it has one, and on nothing when it does not.
 *
 * **One function, so the rule lives in one place.** A record with a producer
 * stamp (`class_ != 0`) names a `(class, key)` the host can be woken by; anything
 * else — no record, or a record with no stamp — is a park nothing external will
 * complete, which is `__parkYield`'s shape. A `class_ == 0` record still parks
 * (keyless) rather than returning: returning would resume the task with a value
 * that has not arrived yet, which is the I70 defect in its original form.
 *
 * **A resumed keyed park settles the handle**, because the value arrived with the
 * wake: `__parkHost` puts it on the record, and `__settleFromRecord` moves it onto
 * the task object the awaited expression reads. Without that second step the
 * suspension would work and the value would still read 0 — which is exactly what
 * the round's first probe measured before this line existed.
 */
export function __parkAwait(task: TaskBase | null): void {
  let record = task ? task.__parkRecord() : null;
  if (task && record) {
    let stamp = record.class_;
    if (stamp != 0) {
      __parkHost(record);
      // **Only the keyed path settles here.** A keyed park was resumed by the
      // host with a value, so the handle now has one; a keyless park has no
      // completion to copy, and its own executor settles it the usual way.
      task.__settleFromRecord(record);
      return;
    }
  }
  __parkYield();
}

/**
 * `await t` on a shell'd program, for a task whose result comes from **outside**.
 *
 * `__inlineAwait` is `t.drive()`, and that is right for a task the lowering built: its
 * `drive` **is** its body, so running it inline is the whole job. A *handle* — the thing
 * `rt.frame()`, `rt.job(id)` and `rt.ai…` hand back — is a bare `Task<T>` carrying a
 * stamped record and no body at all, so its `drive()` is empty and `await` on it returns
 * the field's default with nothing having happened.
 *
 * Measured (DL55), on the fiber backend, with `TENSION_ITERATIONS=1`:
 *
 *   probe: park     frame=0 resumes=0
 *   probe: resume   frame=0 resumes=1     ← same host iteration; no park occurred
 *   ...
 *   iteration=1                            ← the whole program, one pass
 *
 * and the artifact imported no `scheduler::park` at all. That is the "await behaves like
 * a yield, not like awaiting" report, in numbers: the guest looped, the host never saw a
 * park, and `rt.frame()`'s payload was never delivered.
 *
 * So the choice is made where the fact lives — on the object, at runtime. Both shapes have
 * the same **declared** type (`Task<i32>`), so the compiler cannot tell them apart; only
 * `__parkRecord()` can, because the lowering's tasks have no record and a handle has one.
 */
export function __awaitShellTask(task: TaskBase): void {
  let record = task.__parkRecord();
  if (record != null && record.class_ != 0) {
    __parkAwait(task);
    return;
  }
  task.drive();
}

/**
 * The continuation backend's park on a **producer record**: register it with the
 * host, then suspend (DL43, I99).
 *
 * **Why this is not `__parkAwait`.** The fiber backend parks a fiber, so
 * `scheduler::park` does not return until the completion is in hand and
 * `__parkAwait` reads it from `scheduler::completion` on the next line. The
 * continuation backend suspends *in wasm*: `scheduler::park` records the park and
 * returns, the `suspend` stores the continuation at this task's slot, and the
 * shell's ready ring is what resumes it later.
 *
 * So the two facts a resume needs are split: the host keys on `(class, key)` and
 * needs the slot it should queue, and the store needs the record to settle. This
 * function supplies both before the suspension — the `(class, key)` through the
 * existing `scheduler::park`, and the slot plus the record through
 * `__registerRemotePark`, which is what `__taskWake` reads when the host hands the
 * completion back.
 *
 * **No new import.** `scheduler::park` is already in this build's import list; the
 * wake is the same `__taskWake` the plain backend uses.
 */
/**
 * A park this shell is holding, in the shape the host's wake reaches (DL43, I99).
 *
 * The record is settled before the continuation resumes, and `task` is the handle
 * whose `value` the awaited expression reads — `__settleFromRecord` is what moves one
 * to the other, exactly as the fiber backend does from `scheduler::completion`.
 */
class RemotePark {
  /** The executor whose ready ring owns this slot. */
  exec: i32 = 0;
  /** The record the task parked on. */
  record: TaskRecord | null = null;
  /** The handle the resumed body reads. */
  task: TaskBase | null = null;
}

/**
 * Slots this shell has parked on a host completion, by continuation slot.
 *
 * **Here, not in `~lib/task-rt`.** That module is parsed by every build and an
 * exported function in it is a dead-code-elimination root, so a registry placed there
 * landed 1.3 kB in every guest, `count.wasm` included. `~lib/task-stack` is parsed
 * only by a stackful build, which is the only build that can make such a park.
 */
let remoteParks: Map<i32, RemotePark> | null = null;

/**
 * `__taskWake`'s hook: settle the record for `slot` and queue the continuation.
 *
 * **Queued, never resumed here.** The host makes this call from inside
 * `scheduler::park`, i.e. on the parked task's own stack, so resuming the
 * continuation now would run the task over its own frame. The shell's loop pops the
 * slot once the `suspend` below it has stored the continuation.
 */
function resumeRemotePark(slot: i32, payload: i32): bool {
  let map = remoteParks;
  if (map == null || !map.has(slot)) return false;
  let remote = map.get(slot);
  map.delete(slot);
  let awaited = remote.record;
  if (awaited != null) {
    awaited.payload = payload;
    awaited.status = 0;
    awaited.done = 1;
    let task = remote.task;
    if (task != null) task.__settleFromRecord(awaited);
  }
  unchecked(__wakeSink)(remote.exec, slot);
  return true;
}

/** Installs the hook once, on the first park this store makes. */
let remoteSinkInstalled: bool = false;

export function __parkRemote(task: TaskBase | null): void {
  let id = __currentSlot();
  if (id < 0) return;
  let record = task ? task.__parkRecord() : null;
  if (record == null || record.class_ == 0) {
    // Nothing to name: the keyless park, which no producer will complete. Same
    // rule `__parkAwait` applies on the fiber backend, reached from the other side.
    hostPark(<i64>id, 0, 0);
    return;
  }
  // **Registered before the park**, because the host may hand the completion back
  // from inside the `hostPark` call below — the continuation shell's park seam is
  // the only moment the host holds this store.
  if (!remoteSinkInstalled) {
    __remoteParkSink = resumeRemotePark;
    remoteSinkInstalled = true;
  }
  let map = remoteParks;
  if (map == null) {
    map = new Map<i32, RemotePark>();
    remoteParks = map;
  }
  let entry = new RemotePark();
  entry.exec = selfExecutor;
  entry.record = record;
  entry.task = changetype<TaskBase>(task);
  map.set(id, entry);
  hostPark(<i64>id, record.class_, record.key);
}

/**
 * Suspends the **current** task on something that is not a continuation slot.
 *
 * Declared here rather than beside `__suspendAwait` in `~lib/async-stack`
 * because it is the other half of `__resumeTask`'s payload rule — the `-2` the
 * resume stores back without queueing — and because this file is where a policy
 * already finds `__parkOn`. A builtin, not a literal: see `src/builtins.ts`.
 */
// @ts-ignore: decorator
@builtin
export declare function __suspendParked(task: TaskBase | null): void;

/**
 * The `$starts` index of the spawn entry `start` names, as a compile-time
 * constant in every store (`TaskBase.entry`). Emitted by the transform for a
 * task that may be posted elsewhere.
 */
// @ts-ignore: decorator
@builtin
export declare function __spawnIndexOf(start: () => i32): i32;

/** Registers `task` under its continuation slot, for `__currentTask`. */
export function __bindTask(slot: i32, task: TaskBase): void {
  let table = tasks;
  if (!table) {
    table = new Array<TaskBase | null>();
    tasks = table;
  }
  while (table.length <= slot) table.push(null);
  table[slot] = task;
}

/** The task registered at `slot`, or `null` for `main`/an unbound slot. */
export function __taskAt(slot: i32): TaskBase | null {
  let table = tasks;
  if (!table || slot < 0 || slot >= table.length) return null;
  return table[slot];
}

/** The task whose continuation is running, or `null` for `main`. */
export function __currentTask(): TaskBase | null {
  let table = tasks;
  if (!table) return null;
  let slot = __currentSlot();
  if (slot < 0 || slot >= table.length) return null;
  return table[slot];
}

/**
 * This store's executor id: `0` on main, the id `__workerMain` was given in a
 * worker.
 *
 * A store-local fact, so it lives here rather than being asked of `~lib/thread`
 * (`thread.ts` imports this file, and a cycle would make one's layout depend on
 * the other's initialisation). `~lib/thread` installs it, because only that file
 * knows which instance it is running in.
 */
let selfExecutor: i32 = 0;

/** Installs this store's executor id. Called by `~lib/thread`'s `__workerMain`. */
export function __setSelfExecutor(id: i32): void {
  selfExecutor = id;
}

// ── identity and masks ──────────────────────────────────────────────────────
//
// A mask is a **reference** to a `MaskBase` (`~lib/mask`): bit `i` set =
// executor `i` is allowed, and unconstrained is `null` or a `Mask<T>` with no
// bits set. Nothing here counts bits, so nothing here caps the number of
// executors — `Mask<u32>` and `Mask<u64>` are the std's two instantiations, and
// a program may supply its own representation.
//
// The counters live here, not in `~lib/thread`, because `__parkOn` below must
// reach them and `~lib/thread` imports this file: the other direction would be
// a cycle whose initialisation order decides the layout. `~lib/thread` exports
// the program-facing surface.

/** Admissions refused because the target was not in the mask (this store). */
let maskRefusals: i32 = 0;
/** Parks observed on an executor the current task's mask forbids (this store). */
let maskViolations: i32 = 0;

export function __maskRefusalCount(): i32 {
  return maskRefusals;
}

export function __maskViolationCount(): i32 {
  return maskViolations;
}

/** Records one refused admission (`__spawnOnMasked`). */
export function __noteMaskRefusal(): void {
  ++maskRefusals;
}

/**
 * Parks the **current** task on `task`.
 *
 * Called by the generated `f$Rec#drive` immediately before the `$await`
 * suspend. The waiter records its own slot and **this store's** executor; the
 * awaited task is queued by the executor when the resume reports it
 * (`driveReady` pushes `__resumeTask`'s answer), so parking itself only
 * registers the waiter. The awaited task's `settle` pushes that waiter back
 * onto its own executor.
 *
 * **The executor is the store's id, not the task's `home`.** A served
 * continuation has no task object at all (`__taskAt` answers `null`), and a task
 * created by `f$spawnStart` in a worker carries `home = 0` (the transform emits
 * the default). Routing by `home` therefore pushed the *worker's* slot index
 * into **main's** ready ring, where it named an unrelated continuation —
 * measured as `resuming an invalid continuation` at the end of Gate 4 (e).
 * What a parked continuation always needs is the executor that can resume it,
 * and that is the store it is suspended in.
 */
export function __parkOn(task: TaskBase): void {
  // The task that is about to suspend is the **current** one; `task` is what it
  // parks on. A mask that forbids this store is counted, and then the park
  // proceeds: refusing to park would corrupt the continuation protocol, so the
  // guarantee here is observability, not prevention.
  //
  // **An id the mask cannot name counts nothing.** The mask never forbade this
  // executor — `Mask<T>.allows` has no opinion about an id past its width, and
  // the seam must not turn that silence into a violation: counting it would be
  // a false positive. Admission, which *can* tell the caller no, fails closed
  // on the same id instead (`__spawnOnMasked`). The asymmetry is deliberate;
  // `docs/thread-abi.md` §7.3 states it in both places.
  let current = __currentTask();
  if (current) {
    let mask = current.mask;
    // Truthiness, not `!= null`: under `--wasmGc` a nullable class reference
    // is a GC reference and `ref != null` lowers to an `i32.ne` against
    // `ref.null` (measured: `binary child types must be equal`, a validation
    // error). `if (mask)` is the form that lowers correctly on both ABIs.
    if (mask) {
      let policy = changetype<MaskBase>(mask);
      if (selfExecutor >= 0 && selfExecutor < policy.width) {
        if (!policy.allows(selfExecutor)) ++maskViolations;
      }
    }
  }
  let waiter = new Waiter();
  waiter.exec = selfExecutor;
  waiter.slot = __currentSlot();
  let list = task.waiters;
  if (!list) {
    list = new Array<Waiter>();
    task.waiters = list;
  }
  list.push(waiter);
}

/** The base class of every lowered state machine (§4.7.3). */
