// `@inline` in type position: which declarations take it, and which are refused.
//
// **The reservation is lifted.** Until the 1.0 value-type phase, `@inline
// struct` was refused at the declaration with `AS100 "value types (@inline
// struct)"` — a reservation, so the form could not parse-and-ignore (the
// `@fieldOffset` lesson). Commit 1 implements the type kind: the declaration now
// *works*, and it is a C record for `sizeof`/`offsetof`/`alignof`
// (`interop/inline-struct-declared.ts`). What refuses is each *use*
// (`interop/inline-struct-refusals.ts`), by name.
//
// So this fixture pins two things that are still true, and one that is not:
//   - `@inline struct` declares without a diagnostic (the reservation is gone);
//   - `@inline class` is still a genuinely misplaced decorator (AS212) — the
//     value kind is `struct`, and `@inline` on a class means "inline this
//     function", which no class declaration is;
//   - the AS100 reservation message is *gone*, which is what the absence of the
//     first entry in the stderr list asserts.

@inline struct Value {
  x: f32;
}

@inline class Misplaced {
  x: f32;
}

export function run(): i32 {
  // The struct's type-level properties work: it is a record like any other.
  return <i32>(sizeof<Value>() + alignof<Value>());
}
