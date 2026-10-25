// `@inline struct` at the `@external` boundary — the refusal that **remains**,
// and the record of the one that was lifted.
//
// **Lifted: the flattening.** An `@external` declaration with an `@inline
// struct` parameter used to emit one WASM parameter per field —
// `(param f32 f32)` for a two-field record — which made the record's field
// count, order and types part of the host ABI with nothing recording it
// (`layout_hash` folds arena geometry; the host never sees the record). That
// position is now served by a caller-side temp: the guest materialises the value
// on the static call-temp stack and passes its **address**, so the import is
// `(param i32)` like `@unmanaged` and `@managed` already were. See
// `inline-struct-external-param-temp.ts`.
//
// **Remains: the argument shape.** The temp is filled by copying an SROA
// local's fields. A value has no address, so an expression with no local behind
// it has nothing to copy — including a call that returns the value type. That is
// the same rule the guest-internal parameter path applies, restated for the host
// boundary, and it is refused by name.
//
// The message a reader of the *declaration* sees if the boundary flag is ever
// lost is kept in `compileFunction` (gated on `!signature.externalBoundary`):
// it is the fallback that keeps a future path from silently flattening again.

@inline struct V {
  a: f32;
  b: f32;
}

@external("env", "host_sum")
declare function host_sum(v: V): f32;

function make(n: f32): V {
  let v: V = new V();
  v.a = n;
  v.b = n + 1;
  return v;
}

// A call result is not a local, so there is no SROA shape to copy into the temp.
function fromCall(): f32 {
  return host_sum(make(1));
}

// Nor is a field access, or any other expression with no local behind it.
function fromNew(): f32 {
  return host_sum(new V());
}

export function run(): f32 {
  return fromCall() + fromNew();
}
