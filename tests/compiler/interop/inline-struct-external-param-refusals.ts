// `@inline struct` as an **`@external` parameter** — refused, because the
// alternative that shipped was a silent ABI.
//
// `paramRefs` expands a value type into one WASM parameter per field, so an
// import declared with an `@inline struct` parameter used to be emitted as
// `(import "env" "host_use" (func (param f32 f32) (result i32)))` — the record's
// field count, order and types became part of the **host** ABI, and nothing
// recorded it: `layout_hash` folds arena geometry, not guest-side declarations,
// so the hash stayed put. The host could not notice either, because it never
// sees the record, only the flattened scalars.
//
// The fix is not the flattening (undesigned) and not a pointer the host
// invents. It is a caller-side temp: the guest materialises the value on the
// static call-temp stack and passes its address, exactly as the other two
// record kinds already cross. That lands next; until it does, the position is
// refused so no shape compiles on an ABI nobody designed.
//
// The refusal names all three things a diagnostic owes the reader: the shape
// (flattening), why it is wrong (the field list becomes the host ABI), and the
// way out (@unmanaged or @managed, which cross as one borrowed pointer, or pass
// the fields individually).
//
// `inline-struct-external-param-shapes.ts` is the companion: both pointer kinds
// still compile, and both are `(param i32)`.

@inline struct V {
  a: f32;
  b: f32;
}

// Two parameters, to show the refusal does not depend on the position: the
// first one hit is reported, and one diagnostic is enough per declaration.
@external("env", "host_use")
declare function host_use(v: V): i32;

@external("env", "host_use2")
declare function host_use2(k: i32, v: V): i32;

// Not refused: a scalar alongside the value type is untouched.
@external("env", "host_scalar")
declare function host_scalar(x: i32): i32;

export function run(): i32 {
  let v: V = new V();
  v.a = 1;
  v.b = 2;
  let total = host_use(v);
  total += host_use2(7, v);
  total += host_scalar(3);
  return total;
}
