// The latch is a fixed point, not a discovery order.
//
// An `Array<T>` is typed **first here** — at module scope, before any class that
// could be ineligible exists — and only afterwards does a class turn out to be
// ineligible (it holds an `@unmanaged [T * N]` address, which has no emitter yet). If
// the answer were decided at the first `isGcClass` query it would be `true` here and
// flip to `false` later, after `Array` had already been emitted as a GC struct: a
// mixed module, and a crash before GC10's refusal existed.
//
// `ordering-early.ts` is the same program with the two swapped. Both must report the
// same coverage, which is what makes the answer independent of source order.
const seed: Array<i32> = new Array<i32>(0);
seed.push(40);

class HoldsAddressLate {
  view: @unmanaged [u32 * 4] = changetype<@unmanaged [u32 * 4]>(0);
  first(): i32 { return 2; }
}

export function probe(): i32 {
  let late = new HoldsAddressLate();
  return seed[0] + late.first(); // 40 + 2
}
