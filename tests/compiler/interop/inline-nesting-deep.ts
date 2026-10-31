// An `@inline struct` nested **three** levels deep, read through the chain.
//
// Deep SROA, Phase A. The recursion that creates the leaf locals and the walk
// that resolves the receiver are the same tree, so depth is a loop bound rather
// than a special case: `o.b.c.x` is one leaf local, and there are no
// intermediate pointers at any level.

struct L3 {
  x: f32 = 0;
}

struct L2 {
  c: L3 = {};
}

struct L1 {
  b: L2 = {};
}

export function read_deep(): f32 {
  const o = new L1();
  o.b.c.x = 4.25;
  return o.b.c.x;
}

// Phase B: a three-level chain copies leaf by leaf, both forms.
export function copy_deep(): f32 {
  const o = new L1();
  o.b.c.x = 2.5;
  const p = o;
  return p.b.c.x;
}

export function assign_deep(): f32 {
  const o = new L1();
  o.b.c.x = 1.5;
  let q = new L1();
  q = o;
  return q.b.c.x;
}
