// The struct default — what a value *cannot* do, and what the flip changed.
//
// Two refusals, both of which are the flip working as designed:
//
// **1. `changetype<Plain>(ptr)`.** A value has no address, so there is nothing
// to reinterpret bytes as. This is the cell that broke `interop/struct.ts` when
// the flip landed — that fixture is a wire-record test and now says
// `@unmanaged` out loud, which is the migration the diagnostic names.
//
// **2. Capturing a plain struct in a closure.** Before the flip this compiled
// and **silently aliased**: the environment class held the record's 4-byte
// pointer, so a write after the capture was visible through the closure
// (measured: 997 where a copy gives 57). After the flip the environment class
// would have to hold the value *inline in the heap* — the deferred
// inline-in-heap case — so the capture is refused instead.
//
//     silent wrong value  ->  compile error
//
// The messages come from the environment class, not from a capture-specific
// check: `ClosureLowerTransform` runs before resolution and holds no resolved
// `Type`, so a "captured by value" diagnostic needs a post-resolution site. It
// is filed as `closure-capture-of-value` (B.2) and the two messages pinned here
// are what the tree says today. Pinning them means B.2 changes this fixture
// deliberately rather than silently.
//
// The control that matters is measured, not pinned here (it must compile, and a
// fixture that refuses cannot also succeed): an `@unmanaged` record captured in
// a closure is still **allowed** and still aliases, because a pointer is what a
// pointer means.

struct Plain {
  x: u32;
  y: u32;
}

// 1. a value has no address to reinterpret
export function view(p: usize): u32 {
  changetype<Plain>(p); // discarded: reading a field of it would only cascade
  return 0;
}

// 2. capture by value needs an inline-in-heap environment field
export function capture(): u32 {
  let p: Plain = new Plain();
  p.x = 5;
  p.y = 7;
  let f: () => u32 = () => p.x * 10 + p.y;
  p.x = 99;
  return f();
}

export function run(): i32 {
  // Both refusals fire from reachable code: a refusal inside a function nothing
  // compiles never fires.
  let n = view(0);
  if (n == 1) n = capture();
  return n;
}
