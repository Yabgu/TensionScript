// Scalar element assignment — the **discrimination** fixture.
//
// `y[i] = v` is refused when the element is a **record** (see
// `array-star-write-whole-record`), because for a record `y[i]` is an address
// rather than a value slot. It is *not* refused when the element is a scalar,
// because there it is an ordinary store.
//
// That distinction is the one that could silently go wrong: implementing the
// refusal as "both sides have the same type" would refuse this file too, and the
// mistake would look correct against every record test in the suite. So the
// positive case is kept as its own fixture, and its `.wat` is compared — the
// store must be there, at `base + i*sizeof(T)`, with no diagnostic.
//
// The three shapes below are the three ways an assignment reaches the element:
// as a statement, as an expression's value, and as the target of a compound.

export function assignScalar(p: usize, i: i32, v: u32): void {
  const a = changetype<[u32 *]>(p);
  a[i] = v;
}

export function assignScalarAsValue(p: usize, i: i32, v: u32): u32 {
  const a = changetype<[u32 *]>(p);
  return a[i] = v;
}

export function compoundScalar(p: usize, i: i32, v: u32): void {
  const a = changetype<[u32 *]>(p);
  a[i] += v;
}

// A sub-word element still stores at its own width, so the refusal cannot have
// been "scalar but not u32".
export function assignWidth1(p: usize, i: i32, v: u8): void {
  const a = changetype<[u8 *]>(p);
  a[i] = v;
}
