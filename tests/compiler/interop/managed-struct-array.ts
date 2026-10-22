// A `T[N]` field on an `@managed struct` is refused by name.
//
// Field initialization cannot fill an extent today: `makeZero`
// (`src/compiler.ts:10688`) has no `FixedArray` case and traps the compiler, so
// constructing *any* type with such a field — managed or not — kills the build
// with an AssertionError instead of a diagnostic. A managed struct is
// heap-constructed by definition, so it would hit that on every `new`.
//
// Refusing here is the honest reading: the extent-filling phase is a separate
// piece of work, and a feature that promised `T[N]` fields would ship a compiler
// crash. `@unmanaged struct` keeps `T[N]` exactly as 0.8.x had it (borrowed,
// addressed through `changetype`) — see `fixed-array.ts`.
//
// Three-way:
//   refuse  (before the check): the compiler crashed with an AssertionError at
//           `makeZero`, naming no type and no field.
//   partial (a check on the array's *size* or a warning): the field would be
//           accepted and `new` would still trap, so the diagnostic would be
//           noise beside a crash.
//   fixed:   this AS100, naming the field's type node.

@managed struct Holder {
  head: i32 = 0;
  arr: u32[8];
}

export function use(h: Holder): i32 { return h.head; }
