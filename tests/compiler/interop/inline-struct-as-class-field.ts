// Round VT4, item 2: an `@inline struct` as a **plain-class** field.
//
// A class field is a byte offset into the object's allocation, so an inline
// field is inline in the heap -- the same shape an `@unmanaged` / `@managed`
// record has had since inline nesting landed. The layout branch gives it the
// value's extent (8 here) and its alignment; the constructor zero-fills that
// extent (`Compiler#makeInlineFieldZeroFill`) so a bare declaration has defined
// bytes under every runtime, the stub's `__alloc` included.
//
// What this pins:
//
//   1. The offsets are the layout's: `s` at 0, `tail` at 8.
//   2. A field write through the value's own leaves round-trips.
//   3. Two instances own two values (the field is per-object storage).
//   4. A fresh instance reads zero -- the constructor's fill, not the allocator.
//
// The refusal that makes the shape safe -- a **managed leaf** inside the inline
// struct, whose pointer would be invisible to the collector -- is pinned by
// `inline-struct-managed-leaf.ts`.

@inline struct S {
  a: i32;
  b: i32;
}

class C {
  s: S;
  tail: i32;
}

export function valueSize(): i32 {
  return sizeof<S>();                       // 8
}

export function offsetS(): i32 {
  return offsetof<C>("s");                  // 0
}

export function offsetTail(): i32 {
  return offsetof<C>("tail");               // 8
}

export function roundTrip(): i32 {
  const c = new C();
  c.s.a = 11;
  c.s.b = 22;
  c.tail = 33;
  return c.s.a * 10000 + c.s.b * 100 + c.tail;  // 112233
}

export function independent(): i32 {
  const a = new C();
  const b = new C();
  a.s.a = 1;
  b.s.a = 2;
  return a.s.a * 10 + b.s.a;                // 12
}

export function fresh(): i32 {
  const c = new C();
  return c.s.a + c.s.b + c.tail;            // 0
}
