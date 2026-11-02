// `[T *]` — Landing 1: the ABI and the layout, which are the whole of what this
// landing delivers.
//
// `[T *]` is a pointer to T with unknown length. It is **one `i32` slot**
// everywhere — parameter, return, local, field — and that single fact is the
// design's payoff. `Type#toRef` answers the pointer type for
// `TypeKind.UnmanagedArray`, where it reaches `assert(false)` for
// `TypeKind.FixedArray`; so the five emitters that crash on `T[N]`
// (`typesToRefs`, `paramRefs`, `resultRefs`, `compileGlobal`, `makeZero`) each
// bind one slot instead of asserting.
//
// Three things are asserted here, and the `.wat` beside this fixture holds the
// code, since the point is what the *signature* looks like:
//
//   1. `take` spends **one** operand on `[u32 *]`, and `give` returns one.
//      A `T[N]` in either position is a build failure today
//      (`tests/compiler/interop/array-star-parse.ts` is the sibling for the
//      refusals); the same source with `u32[4]` does not compile at all.
//
//   2. As a **field**, it is the pointer's four bytes, not an extent. The
//      layout assertions below put `p` at 4 in `{a: u32; p: [f64 *]; b: u32}`
//      and the record at 12 -- the same numbers a `usize` field would give.
//      `offsetof` on such a field needs no new arm: it reports the offset of the
//      *pointer* within the record, which is what it always meant.
//
//   3. `new` on a record holding one zeroes it to the null pointer. `makeZero`
//      has an arm for the kind, and `Flow#initThisFieldFlags` counts it as
//      "safe to initialize with zero" (a pointer that has never been pointed
//      anywhere is 0, exactly like a scalar) -- without which `new` reported
//      `TS2564` for a field whose zero is perfectly defined.
//
// Not asserted here, because they are later landings: `y[i]` (Landings 2-3),
// `[T * n]` with a runtime length (`@dynamic`, Landing 4), and value arrays of
// records (the `FixedArray` `toRef` crash, Landing 5).

@unmanaged struct BodyState {
  x: f64;
  y: f64;
  q: f64;
  v: f64;
}

// --- 1. one slot in, one slot out ------------------------------------------

export function take(y: [u32 *]): u32 {
  // Not indexed (that is Landings 2-3): passed straight through, which is what
  // a pointer value is for.
  return pass(y);
}

function pass(y: [u32 *]): u32 {
  return 0;
}

export function give(p: usize): [u32 *] {
  return changetype<[u32 *]>(p);
}

// --- 2. a field is the pointer, not an extent ------------------------------

@unmanaged struct Holds {
  a: u32;
  p: [f64 *];
  b: u32;
}

assert(offsetof<Holds>("p") == 4);
assert(sizeof<Holds>() == 12);

// A record element is the case the form exists for: a pointer to a run of
// records. The declaration alone is the claim; indexing it is Landings 2-3.
@unmanaged struct HoldsRecord {
  a: u32;
  states: [BodyState *];
  b: u32;
}

assert(offsetof<HoldsRecord>("states") == 4);
assert(sizeof<HoldsRecord>() == 12);

// --- 3. a fresh record zeroes the pointer ----------------------------------

struct Owner {
  p: [u32 *];
}

export function make(): u32 {
  const o = new Owner();
  return 0;
}

// --- two spellings of one model agree; two models do not -------------------
//
// `[T * N]` is not a new node: the parser builds the same `FixedArrayTypeNode`
// `T[N]` builds. After Landing 5a.5 the memory model is a second axis, so the
// claim splits in two and both halves are asserted here:
//
//   1. **Same model, two spellings → the same type.** `u32[4]` and `[u32 * 4]`
//      are both the value form: 16 inline bytes, `xs` at 4, record 20.
//      Unchanged from Landing 1, and the reason the desugar is safe.
//
//   2. **Different model, same element and count → different types.**
//      `@unmanaged [u32 * 4]` is a pointer: 4 bytes, `xs` at 4, record 8.
//      Before 5a.5 the prefix was parsed and dropped (`Type.fixedArray`
//      interned one object per element+length), so all four spellings produced
//      one Type and this fixture could only assert equality. That equality
//      *was* the bug: a `[T * N]` is inline bytes with no address, and an
//      `@unmanaged [T * N]` is an address. They are not the same thing, and a
//      `changetype<[T * N]>(p)` that compiled was evidence of the confusion,
//      not of the feature.

@unmanaged struct Postfix {
  a: u32;
  xs: u32[4];
}

@unmanaged struct Prefix {
  a: u32;
  xs: [u32 * 4];
}

@unmanaged struct View {
  a: u32;
  xs: @unmanaged [u32 * 4];
}

// 1. Same model, two spellings.
assert(sizeof<Postfix>() == sizeof<Prefix>());
assert(offsetof<Postfix>("xs") == 4);
assert(offsetof<Prefix>("xs") == 4);
assert(offsetof<Postfix>() == 20);
assert(offsetof<Prefix>() == 20);

// 2. Different model: the pointer slot, not the extent.
assert(sizeof<@unmanaged [u32 * 4]>() == sizeof<usize>());
assert(sizeof<@unmanaged [u32 * 4]>() != sizeof<[u32 * 4]>());
assert(offsetof<View>("xs") == 4);
assert(sizeof<View>() == 8);
assert(sizeof<View>() != sizeof<Prefix>());

export function run(): i32 {
  // Value form still equals its postfix spelling; the view form does not.
  return i32(
    sizeof<Postfix>() == sizeof<Prefix>() &&
    sizeof<View>() != sizeof<Prefix>()
  );
}
