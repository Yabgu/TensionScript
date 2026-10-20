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

/**
 * `(family, producer id) → the record awaiting it` (§6.5). Written by
 * `__taskPark` when the awaited record carries a producer's stamp, and read by
 * `__taskDeliver` — which is the only way a delivered `(class, a)` can find its
 * task.
 */
let waitingByKey: Map<i64, TaskRecord> | null = null;

/** `record → the states parked on it`. The general rendezvous: a task handle
 *  (an `async function`'s own record) is awaited through this map alone. */
let waiters: Map<TaskRecord, Array<TaskState>> | null = null;

/** The ready queue: states whose record settled, in delivery order (§6.5). */
let ready: Array<TaskState> | null = null;

/**
 * One completion that arrived before any task parked on its key (§4b of the
 * scope, 4e-1). A *managed* class with primitive fields, so the map's own
 * generated visitor traces it — the buffer is the entry's only root.
 *
 * Five words, because `__taskDeliver` receives five: a buffered entry must
 * reproduce the immediate path exactly when a later park claims it.
 */
class BufferedCompletion {
  class_: i32 = 0;
  payload: i32 = 0;
  f0: f32 = 0;
  f1: f32 = 0;
}

/**
 * `(family, key) → a completion nobody has claimed yet`. Delivery order is
 * `Map` insertion order, which is what makes eviction oldest-first.
 *
 * **The boundary, stated:** at most {@link BUFFER_LIMIT} entries. When a new
 * delivery arrives at a full buffer the oldest is evicted silently (counted in
 * `__taskBufferedEvictions`) and the new one is stored (counted in
 * `__taskBufferedOverflows`). A delivery is never refused and never aborts: a
 * guest that has stopped awaiting would otherwise turn a slow job into a hang,
 * which is the failure this buffer exists to remove. 256 is two orders of
 * magnitude above the live-job ceiling every capability in the tree has, so
 * overflow means "the guest is not awaiting", and dropping the oldest is the
 * right guess about which future will never come.
 */
let buffered: Map<i64, BufferedCompletion> | null = null;
/** The buffer's ceiling. See `buffered`. */
const BUFFER_LIMIT: i32 = 256;
/** Deliveries that found a full buffer (each evicted one old entry). */
let bufferedOverflows: i32 = 0;
/** Entries evicted to make room for a newer delivery. */
let bufferedEvictions: i32 = 0;

/** §3.2's `payload` offset — the record's integer and `bool` result slot. */
const RECORD_PAYLOAD: usize = 8;
/** §3.2's `f0` offset — `f32` results, and the low half of the 64-bit ones. */
const RECORD_F0: usize = 16;

// ── the push path (0.6.0, additive) ─────────────────────────────────────────
//
// `docs/scheduler-contract.md` §2.1-§2.2 is the specification. This half of it
// is **additive**: `__taskPark` keeps its `waitingByKey` registration, so the
// pull path (`__taskDeliver` → `__taskTick`) still delivers everything — which
// is what lets std 0.6.0 ship before the host that calls `__taskWake` exists.
// Retiring the pull path is 0.7.0d's decision, made against that host.

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
  const free = freeSlots;
  if (table == null || free == null) return;   // no table bound: pull path only
  // A record with no producer stamp has no rendezvous to post: a guest task's
  // own record is resolved by the handle, not by a key. The pull path keeps it.
  if (awaited.class_ == 0) return;

  let id: i32 = 0;
  if (free.length == 0) {
    // §5.1's scheduler refusal: settle the task rather than park it. The guest
    // observes it exactly like any other status — `record.status` — and the
    // pull path's registration above is not undone, so an older host still
    // delivers. A refusal must never leave the task parked with nothing coming.
    awaited.status = -28; // -ENOSPC
    awaited.done = 1;
    let queue = ready;
    if (queue == null) {
      queue = new Array<TaskState>();
      ready = queue;
    }
    queue.push(state);
    return;
  }

  id = free.pop();
  table[id].state = state;
  table[id].record = awaited;
  state.slot = id;
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
    // Free before resuming, as `__taskWake` does: a continuation that parks
    // again reuses the id and the host sees a fresh park (§4.9).
    releaseSlot(id);
    state.slot = -1;
    if (record != null) {
      // §3.4: a lost completion is a status, not an exception. The payload
      // stays 0 — nothing was delivered — and the guest reads the capability's
      // table to learn what really happened.
      record.status = <i32>load<i32>(statusesPtr + <usize>i * 4);
      record.done = 1;
    }
    state.resume(state);
  }
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
    // Free before resuming, so a task that parks again in its continuation can
    // reuse the id — the host sees a fresh park for it (§4.9 counts parks, not
    // tasks).
    releaseSlot(id);
    state.slot = -1;
    state.resume(state);
  }
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
  return record;
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
  // §4b: the completion may already be here — delivered before this park ran.
  // Claiming it is what keeps the task from waiting forever: fill the record,
  // mark it settled, and queue the state, so the transform's
  // `if (!__taskSettled) { park; return }` sees a settled record on its *next*
  // check — actually, on the *same* run: `__taskSettled` was checked before
  // this call, which is why the state is queued here rather than left parked.
  if (awaited.class_ != 0) {
    let buffer = buffered;
    let key = keyOf(familyOf(awaited.class_), awaited.key);
    if (buffer != null && buffer.has(key)) {
      let entry = buffer.get(key);
      awaited.class_ = entry.class_;
      awaited.payload = entry.payload;
      awaited.f0 = entry.f0;
      awaited.f1 = entry.f1;
      awaited.status = 0;
      awaited.done = 1;
      buffer.delete(key);
      // No `waitingByKey` registration: this task is not waiting any more.
      let queue = ready;
      if (queue == null) {
        queue = new Array<TaskState>();
        ready = queue;
      }
      queue.push(state);
      return;
    }
  }
  let byRecord = waiters;
  if (byRecord == null) {
    byRecord = new Map();
    waiters = byRecord;
  }
  // `Map#get` aborts for a missing key when the value type is non-nullable
  // (measured: "Key does not exist"), so presence is asked first.
  let list: Array<TaskState> | null = null;
  if (byRecord.has(awaited)) list = byRecord.get(awaited);
  if (list == null) {
    list = new Array<TaskState>();
    byRecord.set(awaited, list);
  }
  list.push(state);
  // A record that carries a producer's stamp (a class and a key, set by the
  // handle that created it — `rt.job(id)` in the framework, 4b) can be found
  // from a delivered `(class, a)`. A guest task's own record has neither until
  // it is delivered, and needs no entry: the handle *is* the rendezvous.
  if (awaited.class_ != 0) {
    let byKey = waitingByKey;
    if (byKey == null) {
      byKey = new Map();
      waitingByKey = byKey;
    }
    byKey.set(keyOf(familyOf(awaited.class_), awaited.key), awaited);
  }
  // The push half (0.6.0). Additive: the registration above is what delivers
  // until the host calls `__taskWake`.
  parkState(state, awaited);
}

/**
 * Copies one delivered completion record (§3.2) into its task's record, marks
 * the task ready, and wakes the states parked on it.
 *
 * Called by the framework's `onBatch`/`onEvent` dispatchers, which decode the
 * 32-byte record out of the arena and pass its words through verbatim (§6.1,
 * §6.2). The runtime never mints an id: `a` is the producer's submit-time id
 * (§3.1).
 *
 * **The copy is immediate, and that is a correctness rule** (§6.5, review 8.3):
 * the sub-ring is transient — compaction slides records down and rebases the
 * guest's tail (`arena.rs:645-655`) — so reading `a`/`b`/`f0`/`f1` at resume
 * time would read a slot that may hold a different event.
 */
export function __taskDeliver(class_: i32, a: i32, b: i32, f0: i32, f1: i32): void {
  let family = familyOf(class_);
  let key = keyOf(family, a);
  let byKey = waitingByKey;
  if (byKey == null || !byKey.has(key)) {
    // Nobody is waiting *yet*: buffer it, so a park that happens later finds
    // the completion instead of waiting for one that already arrived (§4b).
    // Only stamped records take part — a task's own record needs no key.
    if (class_ != 0) bufferCompletion(class_, key, b, f0, f1);
    return;
  }
  let record = byKey.get(key);
  record.class_ = class_;
  record.payload = b;
  record.f0 = reinterpret<f32>(f0);
  record.f1 = reinterpret<f32>(f1);
  // §3.4's failure classes and their errno belong to the dispatcher's binding
  // (4b): std does not know the arena's class ids. Until that binding exists,
  // `status` stays 0 — and nothing delivers in 4a, so nothing observes it.
  record.status = 0;
  record.done = 1;
  wake(record);
}

/** Stores one unclaimed completion, evicting the oldest if the buffer is full. */
function bufferCompletion(class_: i32, key: i64, b: i32, f0: i32, f1: i32): void {
  let buffer = buffered;
  if (buffer == null) {
    buffer = new Map();
    buffered = buffer;
  }
  if (buffer.size >= BUFFER_LIMIT) {
    // Oldest-first: `Map` iterates in insertion order.
    let oldest = buffer.keys()[0];
    buffer.delete(oldest);
    ++bufferedEvictions;
    ++bufferedOverflows;
  }
  let entry = new BufferedCompletion();
  entry.class_ = class_;
  entry.payload = b;
  entry.f0 = reinterpret<f32>(f0);
  entry.f1 = reinterpret<f32>(f1);
  buffer.set(key, entry);
}

/**
 * §6.4's dropped-completion rule, guest side: the framework measured `count`
 * completions lost for `family` and hands the delta here; this wakes up to
 * `count` tasks parked on that family with `status = -EIO` ("completion
 * lost"), oldest-first.
 *
 * **Who computes what, and why.** The drop counters live in the arena's wire
 * types (`TableHeader.dropped`, per class), which are framework knowledge — std
 * must not learn the arena's layout (§4.7's D9 split). So the framework reads
 * the counters and calls this; std owns the wake policy and the status.
 *
 * **Attribution is per family, not per task** (§6.4's Phase 4 ruling): a drop is
 * counted per class, never per record, so the runtime cannot say *which* job was
 * lost. It wakes the oldest parked tasks in the family, up to the delta, and the
 * guest recovers through the capability's own table — the region is the truth.
 */
export function __taskReportDrops(family: i32, count: i32): void {
  if (count <= 0) return;
  let woken: i32 = 0;
  // Oldest-first: `waitingByKey` iterates in insertion order, and a park
  // inserted its entry when it happened.
  let byKey = waitingByKey;
  if (byKey == null) return;
  let keys = byKey.keys();
  for (let i = 0, k = keys.length; i < k && woken < count; ++i) {
    let key = keys[i];
    if (<i32>(key >> 32) != family) continue;
    let record = byKey.get(key);
    byKey.delete(key);
    // §3.4: a lost completion is a status, not an exception. The payload stays
    // 0 — nothing was delivered — and the guest reads the capability's table
    // to learn what really happened.
    record.status = -5; // -EIO
    record.done = 1;
    wake(record);
    ++woken;
  }
}

/** Deliveries that arrived at a full buffer (each evicted one older entry). */
export function __taskBufferedOverflows(): i32 {
  return bufferedOverflows;
}

/** Buffered entries evicted to make room for a newer delivery. */
export function __taskBufferedEvictions(): i32 {
  return bufferedEvictions;
}

/**
 * Moves the states parked on `record` to the ready queue, in the order they
 * parked. The list is cleared so a second completion for the same record (a
 * re-used slot) does not wake the same task twice.
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
 * Resumes the ready tasks, in delivery order — one resume per task per tick
 * (§6.5). Called from the guest-owned frame loop (§6.3), after
 * `RuntimeSession.wait(...)` returns and never from inside a callback.
 *
 * Entries present when the tick starts are the ones that run; a task delivered
 * *during* the tick queues for the next one, so a chatty resumed task cannot
 * starve the frame.
 */
export function __taskTick(): void {
  let queue = ready;
  if (queue == null || queue.length == 0) return;
  // Take the queue: deliveries that happen inside a resume go to a new one.
  ready = null;
  for (let i = 0, k = queue.length; i < k; ++i) {
    let state = queue[i];
    // The pull path resumed this task, so its push-path slot (if any) is done.
    // Without this a guest on the pull path would leak one slot per await and
    // hit -ENOSPC after `capacity` suspensions — measured as the reason the
    // free lives here and not only in `__taskWake`.
    releaseSlotOf(state);
    state.resume(state);
  }
  // §6.4's dropped-completion rule lands here (4e): compare the drop rollup
  // against the last observed value, and wake every task parked on a family
  // whose counter advanced with `status = -EIO`.
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
