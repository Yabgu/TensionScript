/// <reference path="./rt/index.d.ts" />

/**
 * The base class of a task's on-heap record.
 *
 * The eight fields are `docs/async-await-plan-v2.md` §3.2's layout, verbatim and
 * in order — the byte offsets are the contract codegen's typed read depends on
 * (`src/compiler.ts:8025-8027` reads `payload` at 8 for the integer and `bool`
 * kinds, and `f0`/`f1` at 16 for `f32` and the 64-bit kinds), so the declaration
 * order and the types below are load-bearing:
 *
 * | field | offset | meaning |
 * |---|---|---|
 * | `class_` | 0 | the class the completion arrived as; 0 before delivery |
 * | `key` | 4 | the producer's submit-time id (§3.1) |
 * | `payload` | 8 | the producer's `b`, verbatim |
 * | `status` | 12 | 0, or the capability's errno (§3.4) |
 * | `f0` | 16 | the producer's `f0` |
 * | `f1` | 20 | the producer's `f1` |
 * | `tag` | 24 | the await tag; 0 today |
 * | `done` | 28 | 0 = parked, 1 = settled |
 *
 * **Why std and not the framework** (Phase 4 ruling, plan §3.2): §7.1 gives the
 * task machine to std and §3.2 gives it these offsets; a machine that must read
 * `payload` at 8 cannot be written over a class that declares no fields. A
 * capability that needs more subclasses `TaskRecord` — a subclass's fields start
 * after the base's, so the offsets above are unchanged — and
 * `__taskBindRecordFactory` (`task-rt.ts`) is how `__taskRegister` comes to
 * allocate that subclass.
 *
 * It is a *managed* class so that `Task<T>._record` is a traced reference: a
 * class-typed field is visited by the compiler-generated visitor (the
 * `fieldType.isManaged` arm, `builtins.ts:10951-10962`), where a `usize` would
 * not be. That trace is the bottom half of §4.4's root chain — task table →
 * `TaskRecord` → state struct → environment — and it is what keeps a suspended
 * task's record, state struct and environment alive when the only remaining
 * reference is a handle the guest is holding.
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
 * A handle to an asynchronous operation's result.
 *
 * `Task<T>` is what a call to an `async function f(): T` produces, and what a
 * capability's reader returns for work the host completes later
 * (`docs/async-await-plan-v2.md` §1.2 rule 2 and §3.3). One handle type, one
 * name: the design has no `Promise` and no second `Awaitable<T>` (§2.4).
 *
 * The type argument exists for the type checker. The layout is identical for
 * every `T` — one word — exactly as `Function<T>`'s is (`std/assembly/function.ts`):
 * the runtime's task record holds the value, and `await` reads it back through
 * the record's typed read (§3.2).
 *
 * The runtime table, not this field, is the record's strong reference while a
 * task is parked; a settled record nothing references is ordinary garbage (§3.2).
 * The field is nonetheless a traced managed reference rather than an opaque
 * `usize` (the divergence §2.4's "single opaque `usize` field" left open, resolved
 * in favor of §3.2's "managed reference to the owning `TaskRecord`"): a `usize`
 * field is not traced by the generated visitor, so a handle the guest holds across
 * a suspension would be the *only* path to the record and the collector could not
 * see through it — the record, its state struct and its environment could be
 * collected while the task was still parked, and the resume would be a
 * use-after-free. As a class-typed field it is traced, and the handle alone keeps
 * the chain alive. The layout is unchanged: one word, identical for every `T`.
 *
 * Not `private`: the runtime that creates the record owns the handle's
 * construction, and the lowering reads it from generated code (§4.1's
 * `state.handle`). Nothing else may touch it.
 */
@final export class Task<T> {
  /** Managed reference to the runtime's record for this task. */
  _record!: TaskRecord;
}
