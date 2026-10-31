// Deep SROA, Phase C — what a nested by-value parameter still cannot do.
//
// The parameter form itself works (`inline-nesting-params.ts`). These are the
// neighbours, each refused by name and each a different reason:
//
//   - a **view where a value is expected** — `take(changetype<@unmanaged T>(p))`
//     passes a view, which the type still calls an inline value with no address;
//   - a **temporary argument** — `take(new T())`. This is not a nesting issue
//     and not new: the flat case refuses identically (measured), because the
//     callee's operands are read out of a local's leaves and a `new` has none;
//   - a **GC-reference leaf** at any depth — a bare `local.set` would skip the
//     barrier;
//   - `changetype<usize>(value)` — Phase D's design decision: an inline value
//     has no address to lend; `copyInto(dest, value)` is the alternative.

class C {
  v: i32 = 0;
}

struct Inner {
  x: f32 = 0;
  y: f32 = 0;
}

struct Outer1 {
  a: u32 = 0;
  inner: Inner = {};
}

struct BadInner {
  s: C = new C();
}

struct BadOuter {
  a: u32 = 0;
  b: BadInner = {};
}

struct Outer3 {
  a: u32 = 0;
  b: f32 = 0;
}

// (1) A view where a value is expected.
function takeNested(o: Outer1): f32 {
  return o.inner.x;
}

export function viewArg(ptr: usize): f32 {
  return takeNested(changetype<@unmanaged Outer1>(ptr));
}

// (2) A temporary argument — flat, so the refusal is demonstrably about the
// temporary and not about nesting.
function takeFlat(o: Outer3): f32 {
  return f32(o.a) + o.b;
}

export function tempArg(): f32 {
  return takeFlat(new Outer3());
}

// (3) A GC-reference leaf, one level down.
function takeBad(o: BadOuter): i32 {
  return 0;
}

export function gcLeaf(): i32 {
  const o = new BadOuter();
  return takeBad(o);
}

// (4) An inline value's address.
export function valueAddress(): usize {
  const o = new Outer1();
  return changetype<usize>(o);
}
