// `alignof<T>()` for records. 1.0 prerequisite, fixed after the @inline scoping.
//
// `alignof` is the log2 of a type's alignment, and it must equal `ctz` of the
// address every object of that type is placed at. For a record that is the
// strongest alignment among its fields (base included); for a scalar it is the
// scalar's own; for a class reference it is 4, because the reference is 4 bytes
// even though the object it points at has a header.
//
// **The defect.** `builtin_alignof` returned `Type#alignLog2`, which is
// `31 - clz(byteSize)`. A record's `Type` is class-like, so its `byteSize` is the
// 4-byte `usize` -- and every record reported 2, whatever its fields. The
// record's real alignment was already computed and stored as `Class#alignLog2`
// while the resolver laid the fields out; the builtin simply never read it.
// `builtin_sizeof` has had exactly that record branch since 0.8.0, which is why
// `sizeof` was right and `alignof` was not.
//
// Three-way, as assertions:
//   refuse  (before): every record reports 2 -- `{u16}` 2, `{u32,u64}` 2,
//           `{f64}` 2. The `!= 2` assertions below fail there.
//   partial (a field scan that misses the rule): the classic half-fix takes the
//           *first* field's alignment, or forgets the base's. `{u32,u64}` would
//           report 2 (first field) instead of 3, and `Derived` would report its
//           own field's 2 rather than the base's 3 -- both asserted below.
//   fixed:   each record reports its true alignment, scalars are unchanged, and
//           a class reference stays 4/2.
//
// The values are asserted against the *literal* expected numbers, not against
// `ctz(sizeof<T>())`: for `{u8,u32,u8}` the size (12) is not a power of two, and
// deriving alignment from it is the very mistake this fixture exists to catch.

@unmanaged struct OneU16 { x: u16; }              // align 2
@unmanaged struct U32ThenU64 { x: u32; y: u64; }  // align 8 (the u64, not the first field)
@unmanaged struct OneF64 { x: f64; }              // align 8
@unmanaged struct Mixed { x: u8; y: u32; z: u8; } // align 4
@unmanaged struct EndsU16 { x: u8; y: u16; }      // align 2 (the *last* field decides)

@managed struct ManagedU32ThenU64 { x: u32; y: u64; } // align 8, same rule, other ownership
@managed struct ManagedOneU16 { x: u16; }             // align 2
@managed struct ManagedMixed { x: u8; y: u32; z: u8; }// align 4

// The base contributes its alignment: a derived record holding nothing but a
// `u8` is still aligned by the base's `u64`.
@unmanaged struct BaseU64 { b: u64; }
@unmanaged struct DerivedU8 extends BaseU64 { d: u8; }

// A class: the reference is 4 bytes at alignment 4. Not a record.
class Plain { a: u32 = 0; }

// --- fixed: @unmanaged records report their own alignment ------------------
assert(alignof<OneU16>() == 1);          // 2 bytes
assert(alignof<U32ThenU64>() == 3);      // 8 bytes -- not the first field's 2
assert(alignof<OneF64>() == 3);          // 8 bytes
assert(alignof<Mixed>() == 2);           // 4 bytes
assert(alignof<EndsU16>() == 1);         // 2 bytes -- decided by the last field

// --- fixed: @managed records follow the same rule --------------------------
assert(alignof<ManagedU32ThenU64>() == 3);
assert(alignof<ManagedOneU16>() == 1);
assert(alignof<ManagedMixed>() == 2);

// --- fixed: the base's alignment counts ------------------------------------
assert(alignof<BaseU64>() == 3);
assert(alignof<DerivedU8>() == 3);

// --- refuse cell: the old answer was 2 for every record --------------------
// These are the numbers a build with the missing branch produced.
assert(alignof<OneU16>() != 2);          // refuse: 2
assert(alignof<U32ThenU64>() != 2);      // refuse: 2
assert(alignof<OneF64>() != 2);          // refuse: 2
assert(alignof<ManagedU32ThenU64>() != 2);

// --- partial cell: the first-field / base-blind half-fix -------------------
// If the scan used the first field, `U32ThenU64` would be 2; if it skipped the
// base, `DerivedU8` would be 2 (its own `u8`). Both are ruled out.
assert(alignof<U32ThenU64>() == 3);
assert(alignof<DerivedU8>() == 3);

// --- scalars are unchanged (the branch must not touch them) ----------------
assert(alignof<u8>() == 0);
assert(alignof<u16>() == 1);
assert(alignof<u32>() == 2);
assert(alignof<u64>() == 3);
assert(alignof<f64>() == 3);

// --- a class keeps the reference's alignment -------------------------------
// `alignof<Plain>()` describes the reference, not the object: 4 bytes, align 4.
// This is the one case where a record-shaped `Class#alignLog2` read would be
// wrong, which is why the branch is keyed on the record decorators.
assert(alignof<Plain>() == 2);
assert(sizeof<Plain>() == 4);

// --- agreement with the layout the resolver produced -----------------------
// The independent check: a record aligned to 8 must start at a multiple of 8,
// so its `sizeof` (which is rounded to that alignment) must be a multiple of 8.
assert(sizeof<U32ThenU64>() % 8 == 0);
assert(sizeof<OneU16>() % 2 == 0);
assert(sizeof<Mixed>() % 4 == 0);
assert(sizeof<DerivedU8>() % 8 == 0);

export function run(): i32 {
  // Sum a few of them so the assertions sit in a module with a real entry point
  // (the harness compiles and instantiates it).
  return <i32>(
    alignof<U32ThenU64>() + alignof<ManagedU32ThenU64>() + alignof<OneU16>()
  );
}
