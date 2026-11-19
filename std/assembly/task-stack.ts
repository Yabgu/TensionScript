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
 * Resumes `table[slot]` with the shell's `$await` handler and answers the
 * awaited slot, or `-1` when the task ran to its own completion.
 *
 * Declared here rather than in `~lib/async` because the executor (`~lib/thread`)
 * is its only caller now, and `~lib/async` imports `~lib/thread` for the loop.
 */
// @ts-ignore: decorator
@builtin
export declare function __resumeTask(slot: i32): i32;

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
 * Parks the **current** task on `task`.
 *
 * Called by the generated `f$Rec#drive` immediately before the `$await`
 * suspend. The waiter records its own slot and executor; the awaited task is
 * queued by the executor when the resume reports it (`driveReady` pushes
 * `__resumeTask`'s answer), so parking itself only registers the waiter. The
 * awaited task's `settle` pushes that waiter back onto its own executor.
 */
export function __parkOn(task: TaskBase): void {
  let waiter = new Waiter();
  let current = __currentTask();
  if (current) waiter.exec = current.home;
  waiter.slot = __currentSlot();
  let list = task.waiters;
  if (!list) {
    list = new Array<Waiter>();
    task.waiters = list;
  }
  list.push(waiter);
}

/** The base class of every lowered state machine (§4.7.3). */
