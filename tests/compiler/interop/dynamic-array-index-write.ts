// `@unmanaged @dynamic [T * n]` — indexing, writes. Landing 4b.
//
// Every write carries the same bounds check its read does, and the same
// `headerSize + i*sizeof(T)` address. A record field write needs **no arm of its
// own**: `y[i]` is the element's address, so the record's own setter takes it as
// `this` and stores at `addr + offsetof(T, field)`.
//
// Compound and increment call the access twice — once for the read the operator
// performs, once for the store — so the check is emitted twice. That is
// deliberate: sharing one check would mean threading a checked address through
// the operator's codegen, which does not know this arm exists. The brief allowed
// either; this is the one that does not touch code it should not own.
//
// Post-increment yields the **old** value and pre yields the **new** one; the
// `.wat` beside this fixture is what makes that a check rather than a claim.

@unmanaged struct BodyState {
  x: f64;
  y: f64;
}

// --- scalar writes ---------------------------------------------------------

export function writeU32(p: usize, i: i32, v: u32): void {
  const a = changetype<@unmanaged @dynamic [u32 * n]>(p);
  a[i] = v;
}

export function writeF64(p: usize, i: i32, v: f64): void {
  const a = changetype<@unmanaged @dynamic [f64 * n]>(p);
  a[i] = v;
}

// --- record field writes ---------------------------------------------------

export function writeX(p: usize, i: i32, v: f64): void {
  const y = changetype<@unmanaged @dynamic [BodyState * n]>(p);
  y[i].x = v;
}

// The second field, so the store lands at `addr + 8` and not just `addr`.
export function writeY(p: usize, i: i32, v: f64): void {
  const y = changetype<@unmanaged @dynamic [BodyState * n]>(p);
  y[i].y = v;
}

// --- compound --------------------------------------------------------------

export function addU32(p: usize, i: i32, v: u32): void {
  const a = changetype<@unmanaged @dynamic [u32 * n]>(p);
  a[i] += v;
}

export function addField(p: usize, i: i32, v: f64): void {
  const y = changetype<@unmanaged @dynamic [BodyState * n]>(p);
  y[i].y += v;
}

// --- increment / decrement, all four forms ---------------------------------

export function postInc(p: usize, i: i32): u32 {
  const a = changetype<@unmanaged @dynamic [u32 * n]>(p);
  return a[i]++;
}

export function preInc(p: usize, i: i32): u32 {
  const a = changetype<@unmanaged @dynamic [u32 * n]>(p);
  return ++a[i];
}

export function postDec(p: usize, i: i32): u32 {
  const a = changetype<@unmanaged @dynamic [u32 * n]>(p);
  return a[i]--;
}

export function preDec(p: usize, i: i32): u32 {
  const a = changetype<@unmanaged @dynamic [u32 * n]>(p);
  return --a[i];
}

// --- the write usable as a value -------------------------------------------

export function assignAsValue(p: usize, i: i32, v: u32): u32 {
  const a = changetype<@unmanaged @dynamic [u32 * n]>(p);
  return a[i] = v;
}
