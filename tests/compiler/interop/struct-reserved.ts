// `@inline` is reserved on a struct. 0.8.0; the warning is gone as of 0.9.0.
//
//   @inline struct  -> AS100 "Not implemented: value types (@inline struct)".
//                      Value types are the 1.0 feature; the reservation must
//                      refuse by name, never parse-and-ignore (the @fieldOffset
//                      lesson).
//
//   plain struct    -> no diagnostic, and none since the struct-default flip
//                      either. 0.8.x warned (TS6385) that `struct` would become
//                      a *managed* type at 0.9.0; that change was cancelled and
//                      the warning deleted. The flip that did land points the
//                      same way: a bare `struct` injects `@unmanaged` (the
//                      record layout) **and** `@inline` (value semantics), so
//                      `@inline struct` is the same declaration and neither
//                      spelling warns.
//
//                      This fixture is therefore unchanged in code and its
//                      `.wat` is byte-identical — which is the backward-compat
//                      evidence: the flip adds no codegen to a record used only
//                      through `sizeof`. It also means the two assertions below
//                      no longer distinguish the spellings (both are 4 bytes);
//                      the *storage* difference is pinned by
//                      `interop/struct-default-flip.ts`.
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
