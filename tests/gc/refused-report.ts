// A build with a refusal must never report full coverage (GC26).
//
// The report has now lied three times, each in a different way, and this is the fourth:
//
//   GC14  the report was gated on the latch, so it was silent in the one case it existed
//         for — a program that migrated nothing;
//   GC23  a reference-keyed `Map` held the latch off and the line said "held back only by
//         the latch", naming a rule nothing in the class walk could see;
//   GC26  a class whose *record* was refused still counted as migrated, so the build failed
//         with AS100 and the line still claimed `2 of 2 managed classes on the GC ABI`.
//
// The invariant that closes the family: **a class the compiler refused is not a class it
// migrated.** A refusal raised before emission is a fact about the program, and the coverage
// arithmetic has to agree with it — `GC + exempt + refused = total`, with a refusal
// forbidding `onGc == total`.
//
// This fixture is the refusal: an `@unmanaged` record holding a GC reference, which cannot be
// a C record at all, so the build fails. What the assertion pins is the *report*, because a
// wrong report is how a reader ends up debugging the wrong thing.
@unmanaged class Blob {
  ref: string | null = null;
}

class Holds {
  b: Blob | null = null;
}

export function probe(): i32 {
  let h = new Holds();
  h.b = new Blob();
  return 1;
}
