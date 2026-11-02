// Whole-record assignment to a `[T *]` element — refused.
//
// `y[i]` for a record element is an **address**, not a value slot: the element
// `Type` is reference-like, so there is no `sizeof`-sized pile of bytes the
// assignment could copy from a value that is itself stored elsewhere. Copying
// would be `copyInto`, which names its destination explicitly.
//
// The refusal keys on the **element kind** (a record), not on "both sides have
// the same type". The positive counterpart — `a[i] = 5` over `[u32 *]`, which
// must keep compiling — is `array-star-write-scalar-assignment`, and keeping the
// two apart is what makes the key testable rather than assumed.
//
// The field form is the supported way to write part of a record, and it needs no
// new codegen: the address `y[i]` yields is exactly the `this` the record's
// setter takes.

struct BodyState {
  x: f64 = 0;
  y: f64 = 0;
}

// 1. From a parameter — the ordinary shape.
export function assignRecord(p: usize, i: i32, v: BodyState): void {
  const y = changetype<[BodyState *]>(p);
  y[i] = v;
}

// 2. From another element of the same array. The refusal is about what `y[i]`
//    *is*, not about where the value came from, so an address-to-address
//    assignment is refused for the same reason — there is nothing to copy with.
export function assignFromElement(p: usize, i: i32, j: i32): void {
  const y = changetype<[BodyState *]>(p);
  y[i] = y[j];
}
