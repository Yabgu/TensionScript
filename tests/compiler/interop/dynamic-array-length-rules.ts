// The four `n` binding rules (D5), each a separate error.
//
// `n` is bound at function entry from the header word, so it is a fact about the
// buffer rather than a variable the body owns. That makes four things wrong, and
// each is refused rather than resolved by a guess:
//
//   1. two `[T * n]` parameters — one `n` per function, else it means
//      "whichever came last";
//   2. `n` colliding with a parameter — two different things with one name;
//   3. shadowing it in the body — the loop would then iterate over the shadow;
//   4. assigning it — the compiler's idea of the length would disagree with the
//      buffer's, silently, for the rest of the function.
//
// `.length` remains available for the current value, which is why rule 4's
// message points at it.

// 1. Duplicate binding.
export function duplicate(a: [u32 * n], b: [u32 * n]): void {}

// 2. Collision with a parameter name.
export function collides(a: [u32 * n], n: i32): void {}

// 3. Shadowing.
export function shadows(a: [u32 * n]): void {
  let n = 5;
}

// 4. Assignment.
export function assigns(a: [u32 * n]): void {
  n = 5;
}
