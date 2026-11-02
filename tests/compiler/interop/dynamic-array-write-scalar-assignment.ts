// Scalar element assignment to a dynamic array — the **discrimination** fixture.
//
// `y[i] = v` is refused when the element is a **record**; it is not refused when
// the element is a scalar, which is an ordinary store. Implementing the refusal
// as "both sides have the same type" would refuse this file too and would look
// correct against every record test in the suite.
//
// The bounds check applies here like everywhere else — this fixture is about the
// *element-kind key*, and its `.wat` shows both the check and the store.

export function assignScalar(p: usize, i: i32, v: u32): void {
  const a = changetype<@unmanaged @dynamic [u32 * n]>(p);
  a[i] = v;
}

export function assignScalarAsValue(p: usize, i: i32, v: u32): u32 {
  const a = changetype<@unmanaged @dynamic [u32 * n]>(p);
  return a[i] = v;
}

export function compoundScalar(p: usize, i: i32, v: u32): void {
  const a = changetype<@unmanaged @dynamic [u32 * n]>(p);
  a[i] += v;
}

// A sub-word element still stores at its own width, so the refusal cannot have
// been "scalar but not u32".
export function assignWidth1(p: usize, i: i32, v: u8): void {
  const a = changetype<@unmanaged @dynamic [u8 * n]>(p);
  a[i] = v;
}
