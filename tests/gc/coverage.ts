// The coverage report: what `--wasmGc` actually did to *this* program.
//
// The flag makes two different promises depending on the program, and a reader must
// be able to tell which one they got without inspecting the module. A flag that
// claims to move managed classes to another representation, and silently moves
// zero, is indistinguishable from one that works — which is why the report is
// gated on `--wasmGc` and **not** on the latch.
//
// Two programs, and the pair is the point: `coverage-uniform.ts` is uniform and
// reports INFO TS6413 `N of N`; this file is not uniform and reports WARNING TS6414
// naming the cause.
//
// The cause here is an **`@unmanaged [T * N]` array address**, which is the shape that is
// fixable and *not* yet emitted: an address is storable in principle (`@unmanaged` is
// erased and allocates nothing), and the emitter for a fixed-length view is what has not
// been built. Every class the migration has taken — `String`, `StaticArray`, `Array`, the
// typed arrays, `ArrayBuffer`, `Map`, `Set`, function values — is eligible now, so the
// fixable bucket has to name the one that is left.
class HoldsAddress {
  view: @unmanaged [u32 * 4] = changetype<@unmanaged [u32 * 4]>(0);
  n: i32 = 0;
}

class HoldsAddressToo {
  other: @unmanaged [u32 * 8] = changetype<@unmanaged [u32 * 8]>(0);
}

export function reportBlocked(): i32 {
  let a = new HoldsAddress();
  let b = new HoldsAddressToo();
  return a.n + 7; // 7
}
