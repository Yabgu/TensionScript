/// <reference path="./rt/index.d.ts" />

import { TaskRecord } from "./task";

/**
 * The guest async runtime's seam: the symbols the async lowering emits calls to,
 * and the base class every lowered state machine extends.
 *
 * `docs/async-await-plan-v2.md` §4.7 is the specification. The split it pins:
 * **std carries the machine**, the framework connects it to the host's
 * completion stream. The framework's halves are the record subclass (its fields
 * *are* §3.2's layout), the class→family map for its capabilities, and the two
 * call sites — `onBatch`/`onEvent` decoding a delivered record into
 * `__taskDeliver`, and the frame loop calling `__taskTick` (§6.1-§6.3).
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
 * **Every body here traps.** These are the seam's *contract* — the transform
 * emits calls to them today, and the machine that answers them lands in Phase 4
 * (`docs/async-await-plan-v2.md` §11's M2). A trapping body is what keeps that
 * honest: nothing silently no-ops, and a program that reached here before the
 * machine exists would stop rather than pretend.
 */

/** The base class of every lowered state machine (§4.7.3). */
export class TaskState {
  /**
   * The task's own record. The runtime's table holds the state struct, and the
   * record is reached from the state through this field or through the handle's
   * `_record` — the chain §4.4 requires to be traced at every link.
   *
   * Assigned by `__taskRegister`; the definite-assignment assertion is what
   * keeps it non-nullable without a dummy initializer (`common.ts:42-43`).
   */
  record!: TaskRecord;
}

/**
 * Creates the task record for `state`, roots it, and answers it.
 *
 * The runtime assigns `state.record`, puts the state in the task table (the
 * table's element is the *state*, not the record: §3.2's record is `T`-free and
 * fixed-layout with no spare word for a state reference, so the state is what
 * a resume can be dispatched to), and returns the record so the entry can store
 * it in the handle it returns (§4.1 artifact 3).
 */
export function __taskRegister(state: TaskState): TaskRecord {
  return unreachable(); // the machine lands in Phase 4
}

/**
 * Parks `state` on `awaited` until the runtime delivers the completion whose
 * `(class-family, a)` key matches it (§3.1, §6.5).
 *
 * Called at every suspension, *after* `state.resumePoint` has been set, so a
 * delivery that arrives before the park still finds a valid resume point.
 */
export function __taskPark(state: TaskState, awaited: TaskRecord): void {
  unreachable(); // the machine lands in Phase 4
}

/**
 * Whether `record`'s task is already settled — §1.2 rule 4's check, so a
 * settled `await` returns immediately and does not suspend.
 */
export function __taskSettled(record: TaskRecord): bool {
  return unreachable(); // the machine lands in Phase 4
}

/**
 * Copies one delivered completion record (§3.2) into its task's record, marks
 * the task ready, and (re)derives `status` from the class (§3.4).
 *
 * Called by the framework's `onBatch`/`onEvent` dispatchers, which decode the
 * 32-byte record out of the arena and pass its words through verbatim (§6.1,
 * §6.2). The runtime never mints an id: `a` is the producer's submit-time id
 * (§3.1).
 */
export function __taskDeliver(class_: i32, a: i32, b: i32, f0: i32, f1: i32): void {
  unreachable(); // the machine lands in Phase 4
}

/**
 * Resumes the ready tasks, in delivery order, and applies §6.4's dropped-
 * completion rule. Called from the guest-owned frame loop (§6.3) — never from
 * inside a callback, where the session's reentrancy rules refuse a verb anyway
 * (§1.1, §6.5).
 */
export function __taskTick(): void {
  unreachable(); // the machine lands in Phase 4
}

/**
 * The framework's startup hook: how a record subclass — the class whose fields
 * are §3.2's layout — becomes what the runtime allocates per task.
 */
export function __taskBindRecordFactory(factory: () => TaskRecord): void {
  unreachable(); // the machine lands in Phase 4
}

/**
 * The framework's startup hook: which completion classes resolve one await.
 * `JOB_DONE`/`JOB_FAILED` are one family (§3.1); an unbound class is its own.
 */
export function __taskBindFamily(class_: i32, family: i32): void {
  unreachable(); // the machine lands in Phase 4
}
