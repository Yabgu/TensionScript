// `@lazy await EXPR` without a declared type: refused (`TS6399`).
//
// The lowering needs to lift the memo cell into the task's state struct, and a
// state field needs a *syntactic* type — the transforms run before resolution, so
// there is nothing to infer from `f()`'s return type. That is the same constraint
// the async lowering already states for an ordinary awaited local: `let v =
// await f();` is refused with "a local without a declared type that crosses an
// await". This file's diagnostic names the `@lazy` spelling of the same rule,
// because the reason is invisible from the source.
//
// The annotated form is lowered — see `lazy-expr-await.ts`.
//
// The refusal degrades the declaration (the `@lazy` wrapper is dropped, the call
// is left in place) so that one mistake prints one diagnostic rather than also
// drawing the async transform's "this async body" refusal.

async function one(): i32 { return 1; }

export async function deferredAwait(): i32 {
  let a = @lazy await one();
  return a;
}
