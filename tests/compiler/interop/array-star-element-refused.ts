// Cross-element assignment — refused, for both array kinds.
//
// The counterpart of `array-star-element-safe.ts`: that file proves the escape
// hatch (`changetype`) still works and same-element assignment still works; this
// one pins what must not work.
//
// Each case is one assignment path, because they are enforced at two different
// sites and a regression in either would otherwise hide behind the other:
//
//   1. a declaration's initializer        — `convertExpression`'s "same kind"
//                                            early return
//   2. a reassignment                     — the same, via `compileAssignment`
//   3. an argument                        — the same, via the parameter convert
//   4. a function expression's parameter  — `Type#isStrictlyAssignableTo`
//      contextual type
//
// The `T[N]` case is type-level only (4b): any `T[N]` in a local or parameter
// position reaches `Type#toRef`'s assert first, which is Landing 5's crash, so an
// assignment-level probe cannot tell the assignability question apart from it.

@unmanaged struct BodyState {
  x: f64;
  y: f64;
}

function takesF64Pointer(q: [f64 *]): u32 {
  return 0;
}

// 1. Declaration initializer.
export function declInit(p: [u32 *]): u32 {
  const q: [f64 *] = p;
  return 0;
}

// 2. Reassignment, after a legal initializer.
export function reassign(p: [u32 *]): u32 {
  let q: [f64 *] = changetype<[f64 *]>(p);
  q = p;
  return 0;
}

// 3. Argument.
export function argument(p: [u32 *]): u32 {
  return takesF64Pointer(p);
}

// 4a. Function expression whose parameter contradicts the contextual signature.
export function fnExprUnmanaged(): u32 {
  const g: (q: [f64 *]) => u32 = (q: [u32 *]): u32 => 0;
  return 0;
}

// 4b. The same for an inline array, which reaches the check by type alone.
export function fnExprFixed(): u32 {
  const g: (q: f64[4]) => u32 = (q: u32[4]): u32 => 0;
  return 0;
}

// 5. A record element is not a wildcard either: `[BodyState *]` is not
//    `[f64 *]`, even though both are 4-byte-aligned pointer-ish values.
export function recordVsScalar(p: [f64 *]): u32 {
  const q: [BodyState *] = p;
  return 0;
}
