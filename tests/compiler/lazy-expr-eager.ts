// The one legal placement, and what it does *today*: `@lazy` parses, and the
// expression is evaluated **eagerly**, with `TS6398` saying so.
//
// This file is the foundation's honest state, not the feature. Landed ahead of
// the lowering on purpose: the node, the position rule and the diagnostics are a
// safety layer the lowering then builds on, and shipping them first is what keeps
// a later mistake a diagnostic instead of a compiler assertion (the compiler's
// expression dispatch ends in `assert(false)`; a `LazyExpression` that reached it
// would crash with no message at all -- measured: `AssertionError` at
// `compiler.ts:3889`, exit 2).
//
// Two properties are asserted here, and both must survive the lowering:
//
//   1. `@lazy EXPR` has the type of EXPR. It is a *when*, not a *what* -- so a
//      `let` with no annotation infers from the inner expression, and a typed
//      `let` accepts the inner expression's type unchanged.
//
//   2. The wrapper is transparent to closure analysis. A binding captured
//      anywhere in the function has its storage moved into the environment, and
//      a read of it *inside* a `@lazy` operand must be rewritten too. Measured
//      without the closure transform's `Lazy` arm: this file fails to build with
//      `TS2304: Cannot find name 'x'`.
//
// The calls are counted so the eager reading is visible in the assertion rather
// than assumed: with the lowering, `calls` would stay 0 until the read.

let calls: i32 = 0;

function counted(): i32 {
  calls += 1;
  return 41;
}

export function eager(): i32 {
  let c = @lazy counted();
  // Eager today: the initializer already ran. Under the lowering this assertion
  // becomes `calls == 0` before the read and `calls == 1` after it.
  assert(calls == 1);
  assert(c == 41);
  return c;
}

export function capture(): i32 {
  let x: i32 = 5;
  let read = (): i32 => x;   // captures x
  let a = @lazy x;           // reads the captured binding inside the operand
  return read() + a;
}

export function typed(): i32 {
  let t: i32 = @lazy counted();
  return t;
}

export function main(): i32 {
  assert(eager() == 41);
  assert(capture() == 10);
  assert(typed() == 41);
  return 0;
}
