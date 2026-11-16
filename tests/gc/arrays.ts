// `StaticArray<T>` as a wasm GC array, through the real compiler path.
//
// `StaticArray` is a bare block — `[key: number]: T`, data at offset 0, length
// implied by the allocation, no `length_` field — so it maps 1:1 onto
// `(array (mut T))` with no growth policy to invent.

class Item {
  v: i32;
  constructor(v: i32) { this.v = v; }
}

// --- primitives -------------------------------------------------------------

export function makeN(n: i32): StaticArray<i32> {
  let a = new StaticArray<i32>(n);
  for (let i = 0; i < n; ++i) a[i] = i * 3;
  return a;
}

export function sum(a: StaticArray<i32>): i32 {
  let t = 0;
  for (let i = 0; i < a.length; ++i) t += a[i];
  return t;
}

export function len(a: StaticArray<i32>): i32 { return a.length; }

/** 0,3,6,9 → write 100 at 1 → 0,100,6,9 = 115; ×100 + length 4. */
export function probe(): i32 {
  let a = makeN(4);
  a[1] = 100;
  return sum(a) * 100 + a.length;
}

/** Reads past the end: must abort with the stdlib's `Index out of range`. */
export function outOfRange(): i32 {
  let a = new StaticArray<i32>(2);
  return a[5];
}

/** Writes past the end: the same. */
export function outOfRangeWrite(): void {
  let a = new StaticArray<i32>(2);
  a[9] = 1;
}

// --- managed elements -------------------------------------------------------
//
// The point of the round: `array.set` puts a *reference* into the array, and the
// engine's tracer follows it. GC5 proved that at the IR level; this is the same
// claim through the compiler.

export function makeItems(n: i32): StaticArray<Item> {
  let a = new StaticArray<Item>(n);
  for (let i = 0; i < n; ++i) a[i] = new Item(i + 1);
  return a;
}

export function itemSum(a: StaticArray<Item>): i32 {
  let t = 0;
  for (let i = 0; i < a.length; ++i) t += a[i].v;
  return t;
}

export function itemCount(a: StaticArray<Item>): i32 { return a.length; }

/** 1+2+3+4 = 10, and 4 elements. */
export function managedProbe(): i32 {
  let a = makeItems(4);
  return itemSum(a) * 100 + itemCount(a);
}
