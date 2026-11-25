/// <reference path="./rt/index.d.ts" />

import { MaskBase } from "./mask";

/**
 * A **Promise** record — the state-machine backend's storage. The name is
 * historical: as of the Task/Promise split this is not a task.
 *
 * **Backend A's record.** The `await`-lowered (state-machine) backend reads and
 * writes this class at fixed byte offsets (§3.2): `payload` at 8, `f0`/`f1` at
 * 16, `done` at 28. The stackful backend (`--enable stack-switching`) no longer
 * uses it — it has one `TaskBase` object per execution and reads fields — but
 * the offsets are still the contract for Backend A, so the declaration order
 * and types below are unchanged.
 *
 * The class is managed so a handle's `_record` is a traced reference. A
 * capability's record subclasses it; a subclass's fields start after the base's,
 * so the offsets above stay fixed.
 */
export class TaskRecord {
  /** Offset 0: the class the completion arrived as; 0 before delivery. */
  class_: i32 = 0;
  /** Offset 4: the producer's submit-time id (§3.1). */
  key: i32 = 0;
  /** Offset 8: the producer's `b`, verbatim — integer and `bool` results. */
  payload: i32 = 0;
  /** Offset 12: 0, or the capability's errno (§3.4). */
  status: i32 = 0;
  /** Offset 16: the producer's `f0` — `f32` results, and the low half of 64-bit ones. */
  f0: f32 = 0;
  /** Offset 20: the producer's `f1` — the high half of 64-bit results. */
  f1: f32 = 0;
  /** Offset 24: the await tag (§3.1's limitation); 0 today. */
  tag: i32 = 0;
  /** Offset 28: 0 = parked, 1 = settled. */
  done: i32 = 0;
}

/**
 * A parked waiter: the executor that owns it and the continuation slot to
 * resume there.
 *
 * A slot, not an object reference, so the same entry is meaningful to the
 * scheduler regardless of the guest program's class representation, and so a
 * cross-thread wake can carry it (design §3/§4). `exec` is the id of the
 * executor that must resume the waiter — the store it parked in, not the
 * task's declared `home` (`docs/thread-abi.md`; `__parkOn` sets it).
 */
export class Waiter {
  /** The executor that will resume this waiter. */
  exec: i32 = 0;
  /** The waiter's continuation slot in that executor's table. */
  slot: i32 = 0;
}

/**
 * The wake seam: `settle` pushes a waiter's slot onto its executor's ready
 * ring through this.
 *
 * A function, not a direct call, because the executor table lives in
 * `thread.ts` and this file must not import it: `thread.ts` names `TaskBase`,
 * and a cycle between them would make the layout of one depend on the other's
 * initialisation. `__executorInit` installs the sink before anything runs; a
 * `settle` with no executor table (a task that never reaches the loop) wakes
 * nobody, which is the correct no-op — nothing could resume it.
 */
function noopWake(exec: i32, slot: i32): void {}

export let __wakeSink: (exec: i32, slot: i32) => void = noopWake;

/** Installs the wake seam. Called once, by `__executorInit`. */
export function setWakeSink(sink: (exec: i32, slot: i32) => void): void {
  __wakeSink = sink;
}

/**
 * The **stackful** shell's park registry, reached through a function value so no
 * build that does not use it carries its code (DL43, I99).
 *
 * A registry written directly in `~lib/task-rt` — which every build parses, where an
 * exported function is a dead-code-elimination root — put 1.3 kB into *every* guest,
 * including programs that never spawn (measured: `count.wasm` grew 1 336 bytes). The
 * registry therefore lives in `~lib/task-stack`, parsed only by a stackful build, and
 * this is the one hook `__taskWake` needs: `(slot, payload) -> bool`, answering
 * whether the slot was a stackful park (and so was queued).
 *
 * `null` is the honest default: a store with no stackful park has nothing to hand
 * back. Same shape as `__wakeSink` above, for the same reason and with the same
 * measured history.
 *
 * **Assigned, not installed through a setter.** A setter would be one more exported
 * function in this module, and an exported function here is compiled into every
 * guest: the first version of this hook cost 306 bytes per artifact through exactly
 * that. `let` is exported so `~lib/task-stack` can assign it directly, which costs
 * the guests that never assign it nothing beyond a nullable global initialised to
 * `null`.
 */
export let __remoteParkSink: ((id: i32, payload: i32) => bool) | null = null;


/**
 * What a task's `await` does, and what happens the moment the task is created.
 *
 * `docs/policy-and-threads.md` §3. Two moments, two methods, and **no generic
 * methods in the virtual surface**: the compiler allocates the concrete task
 * (`f$Rec`, whose `R` it knows) and hands the policy a `TaskBase`, so the vtable
 * stays monomorphic and the value never crosses it.
 *
 * A task whose `policy` is `null` is on the default policy — inline, on the
 * current executor. **The absence is the default**: there is no singleton
 * instance to allocate, compare against, or shadow, and the hot path costs one
 * null compare.
 */
export abstract class TaskPolicy {
  /**
   * Declared by the class, read by the compiler: every argument captured for a
   * task on this policy crosses a thread boundary and must therefore be
   * addressable rather than a reference into the caller's heap.
   */
  readonly crossesThreads: bool = false;

  /**
   * Called at the call site, once the task object exists and before any body
   * runs. This is where a policy decides **eagerness**: the default does
   * nothing (so `f()` runs no body), while a parallel policy submits here, which
   * is what makes `let t = f() on pool; ...; await t` overlap.
   */
  abstract create(task: TaskBase): void;

  /**
   * Called by `await` when the task is not settled. Must return with it settled
   * (or with `status` set to a failure): the task's own awaiter handles its own
   * await, which is the "generator" seam.
   */
  abstract await(task: TaskBase): void;
}

/**
 * The default policy's `await`: park the current task on `task` and let the
 * executor resume it.
 *
 * `docs/policy-and-threads.md` §3: a null policy *is* this, so the compiler's
 * lowering is `if (!t.settled) (t.policy == null ? __inlineAwait(t) : t.policy.await(t))`.
 * It is `drive()` — the same seam the null arm has always used — named here so
 * the lowering reads as what it means.
 */
export function __inlineAwait(task: TaskBase): void {
  task.drive();
}

/**
 * The default policy, named: create does nothing, await is the inline path.
 *
 * `docs/policy-and-threads.md` §5's first row. It exists so a call site can say
 * `f(x) on inline` and mean exactly what the absence means — useful when a
 * caller wants the default *explicitly*, or when one call site in a pool-using
 * file must not be pooled. The absent form stays cheaper (one null compare), so
 * this is a convenience, not the implementation of the default.
 */
@final class InlinePolicy extends TaskPolicy {
  create(task: TaskBase): void {}
  await(task: TaskBase): void { __inlineAwait(task); }
}

/** The shared default-policy instance, created on first use. */
let inlinePolicyInstance: TaskPolicy | null = null;

/**
 * The default policy as a value — `f(x) on inlinePolicy()` means exactly what
 * `f(x)` means, said out loud (`docs/policy-and-threads.md` §5).
 *
 * **A function, not a `const`, and that is a measured constraint.** Every
 * program parses this file, and a top-level *initializer* — `new` or even
 * `@lazy new` — is emitted into the module's start function whether or not
 * anything reads it. Measured: an await-free async program (A1's shell) grew an
 * `env.abort` import from the allocator and `test:coreloop` failed with exit 1.
 * A function is only compiled when called, so a program that never names the
 * policy pays nothing, and the instance is still one object, shared.
 *
 * (The design's table spells this row `inline`; `inline` itself is the
 * `@inline` decorator's name in the global element index, so a top-level
 * binding of that name is a duplicate identifier — `TS2300`, measured.)
 */
export function inlinePolicy(): TaskPolicy {
  let policy = inlinePolicyInstance;
  if (!policy) {
    policy = new InlinePolicy();
    inlinePolicyInstance = policy;
  }
  return changetype<TaskPolicy>(policy);
}

/**
 * The common part of every task: one object per execution, with the fields the
 * scheduler owns and the single abstract operation that runs it.
 *
 * **This is the Task of the Task/Promise split** — the stackful backend's
 * object, not a state-machine record (`docs/task-model.md`).
 *
 * The stackful lowering declares a subclass per `async function` — a
 * `f$Rec extends Task<R>` — carrying the function's captured parameters as
 * fields and implementing `drive`. There is no second record: the object the
 * entry allocates *is* the task, and the continuation's captured parameters are
 * its fields, reached by field access rather than by literal byte offsets.
 */
export abstract class TaskBase {
  /**
   * The task's continuation slot in the executor's table. `-1` before it is installed.
   */
  slot: i32 = -1;
  /**
   * The executor the spawn entry recorded for this task. `0` is main, which is
   * also the value the transform emits in `f$spawnStart` when it runs elsewhere;
   * **routing does not read this** — a waiter is resumed by the store that
   * parked it (`Waiter.exec`), because a served continuation has no task at all.
   */
  home: i32 = 0;
  /** Whether the task has completed (its result is available). */
  settled: bool = false;
  /** The completion status; 0 on success. */
  status: i32 = 0;
  /** Tasks parked on this one, or `null` when nobody is waiting. */
  waiters: Array<Waiter> | null = null;
  /**
   * The policy this task was created under, or `null` for the default.
   *
   * Readable after the fact by design (`docs/policy-and-threads.md` §2): nothing
   * about where a task runs is hidden from the caller who asked for it.
   */
  policy: TaskPolicy | null = null;
  /**
   * The `$starts` index of this task's synthesized `f$spawnStart`, or `-1` when
   * it has none (a parameterized async function, whose spawn entry the
   * transform does not synthesize yet).
   *
   * A **module fact, not a store fact**: every instance of the module has the
   * same `$starts` layout, so an index written here in one store names the same
   * function in another, which is what lets a policy post a task it did not
   * create. The value comes from `__spawnIndexOf` (`src/builtins.ts`), a
   * compile-time constant per function.
   *
   * Declared **last** so the fields before it keep their offsets: the class is
   * not `TaskRecord` (whose offsets are the Backend A contract), but a moving
   * layout is churn in every async fixture for no reason.
   */
  entry: i32 = -1;
  /**
   * The executors this task may run on, or `null` for unconstrained (the
   * default, and the reason the field costs a program nothing). A policy's
   * `create` sets it — as a **reference**, so one mask object serves every
   * task the policy creates; the transform does not touch it.
   *
   * `null` and a zero-bits `Mask<T>` both mean unconstrained. Nothing here
   * knows the width: `MaskBase` answers `allows` and `width`, and the two seams
   * that ask (admission in `~lib/thread`, the park in `~lib/task-stack`) are
   * what give the mask its meaning. `~lib/mask` imports nothing, so this
   * import cannot cycle.
   *
   * Declared after `entry`, so no earlier field's offset moves. On wasm32 a
   * reference is four bytes, exactly what the `i32` it replaces cost at the
   * time, so `offsetof("mask")` did not move — `tests/rt/gate4.js` (j)
   * observes it. The serve context (`serveArg`/`serveKey`/`serveOrigin`) is
   * appended **after** this field for the same reason.
   */
  mask: MaskBase | null = null;
  /**
   * The request words this task was created by, or the zeroes an unserved task
   * keeps: `__serveArg`'s one `i32`, `__serveKey`'s origin-defined key, and
   * `__serveOrigin`'s poster.
   *
   * **On the task, because the serve and the body have different lifetimes.**
   * `__drainInbox` serves an entire queue before any body runs (`__serveOne`
   * resumes `f$spawnStart`, which parks this slot on the new task and returns),
   * so a word copied into module state at dequeue time names the *last* request
   * by the time the first body reads it. `__serveOne` writes these three onto
   * the task it just created, and the body reads its own at any point — before
   * or after a suspension, nested serves included.
   *
   * Appended after `mask`, so no field declared earlier moves; the record grows
   * by three words and a subclass's own fields shift past them.
   */
  serveArg: i32 = 0;
  serveKey: i32 = 0;
  serveOrigin: i32 = 0;

  /** Runs, or resumes, this task on the current thread. */
  abstract drive(): void;

  /**
   * Marks the task settled and releases every waiter onto its own executor.
   *
   * Called by the task's continuation immediately before it returns, after the
   * value has been written. Waking here — rather than in the executor loop — is
   * what lets a completion on one thread release a waiter on another: the wake
   * is a queue push to the waiter's `exec`, and Gate 3's inbox carries it.
   */
  settle(status: i32): void {
    this.status = status;
    this.settled = true;
    let list = this.waiters;
    let sink = __wakeSink;
    if (list) {
      for (let i = 0, k = list.length; i < k; ++i) {
        let waiter = unchecked(list[i]);
        // **Routed by the waiter's own executor**, never by the one settling:
        // a worker can make main runnable and can never make main run (§9.0).
        unchecked(sink)(waiter.exec, waiter.slot);
      }
      list.length = 0;
    }
  }
  /**
   * The `TaskRecord` this task is a handle for, or `null` when it has none.
   *
   * **A method rather than a field**, because only `Task<T>` carries one and the
   * policies that park take a `TaskBase` (`~lib/thread`'s `RemotePolicy.await`).
   * A field here would move every subclass's layout for one virtual read; this
   * adds a vtable slot and nothing else. The fiber backend's park needs exactly
   * this: its host ABI is `(task_id, class, key)`, and the pair is the record's.
   *
   * A stackful task answers `null` — the stackful lowering never writes a record
   * (`std/assembly/task.ts`'s `Task<T>._record` note) — and `null` is the honest
   * answer rather than a zeroed record: there is no producer and no key.
   */
  __parkRecord(): TaskRecord | null { return null; }

  /**
   * Takes a delivered completion into this handle: `settled`, a status, and — in
   * the subclass that has one — the value.
   *
   * The stackful path's counterpart of Backend A's `rt.classify`: same record,
   * same fields, different reader. The base class has no `value` field to write
   * (`Task<void>` instantiates none), so it settles without one; `Task<T>`
   * overrides this to copy the payload.
   */
  __settleFromRecord(record: TaskRecord): void {
    this.status = record.status;
    this.settled = true;
  }
}

/**
 * A handle to an asynchronous operation's result.
 *
 * For the stackful backend a task is one object: the entry allocates a
 * per-function subclass of this class and returns it, its body's result lands
 * in `value`, and `await t` is `if (!t.settled) t.drive(); return t.value`.
 *
 * **`value` is `T`.** The accessors are monomorphized from the declared field
 * type, so a `Task<P>` read is a `P` read with no cast, offset or runtime
 * check. A type parameter substituted with `void` instantiates no field at all
 * (`Task<void>` has no `value`, no getter and no setter): the resolver omits a
 * field whose type parameter is `void`, so the declaration below costs a
 * `Task<void>` nothing and the body's `void` result has nowhere to be stored.
 * Every other `T` gets the ordinary field and its `get:value`/`set:value`.
 *
 * `_record` remains for Backend A, whose state machine stores its lowered
 * record on the handle. The stackful backend does not create one.
 */
export class Task<T> extends TaskBase {
  /** Backend A's record for this task. Unused by the stackful backend. */
  _record!: TaskRecord;

  drive(): void {}

  /** The record this handle is for — see `TaskBase#__parkRecord`. */
  __parkRecord(): TaskRecord | null { return this._record; }

  /**
   * `this.value = <T>the delivered payload word`.
   *
   * **The scalar shapes, stated rather than assumed.** The record carries
   * `payload` (i32/bool), `f0`/`f1` (f32 and the two halves of a 64-bit value) and
   * `class_`/`key`; this copies the `payload` word, which is the i32-shaped
   * completion the round's probe delivers (`Task<i32>`). A `Task<f32>` or a
   * 64-bit payload would need the `f0`/`f1` rule `rt.classify` implements, and
   * that is not written here: nothing in this round delivers one, and writing a
   * decoder for fields no test exercises is how a wrong decoder ships.
   */
  __settleFromRecord(record: TaskRecord): void {
    this.value = <T>record.payload;
    this.status = record.status;
    this.settled = true;
  }
  /** The stackful backend's result. Valid once `settled` is true. */
  value!: T;

  /**
   * Backend A's handle is never driven; the stackful per-function subclass
   * overrides this. Declared concretely so `Task<T>` stays instantiable for
   * Backend A's tests and user code.
   */
}
