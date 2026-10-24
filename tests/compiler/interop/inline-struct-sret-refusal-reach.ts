// `@inline struct` returns — the **refusal's reach**.
//
// The read path implements exactly two consumers: `f().x` (one field load) and
// `let q: P = f()` (per-field loads into q's SROA locals). Every other use has
// no value to consume, so the pre-work measured what each one does. The gate was
// the silent path: a use that compiles while treating the slot's address as a
// value would be the corruption this phase exists to prevent.
//
// Measured (this fixture pins the four that refuse; the fifth is reported in the
// test body because it is the one that succeeds):
//
//   1. `g(f())`            AS100 — passing an expression as an @inline struct
//                          argument (only a local can be passed).
//   2. `f() + 1`           TS2365 — an @inline struct is not a number.
//   3. `return f()` in an  TS2322 — the function's return type is i32, and a
//      i32-returning        value type is not assignable to it.
//      function
//   4. `a[i] = f()`        AS100 — `Array<P>` is a refused type argument, and
//                          the store reads the value as a whole.
//
//   5. bare `f()`          **compiles**, and is safe: it allocates the slot,
//                          passes its address as the hidden destination, calls,
//                          and unwinds — it never reads the slot as a value.
//                          See `discard()` in `inline-struct-sret.ts`, which
//                          asserts the unwind.
//
// The fallback for (1) and (4) is the whole-value refusal; (2) and (3) are
// stopped by the type checker before codegen. Nothing here reaches the slot's
// address as a value.

@inline struct P {
  x: i32;
  y: i32;
}

function make(n: i32): P {
  let p: P = new P();
  p.x = n;
  p.y = n + 1;
  return p;
}

function take(p: P): i32 {
  return p.x;
}

// 1. passing the result to another function
function passResult(): i32 {
  return take(make(5));
}

// 2. using the result in an arithmetic expression
function inExpression(): i32 {
  return make(5) + 1;
}

// 3. returning the result where the function's return type is not @inline
function returnResult(): i32 {
  return make(5);
}

// 4. storing the result
function storeInArray(): i32 {
  let a: P[] = new Array<P>(2);
  a[0] = make(5);
  return 0;
}

// 4b. storing the result in a field: inline nesting, refused at the field's
// declaration (a class is a heap record; an inline field would need the value's
// bytes inline, which this phase does not lay out).
class Holder {
  field: P = new P();
}

function storeInField(): i32 {
  let h = new Holder();
  h.field = make(5);
  return 0;
}

// 5. discarding the result — the one that compiles, safely
function discardResult(): i32 {
  make(5);
  return 1;
}

export function run(): i32 {
  passResult();
  inExpression();
  returnResult();
  storeInArray();
  storeInField();
  return discardResult();
}
