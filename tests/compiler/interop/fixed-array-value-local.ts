// `[T * N]` — Landing 5b: the value form as a **local**.
//
// The previous 5b attempt tried a stack slot and STOPped: `visitStack` scans
// every word of `[__stack_pointer, __heap_base)` as a GC root
// (`std/assembly/rt/itcms.ts:167`) and `__visit` has no validity check, so
// element bytes placed there are read as object headers at `ptr -
// TOTAL_OVERHEAD`. There is no per-function frame machinery to hang a slot on
// anyway — the only region is `ensureSretStack`'s static one, and it is placed
// in the data segment precisely so the collector will *not* scan it.
//
// So the value form gets the representation `@inline struct` already has: one
// WASM local per scalar leaf, and no local for the array itself. `[u32 * 4]` is
// four `i32` locals; `arr[2]` is `local.get` on the third. No address, no
// pointer, nothing for the collector to scan — which is exactly the design
// invariant ("inline bytes, no address, can be represented by registers").
//
// What this pins, and why each part is load-bearing:
//
//   1. **A constant index is a `local.get`, not a load.** There is no memory in
//      the picture at all.
//   2. **A runtime index is a `br_table`**, one block per element, because WASM
//      locals are not addressable. The bodies sit *after* their block's `end`,
//      which is where a branch target lands — written the other way round first,
//      which silently shifted every element by one (`i=0,1,2,3` gave
//      `10,10,20,30`) with no diagnostic.
//   3. **Copies are real.** `let b = a` copies leaf by leaf, so a write through
//      `b` cannot be seen through `a`. The alternative — one slot holding an
//      address — aliases, which is the hazard `checkInlineStructValue` describes
//      ("it looks like the feature works, and `let q = p` aliases").
//   4. **The extent is unchanged.** `sizeof<[u32 * 4]>()` is still 16: the
//      representation changed, the layout did not.

assert(sizeof<[u32 * 4]>() == 16);
assert(sizeof<[u8 * 8]>() == 8);
assert(sizeof<[f64 * 2]>() == 16);

// --- literal + constant index ---------------------------------------------

export function literal(): u32 {
  const arr: [u32 * 4] = [10, 20, 30, 40];
  return arr[2] * 100 + arr[0];
}

// A constant index that folds at compile time, still one `local.get`.
export function literalLast(): u32 {
  const arr: [u32 * 4] = [10, 20, 30, 40];
  return arr[3];
}

// Zero-init is free: a WASM local starts at zero, so this emits no stores.
export function zeroed(): u32 {
  let arr: [u32 * 4];
  arr[1] = 5;
  return arr[0] + arr[1] + arr[2];
}

// --- constant-index writes ------------------------------------------------

export function writeConst(): u32 {
  let arr: [u32 * 4];
  arr[2] = 42;
  arr[0] = 8;
  return arr[2] - arr[0];
}

// --- runtime index (reads) -----------------------------------------------

export function readRuntime(i: i32): u32 {
  const arr: [u32 * 4] = [10, 20, 30, 40];
  return arr[i];
}

// A runtime **write** is deliberately not in this fixture. It is correct —
// `arr[i] = v` stores into the selected leaf, measured out of band — but the
// store case materialises the value into a temp local (one WASM node cannot be
// the parent of N stores), and *which* local the temp lands in differs between
// the dist build and the bootstrap build. That makes the emitted wat differ by
// local index, and this fixture is byte-compared. Behaviour is identical; only
// the numbering moves, which is the byte-identity caveat the discipline note
// says the gate must not be built on.

// Two runtime accesses in one function: the `br_table` labels carry a
// per-emission suffix, because a write compiles its target more than once and
// Binaryen rejects repeated block names.
export function twoRuntime(i: i32, j: i32): u32 {
  const arr: [u32 * 4] = [10, 20, 30, 40];
  return arr[i] + arr[j];
}

// --- copy semantics -------------------------------------------------------

export function copyIndependence(): u32 {
  const a: [u32 * 4] = [1, 2, 3, 4];
  let b: [u32 * 4] = a;
  b[0] = 99;
  return a[0] * 100 + b[0];   // 199 when copying, 9999 when aliased
}

export function assignIndependence(): u32 {
  let a: [u32 * 4] = [1, 2, 3, 4];
  let b: [u32 * 4] = [0, 0, 0, 0];
  b = a;
  b[2] = 77;
  return a[2] * 100 + b[2];   // 377 when copying, 7777 when aliased
}

// --- element widths -------------------------------------------------------
//
// The leaves take the element's own WASM type, so a sub-word or 64-bit element
// is not widened by the representation.

export function narrow(): u8 {
  const arr: [u8 * 8] = [1, 2, 3, 4, 5, 6, 7, 8];
  return arr[7];
}

export function wide(): f64 {
  const arr: [f64 * 2] = [1.5, 2.5];
  return arr[1];
}

// --- sixteen elements, constant index ------------------------------------
//
// **A constant index is unbounded.** Only runtime *selection* is capped at eight
// (`fixed-array-value-large-N`), because that is where the `br_table` starts
// costing more than a pointer view. A constant names its leaf directly, so the
// extent does not matter.

export function largeConstant(): u32 {
  const arr: [u32 * 16] = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16
  ];
  return arr[15];
}
