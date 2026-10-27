// Sized enums — the two refusals. A declared width is a contract, so a member
// that does not fit it is refused at the declaration, before any codegen.
//
// Why a declaration guard and not just the conversion: `compileInlineConstant`
// (`src/compiler.ts`, the `U8`/`U16` arm) **masks** rather than refuses, so a
// `const enum` member of 300 in a `u8` enum would silently inline as 44. And
// the conversion machinery only refuses *literals* (`determineIntegerLiteralType`
// refuses `let x: u8 = 300`); a folded constant such as `200 + 200` passes the
// assignment conversion and is masked silently — measured, `let x: u8 = 200 +
// 200` compiles today. So the guard is the only check that sees every member.
//
// The two diagnostics below are deliberately different:
//   TS6404 is the declaration guard: it names the member and the width.
//   AS200  is the existing literal conversion refusal, which still fires for a
//          literal out of range. Both appear for `A = 300`; that is the split
//          the scoping doc describes ("keep AS200 for the out-of-range case,
//          and add one enum-specific diagnostic that says more").
//
// Three-way, as stderr patterns:
//   refuse  (before this phase): `enum Big: u8 { … }` is `TS1005` at the colon,
//           so none of these declarations exist to be checked.
//   partial (the type repoint without the guard): every declaration below
//           compiles, and `Big.A` becomes 44 / `Carry.B` becomes 0 — the
//           silent truncation this fixture exists to prevent.
//   fixed:   each is refused, by the diagnostic named.

enum Big: u8 {
  A = 300
}

enum Carry: u8 {
  A = 255,
  B
}

// The carry case, three deep: a refused member must not leave the *next* one
// referencing a global that was never added — that was a Binaryen exception
// (crash, no diagnostic) before this fixture existed.
enum CarryChain: u8 {
  A = 255,
  B,
  C
}

// The initializer is compiled *at the underlying type*, which is what gives the
// literal range check for free — and which is why a non-constant i32-returning
// initializer needs a cast, exactly as `let x: u8 = g()` does. Not a sized-enum
// special case; the same rule as any narrow assignment.
function g(): i32 {
  return 3;
}

enum CallsI32: u8 {
  A = g()
}

enum Negative: u8 {
  A = -1
}

enum Signed: i8 {
  A = 128
}

enum Wide: u16 {
  A = 65536
}

// The conversion cannot see this one: a folded non-literal constant. This is
// the case AS200 does not catch, and the reason the guard is not redundant.
enum Folded: u8 {
  A = 200 + 200
}

enum BoolBacked: bool {
  A
}

enum I64Backed: i64 {
  A
}

enum F32Backed: f32 {
  A
}

export function use(): u8 {
  return Big.A;
}

ERROR("EOF");
