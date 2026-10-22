// `@inline` is reserved on a struct. 0.8.0; the warning is gone as of 0.9.0.
//
//   @inline struct  -> AS100 "Not implemented: value types (@inline struct)".
//                      Value types are the 1.0 feature; the reservation must
//                      refuse by name, never parse-and-ignore (the @fieldOffset
//                      lesson).
//
//   plain struct    -> no diagnostic, as of 0.9.0. 0.8.x warned (TS6385) that
//                      `struct` would become a managed type at 0.9.0; that
//                      change is cancelled, so the warning is gone and plain
//                      `struct` means `@unmanaged struct` permanently. The
//                      assertions below still pin the borrowed layout, which is
//                      the part that must not change.
//
// The positive cases are the compile-visible ones, so they are here:
//   @unmanaged struct -> no diagnostic (the explicit spelling; now redundant,
//                        still valid).
//   @inline class     -> AS212, unchanged (a misplaced decorator, not a
//                        reservation).
//
// The two error cases cannot be asserted from inside a compiled module — the
// module does not exist when the diagnostic fires — so they are driven through
// the CLI by the test script below, which checks the *code*, not just that
// something failed.

struct Warned {
  x: f32 = 0;
}

@unmanaged struct Explicit {
  x: f32 = 0;
}

// --- fixed: the stable spelling compiles and lays out as the borrowed form ---
assert(sizeof<Explicit>() == 4);
assert(offsetof<Explicit>("x") == 0);

// `Warned` compiles too (the warning is not an error) and is the same record.
assert(sizeof<Warned>() == 4);
assert(sizeof<Warned>() == sizeof<Explicit>());

export function run(): i32 {
  return sizeof<Warned>() + sizeof<Explicit>();
}
