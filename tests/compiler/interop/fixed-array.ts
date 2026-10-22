// `T[N]` — Commits 9-10: the grammar, the type, and the layout engine. 0.8.0.
//
// `T[N]` parses as a fixed-size **inline** array, not as `Array<T>`: the token
// after `[` decides (`]` -> a managed reference, an integer -> N elements
// inline), so the two spellings are one character apart and two memory models.
//
// The layout engine aligned a field by its **size** (`assert(isPowerOf2(
// byteSize))`, `mask = byteSize - 1`). That is wrong for an inline array in two
// directions at once: a 16-byte `f32[4]` was over-aligned to 16, and a 24-byte
// `f32[6]` crashed the assert because 24 is not a power of two. Commit 10 aligns
// by the field's *alignment* -- the element's, for an array -- which is a power
// of two by construction.
//
// Three-way:
//   refuse  (before commit 9): `f32[4]` in a field type was `TS1005 ']' expected`.
//   partial (commit 9): parses; `sizeof<f32[4]>` = 16, but `alignof<f32[4]>` = 4
//           (log2, i.e. 16-byte alignment) and `{a:i32; arr:f32[4]; b:i32}` was
//           **36 bytes with `arr` at 16, `b` at 32**. `f32[6]` crashed.
//   fixed   (this): 24 / 4 / 20, alignment 4 bytes, `f32[6]` is 24.

@unmanaged struct Holder {
  arr: f32[4];
}

@unmanaged struct Mixed {
  a: i32;      // 0
  arr: f32[4]; // 4  (4-aligned: the element is f32, not the 16-byte total)
  b: i32;      // 20
}

@unmanaged struct Six {
  arr: f32[6]; // 24 bytes, 4-aligned -- not a power of two, and that is fine
}

@unmanaged struct Eight {
  head: u8;    // 0
  arr: u32[8]; // 4  (4-aligned, not 32)
  tail: u8;    // 36
}

// --- the disambiguation did not collapse to Array<T> -----------------------
// `Array<T>` is a reference: 4 bytes. 16 is four f32s inline.
assert(sizeof<f32[4]>() == 16);
assert(sizeof<f32[]>() == 4);
assert(sizeof<u32[8]>() == 32);
assert(sizeof<u8[3]>() == 3);

// --- alignment is the element's, however long the array is ----------------
// `alignof` returns log2: f32 -> 2 (4 bytes), u32 -> 2, u8 -> 0.
assert(alignof<f32[4]>() == alignof<f32>());
assert(alignof<f32[6]>() == alignof<f32>());
assert(alignof<u32[8]>() == alignof<u32>());
assert(alignof<u8[3]>() == alignof<u8>());

// --- a record of one array is the array -----------------------------------
assert(sizeof<Holder>() == 16);
assert(offsetof<Holder>("arr") == 0);

// --- the scoping's fixture: 24 bytes, arr at 4, b at 20 -------------------
assert(sizeof<Mixed>() == 24);
assert(offsetof<Mixed>("a") == 0);
assert(offsetof<Mixed>("arr") == 4);
assert(offsetof<Mixed>("b") == 20);

// --- a length that is not a power of two neither pads nor crashes ---------
assert(sizeof<Six>() == 24);
assert(offsetof<Six>("arr") == 0);

// --- and a following field is placed right after the array ----------------
assert(sizeof<Eight>() == 37);
assert(offsetof<Eight>("arr") == 4);
assert(offsetof<Eight>("tail") == 36);

export function run(): i32 {
  return sizeof<Mixed>() + offsetof<Mixed>("b");
}
