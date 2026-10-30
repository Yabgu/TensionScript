// Deep SROA, Phase D: **path-to-path** assignment.
//
// `b.inner = a.inner` copies the leaves behind one path into the leaves behind
// another, without evaluating a value expression in between — an inline value
// has no representation to evaluate, which is why the bare form still refuses.
//
// Both sides are SROA trees this compiler built, so the leaves are distinct
// locals by construction and the copy cannot alias. Self-assignment degenerates
// to reading and writing the same local, which is harmless — the second
// function pins that it stays a valid program rather than becoming a no-op that
// skips the write.

struct Inner {
  x: f32 = 0;
  y: f32 = 0;
}

struct Outer1 {
  a: u32 = 0;
  inner: Inner = {};
}

export function path_copy(): f32 {
  const a = new Outer1();
  const b = new Outer1();
  a.inner.x = 1.5;
  a.inner.y = 2.5;
  b.inner = a.inner;
  return b.inner.x + b.inner.y;
}

export function path_self(): f32 {
  const a = new Outer1();
  a.inner.x = 1.5;
  a.inner.y = 2.5;
  a.inner = a.inner;
  return a.inner.x;
}
