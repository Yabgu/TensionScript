// `[T * N]` — Landing 5b: why a runtime index stops at eight elements.
//
// A runtime index into a value-form array has no address to scale: the elements
// are separate WASM locals, and locals are not addressable. So the element is
// selected with a `br_table` carrying one block per element, which is a branch
// per candidate. That is cheap for a handful and stops paying for itself past
// eight — and the caller who wants an arbitrary index over many elements wants a
// pointer, which `@unmanaged [T * N]` gives them with no dispatch at all.
//
// The fixture pins that the refusal **names both routes forward** — a constant
// index, or the pointer view — rather than only saying no. The constant-index
// half is not here: a `.json` fixture stops at the first diagnostic, so the
// positive case (sixteen elements, indexed by a constant, which compiles) lives
// in `fixed-array-value-local` where it is actually exercised.

// --- refused: runtime index, N > 8 ---------------------------------------

export function largeRuntime(i: i32): u32 {
  const arr: [u32 * 16] = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16
  ];
  return arr[i];
}
