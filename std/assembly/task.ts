/// <reference path="./rt/index.d.ts" />

/**
 * The base class of a task's on-heap record.
 *
 * `TaskRecord` names the record's *type* without naming its layout. It declares no
 * fields, because the fields belong to the capability that completes the work
 * (`docs/async-await-plan-v2.md` §3.2: `class_`, `key`, `payload`, `status`, `f0`,
 * `f1`, `tag`, `done`), and std must not depend on the framework. A capability
 * that completes work asynchronously declares its own subclass — the plan's
 * `class JobTaskRecord extends TaskRecord { … }` — so one handle type stays one
 * handle type (§2.4) while the layout lives where the payloads are understood.
 *
 * It exists so that `Task<T>._record` can be a *managed* reference: a class-typed
 * field is traced by the compiler-generated visitor for the owning class (the
 * `fieldType.isManaged` arm of the generated visitor, `builtins.ts:10951-10962`),
 * where a `usize` field would not be. That trace is the bottom half of §4.4's root
 * chain — task table → `TaskRecord` → state struct → environment — and it is what
 * keeps a suspended task's record, state struct and environment alive when the
 * only remaining reference is a handle the guest is holding.
 */
export class TaskRecord {}

/**
 * A handle to an asynchronous operation's result.
 *
 * `Task<T>` is what a call to an `async function f(): T` yields, and what a
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
