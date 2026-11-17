// `if (someReference)` — truthiness of a wasm GC reference.
//
// A class or array type's `kind` is `Usize`, so a `String | null` (and any GC
// class) reached `makeIsTrueish`'s `Usize` arm, which answers the expression
// unchanged. That is right for the pointer ABI — a pointer is an `i32` whose zero
// means null — and wrong under GC, where the answer stayed ref-typed and the
// enclosing `if` asserted in `evaluateCondition`. Measured on `if (out)`, the shape
// `String#replaceAll` uses.
export function probe(): i32 {
  let s: string | null = null;
  let acc = 0;
  if (!s) acc |= 1;            // null is falsy
  if (s) acc |= 2; else acc |= 4;
  s = "x";
  if (s) acc |= 8;             // present is truthy
  if (!s) acc |= 16; else acc |= 4;
  // A non-nullable reference is always true, and must not read as false.
  let t: string = "y";
  if (t) acc |= 16;
  return acc; // 1 (null falsy) | 4 (else of `if (s)`) | 8 (present truthy) | 16
}
