// A wasm GC array has no address. `changetype<usize>(aString)` must be a
// diagnostic, not a silent `i32` — measuring it matters because `String#replaceAll`
// builds exactly this shape (`changetype<usize>(out)` inside `__renew`) and, before
// the check, compiled and answered a wrong length.
export function addr(): usize {
  let s = "abc";
  return changetype<usize>(s);
}
