// `[T * N]` — Landing 5a: the positions that still refuse.
//
// The landing gives a fixed array a *value representation* (one `i32` address)
// and nothing else. That is enough for every position whose storage the caller
// supplies, which is why the parameter, local, return and initialised-global
// cases moved into `fixed-array-changetype` and are not refused here.
//
// Three positions need something this landing does not have, and each is
// refused by name instead of being compiled:
//
//   1. **A record element.** `[T * N]` where `T` is a record would need a stride
//      of `log2(extent)` rather than `log2(alignof(T))` — the shift element
//      access emits. Refused by the kind check; `[T *]` accepts record elements
//      because its stride is computed through `sizeof` instead.
//
//   2. **A global with no initializer.** `makeZero` answers the null pointer for
//      the kind (as it does for `[T *]`), so the zero would *persist* and the
//      first `g[i]` would read address 0.
//
//   3. **A record field constructed by `new`.** The field is inline storage —
//      `sizeof<H>()` counts its bytes and `offsetof<H>("arr")` finds them inside
//      the parent — while the value representation is one pointer. Constructing
//      the record needs an allocation strategy for those bytes; zeroing the slot
//      instead stores a null pointer where 16 bytes of elements belong, and the
//      setter emits an `i32.store` of the field's extent, which the wasm
//      validator rejects.
//
// None of these may assert: before Landing 5a each one aborted the compiler
// inside `toRef`, inside `makeZero`, or in the wasm validator.

// --- 1. record element -----------------------------------------------------

struct RecordElement {
  a: u32;
  b: u32;
}

export function recordElement(p: usize): u32 {
  const a = changetype<[RecordElement * 2]>(p);
  return a[0].a;
}

// --- 2. global with no initializer ----------------------------------------

let zeroGlobal: [u32 * 4];

export function globalNoInit(): u32 {
  return zeroGlobal[0];
}

// --- 3. record field constructed by `new` ---------------------------------

class NewHolder {
  arr: [u32 * 4];
  constructor(p: usize) {
    this.arr = changetype<[u32 * 4]>(p);
  }
}

export function newField(p: usize): u32 {
  const h = new NewHolder(p);
  return h.arr[0];
}
