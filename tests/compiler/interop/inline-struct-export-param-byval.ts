// `@inline struct` as an **export parameter** — the byval pointer, and the
// three-way this closes.
//
//   refuse  (before this phase): the export declared `(param f32 f32)` for a
//           two-field record — the field list *was* the host ABI, with no
//           `layout_hash` movement to record it. The host could not notice; it
//           never sees the record. Refused first, in
//           `inline-struct-export-param-refusals.ts`.
//
//   partial (a pointer read lazily, or a pointer the callee keeps): the body
//           would observe the caller's later mutations, so the parameter would
//           be by *reference* wearing by-value syntax. The assertion below that
//           a mutation does not leak back is what catches it.
//
//   fixed   (this): one `(param i32)`, and the prologue copies each field into
//           its SROA local before the body runs. The body never sees an
//           address; it runs on the same locals a guest call would bind.
//
// This is the mirror of sret: sret writes each field to `(dest + offset)` on
// return; this reads each field from `(ptr + offset)` at entry. Together the
// value crosses the boundary as memory in both directions.
//
// The glue plays the host: it writes the record into guest memory, calls the
// export, mutates the record afterwards, and checks that the second call sees
// the new value while the first call's result is unaffected.

@inline struct V {
  a: f32;
  b: f32;
}

export function sum(v: V): f32 {
  return v.a + v.b;
}

// The body mutates its own copy. A by-reference parameter would write the
// caller's memory; a by-value one writes only the locals.
export function sumAndMutate(v: V): f32 {
  let total = v.a + v.b;
  v.a = 0;
  v.b = 0;
  return total;
}

// Two value-type parameters and a scalar: each gets its own pointer, in
// declaration order, and the scalar keeps its own slot.
export function sumTwo(v: V, k: i32, w: V): f32 {
  return v.a + v.b + <f32>k + w.a + w.b;
}
