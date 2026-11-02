// `[T * N]` — Landing 5a: `changetype` gives a fixed array a value.
//
// Before this landing `TypeKind.FixedArray` had no reference representation:
// `toRef()` ended in `assert(false)`, so every use that needed a WASM slot
// aborted the compiler. `changetype<[T * N]>(p)[i]` died inside
// `compileFixedArrayElementAddress` on the way to the load.
//
// The representation 5a chose is the one the form implies and not the one the
// spelling suggests: a `[T * N]` value is a **view** — an `i32` address — not N
// elements inline. So a `[T * N]` parameter, local, return and initialised
// global are all one pointer slot, and `changetype<[T * N]>(ptr)` is how an
// address the caller already holds is named with an extent.
//
// Three details are load-bearing and pinned by the `.wat` beside this fixture:
//
//   1. **The stride is the element size.** `u8` shifts by 0, `u32` by 2, `u64`
//      by 3 — `index << alignLog2`, which equals `sizeof` for every element the
//      form accepts. It is *not* a general `sizeof` proof: a record element
//      would need a shift of `log2(extent)`, and the form refuses record
//      elements outright (`AS100`, `fixed-array-value-refusals`). That refusal
//      is what keeps the shift sound, exactly as `array-star-index-read` notes
//      for `[T *]`.
//
//   2. **No bounds check.** `N` is compile-time and the address is the
//      caller's, so there is nothing to compare against: no `if`, no `abort`.
//
//   3. **The extent is not part of the value.** `sizeof<[u32 * 4]>()` is 16
//      because `sizeof` asks the layout, and `alignof<[u32 * 4]>()` is 4. The
//      value that crosses a function boundary is one `i32`, asserted below by
//      the parameter and return cases.

// --- the layout facts the strides ride on ----------------------------------
//
// `alignof<T>()` answers the **log2** of the alignment in this compiler, for
// every kind alike (`alignof<u32>()` is 2, `alignof<u64>()` is 3, `alignof<H>()`
// for a 4-aligned record is 2), so the fixed-array cases are compared against
// the element's answer rather than against a byte count.

assert(sizeof<[u32 * 4]>() == 16);
assert(alignof<[u32 * 4]>() == alignof<u32>());
assert(sizeof<[u8 * 16]>() == 16);
assert(sizeof<[u64 * 2]>() == 16);

// A record holding one, for the sizeof/offsetof pair (D5): the field is inline
// bytes inside the parent, and `sizeof` accounts for all of them.
@unmanaged struct Holder {
  a: u32;
  arr: [u32 * 4];
  b: u32;
}

assert(sizeof<Holder>() == 24);
assert(offsetof<Holder>("arr") == 4);

// --- reads -----------------------------------------------------------------

export function readU32(p: usize, i: i32): u32 {
  const a = changetype<[u32 * 4]>(p);
  return a[i];
}

// The whole point of the form: a fixed extent and no struct wrapper.
export function readAt3(p: usize): u32 {
  const a = changetype<[u32 * 4]>(p);
  return a[3];
}

// Sub-word and 64-bit elements, so neither the stride nor the load width is
// assumed from the widest case.
export function readU8(p: usize, i: i32): u8 {
  const a = changetype<[u8 * 16]>(p);
  return a[i];
}

export function readU64(p: usize, i: i32): u64 {
  const a = changetype<[u64 * 2]>(p);
  return a[i];
}

export function readI32(p: usize, i: i32): i32 {
  const a = changetype<[i32 * 4]>(p);
  return a[i];
}

// --- writes ----------------------------------------------------------------

export function writeU32(p: usize, i: i32, v: u32): void {
  const a = changetype<[u32 * 4]>(p);
  a[i] = v;
}

export function writeU64(p: usize, i: i32, v: u64): void {
  const a = changetype<[u64 * 2]>(p);
  a[i] = v;
}

// --- the value crosses a boundary as one slot ------------------------------

// A `[T * N]` parameter is an address, so this is legal and costs one `i32`.
export function readViaParam(a: [u32 * 4], i: i32): u32 {
  return a[i];
}

// A `[T * N]` return is that same slot: no sret, no caller-allocated storage.
// (Bare-return allocation is Landing 5c; returning an address the callee was
// given is not.)
export function passThrough(p: usize): [u32 * 4] {
  return changetype<[u32 * 4]>(p);
}

// A global holding an address the initializer produced is one `i32` slot.
const GLOBAL_BASE: usize = 4096;
const g: [u32 * 4] = changetype<[u32 * 4]>(GLOBAL_BASE);

export function globalRead(i: i32): u32 {
  return g[i];
}

// --- record field access is unchanged (D4) --------------------------------
//
// The field's address comes from the parent's layout, never from `toRef` on the
// field's own value, which is why this worked before 5a and still does.
export function fieldRead(o: usize): u32 {
  const h = changetype<Holder>(o);
  return h.arr[1];
}

export function fieldWrite(o: usize, v: u32): void {
  const h = changetype<Holder>(o);
  h.arr[1] = v;
}
