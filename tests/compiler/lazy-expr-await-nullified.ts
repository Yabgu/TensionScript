// `await @lazy f()`: refused, and told *why* (`TS6402`).
//
// The refusal is unchanged — an `@lazy` here is not a declaration initializer
// root, so the position rule (`TS6397`) already rejected it. What changes is the
// reason the reader is given. `@lazy` defers an evaluation to a *first read*, and
// `await` performs the read immediately: there is no later read left to defer to,
// so the annotation is not misplaced so much as self-cancelling. `TS6397` would
// have said "this is the wrong position", which is true and unhelpful; `TS6402`
// names the contradiction and both ways out of it.
//
// The distinction is by *immediate* parent, and the third function below is the
// control: an `@lazy` nested inside the awaited expression is a different case
// (`await (0 + @lazy f())`), the await does not directly nullify it, and the
// generic position rule is the honest diagnostic there.
//
// The permissive reading — compile eagerly and warn — was considered and not
// taken: it would give `@lazy` "allowed but meaningless" semantics in exactly one
// context, which is the invisible-context shape this project avoids. If that is
// wanted later it is a separate design, not a message.

async function f(): i32 { return 1; }

export async function nullified(): i32 {
  let a: i32 = await @lazy f();
  return a;
}

export async function nullifiedUnannotated(): i32 {
  let b = await @lazy f();
  return b;
}

// Control: the `@lazy` is not the await's immediate operand, so this is the
// generic rule. It is here so the refinement cannot silently widen.
export async function nested(): i32 {
  let c: i32 = await (0 + @lazy f());
  return c;
}
