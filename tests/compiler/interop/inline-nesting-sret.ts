// Deep SROA: **sret copy-out for nested inline returns** — the last leaf consumer.
//
// A function returning an `@inline struct` writes its fields into a hidden
// destination slot (the first WASM parameter) and returns nothing through the
// value stack. With a nested type, that copy is per **leaf**: the slot is filled
// at each leaf's own offset, and the caller reads it back the same way.
//
// So `make_nested` stores at 0, 4 and 8 of the slot — one per leaf of
// `{ a, inner{x,y} }` — and `read_nested` loads them back into a local's leaves.
// The flat case (`make_flat`) is unchanged byte for byte; that is what keeps
// every existing sret consumer honest.
//
// What this does **not** cover: reading a nested field directly off a call
// result (`make_deep().b.c.x`), where the first hop is itself an inline-typed
// field. That needs the sub-value's address to outlive the call's slot, which is
// a lifetime question rather than a copy — `const v = make_deep(); v.b.c.x`
// is the supported form and is what `read_deep` below uses.

struct Inner {
  x: f32 = 0;
  y: f32 = 0;
}

struct Outer1 {
  a: u32 = 0;
  inner: Inner = {};
}

struct Flat {
  a: u32 = 0;
  b: f32 = 0;
}

// Flat: two fields, two stores — the baseline that must not move.
function make_flat(): Flat {
  const f = new Flat();
  f.a = 7;
  f.b = 1.5;
  return f;
}

export function read_flat(): f32 {
  const f = make_flat();
  return f32(f.a) + f.b;
}

// Nested: three leaves, three stores.
function make_nested(): Outer1 {
  const o = new Outer1();
  o.a = 7;
  o.inner.x = 1.5;
  o.inner.y = 2.5;
  return o;
}

export function read_nested(): f32 {
  const o = make_nested();
  return f32(o.a) + o.inner.x + o.inner.y;
}

// `return new P()` has no local to copy from, but the slot is stack space a
// previous sret call may have filled — so every leaf is still zeroed.
function make_zero(): Outer1 {
  return new Outer1();
}

export function read_zero(): f32 {
  const o = make_zero();
  return f32(o.a) + o.inner.x + o.inner.y;
}

// Three levels: one leaf, so one store.
struct L3 { x: f32 = 0; }
struct L2 { c: L3 = {}; }
struct L1 { b: L2 = {}; }

function make_deep(): L1 {
  const v = new L1();
  v.b.c.x = 3.14;
  return v;
}

export function read_deep(): f32 {
  const v = make_deep();
  return v.b.c.x;
}

// By-value in, by-value out: the parameter binds leaf params to a tree, and the
// return writes that tree back out to the slot.
function roundtrip(o: Outer1): Outer1 {
  return o;
}

export function use_roundtrip(): f32 {
  const x = new Outer1();
  x.a = 1;
  x.inner.x = 2;
  x.inner.y = 3;
  const y = roundtrip(x);
  return f32(y.a) + y.inner.x + y.inner.y;
}
