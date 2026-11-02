// Indexed writes to a `[T *]` — refused, and refused *by name*.
//
// Landing 2 delivers reads only. A write addresses memory through a pointer whose
// length is unknown, which is a different promise from a read: reading a wrong
// element yields a wrong number, writing one corrupts whatever lives there. So
// the store paths stay closed until Landing 3 and say so.
//
// The three codegen intercepts are the ones that already exist for `T[N]`
// (compound assignment, plain assignment, `++`/`--`). None of them goes through
// `compileAssignment`'s ordinary target lookup, which is why the refusal is
// installed at each rather than once.
//
// A write can address the element itself or a field of it, and the field form is
// the one that would otherwise slip through: `y[i].x = v` looks up a *property*
// on the element's class, finds the setter, and would store — so the check peels
// property accesses down to the element access underneath before deciding.
//
// All six forms below must report the same diagnostic, and the diagnostic must
// name the landing rather than the resolver's old
// `TS2329 Index signature is missing in type '[u32 *]'`, which after Landing 2
// would read as a bug in a type that deliberately has no index signature.

@unmanaged struct BodyState {
  x: f64;
  y: f64;
}

// 1. Scalar element, plain assignment.
export function writeScalar(p: usize, i: i32, v: u32): void {
  const a = changetype<[u32 *]>(p);
  a[i] = v;
}

// 2. Record field, plain assignment.
export function writeField(p: usize, i: i32, v: f64): void {
  const y = changetype<[BodyState *]>(p);
  y[i].x = v;
}

// 3. Scalar element, compound assignment.
export function compoundScalar(p: usize, i: i32, v: u32): void {
  const a = changetype<[u32 *]>(p);
  a[i] += v;
}

// 4. Scalar element, increment.
export function incrementScalar(p: usize, i: i32): void {
  const a = changetype<[u32 *]>(p);
  a[i]++;
}

// 5. Record field, compound assignment.
export function compoundField(p: usize, i: i32, v: f64): void {
  const y = changetype<[BodyState *]>(p);
  y[i].x += v;
}

// 6. Record field, increment.
export function incrementField(p: usize, i: i32): void {
  const y = changetype<[BodyState *]>(p);
  y[i].x++;
}
