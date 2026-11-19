// Round VT4, item 3: `[S * N]` over an `@inline struct`.
//
// The array's *size* was always the element's inline extent (`Type#inlineExtentBytes`),
// but the element **stride** in `compileFixedArrayElementAccess` read
// `byteSize` -- 4 for a record -- so both indices landed in the first element
// and the writes aliased. Measured before the fix: the two-element round-trip
// below answered `134334433` where `134332211` is right. The stride is the
// extent now, and a record element compiles to its address (as it already did
// in the `@unmanaged` view form) rather than to a 4-byte load.
//
// What this pins:
//
//   1. `sizeof<[S * 2]>()` is 16 and the field sits at 0 with `tail` at 16.
//   2. Two elements are two slots: 13/43 and 32/211 round-trip as 134332211.
//   3. Three elements are three slots.

@inline struct S {
  a: i32;
  b: i32;
}

class B {
  s: [S * 2];
  tail: i32;
}

class T3 {
  s: [S * 3];
}

export function arraySize(): i32 {
  return sizeof<[S * 2]>();                 // 16
}

export function offsetS(): i32 {
  return offsetof<B>("s");                  // 0
}

export function offsetTail(): i32 {
  return offsetof<B>("tail");               // 16
}

export function twoElements(): i32 {
  const b = new B();
  b.s[0].a = 13;
  b.s[0].b = 43;
  b.s[1].a = 32;
  b.s[1].b = 211;
  return b.s[0].a * 10000000
    + b.s[0].b * 100000
    + b.s[1].a * 1000
    + b.s[1].b;                             // 134332211
}

export function threeElements(): i32 {
  const t = new T3();
  t.s[0].a = 1; t.s[0].b = 2;
  t.s[1].a = 3; t.s[1].b = 4;
  t.s[2].a = 5; t.s[2].b = 6;
  return t.s[0].a * 100000
    + t.s[0].b * 10000
    + t.s[1].a * 1000
    + t.s[1].b * 100
    + t.s[2].a * 10
    + t.s[2].b;                             // 123456
}

export function fresh(): i32 {
  const b = new B();
  return b.s[0].a + b.s[0].b + b.s[1].a + b.s[1].b + b.tail;  // 0
}
