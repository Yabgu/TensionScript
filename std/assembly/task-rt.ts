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

/** §3.2's `payload` offset — the record's integer and `bool` result slot. */
const RECORD_PAYLOAD: usize = 8;
/** §3.2's `f0` offset — `f32` results, and the low half of the 64-bit ones. */
const RECORD_F0: usize = 16;

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
  let byKey = waitingByKey;
  if (byKey == null) return;
  let key = keyOf(familyOf(class_), a);
  if (!byKey.has(key)) return; // not ours: an input or log class riding the same path
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
