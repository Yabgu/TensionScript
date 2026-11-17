// A GC class may not hold an exempt record as a plain field (GC25).
//
// The exemption divides managed classes into two representations: a GC struct, and a
// linear record with a C layout. A **plain field** between them would be one
// representation stored in the other — a linear pointer where the GC struct's field is a
// reference — and the honest outcome is a named compile error, not a module that aborts
// inside Binaryen.
//
// This is a crossing and not a coexistence problem: the two representations can live in
// one module (that is what the exemption is for), but nothing may *point* from one into
// the other. `@unmanaged` is the sanctioned crossing, because an address is not a
// reference; `tests/gc/exempt.ts` exercises it.

/// Trace-free: exempt, stays linear.
class Vec3fLike {
  x: f32 = 1;
  y: f32 = 2;
  z: f32 = 3;
}

/// Not trace-free: it holds a `String`, so it wants to be a GC struct — and its `pos`
/// field points at a linear record.
class Mixed {
  pos: Vec3fLike = new Vec3fLike();
  label: string = "x";
}

export function probe(): i32 {
  let m = new Mixed();
  return m.label.length + <i32>m.pos.x;
}
