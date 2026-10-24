// `@inline struct` as a **parameter**: passed by value, flattened at the call.
//
// **Three-way, and the partial cell is measured.**
//
//   refuse  (before this commit): a parameter of `@inline struct` type was
//           refused by name (PR #12's `a parameter` refusal). That refusal was
//           right at the time — an `@inline struct` is an `@unmanaged class`
//           underneath, so without flattening it would have compiled as a
//           4-byte *pointer* and the callee's writes would have reached the
//           caller's value.
//
//   partial (flattening that passes the value but shares storage): the callee
//           mutates `p.x` and the caller sees it. `takeThenCheck()` below
//           returns 995 if the callee's write leaks back and 599 if it does
//           not — 599 is the assertion.
//
//   fixed   (this commit): the source parameter becomes **one WASM local per
//           field** in the callee, and the call site expands the argument into
//           one operand per field, in declaration order. The callee's fields are
//           its own.
//
// **The index mapping is the whole change.** Source parameter `i` no longer
// means WASM parameter `i`: for `(p: P{2}, q: i32, r: P{2})` the WASM operands
// are `(p.x, p.y, q, r.x, r.y)`. `Signature#wasmParamCountOf` /
// `wasmParamStartOf` / `wasmParamCount` / `sourceIndexOf` are the only place
// that translation happens — `grep wasmParam` finds every site that consults
// them, and a site computing a range inline is a bug.
//
// **The closure-environment interaction** is here too, because it is the
// silent-failure path: `getNonParameterLocalTypes` computes the body-local
// boundary from the *WASM* parameter count. With the source count it would leave
// the parameter's trailing field locals in the "additional locals" list, and
// `CLOSURE_ENV_IN_LOCAL` would land one slot off — a miscompile with no
// diagnostic. `closureInScope()` asserts a value that depends on both the
// parameter's fields and a closure's environment.

@inline struct Point {
  x: u32;
  y: u32;
}

// --- fixed: the callee's fields are its own --------------------------------
function takeThenCheck(p: Point): u32 {
  p.x = 99;                  // must not reach the caller
  return p.x;
}

export function passByValue(): u32 {
  let a: Point = new Point();
  a.x = 5;
  a.y = 6;
  let r = takeThenCheck(a);  // 99 from inside the callee
  return a.x * 100 + r;      // 5*100 + 99 = 599 independent; 9999 aliased
}

// --- fixed: several parameters, ordering preserved -------------------------
// The WASM operands are (p.x, p.y, q, r.x, r.y): a scalar between two values.
function order(p: Point, q: i32, r: Point): u32 {
  return p.x * 10000 + p.y * 1000 + q * 100 + r.x * 10 + r.y;
}

export function multiParamOrder(): u32 {
  let a: Point = new Point(); a.x = 1; a.y = 2;
  let b: Point = new Point(); b.x = 3; b.y = 4;
  return order(a, 5, b);     // 1 2 5 3 4 -> 12534
}

// --- fixed: a closure in a function with an @inline parameter --------------
// If `numFixed` were the source parameter count, the environment local would
// land one slot early and either value could come back wrong.
function closureInScope(p: Point, n: i32): u32 {
  let doubled = n * 2;              // a body local, after the param's fields
  let f = (): u32 => doubled + n;   // a closure: env in a body-local slot
  return p.x + f();                 // 5 + (14 + 7) = 26
}

export function closureEnvSlot(): u32 {
  let a: Point = new Point();
  a.x = 5;
  a.y = 6;
  return closureInScope(a, 7);
}

// --- the assertions -------------------------------------------------------
assert(passByValue() == 599);
assert(multiParamOrder() == 12534);
assert(closureEnvSlot() == 26);

export function run(): i32 {
  return <i32>(passByValue() + multiParamOrder() + closureEnvSlot());
}
