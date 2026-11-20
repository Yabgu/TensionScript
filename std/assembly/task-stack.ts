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

import { TaskBase, Waiter } from "./task";

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
export declare function __suspendParked(): void;

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
