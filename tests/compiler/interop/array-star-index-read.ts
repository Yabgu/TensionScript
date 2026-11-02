// `[T *]` — Landing 2: element reads.
//
// `y[i]` compiles to `base + i * sizeof(T)` and then:
//
//   - **scalar element** — a load of the element's own width. `u32` is a 4-byte
//     stride and an `i32.load`; `f64` is 8 and an `f64.load`.
//
//   - **record element** — the **address**, typed as the record. Loading there
//     would read the record's first four bytes and call them a pointer, which is
//     the mistake this form exists to avoid: a record's `Type.byteSize` is its
//     reference size, not its extent. So `y[i].x` composes through the record's
//     own accessor, which is already `f64.load offset=offsetof(T, x)`.
//
// Two details are load-bearing and are pinned by the assertions below plus the
// `.wat` beside this fixture:
//
//   1. **The stride is `sizeof(T)`, not `alignof(T)`.** For `BodyState`
//      (`{x: f64; y: f64}`) that is 16, not 8 — the fixed-array arm's
//      `index << alignLog2` is right only because it refuses record elements
//      outright, and a record element is the ordinary case here.
//
//   2. **No bounds check.** `*` means the length is unknown, so there is nothing
//      to check against. The wat shows no compare and no trap between the
//      address and the load.
//
// `sizeof<BodyState>() == 16` is asserted so the runtime check below and the
// emitted stride cannot drift apart.

@unmanaged struct BodyState {
  x: f64;
  y: f64;
}

assert(sizeof<BodyState>() == 16);

// --- scalar elements -------------------------------------------------------

export function readU32(p: usize, i: i32): u32 {
  const a = changetype<[u32 *]>(p);
  return a[i];
}

export function readF64(p: usize, i: i32): f64 {
  const a = changetype<[f64 *]>(p);
  return a[i];
}

// A constant index folds into the address, and still multiplies by the element
// size rather than assuming byte elements.
export function readU32At2(p: usize): u32 {
  const a = changetype<[u32 *]>(p);
  return a[2];
}

// --- record elements -------------------------------------------------------

export function readX(p: usize, i: i32): f64 {
  const y = changetype<[BodyState *]>(p);
  return y[i].x;
}

// The second field, so the composed read is `addr + offsetof(y)` and not just
// `addr`. A stride bug that happened to land on x would still fail here.
export function readY(p: usize, i: i32): f64 {
  const y = changetype<[BodyState *]>(p);
  return y[i].y;
}

// --- the element as a first-class value ------------------------------------
//
// The resolver types `y[i]` as the element, so a local can hold it: `b` is a
// `BodyState` address, and `b.x` is the same load.
export function viaLocal(p: usize, i: i32): f64 {
  const y = changetype<[BodyState *]>(p);
  const b = y[i];
  return b.x;
}

// --- computed at runtime ---------------------------------------------------
//
// The whole point of the form: the collision solver's arrays have lengths from
// parameters. This is a read, so it is unchecked by contract — the caller owns
// the bound.

export function sum(p: usize, n: i32): f64 {
  const a = changetype<[f64 *]>(p);
  let s: f64 = 0;
  for (let i = 0; i < n; i++) {
    s = s + a[i];
  }
  return s;
}

export function sumX(p: usize, n: i32): f64 {
  const y = changetype<[BodyState *]>(p);
  let s: f64 = 0;
  for (let i = 0; i < n; i++) {
    s = s + y[i].x;
  }
  return s;
}

// Signed and sub-word elements, so the load's signedness and width are not
// assumed from the widest case.
export function readI8(p: usize, i: i32): i8 {
  const a = changetype<[i8 *]>(p);
  return a[i];
}

export function readU16(p: usize, i: i32): u16 {
  const a = changetype<[u16 *]>(p);
  return a[i];
}
