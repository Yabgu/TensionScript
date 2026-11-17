// The latch is a fixed point, not a discovery order.
//
// An `Array<T>` is typed **first here** — at module scope, before any class that
// could be ineligible exists — and only afterwards does a class turn out to be
// ineligible (it holds a `TypedArray`, which is still linear memory). If the answer
// were decided at the first `isGcClass` query, it would be `true` here and flip to
// `false` later, after `Array` had already been emitted as a GC struct: exactly the
// mixed module GC10's refusal exists to prevent, and a crash before that refusal
// existed.
//
// `ordering-early.ts` is the same program with the two swapped. Both must report
// the same coverage, which is what makes the answer independent of source order.
const seed: Array<i32> = new Array<i32>(0);
seed.push(40);

class HoldsTypedArrayLate {
  data: Uint8Array;
  constructor() { this.data = new Uint8Array(2); }
  first(): i32 { return this.data[0]; }
}

export function probe(): i32 {
  let late = new HoldsTypedArrayLate();
  return seed[0] + late.first(); // 40 + 0
}
