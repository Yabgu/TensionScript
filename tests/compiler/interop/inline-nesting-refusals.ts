// Deep SROA — the cells that still refuse, each refused by **name**.
//
// Phase A accepted a nested `@inline` field and taught the read path to reach
// its leaves. These are the neighbours that did not come with it, and each is a
// different, named limitation rather than one broad "nested inline" refusal:
//
//   - reading the nested **value as a whole** — it is several leaves, so there
//     is no single local to read (`AS100`).
//   - ~~copying a value that contains a nested field~~ **now accepted** (Phase B:
//     one `local.set` per leaf, so the copy cannot alias — see
//     `inline-nesting-nested.ts`).
//   - a **GC-reference leaf** at any depth — a bare `local.set` skips the write
//     barrier, so the field would look safe and not be (`AS100`). This is the
//     existing guard, and depth is what is being shown: it fires for the inner
//     field, not only for a flat one.
//
//   - `changetype<usize>(value)` — **a design decision, not a deferral.** The
//     address it would return belongs to a temp whose lifetime nothing tracks,
//     so it would be dangling by construction. `copyInto(dest, value)` is the
//     explicit alternative and is what the engine uses (`inline-nesting-copyout.ts`).
//
// Every declaration below has a user so it actually resolves.

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

// (1) The nested value read as a whole.
export function bareRead(): f32 {
  const o = new Outer1();
  const i = o.inner;
  return 0;
}

// (3) A GC-reference leaf, one level down inside an inline value.
export function gcLeaf(): i32 {
  const o = new BadOuter();
  return 0;
}

// (4) An inline value's address. Stays refused by design: see the note above.
export function valueAddress(): usize {
  const o = new Outer1();
  return changetype<usize>(o);
}
