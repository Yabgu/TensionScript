// `@inline struct` at an **export** boundary — what is refused now that the
// by-value pointer landed, and the record of the flattening it replaced.
//
// **Lifted: the flattening.** `export function take(v: V)` used to declare
// `(param f32 f32)` — the record's field list as the host ABI, with no
// `layout_hash` movement. It now declares `(param i32)`, the byval pointer, and
// the prologue copies the fields into SROA locals. See
// `inline-struct-export-param-byval.ts`.
//
// **Remains: the argument shape.** A guest that calls the export internally has
// to materialise the temp itself, and the temp is filled by copying an SROA
// local's fields. A value has no address, so an expression with no local behind
// it has nothing to copy — a call result, a literal, a field access. That is the
// same rule the `@external` side applies, because it is the same mechanism.
//
// The scalar export in this file is here so the refusal does not over-reach: a
// signature with no value-type parameter keeps an ordinary shape.

@inline struct V {
  a: f32;
  b: f32;
}

export function take(v: V): f32 {
  return v.a + v.b;
}

export function scalarOnly(x: i32, y: f32): f32 {
  return <f32>x * y;
}

function make(n: f32): V {
  let v: V = new V();
  v.a = n;
  v.b = n + 1;
  return v;
}

// The export is callable from guest code, and there the caller supplies the
// temp — which needs a local to copy from.
function fromCall(): f32 {
  return take(make(1));
}

function fromNew(): f32 {
  return take(new V());
}

export function run(): f32 {
  let v: V = new V();
  v.a = 1;
  v.b = 2;
  return take(v) + scalarOnly(2, 3) + fromCall() + fromNew();
}
