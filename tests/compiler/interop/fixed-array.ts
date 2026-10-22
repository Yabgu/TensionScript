// `T[N]` — Commit 9: the grammar and the type. 0.8.0.
//
// `T[N]` parses as a fixed-size **inline** array, not as `Array<T>`: the token
// after `[` decides (`]` -> a managed reference, an integer -> N elements
// inline), so the two spellings are one character apart and two memory models.
//
// This commit lands the grammar and the `TypeKind.FixedArray` type. It does
// **not** land the layout-engine fix, and the assertions below record exactly
// what that leaves: the array type has the right size, but a record that holds
// one over-aligns it, because the class-layout loop still treats a field's
// `byteSize` as its alignment (`resolver.ts`, `assert(isPowerOf2(byteSize))`).
// Commit 10 replaces that with the element's alignment; the three "wrong today"
// assertions below flip at that point.
//
// Three-way:
//   refuse  (before): `f32[4]` in a field type was `TS1005 ']' expected`.
//           The refusal is *preserved* for a non-literal bound, which is the
//           cell asserted in tests/compiler/interop/fixed-array-bound.{ts,json}.
//   partial (this commit): it parses, `sizeof<f32[4]>` is 16, but
//           `alignof<f32[4]>` reports 16-byte alignment instead of 4, and
//           `{a:i32; arr:f32[4]; b:i32}` lays out as 36 bytes with the array at
//           16 -- the scoping's measured naive numbers.
//   fixed   (commit 10): 24 bytes, `arr` at 4, `b` at 20, alignment 4.

@unmanaged struct Holder {
  arr: f32[4];
}

// --- fixed already: the disambiguation did not collapse to Array<T> ---------
// `Array<T>` is a reference: 4 bytes. 16 is four f32s inline.
assert(sizeof<f32[4]>() == 16);
assert(sizeof<f32[]>() == 4);
assert(sizeof<u32[8]>() == 32);
assert(sizeof<u8[3]>() == 3);

// --- fixed already: a record of one array is the array ----------------------
assert(sizeof<Holder>() == 16);
assert(offsetof<Holder>("arr") == 0);

// --- partial, asserted as it stands: alignment is still byteSize-derived ----
// `alignof` returns log2. The element is f32 -> 4-byte alignment -> 2.
// Commit 10 makes this 2; today it is 4, i.e. the whole 16-byte array is
// treated as a 16-byte-aligned unit.
assert(alignof<f32[4]>() == 4);   // FIXES TO 2 in commit 10

export function run(): i32 {
  return sizeof<f32[4]>();
}
