// sizeof, 0.8.0 (variant B): an `@unmanaged` class reports its layout size, the
// same number `offsetof<T>()` returns; a managed class keeps the reference
// width. The fix lives in `builtin_sizeof` so that `Type.byteSize` -- and with
// it `store`'s width, `load`'s width, `alignof`, and field layout -- does not
// move.
//
// The three cells, as assertions:
//   refuse  (before): sizeof<Two>() == 4       -- the reference width
//   partial (a size sum without alignment): 12
//   fixed:   sizeof<Two>() == 16 == offsetof<Two>()
// The partial value is asserted *against*, so a future "sum the fields" fix
// fails here rather than shipping.

@unmanaged class Two { a: i32; b: f64; }   // 0, pad to 8, 8 -> 16
@unmanaged class OnlyF32 { a: i32; b: f32; }   // 0, 4 -> 8
@unmanaged class Mat16 {
  m00: f32; m01: f32; m02: f32; m03: f32;
  m10: f32; m11: f32; m12: f32; m13: f32;
  m20: f32; m21: f32; m22: f32; m23: f32;
  m30: f32; m31: f32; m32: f32; m33: f32;
}
@unmanaged class Empty { }
class Managed { a: i32; b: f64; }

// --- fixed: layout size, and it is exactly what offsetof reports ------------
assert(sizeof<Two>() == 16);
assert(sizeof<Two>() == offsetof<Two>());
assert(sizeof<OnlyF32>() == 8);
assert(sizeof<OnlyF32>() == offsetof<OnlyF32>());
assert(sizeof<Mat16>() == 64);
assert(sizeof<Mat16>() == offsetof<Mat16>());

// --- aligned, not merely summed --------------------------------------------
// A sum of the field sizes would be 4 + 8 = 12; the layout pads to 8.
assert(sizeof<Two>() != 12);
assert(sizeof<Two>() - sizeof<i32>() == sizeof<f64>() + 4); // 12 + 4 == 16

// --- the refuse cell: the reference width is no longer the answer ----------
assert(sizeof<Two>() != sizeof<usize>());
assert(sizeof<OnlyF32>() != sizeof<usize>());

// --- an empty record occupies nothing, consistent with offsetof ------------
assert(sizeof<Empty>() == 0);
assert(sizeof<Empty>() == offsetof<Empty>());

// --- a managed class is a reference: unchanged ------------------------------
assert(sizeof<Managed>() == sizeof<usize>());
assert(sizeof<Managed>() != offsetof<Managed>());

// --- `byteSize` is untouched, so alignof does not move ---------------------
// alignof is ctz(byteSize). For a class byteSize is the reference width, so a
// record still reports 2 -- the property variant B preserves, and the reason
// the fix is not at `Type.byteSize`.
assert(alignof<Two>() == alignof<usize>());

// --- primitives are unchanged ----------------------------------------------
assert(sizeof<u8>() == 1);
assert(sizeof<i32>() == 4);
assert(sizeof<f64>() == 8);
assert(sizeof<usize>() == 4);

export function run(): i32 { return sizeof<Two>() + sizeof<Mat16>(); }
