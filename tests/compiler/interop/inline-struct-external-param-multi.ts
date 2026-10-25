// Two `@inline struct` arguments in one `@external` call, plus a scalar between
// them — the per-call mark and the per-argument slices.
//
// One mark covers the whole call: the bump advances by the **sum** of the
// arguments' rounded sizes before any argument is stored, and the single restore
// unwinds them all. Each argument therefore gets its own distinct slice of one
// block, in declaration order. A per-argument mark would need a stack of locals
// to unwind in reverse and would buy nothing — the restore is one operation
// either way.
//
// Bumping by the total *before* the operands are stored is also what makes a
// nested call in the argument stream safe: it allocates above this whole block,
// never between two of its slices.
//
// WASM: `(param i32 i32 i32)` — v's address, the scalar, w's address.

@inline struct V {
  a: f32;
  b: f32;
}

@inline struct W {
  c: i32;
  d: i32;
}

@external("env", "host_two")
declare function host_two(v: V, k: i32, w: W): f32;

export function twoRecords(): f32 {
  let v: V = new V();
  v.a = 1;
  v.b = 2;
  let w: W = new W();
  w.c = 10;
  w.d = 20;
  // (1 + 2) + 5 + (10 + 20) = 38
  return host_two(v, 5, w);
}

// The same two locals through a second call: each call has its own mark, so the
// first call's block is already unwound.
export function twice(): f32 {
  let v: V = new V();
  v.a = 1;
  v.b = 2;
  let w: W = new W();
  w.c = 10;
  w.d = 20;
  return host_two(v, 5, w) + host_two(v, 5, w); // 76
}
