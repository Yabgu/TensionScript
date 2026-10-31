// An `@inline struct` nested inside an `@inline` value — **reads**.
//
// Deep SROA, Phase A. The outer value is still one WASM local per **leaf**; the
// leaves of a nested inline field are reached by walking the access chain, so
// `o.inner.x` is a `local.get` of a leaf local, not a load through a pointer and
// not a refusal.
//
// What this pins:
//   - `Outer1` declares: a nested inline field is accepted, not refused.
//   - `only_x` / `only_y` read *different* leaves of the same nested value, so a
//     single mistaken slot would show up as one of them returning the other's
//     value.
//
// Writes are Phase B and copy-out is Phase D; neither is exercised here. The
// two blocks below happen to compile because the write path and the read path
// resolve through the same tree, but this fixture asserts only the layout.

struct Inner {
  x: f32 = 0;
  y: f32 = 0;
}

struct Outer1 {
  a: u32 = 0;
  inner: Inner = {};
}

export function only_x(): f32 {
  const o = new Outer1();
  o.inner.x = 1.5;
  o.inner.y = 9.5;
  o.a = 12345;
  return o.inner.x;
}

export function only_y(): f32 {
  const o = new Outer1();
  o.inner.x = 1.5;
  o.inner.y = 9.5;
  return o.inner.y;
}

// Phase B: the copy is a **copy**, not an alias. Writes to the copy's leaf are
// invisible through the original, which is what one `local.set` per leaf buys.
export function copy_leaf(): f32 {
  const a = new Outer1();
  a.inner.x = 3.14;
  const b = a;
  b.inner.x = 7.0;
  return a.inner.x * 10 + b.inner.x; // 31.4 + 7.0 = 38.4
}
