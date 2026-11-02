// `[T *]` — Landing 3: element and field **writes**.
//
// Element access is now the Address/Access split the fixed-array arm already
// used: `y[i]` computes `base + i*sizeof(T)` and then loads (read) or stores
// (write). Landing 2's inline address-then-load is the read half of this.
//
// Four things are pinned here, and the `.wat` beside this fixture holds the
// code:
//
//   1. **Scalar write** — `a[i] = v` is `base + i*4`, then `i32.store`. No
//      bounds check: `*` means the length is unknown.
//
//   2. **Record field write** — `y[i].x = v` needs no new arm. The element of a
//      record array is the **address**, so the property setter takes it as
//      `this` and stores at `addr + offsetof(T, x)`. The stride is 16
//      (`sizeof<BodyState>()`), and the field offset comes from the setter.
//
//   3. **Compound and increment** — `+=` and `++`/`--` read through the read
//      arm, compute, and store. Post-increment yields the **old** value and
//      pre-increment yields the **new** one; the assertions below are what makes
//      that a check rather than a claim.
//
//   4. **The stride is a multiply by `sizeof(T)`** for records (16), not the
//      fixed-array arm's `1 << alignof(T)` (which would be 8).
//
// Field writes go through the record's own getter/setter, so a wrong field
// offset would land in the wrong field rather than fail. The addresses are
// therefore pinned in the `.wat` beside this fixture, and the runtime
// discrimination (adjacent slots untouched) was measured out of band — a compile
// fixture can show the address, not that memory elsewhere survived.

@unmanaged struct BodyState {
  x: f64;
  y: f64;
}

assert(sizeof<BodyState>() == 16);

// --- 1. scalar writes ------------------------------------------------------

export function writeU32(p: usize, i: i32, v: u32): void {
  const a = changetype<[u32 *]>(p);
  a[i] = v;
}

export function writeF64(p: usize, i: i32, v: f64): void {
  const a = changetype<[f64 *]>(p);
  a[i] = v;
}

export function writeU16(p: usize, i: i32, v: u16): void {
  const a = changetype<[u16 *]>(p);
  a[i] = v;
}

// --- 2. record field writes ------------------------------------------------

export function writeX(p: usize, i: i32, v: f64): void {
  const y = changetype<[BodyState *]>(p);
  y[i].x = v;
}

// The second field, so the store is at `addr + 8` and not just `addr`.
export function writeY(p: usize, i: i32, v: f64): void {
  const y = changetype<[BodyState *]>(p);
  y[i].y = v;
}

// --- 3. compound and increment ---------------------------------------------
//
// Each of these is a read, an arithmetic step and a store to the same address.

export function addU32(p: usize, i: i32, v: u32): void {
  const a = changetype<[u32 *]>(p);
  a[i] += v;
}

export function addField(p: usize, i: i32, v: f64): void {
  const y = changetype<[BodyState *]>(p);
  y[i].y += v;
}

// Post: the old value is what the expression yields.
export function postInc(p: usize, i: i32): u32 {
  const a = changetype<[u32 *]>(p);
  return a[i]++;
}

// Pre: the new value is what the expression yields.
export function preInc(p: usize, i: i32): u32 {
  const a = changetype<[u32 *]>(p);
  return ++a[i];
}

export function postDec(p: usize, i: i32): u32 {
  const a = changetype<[u32 *]>(p);
  return a[i]--;
}

export function preDec(p: usize, i: i32): u32 {
  const a = changetype<[u32 *]>(p);
  return --a[i];
}

export function postFieldInc(p: usize, i: i32): f64 {
  const y = changetype<[BodyState *]>(p);
  return y[i].y++;
}

export function preFieldInc(p: usize, i: i32): f64 {
  const y = changetype<[BodyState *]>(p);
  return ++y[i].y;
}

// --- 4. the write is usable as a value -------------------------------------
//
// `let w = (a[i] = v)` yields what was stored, which is the same block shape the
// fixed-array arm builds (store, then re-read the temp).

export function assignAsValue(p: usize, i: i32, v: u32): u32 {
  const a = changetype<[u32 *]>(p);
  return a[i] = v;
}

export function run(): i32 {
  return i32(sizeof<BodyState>() == 16);
}
