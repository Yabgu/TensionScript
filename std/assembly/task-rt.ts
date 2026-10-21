/// <reference path="./rt/index.d.ts" />

import { TaskRecord } from "./task";

/**
 * The guest async runtime's seam — and, since Phase 4, the machine behind it.
 *
 * `docs/async-await-plan-v2.md` §4.7 is the specification, §3.2 the record
 * layout (`std/assembly/task.ts`), §6 the scheduler, §6.4 the dropped-completion
 * rule. The split it pins: **std carries the machine**, the framework connects
 * it to the host's completion stream. The framework's halves are the record
 * subclass (when a capability wants one), the class→family map for its
 * capabilities, and the two call sites — `onBatch`/`onEvent` decoding a
 * delivered record into `__taskDeliver`, and the frame loop calling
 * `__taskTick` (§6.1-§6.3).
 *
 * Why a *top-level* std file (`~lib/task-rt.ts`) and not a subdirectory module:
 * top-level std files are parsed by every build (`cli/index.js:471-479`), and
 * their exports resolve as bare identifiers from any source through the
 * program's global element index (`resolver.ts:1301` — the same fallback that
 * makes `Task` itself resolvable, `program.ts:559-567`). A subdirectory module
 * is parsed only on demand, and the lowering transform cannot create that
 * demand: an import it injects into an already-parsed source is not queued, and
 * the CLI's second `parseBacklog` drains only what the parser queued
 * (`cli/index.js:703-706`). Measured: an injected import naming an unparsed
 * `~lib/` module does not resolve.
 *
 * ## What is implemented, and what Phase 4a does not yet do
 *
 * Implemented (4a): registration, the settled check, parking (which no longer
 * traps), delivery's payload copy, the ready queue and `__taskTick`, the two
 * startup hooks, and `__taskHasRunnable`.
 *
 * Not yet: **§6.4's dropped-completion rule** (4e), and **the status a failure
 * class derives** (§3.4) — both need the framework's class bindings, which 4b
 * adds. A delivered record's `status` is therefore 0 even for a failure class
 * until then; nothing in 4a delivers, so no program can observe it.
 */

/**
 * The base class of a task's environment — the object that holds a captured
 * binding's single storage (§4.4: "a captured binding's storage *is* the
 * environment").
 *
 * It declares no fields: the fields belong to whatever the closures transform
 * decided the environment looks like (`src/closure/lower.ts`), and std must not
 * pre-empt that. What std fixes is the *type*, so the state struct's `$env`
 * field has a nameable type to point at, and so the shape does not change when
 * closures land. Being a class-typed field, it is traced by the generated
 * visitor, which is what lets the collector follow state → environment for a
 * parked task (§4.4).
 */
export class TaskEnv {}

/** The base class of every lowered state machine (§4.7.3). */
export class TaskState {
  /**
   * The task's own record. Assigned by `__taskRegister`; the
   * definite-assignment assertion is what keeps it non-nullable without a dummy
   * initializer (`common.ts:42-43`).
   */
  record!: TaskRecord;

  /**
   * The function that resumes this task — `f$resume`, assigned by the entry
   * immediately before the synchronous prefix runs (Phase 4 ruling, plan
   * §4.7.3).
   *
   * Without it a parked task has no way back into its own body: the entry calls
   * `f$resume` directly and returns, and nothing else holds a reference to it.
   * The type is the *base* shape `(state: TaskState) => void` because the field
   * is declared once for every state struct; the entry assigns
   * `f$resume` through a `changetype`, which is the same one cast §8.3 already
   * uses for a non-nullable read of a carrier field. A managed function value
   * (every `f$resume` is a top-level synthesized function, so the value is a
   * static `Function<T>` and allocates nothing), traced by the generated
   * visitor like every other reference in §4.4's chain.
   */
  resume!: (state: TaskState) => void;

  /**
   * The task-table slot this suspension holds, or `-1` when it holds none
   * (0.6.0's push path; `-1` for a task that never parked, or one already
   * resumed).
   *
   * A plain `i32` on the state rather than a `Map<TaskState, i32>`: the state
   * already *is* the key, the value is one word, and a map would pull the whole
   * `Map` machinery into every guest that reaches `__taskTick` — measured at
   * +522 bytes of code in a guest that never parks. The field costs four bytes
   * per state struct instead.
   */
  slot: i32 = -1;
}

// --- the machine's state ----------------------------------------------------

/**
 * Creates records: the default allocates the base class, and
 * `__taskBindRecordFactory` replaces it with a capability's subclass (§3.2).
 */
let recordFactory: (() => TaskRecord) | null = null;

/** `class_ → family` (§3.1). Unbound classes are their own family. */
let families: Map<i32, i32> | null = null;

/** `record → the states parked on it`. The rendezvous for a task handle: an
 *  `async function`'s own record is awaited through this map alone, and `wake`
 *  is what resumes it when that task completes (0.7.0). */
let waiters: Map<TaskRecord, Array<TaskState>> | null = null;

/** States a completion has released, drained at the next host entry
 *  (`drainReady`). The guest-side half of the wake, for waiters on a guest
 *  task's own record — the host has no key for those. */
let ready: Array<TaskState> | null = null;

/**
 * §3.2's `payload` offset — the record's integer and `bool` result slot.
 *
 * **Derived from the declaration**, not hand-copied: `TaskRecord`
 * (`./task.ts:41-55`) is the layout, and `offsetof` reports it as a compile-time
 * constant (measured: 8, and 32 for the record's size). A field that moved
 * would move this with it; a literal would not.
 *
 * A constant rather than `record.payload = …` at the use sites because the
 * 64-bit path below is generic: `R` is one of `i64`/`u64`/`f64`, which lands
 * across `f0`/`f1` — two declared `f32` fields — so that store is necessarily a
 * raw 8-byte write at `f0`'s offset. `payload` keeps the same spelling as its
 * sibling for symmetry, not because it needs the offset form.
 */
const RECORD_PAYLOAD: usize = offsetof<TaskRecord>("payload");
/** §3.2's `f0` offset — `f32` results, and the low half of the 64-bit ones. */
const RECORD_F0: usize = offsetof<TaskRecord>("f0");

// ── the push path (the only path, 0.7.0) ────────────────────────────────────
//
// `docs/scheduler-contract.md` §2.1-§2.2 is the specification. What stood beside
// it — `__taskDeliver`, `__taskTick`, `__taskReportDrops`, the early-completion
// buffer and the `waitingByKey` index they fed — is gone: the host publishes,
// matches and wakes, and it attributes drops itself (`0.7.0c`). What remains
// guest-side is the one rendezvous the host cannot own: two guest tasks, one
// awaiting the other.

/** `scheduler::park(task_id, class, key)` — one call per suspension (§2.1).
 *  `void`: a refusal comes back as a completion, never as a return value. */
@external("scheduler", "park")
declare function hostPark(taskId: i64, class_: i32, key: i32): void;

/**
 * One entry of the guest's task table.
 *
 * **One managed field, and that is load-bearing.** `state` is a class-typed
 * reference, so the compiler-generated visitor traces it, exactly as it traces
 * `Task<T>._record` (`task.ts:30-45`). An opaque `usize` would not be traced,
 * and a parked task's state struct — with its environment and its lifted
 * locals — could be collected while the task was still parked. The record and
 * the resume function are read *through* this reference (`state.record`,
 * `state.resume`), so the slot needs no fields of its own.
 */
class TaskSlot {
  state: TaskState | null = null;
  /**
   * The record this task parked on (0.7.0c). `__taskFail` needs it: a refused
   * park or a lost completion resumes the task with a *status*, and the status
   * lives on the awaited record — the one the transform's continuation checks
   * and `rt.classify` reads — not on the task's own result record.
   */
  record: TaskRecord | null = null;
}

/** The table: `task_id` is a slot index (§2.1). Allocated at bind time. */
let slots: Array<TaskSlot> | null = null;
/** Free slot indices, as a stack. Empty means the table is exhausted. */
let freeSlots: Array<i32> | null = null;

/**
 * Binds the task table: the guest allocates it once at startup and the host
 * never allocates on the guest's behalf (§2.1's "the executor maintains a task
 * table keyed by task_id" — in this implementation the executor's table is the
 * guest's, because the continuations live in guest memory).
 *
 * `capacity` is the number of concurrently parked tasks the guest will allow;
 * a park past it is the **scheduler refusal**, `-ENOSPC` (§5.1). Idempotent: a
 * second bind replaces the table, which discards whatever was parked — so the
 * framework calls it once, at startup.
 */
export function __taskBindTable(capacity: i32): void {
  if (capacity <= 0) return;
  const table = new Array<TaskSlot>(capacity);
  const free = new Array<i32>(capacity);
  for (let i = 0; i < capacity; ++i) {
    table[i] = new TaskSlot();
    // Descending, so the free stack hands out index 0 first.
    free[i] = capacity - 1 - i;
  }
  slots = table;
  freeSlots = free;
}

/**
 * The push half of a park: allocate a slot, record the state, tell the host.
 *
 * Called from `__taskPark` **after** the pull-path registration, so a guest
 * that binds no table (or a host with no `scheduler::park`) behaves exactly as
 * it did before this release — the function returns early and the pull path is
 * all there is.
 */
function parkState(state: TaskState, awaited: TaskRecord): void {
  const table = slots;
  if (table == null) return;                   // no table bound: pull path only
  // A record with no producer stamp has no rendezvous to post: a guest task's
  // own record is resolved by the handle, not by a key.
  if (awaited.class_ == 0) return;

  // **The slot is already this task's** (0.7.0d-pre). `__taskRegister` claimed it
  // when the task was created and `__taskComplete*` frees it; a park only records
  // the rendezvous. That is what makes -ENOSPC a creation-time answer: by the
  // time a task can park, its slot exists, so the refusal has an id to fail and
  // no task can strand with nowhere to be woken.
  const id = state.slot;
  if (id < 0) return;                          // registration refused: not runnable
  const slot = table[id];
  slot.state = state;
  slot.record = awaited;
  hostPark(<i64>id, awaited.class_, awaited.key);
}

/**
 * `__taskFail(idsPtr, statusesPtr, count)` — the host names tasks to resume
 * with a status and no payload (§4.4's lost completion, §5.1's refused park).
 *
 * `idsPtr` points at `count` packed `u64` task ids; `statusesPtr` at `count`
 * packed `i32` statuses (a negative errno each). The status goes on the record
 * the task *awaited*: that is the one the transform's settled check reads and
 * the one `rt.classify` reports, so a lost stream signal returns `-EIO` rather
 * than the `0` a bare wake would look like.
 *
 * This is the mechanism `scheduler::park`'s refusal already described in
 * `scheduler.rs` — "the next `wake(ids)` carries the id" — split out so the
 * host has one call for "resume with a status" and another for "resume with a
 * completion", rather than a wake that sometimes means both.
 *
 * An id whose slot is empty is skipped, exactly as `__taskWake` skips one: a
 * stale id must never resume anything twice.
 */
export function __taskFail(idsPtr: usize, statusesPtr: usize, count: i32): void {
  const table = slots;
  if (table == null || count <= 0) return;
  for (let i = 0; i < count; ++i) {
    const id = <i32>load<u64>(idsPtr + <usize>i * 8);
    if (id < 0 || id >= table.length) continue;
    const slot = table[id];
    const state = slot.state;
    if (state == null) continue;            // already resumed: a stale id
    const record = slot.record;
    // Clear the park, keep the slot: the task is still live and will free its
    // slot when its body returns (0.7.0d-pre). Freeing here would let a second
    // task claim the id while this one is still running, and the host's next
    // wake for that id would resume the wrong task.
    slot.state = null;
    slot.record = null;
    if (record != null) {
      // §3.4: a lost completion is a status, not an exception. The payload
      // stays 0 — nothing was delivered — and the guest reads the capability's
      // table to learn what really happened.
      record.status = <i32>load<i32>(statusesPtr + <usize>i * 4);
      record.done = 1;
    }
    state.resume(state);
  }
  drainReady();
}

/**
 * `__taskResume(idsPtr, classesPtr, payloadsPtr, count)` — resume tasks with the
 * completion that woke them (0.7.0d-pre).
 *
 * `__taskWake` names ids and nothing else, which was enough while the guest's
 * own `__taskDeliver` was still filling records from the ring. Under the push
 * path the host is the only thing that knows what arrived, so the record has to
 * come with the wake: `classesPtr` points at `count` packed `i32` class ids and
 * `payloadsPtr` at `count` packed `i32` payload words, both written by the host.
 *
 * Three parallel arrays rather than one packed record, so a chunk costs no more
 * scratch than the ids already do.
 *
 * An id whose slot is empty is skipped: a stale id must never resume a task
 * twice (§1.2).
 */
export function __taskResume(
  idsPtr: usize,
  classesPtr: usize,
  payloadsPtr: usize,
  count: i32
): void {
  const table = slots;
  if (table == null || count <= 0) return;
  for (let i = 0; i < count; ++i) {
    const id = <i32>load<u64>(idsPtr + <usize>i * 8);
    if (id < 0 || id >= table.length) continue;
    const slot = table[id];
    const state = slot.state;
    if (state == null) continue;            // already resumed: a stale id
    const record = slot.record;
    // Clear the park, keep the slot (0.7.0d-pre).
    slot.state = null;
    slot.record = null;
    if (record != null) {
      record.class_ = <i32>load<i32>(classesPtr + <usize>i * 4);
      record.payload = <i32>load<i32>(payloadsPtr + <usize>i * 4);
      record.status = 0;
      record.done = 1;
    }
    state.resume(state);
  }
  drainReady();
}

/** Release a slot: the task it held has resumed, and the id may be reused. */
function releaseSlot(id: i32): void {
  const table = slots;
  const free = freeSlots;
  if (table == null || free == null) return;
  if (id < 0 || id >= table.length) return;
  table[id].state = null;
  table[id].record = null;
  free.push(id);
}

/** Release whatever slot `state` holds, if it holds one. */
function releaseSlotOf(state: TaskState): void {
  const id = state.slot;
  if (id < 0) return;
  state.slot = -1;
  releaseSlot(id);
}

/**
 * `__taskWake(idsPtr, count)` — the host names the tasks to resume (§2.2).
 *
 * `idsPtr` points at `count` packed little-endian `u64` task ids in guest
 * memory; the host wrote them before the call. Each id is resolved through the
 * table and its continuation invoked **exactly once** (§1.2, §4.1), then the
 * slot is freed so the id can be reused.
 *
 * An id whose slot is empty is skipped, not an error: a stale id can only
 * arrive from a host index that outlived its park (see `scheduler.rs`'s note on
 * overwrite), and waking nothing is the correct behaviour — resuming twice
 * never is.
 */
export function __taskWake(idsPtr: usize, count: i32): void {
  const table = slots;
  if (table == null || count <= 0) return;
  for (let i = 0; i < count; ++i) {
    const id = <i32>load<u64>(idsPtr + <usize>i * 8);
    if (id < 0 || id >= table.length) continue;
    const slot = table[id];
    const state = slot.state;
    if (state == null) continue;            // already resumed: a stale id
    // Clear the park, keep the slot (0.7.0d-pre): the task is live until its
    // body returns, and `__taskComplete*` frees the id then.
    slot.state = null;
    slot.record = null;
    state.resume(state);
  }
  drainReady();
}

/** `(family << 32) | (a & 0xffffffff)`, the correlation key (§3.1). */
function keyOf(family: i32, a: i32): i64 {
  return (<i64>family << 32) | <i64>(<u32>a);
}

/** The family a class belongs to; an unbound class is its own family (§3.1). */
function familyOf(class_: i32): i32 {
  let map = families;
  if (map != null && map.has(class_)) {
    return map.get(class_);
  }
  return class_;
}

/** Creates the task record for `state`, roots it, and answers it. */
export function __taskRegister(state: TaskState): TaskRecord {
  let make = recordFactory;
  let record = make != null ? make() : new TaskRecord();
  state.record = record;

  // **The slot is claimed here, at creation** (0.7.0d-pre): the table's capacity
  // is a bound on *live* tasks, not on parked ones, and the id is the task's
  // handle from creation to completion. §5.1's refusal therefore has a moment
  // where it can be answered: a task that cannot get an id is settled with
  // -ENOSPC before its body runs, and its caller's `await` falls through on the
  // settled record instead of suspending forever.
  const table = slots;
  const free = freeSlots;
  if (table == null || free == null) return record;  // no table bound: pull path
  if (free.length == 0) {
    record.status = -28; // -ENOSPC
    record.done = 1;
    state.slot = -1;
    return record;
  }
  const id = free.pop();
  table[id].state = state;
  table[id].record = null;
  state.slot = id;
  return record;
}

/** Whether this task got a slot — the entry's guard (0.7.0d-pre). A task whose
 *  registration was refused must not run its body: its record is already settled
 *  with the refusal, and the caller's await has already been answered. */
export function __taskRegistered(state: TaskState): bool {
  // "May run", not "has a slot" (0.7.0d-pre). A guest that binds no table is on
  // the pull path: `__taskRegister` is a no-op there and every task runs. Only a
  // *refused* registration — a table is bound and no slot was free — is false.
  return state.slot >= 0 || slots == null;
}

/** Frees a task's slot when its body returns. Idempotent. */
function finishTask(state: TaskState): void {
  const id = state.slot;
  if (id < 0) return;
  state.slot = -1;
  releaseSlot(id);
}

/**
 * Whether `record`'s task is already settled — §1.2 rule 4's check, so a
 * settled `await` returns immediately and does not suspend.
 *
 * `done`, not `status`: §3.2 defines `done` as the settled word (0 = parked,
 * 1 = settled) and `status` as the outcome (0 = success, otherwise the errno).
 * Reading `status` would make every *successful* completion look unsettled.
 */
export function __taskSettled(record: TaskRecord): bool {
  return record.done != 0;
}

/**
 * Parks `state` on `awaited` until the runtime delivers a completion for it
 * (§3.1, §6.5). Never traps: a task that parks and is never delivered stays
 * parked, which is exactly what the machine must do when no producer exists
 * yet.
 *
 * Called at every suspension, *after* `state.resumePoint` has been set, so a
 * delivery that arrives before the park would still find a valid resume point.
 */
export function __taskPark(state: TaskState, awaited: TaskRecord): void {
  // The push half is the whole park (0.7.0). `parkState` records the state on
  // the slot the task has held since creation and tells the host, which owns the
  // rendezvous. A record with no producer stamp (`class_ == 0`) is not the host's
  // business — its rendezvous is the handle — so `parkState` returns early and
  // `wake` resumes it when the owning task completes.
  //
  // What the retirement removed: the guest-side early-completion buffer and the
  // `waitingByKey` registration that fed `__taskDeliver`/`__taskTick`. Early
  // completions are the host's now (`scheduler::RecentCompletions`), delivered
  // through `__taskResume`; the pull delivery they existed for is gone.
  let byRecord = waiters;
  if (byRecord == null) {
    byRecord = new Map();
    waiters = byRecord;
  }
  let list: Array<TaskState> | null = null;
  if (byRecord.has(awaited)) list = byRecord.get(awaited);
  if (list == null) {
    list = new Array<TaskState>();
    byRecord.set(awaited, list);
  }
  list.push(state);
  parkState(state, awaited);
}

/**
 * Move the states parked on `record` to the ready list.
 *
 * This is the one rendezvous the host cannot own: `record` is a **guest task's
 * own record** (class 0), so there is no producer key to match and the host was
 * never told. The list is cleared so a second completion for the same record (a
 * re-used slot) does not wake the same task twice.
 *
 * Since 0.7.0 there is no `slot >= 0` filter here. That guard read "the host
 * owns this one", which was true when a slot was allocated at park; pre-park
 * registration gives every task a slot at creation, so the filter dropped every
 * waiter and a task awaiting a *suspending guest task* was resumed by nobody —
 * measured as `guest-chain` hanging.
 */
function wake(record: TaskRecord): void {
  let byRecord = waiters;
  if (byRecord == null) return;
  let list: Array<TaskState> | null = null;
  if (byRecord.has(record)) list = byRecord.get(record);
  if (list != null && list.length != 0) {
    let queue = ready;
    if (queue == null) {
      queue = new Array<TaskState>();
      ready = queue;
    }
    for (let i = 0, k = list.length; i < k; ++i) queue.push(list[i]);
    list.length = 0;
  }
}

/**
 * Resume the states queued by `wake` — at the executor's entry, never from
 * inside a completing task's own body.
 *
 * Under the pull path `__taskTick` drained this from the guest's frame loop; a
 * host-driven guest never ticks, so the drain moved to the host's own entry
 * points — `__taskWake`, `__taskResume` and `__taskFail` all end here. That keeps
 * every resume at the top of a host call, which is the property the list existed
 * for.
 *
 * Loops until empty: resuming one state can complete another task, whose own
 * waiters are then queued. Each entry is resumed once and the list is emptied
 * before the first resume, so this terminates.
 */
function drainReady(): void {
  let guard: i32 = 0;
  let pending = ready;
  while (pending != null && pending.length != 0 && guard < 1024) {
    let queue = pending;
    ready = null;
    for (let i = 0, k = queue.length; i < k; ++i) {
      let state = queue[i];
      state.resume(state);
    }
    pending = ready;
    guard += 1;
  }
}

/**
 * The zero of `T`, for the state struct's lifted-local initializers.
 *
 * `changetype<T>(0)` is the only spelling the lowering can emit without knowing
 * whether `T` is a float, an integer or a reference — and it does not compile
 * for a float (measured: AS202, an i32 literal changed to f64). The branches
 * here are compile-time constants per instantiation, so exactly one line of
 * each is emitted.
 */
export function __asyncZero<T>(): T {
  if (isFloat<T>()) return <T>0.0;
  if (isInteger<T>()) return <T>0;
  return changetype<T>(0);
}

/**
 * Completes a task from inside the guest: `done`, `status = 0`, and the states
 * parked on its record are queued for resume (§4.7.3, Phase 4b).
 *
 * The value half is {@link __taskCompleteResult}; this is what a `void` body's
 * terminal calls. Split because `T` has to be named at the call site.
 */
export function __taskComplete(state: TaskState): void {
  let record = state.record;
  record.status = 0;
  record.done = 1;
  finishTask(state);
  wake(record);
}

/**
 * Completes a task with a value: stores it into the record at §3.2's offset for
 * `R`, then {@link __taskComplete}.
 *
 * The offset mapping is codegen's read, mirrored exactly (`compiler.ts:8025-8027`):
 * `f32` and the 64-bit kinds live at `f0` (16), everything narrower at `payload`
 * (8). It is decided by `sizeof`/`isFloat` rather than by a name here, so a
 * type alias resolves the same way it does at the read — the reason this is
 * generic rather than a store the transform emits itself.
 */
export function __taskCompleteResult<R>(state: TaskState, value: R): void {
  let record = state.record;
  let base = changetype<usize>(record);
  if (sizeof<R>() == 4 && isFloat<R>()) {
    store<f32>(base + RECORD_F0, <f32>value);
  } else if (sizeof<R>() > 4) {
    store<R>(base + RECORD_F0, value);
  } else {
    store<R>(base + RECORD_PAYLOAD, value);
  }
  __taskComplete(state);
}

/** Whether any task is ready to resume — the frame loop's `wait(0)` test (§6.3). */
export function __taskHasRunnable(): bool {
  let queue = ready;
  return queue != null && queue.length != 0;
}

/** The framework's startup hook: the record subclass `__taskRegister` allocates. */
export function __taskBindRecordFactory(factory: () => TaskRecord): void {
  recordFactory = factory;
}

/**
 * The framework's startup hook: which completion classes resolve one await
 * (§3.1). `JOB_DONE`/`JOB_FAILED` are one family; an unbound class is its own.
 */
export function __taskBindFamily(class_: i32, family: i32): void {
  let map = families;
  if (map == null) {
    map = new Map();
    families = map;
  }
  map.set(class_, family);
}
