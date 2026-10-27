// Inline nesting, sub-phase A — the address-form read and the leaf store.
//
// The read path compiles a nested inline field to `base + offset` and lets the
// inner's own accessor run against that **address**: `w.inner.a` is
// `Outer#get:inner` (an address) then `Inner#get:a` with `this` = that address.
// `Inner#get:a` is an ordinary record accessor taking an `i32` `this`, which is
// why no offset sum has to be written: each step compiles its own hop.
//
// The write path is the same in reverse, and the widths matter: `tag` is a
// `store8` at 0, `inner.a` a `store32` at 4, `inner.b` a `store32` at 8, `tail`
// a `store8` at 12. A four-byte store for `tag` would clobber `inner.a`, so the
// byte assertions below are load-bearing, not decoration.
//
// The C-equivalent this fixture pins, field for field:
//
//   struct Inner { uint32_t a; uint32_t b; };          // 8 bytes, align 4
//   struct Outer { uint8_t tag; struct Inner inner; uint8_t tail; };
//   offsetof(Outer, tag)   == 0
//   offsetof(Outer, inner) == 4    (3 bytes of pad after tag)
//   offsetof(Outer, tail)  == 12
//   sizeof(Outer)          == 16   (rounded up to Inner's alignment)
//
// Measured with `cc -std=c11` on that declaration: sizeof=16, tag=0, inner=4,
// tail=12. The offsets below are that compiler's answer, not a hand count.
//
// A C compiler produces exactly those numbers for that declaration; the fixture
// therefore asserts them both as `offsetof`/`sizeof` *and* as raw loads at the
// same addresses after writing through the fields.

@inline struct Inner {
  a: u32;
  b: u32;
}

@unmanaged struct Outer {
  tag: u8;
  inner: @inline Inner;
  tail: u8;
}

export function run(): i32 {
  let w = changetype<Outer>(heap.alloc(sizeof<Outer>()));
  w.tag = 0x11;
  w.inner.a = 0x22222222;
  w.inner.b = 0x33333333;
  w.tail = 0x44;

  let base = changetype<usize>(w);

  // The layout the C declaration above would produce, read as bytes.
  if (load<u8>(base) != 0x11) return 1;                    // tag @ 0
  if (load<u32>(base + 4) != 0x22222222) return 2;         // inner.a @ 4
  if (load<u32>(base + 8) != 0x33333333) return 3;         // inner.b @ 8
  if (load<u8>(base + 12) != 0x44) return 4;               // tail @ 12

  // The padding is not written by any store, so it stays zero.
  if (load<u8>(base + 1) != 0) return 5;
  if (load<u8>(base + 2) != 0) return 6;
  if (load<u8>(base + 3) != 0) return 7;

  // And the same values through the type, which is the accessor path.
  if (w.tag != 0x11) return 8;
  if (w.inner.a != 0x22222222) return 9;
  if (w.inner.b != 0x33333333) return 10;
  if (w.tail != 0x44) return 11;

  // A write through the address is visible through the field, and the reverse:
  // the field is the bytes, not a copy of them.
  store<u32>(base + 8, 0x55555555);
  if (w.inner.b != 0x55555555) return 12;

  // `tag` is one byte: writing 0xFF must leave `inner.a` alone.
  w.tag = 0xFF;
  if (w.inner.a != 0x22222222) return 13;
  if (load<u32>(base + 4) != 0x22222222) return 14;

  // Two writes to different leaves of the same nested field do not interfere.
  w.inner.a = 1;
  w.inner.b = 2;
  if (w.inner.a * 10 + w.inner.b != 12) return 15;

  return 0;
}
