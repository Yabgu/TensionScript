// `@inline struct` as an **export parameter** — refused, the mirror of the
// `@external` refusal.
//
// An export's WASM signature comes from the same `signature.paramRefs` a guest
// function uses, so a two-field record was declared as
//
//   (export "take" (func $take (param f32 f32)))
//
// — the record's field count, order and types became part of the host ABI in the
// outgoing direction, exactly as they did on the import side before that was
// refused. `layout_hash` does not move (it folds arena geometry, and this is a
// guest-side declaration the hash never sees), and a host that hands the
// function a struct pointer instead reads garbage rather than failing to link:
// both are `(param i32)`-shaped for a two-field `f32` record only by accident,
// and not for any other shape.
//
// Refused until the by-value pointer parameter exists: one `(param i32)`, with
// the prologue copying the pointer's fields into the SROA locals — the mirror of
// sret's callee write, and the mirror of the caller-side temp the `@external`
// case uses. `inline-struct-export-param-byval.ts` is that shape.
//
// The two pointer kinds are untouched: `@unmanaged` and `@managed` already cross
// as `(param i32)`, and `inline-struct-export-param-shapes.ts` pins it.

@inline struct V {
  a: f32;
  b: f32;
}

// Two value-type parameters and a scalar: the refusal does not depend on
// position, and one diagnostic per declaration is enough.
export function take(v: V): void {}

export function takeTwo(k: i32, v: V, w: V): void {}

// Not refused: a scalar export keeps its own signature.
export function scalarOnly(x: i32, y: f32): f32 {
  return x * y;
}

export function run(): f32 {
  let v: V = new V();
  let w: V = new V();
  take(v);
  takeTwo(1, v, w);
  return scalarOnly(2, 3);
}
