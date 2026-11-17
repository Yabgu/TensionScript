// The mirror of `ordering-late.ts`: the ineligible class is declared and used
// *first*, and the `Array<i32>` is typed after it. Same program, same answer — the
// latch is computed once from every declared class, so neither source order can
// decide it.
class HoldsTypedArrayEarly {
  data: Uint8Array;
  constructor() { this.data = new Uint8Array(2); }
  first(): i32 { return this.data[0]; }
}

const seed: Array<i32> = new Array<i32>(0);
seed.push(40);

export function probe(): i32 {
  let early = new HoldsTypedArrayEarly();
  return seed[0] + early.first(); // 40 + 0
}
