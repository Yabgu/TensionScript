// `@lazy EXPR` in any position but a declaration initializer: refused (`TS6397`).
//
// The rule is not a grammar rule, because the parser builds the node before it
// knows what will enclose it. It is also not arbitrary: a deferred expression
// needs a *name* to hang the memo cell and the read-site guard on, and the only
// place a name comes from is the declaration being initialized. `g(@lazy f())`
// has no read site to defer to -- there is nothing to memoize *for*.
//
// The accounting is exact rather than best-effort: `Parser#parseLazyExpression`
// is the only site that creates the node, so every `@lazy` spelling is recorded
// at creation, the legal one is struck off by `parseVariableDeclaration`, and
// whatever remains when the file ends is reported here. No expression kind has
// to be enumerated, and no placement can slip through by being a shape the walk
// forgot.
//
// The legal placement is asserted in `lazy-expr-eager.ts`; the shape that a
// *statement* position would produce is in `lazy-expr-statement.ts` (it is
// `TS1206`, because `@` there is a declaration decorator).

function one(): i32 { return 1; }

function takes(v: i32): i32 { return v; }

// 1. as a call argument
export function asArgument(): i32 {
  return takes(@lazy one());
}

// 2. as a return value
export function asReturn(): i32 {
  return @lazy one();
}

// 3. under a binary operator: `@lazy` binds at unary precedence, so this is
//    `(@lazy one()) + 1` and the root of the initializer is the binary
export function underBinary(): i32 {
  let a = @lazy one() + 1;
  return a;
}
