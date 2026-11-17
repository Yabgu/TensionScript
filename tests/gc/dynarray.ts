// Dynamic `Array<T>` on the GC heap, via the compiler-synthesised layout.
//
// `Array` grows and the glue has no `array.grow`, so it is not a wasm array: it is
// a struct `{ <brand>, data: (ref null (array (mut T))), length_ }` where
// `array.len data` is the **capacity** and `length_` the used count. The layout
// exists only in the compiler, so `std/assembly/array.ts` is unedited and flag-off
// code is untouched by construction.

class Item {
  v: i32;
  constructor(v: i32) { this.v = v; }
}

/** 100 pushes (several 2× growths), read back, then pop. */
export function prim(): i32 {
  let a = new Array<i32>(0);
  for (let i = 0; i < 100; ++i) a.push(i);
  let t = 0;
  for (let i = 0; i < a.length; ++i) t += a[i];
  a.pop();
  return a.length * 100000 + t;      // 99 * 100000 + 4950
}

/** 40 managed elements, each checked against the object it should be. */
export function grown(): i32 {
  let a = new Array<Item>(0);
  for (let i = 0; i < 40; ++i) a.push(new Item(i + 1));
  let ok = 0;
  for (let i = 0; i < a.length; ++i) if (a[i].v == i + 1) ++ok;
  return ok * 1000 + a.length;       // 40040
}

/** A fresh array: length 0 even though capacity is `MIN_SIZE` (8). */
export function freshLength(): i32 { return new Array<i32>(0).length; }

/** Within capacity, past the used count: out of range. */
export function readPastLength(): i32 {
  let a = new Array<i32>(0);
  a.push(1);
  return a[3];
}

/** The same for a store. */
export function writePastLength(): void {
  let a = new Array<i32>(0);
  a.push(1);
  a[5] = 9;
}

export function popEmpty(): i32 { return new Array<i32>(0).pop(); }
