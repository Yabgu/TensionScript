// Whole-record assignment to a dynamic array element — refused.
//
// `y[i]` for a record element is an **address**, not a value slot: the element
// `Type` is reference-like, so there is no `sizeof`-sized pile of bytes an
// assignment could copy from. Copying would be `copyInto`, which names its
// destination; writing one field is `y[i].field = v`.
//
// The refusal keys on the **element kind** (a record), not on "both sides have
// the same type". The positive counterpart — `a[i] = 5` over
// `[u32 * n]`, which must keep compiling — is
// `dynamic-array-write-scalar-assignment`, and keeping the two apart is what
// makes the key testable rather than assumed.
//
// Note the bounds check is *not* what refuses this: an in-range whole-record
// assignment would still be refused, because the problem is the shape of the
// store, not the address.

struct BodyState {
  x: f64 = 0;
  y: f64 = 0;
}

// 1. From a parameter.
export function assignRecord(p: usize, i: i32, v: BodyState): void {
  const y = changetype<@unmanaged @dynamic [BodyState * n]>(p);
  y[i] = v;
}

// 2. From another element of the same buffer. The refusal is about what `y[i]`
//    *is*, not where the value came from — there is nothing to copy with either
//    way.
export function assignFromElement(p: usize, i: i32, j: i32): void {
  const y = changetype<@unmanaged @dynamic [BodyState * n]>(p);
  y[i] = y[j];
}
