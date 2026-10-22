// Trailing padding in an `@unmanaged` record's size. 0.8.0, variant B corrected.
//
// The size of a C record is where its last field **ends, rounded up to the
// record's alignment**. `{a: u8; arr: u32[8]; b: u8}` ends at 37 and is 40
// bytes, because its fields align it to 4. The first variant-B build reported
// the end offset (37), which is wrong in three ways at once: as an array stride
// (`T[N]` misaligns every element but the first), as a `COPY_STRUCT` length
// (the tail of a host buffer stays untouched), and against `Marshal.SizeOf`.
//
// `sizeof<T>()` and the no-argument `offsetof<T>()` are the same number by
// construction -- both read `Class#nextMemoryOffset`, which the resolver
// rounds to the record's alignment. A field's offset
// (`offsetof<T>("field")`) is untouched, so the 135 tree sites do not move.
//
// Three-way, as assertions:
//   refuse  (variant B as first shipped): 37/37, and `COPY_STRUCT` copies 37,
//           leaving the last 3 bytes of the destination as they were.
//   partial (the round-up reachable from `sizeof` but not from the no-argument
//           `offsetof`, or the copy still sized by the unrounded number):
//           40 vs 37. The `sizeof == offsetof` assertions below fail, and the
//           copy test fails too -- on the *agreement*, not on a magic value.
//   fixed:   40/40, and a copy of a 40-byte record reproduces byte 39 while
//           leaving the byte past the record alone.

import { COPY_STRUCT } from "util/bytes";

@unmanaged struct Tail {
  a: u8;        // 0
  arr: u32[8];  // 4 .. 35
  b: u8;        // 36 .. 37, rounded to the record's alignment -> 40
}

@unmanaged struct TailOnly {
  a: u8;        // 0
  b: u16;       // 2 .. 3, rounded to 2's alignment -> 4
}

@unmanaged struct Aligned {
  a: i32;       // 0
  b: f64;       // 8 .. 16, already a multiple of 8
}

// --- fixed: the record's size is C's sizeof --------------------------------
assert(sizeof<Tail>() == 40);
assert(offsetof<Tail>() == 40);
assert(sizeof<Tail>() == offsetof<Tail>());
assert(offsetof<Tail>("arr") == 4);
assert(offsetof<Tail>("b") == 36);

// --- the refuse cell's number is gone --------------------------------------
assert(sizeof<Tail>() != 37);
assert(offsetof<Tail>() != 37);

// --- a two-byte tail rounds too --------------------------------------------
assert(sizeof<TailOnly>() == 4);
assert(offsetof<TailOnly>() == 4);
assert(offsetof<TailOnly>("b") == 2);

// --- no over-padding: a record already on its alignment does not move ------
assert(sizeof<Aligned>() == 16);
assert(offsetof<Aligned>() == 16);

// --- the copy primitive copies the record, tail included -------------------
// `COPY_STRUCT` copies `offsetof<T>()` bytes. At 37 this leaves `dst + 37..39`
// untouched, so the copy is not `memcpy(dst, src, sizeof(S))`. The canary at
// `dst + 40` proves the copy does not run *past* the record either.
{
  let src = heap.alloc(40);
  let dst = heap.alloc(41);
  memory.fill(src, 0, 40);
  store<u8>(src + 36, 0x11);   // `b`
  store<u8>(src + 39, 0xA5);   // the last byte of the record's padding
  memory.fill(dst, 0, 41);
  store<u8>(dst + 40, 0x5A);   // canary, one byte past the record

  COPY_STRUCT<Tail>(dst, src);

  assert(load<u8>(dst + 36) == 0x11);
  assert(load<u8>(dst + 39) == 0xA5);  // a 37-byte copy fails here
  assert(load<u8>(dst + 40) == 0x5A);  // a 41-byte copy fails here
}

export function run(): i32 {
  return sizeof<Tail>() + offsetof<Tail>();
}
