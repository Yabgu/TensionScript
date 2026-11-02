// `@unmanaged @dynamic [T * n]` — what it refuses, and why each is a refusal
// rather than something the compiler could quietly do differently.
//
// Every case below is a distinct reason, not a distinct spelling:
//
//   1. `@dynamic` with no owner — inline runtime-length arrays have no WASM
//      representation (no variable stack allocation), so "no model" is not a
//      default that could be guessed.
//   3. `sizeof<[T * n]>` — the type is a pointer; the data has no compile-time
//      extent, and answering 4 would read as a count.
//   3. `[T * N]` where `N` is a compile-time constant — the source asked for a
//      *static* extent and spelled it as a name. Both forms stay
//      distinguishable, and the message names both.
//   4. a GC-managed element — the buffer is not scanned (Landing 3's CX1).
//
// Indexing used to be on this list. Landing 4b implements it — `y[i]` with a
// bounds check — so the positive shapes live in `dynamic-array-index-read.ts`
// and `dynamic-array-index-write.ts`, and whole-record assignment is refused on
// its own terms in `dynamic-array-write-whole-record.ts`.
//
// The length-binding rules (duplicate / collision / shadow / assign) are scoped
// to a function and are pinned in `dynamic-array-length-rules.ts`, so this file
// stays about the type.

class Ref {
  x: i32 = 0;
}

const CONST_N: i32 = 4;

// 1. ~~Managed owner~~ — Landing 4d.1 implements the managed form as a std
//    class reference, so `@managed @dynamic [u32 * n]` now resolves. Its own
//    refusals (indexing, construction, GC element, sizeof) live in
//    `managed-dynamic-refusals.ts`.

// 2. No owner named.
export function unowned(y: @dynamic [u32 * n]): i32 {
  return 0;
}

// 3. sizeof of the view.
export function sizeOfView(y: [u32 * n]): usize {
  return sizeof<[u32 * n]>();
}

// 4. A compile-time constant in the length position.
export function constantLength(y: [u32 * CONST_N]): i32 {
  return 0;
}

// 5. A GC reference in an unscanned buffer.
export function gcElement(y: [Ref * n]): i32 {
  return 0;
}
