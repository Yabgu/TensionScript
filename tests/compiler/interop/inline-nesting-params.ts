// Deep SROA, Phase C: **nested inline by-value parameters**.
//
// An `@inline struct` parameter whose type nests crosses the ABI as one WASM
// operand per **leaf**, not one per direct field:
//
//   Outer1 { a: u32; inner: Inner{x,y} }  ->  (param i32, f32, f32)
//   Outer3 { a: u32; b: f32 }             ->  (param i32, f32)   unchanged
//   L1 { b: L2{c: L3{x}} }                ->  (param f32)        one leaf
//
// Three walks have to agree on the order — the signature (`leafTypesOf`), the
// caller's operands, and the binder that turns the incoming parameters back
// into a `fieldLocals` tree. They are depth first in declaration order, and
// this fixture pins the result rather than the mechanism: if any walk ordered
// differently, the arithmetic below would be wrong rather than the module
// invalid.
//
// The callees are deliberately **not** exported: an exported inline parameter
// crosses a host boundary as one byval pointer (the host materialises the
// value), which is a different contract. `submit_exported` covers that shape
// separately.

struct Inner {
  x: f32 = 0;
  y: f32 = 0;
}

struct Outer1 {
  a: u32 = 0;
  inner: Inner = {};
}

struct Outer3 {
  a: u32 = 0;
  b: f32 = 0;
}

// Flat: two fields, two operands — the baseline that must not move.
function take_flat(o: Outer3): f32 {
  return f32(o.a) + o.b;
}

export function call_flat(): f32 {
  const x = new Outer3();
  x.a = 7;
  x.b = 1.5;
  return take_flat(x);
}

// Nested: three leaves, three operands.
function take_nested(o: Outer1): f32 {
  return f32(o.a) + o.inner.x + o.inner.y;
}

export function call_nested(): f32 {
  const x = new Outer1();
  x.a = 7;
  x.inner.x = 1.5;
  x.inner.y = 2.5;
  return take_nested(x);
}

// Three levels: one leaf, so one operand — no cliff at depth.
struct L3 { x: f32 = 0; }
struct L2 { c: L3 = {}; }
struct L1 { b: L2 = {}; }

function take_deep(o: L1): f32 {
  return o.b.c.x;
}

export function call_deep(): f32 {
  const x = new L1();
  x.b.c.x = 3.14;
  return take_deep(x);
}

// An **exported** nested parameter takes the host-boundary shape: the host
// materialises the value and passes one pointer, and the prologue copies the
// leaves in. That path needed the same leaf recursion (`emitTempArgumentLeaves`)
// or it emitted a read of local -1.
export function submit_exported(o: Outer1): f32 {
  return f32(o.a) + o.inner.x + o.inner.y;
}
