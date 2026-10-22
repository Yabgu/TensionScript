// `@inline` is reserved, and a plain `struct` warns. 0.8.0.
//
// Two different jobs, both about the 0.9.0/1.0 boundary:
//
//   @inline struct  -> AS100 "Not implemented: value types (@inline struct)".
//                      Value types are the 1.0 feature; the reservation must
//                      refuse by name, never parse-and-ignore (the @fieldOffset
//                      lesson).
//
//   plain struct    -> warning TS6385. At 0.8.0 `struct` means the borrowed
//                      form; at 0.9.0 the same spelling becomes a managed
//                      C-layout reference type. Warning from day one is what
//                      keeps 0.8.0 code from changing meaning silently.
//
// The positive cases are the compile-visible ones, so they are here:
//   @unmanaged struct -> no warning, no error (the stable spelling).
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
