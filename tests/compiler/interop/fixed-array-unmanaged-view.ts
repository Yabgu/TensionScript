// `@unmanaged [T * N]` — Landing 5a.5: a pointer to N elements.
//
// Landing 5a gave `[T * N]` (no prefix) a pointer representation so that
// `changetype<[T * N]>(p)[i]` would compile. That was the **view** case wearing
// the value case's spelling, and 5a.5 splits the two:
//
//   `[T * N]`, `u32[N]`, `@inline [T * N]`   N inline elements, no address
//                                            (`sizeof` = N × sizeof(T))
//   `@unmanaged [T * N]`                     a pointer to N elements
//                                            (`sizeof` = the pointer's)
//   `@managed [T * N]`                       one GC reference (Landing 5c)
//
// So this fixture is 5a's suite with the prefix the form always needed. The
// invariant it pins is the one the taxonomy states: **`@unmanaged [T * N]`
// behaves exactly as `@unmanaged T` does** — one `i32` slot, wherever a
// `@unmanaged T` is allowed.
//
// Two details are load-bearing and pinned by the `.wat` beside this fixture:
//
//   1. **The stride is the element size** — `u8` shifts by 0, `u32` by 2, `u64`
//      by 3 — i.e. `index << alignLog2`. Not a general `sizeof` proof: a record
//      element would need `log2(extent)`, and the stride here is correct only
//      because a record element of this form is a fixed-extent run whose size
//      happens to be a power of two. `[T *]` multiplies by `sizeof` for the
//      general case; this kind's shift is Landing 1's and is not changed here.
//
//   2. **No bounds check.** `N` is compile-time and the address is the
//      caller's, so there is nothing to compare against: no `if`, no `abort`.
//
// The third thing it pins is the split itself: `sizeof<@unmanaged [u32 * 4]>()`
// is 4 (the pointer) while `sizeof<[u32 * 4]>()` on the *value* form is 16.

// --- the layout facts ------------------------------------------------------

assert(sizeof<@unmanaged [u32 * 4]>() == sizeof<usize>());
assert(sizeof<@unmanaged [u32 * 4]>() == 4);
assert(sizeof<@unmanaged [u8 * 16]>() == 4);
assert(sizeof<@unmanaged [u64 * 2]>() == 4);

// The value form, for contrast: same element, same count, different storage.
assert(sizeof<[u32 * 4]>() == 16);
assert(alignof<@unmanaged [u32 * 4]>() == alignof<usize>());

// A record field of the view form is a **pointer slot**, so the parent is
// `4 + 4` bytes, not `4 + 16`. The only difference between the two structures
// below is the prefix, and so is the difference between their sizes.
@unmanaged struct HView {
  n: u32;
  xs: @unmanaged [u32 * 4];
}

@unmanaged struct HValue {
  n: u32;
  xs: [u32 * 4];
}

assert(sizeof<HView>() == 8);
assert(sizeof<HValue>() == 20);
assert(offsetof<HView>("xs") == 4);
assert(offsetof<HValue>("xs") == 4);

// --- reads -----------------------------------------------------------------

export function readU32(p: usize, i: i32): u32 {
  const a = changetype<@unmanaged [u32 * 4]>(p);
  return a[i];
}

// A constant index folds into the address, and still multiplies by the element
// size rather than assuming byte elements.
export function readAt3(p: usize): u32 {
  const a = changetype<@unmanaged [u32 * 4]>(p);
  return a[3];
}

// Sub-word and 64-bit elements, so neither the stride nor the load width is
// assumed from the widest case.
export function readU8(p: usize, i: i32): u8 {
  const a = changetype<@unmanaged [u8 * 16]>(p);
  return a[i];
}

export function readU64(p: usize, i: i32): u64 {
  const a = changetype<@unmanaged [u64 * 2]>(p);
  return a[i];
}

export function readI32(p: usize, i: i32): i32 {
  const a = changetype<@unmanaged [i32 * 4]>(p);
  return a[i];
}

// --- record elements -------------------------------------------------------
//
// The read `[T *]` was built for, with a compile-time count: a pointer to a run
// of records, which is what the collision solver's upgrade wants. The value
// form refuses a record element outright — it would have to lay N records out
// inline, which is Landing 5b — while the view form takes it, because "pointer
// to N records" is exactly what it means.
@unmanaged struct Pair {
  a: u32;
  b: u32;
}

export function readRecordX(p: usize, i: i32): u32 {
  const a = changetype<@unmanaged [Pair * 2]>(p);
  return a[i].a;
}

// The second field, so the composed read is `addr + offsetof(b)` and not just
// `addr`. A stride bug that happened to land on `a` would still fail here.
export function readRecordY(p: usize, i: i32): u32 {
  const a = changetype<@unmanaged [Pair * 2]>(p);
  return a[i].b;
}

// --- writes ----------------------------------------------------------------

export function writeU32(p: usize, i: i32, v: u32): void {
  const a = changetype<@unmanaged [u32 * 4]>(p);
  a[i] = v;
}

export function writeU64(p: usize, i: i32, v: u64): void {
  const a = changetype<@unmanaged [u64 * 2]>(p);
  a[i] = v;
}

export function writeRecordX(p: usize, i: i32, v: u32): void {
  const a = changetype<@unmanaged [Pair * 2]>(p);
  a[i].a = v;
}

// --- the value crosses a boundary as one slot ------------------------------
//
// A pointer is a pointer: parameter, return and initialised global are each one
// `i32`, exactly as they are for `@unmanaged T` or for `[T *]`.

export function readViaParam(a: @unmanaged [u32 * 4], i: i32): u32 {
  return a[i];
}

export function passThrough(p: usize): @unmanaged [u32 * 4] {
  return changetype<@unmanaged [u32 * 4]>(p);
}

const GLOBAL_BASE: usize = 4096;
const g: @unmanaged [u32 * 4] = changetype<@unmanaged [u32 * 4]>(GLOBAL_BASE);

export function globalRead(i: i32): u32 {
  return g[i];
}

// --- a record field holds the pointer, and indexing follows it -------------
//
// The field's own offset comes from the parent's layout (4 — the pointer slot);
// the element address is `*(base + 4) + i * sizeof(u32)`. Two indirections,
// which is what a pointer field means.
export function fieldRead(o: usize, i: i32): u32 {
  const h = changetype<HView>(o);
  return h.xs[i];
}

export function fieldWrite(o: usize, i: i32, v: u32): void {
  const h = changetype<HView>(o);
  h.xs[i] = v;
}
