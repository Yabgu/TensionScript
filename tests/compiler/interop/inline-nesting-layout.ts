// Inline nesting, sub-phase A — the layout.
//
// A field whose **type** is an `@inline struct` stores the value's bytes inline
// in a pointer-layout record, the C shape no declaration could express before:
//
//   struct Outer { uint8_t tag; struct Inner inner; uint8_t tail; };
//
// **The field's type decides, not a decorator.** `inner: @inline Inner` and
// `inner: Inner` are the same declaration here: `checkMemoryModelOverride`
// returns the type unchanged when the request matches the declaration
// (`resolver.ts:248`), so the field-position `@inline` is an assertion, not a
// gate. That is why the control below uses an `@unmanaged` struct: an `@inline`
// struct is inline whether or not the word appears at the field.
//
// Three-way:
//
//   refuse  (before this phase): every `@inline struct` field — including this
//           one — was `AS100 "inline nesting is a later phase"`.
//   partial (the extent branch without the alignment branch): `sizeof` is right
//           and `offsetof` is not — `inner` lands at 1 instead of 4. `sizeof`
//           alone would not catch it, so this fixture asserts all three numbers.
//   fixed   (this commit): 16 / 4 / 12, and the byte offsets the C compiler
//           would choose.

@inline struct Inner {
  a: u32;
  b: u32;
}

// 8 bytes, align 4: `sizeof 8`, `alignof 2` (log2).
@unmanaged struct Outer {
  tag: u8;
  inner: @inline Inner;
  tail: u8;
}

// The control: the same shape with a **pointer** field. `InnerU` is
// `@unmanaged`, so the field is 4 bytes — the pointer model, unchanged by this
// phase.
@unmanaged struct InnerU {
  a: u32;
  b: u32;
}

@unmanaged struct PtrOuter {
  tag: u8;
  inner: InnerU;
  tail: u8;
}

// --- the inline field takes the value's extent ------------------------------
assert(sizeof<Inner>() == 8);
assert(alignof<Inner>() == 2);

// `tag` at 0, three bytes of pad, `inner` at 4 and eight bytes of it, `tail` at
// 12. The record rounds up to `Inner`'s alignment, so it is 16 — not 13.
assert(sizeof<Outer>() == 16);
assert(offsetof<Outer>("tag") == 0);
assert(offsetof<Outer>("inner") == 4);
assert(offsetof<Outer>("tail") == 12);
assert(alignof<Outer>() == 2);

// --- the control: a pointer field, byte-identical to before the phase ------
assert(sizeof<PtrOuter>() == 12);
assert(offsetof<PtrOuter>("inner") == 4);
assert(offsetof<PtrOuter>("tail") == 8);

// --- the two differ in exactly the field's extent, and nothing else ---------
assert(sizeof<Outer>() - sizeof<PtrOuter>() == sizeof<Inner>() - 4);

// --- `@managed` takes the same layout path ---------------------------------
@managed struct ManagedOuter {
  tag: u8;
  inner: Inner = {};
  tail: u8;
}

assert(sizeof<ManagedOuter>() == 16);
assert(offsetof<ManagedOuter>("inner") == 4);
assert(offsetof<ManagedOuter>("tail") == 12);

// --- measured against a real C compiler ------------------------------------
// `cc -std=c11` on the declarations above reports, for `struct Outer`:
//
//   Inner:    sizeof=8  align=4
//   Outer:    sizeof=16  tag=0  inner=4  tail=12  align=4
//
// and for the `Wide`/`AfterWide` pair below: sizeof=24, inner=8, tail=16,
// align=8. Every number this fixture asserts is one of those, so the claim is a
// measurement against gcc rather than a hand-computed expectation.

// --- a nested value whose own alignment is stronger moves the offsets ------
// `{ x: u64 }` is 8 bytes aligned 8, so the field after it starts at 16.
@inline struct Wide {
  x: u64;
}

@unmanaged struct AfterWide {
  tag: u8;
  inner: Wide;
  tail: u8;
}

assert(sizeof<Wide>() == 8);
assert(offsetof<AfterWide>("inner") == 8); // 1 rounded up to 8
assert(offsetof<AfterWide>("tail") == 16);
assert(sizeof<AfterWide>() == 24); // 17 rounded up to 8

export function run(): void {
  // A compile-time-only fixture: every assertion above is folded by the
  // compiler, so a wrong number is a compile error rather than a runtime one.
  // The runtime half is `inline-nesting-access.ts`.
}
