/// <reference path="./rt/index.d.ts" />

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
 * The runtime table — not this field — is the record's strong reference: while a
 * task is parked, the table roots its record; a settled record nothing
 * references is ordinary garbage (§3.2). Whether that rooting makes this field a
 * bare handle or a traced reference is a runtime decision (§3.2 says "managed
 * reference to the owning TaskRecord", §2.4 says "a single opaque `usize`
 * field"); this phase pins the *type*, and the field stays one word either way.
 */
@final export class Task<T> {
  /** Opaque handle to the runtime's record for this task. */
  private _record: usize;
}
