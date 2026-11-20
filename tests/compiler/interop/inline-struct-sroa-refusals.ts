// SROA's remaining refusals: the two things a per-field-local representation
// cannot carry. Both are named, and both are *features* — each is a case where
// the alternative would be a silent wrong answer.
//
//   1. ~~**A `T[N]` field.**~~ **Accepted now**: the array's elements are N
//      leaves behind a placeholder, and the memory <-> SROA copy walkers descend
//      it (`copyMemoryToSroa` / `copySroaToMemory`). The `makeZero` gap is closed
//      by zeroing each element leaf (`emitSroaZerosToLocal`'s array arm).
//
//   2. **A GC-reference field.** A bare `local.set` skips the write barrier
//      (`link`), so a collected object could be stored into a local the
//      collector has no reason to trace. Refused rather than emitted unsafely.
//
//      Since round VT6 a **class**-typed field (`m: Managed` here, until this
//      round) is refused one hop earlier — where the record is laid out — so this
//      arm is reached through a field `Type#isManaged` calls a reference but the
//      declaration check cannot name: a **function type** carries no
//      `classReference`, and the leaf still has to be refused at the local.
//      Declaring the class field instead is pinned in `inline-struct-managed-leaf.ts`.
//
//   3. **A whole value in a value position** (`let n: u32 = p`). There is no
//      local to read and no address to take; the value exists only as its
//      fields. This is the refusal that makes the representation coherent —
//      without it, "no address" would be a claim rather than a property.
//
// Each case is reachable, and none reads a refused binding, so the expected
// stderr is the diagnostics with no cascade.

@inline struct WithArray {
  arr: u32[4];
}

@inline struct WithManaged {
  f: () => void;                    // a function reference: isManaged, no class
}

@inline struct Plain { x: u32 = 0; }

// 1. a T[N] field: accepted, one element leaf per element (regression guard
//    for the case this fixture used to refuse)
function usesArray(): void {
  let a: WithArray = new WithArray();
}

// 2. a GC-reference field
function usesManaged(): void {
  let m: WithManaged;
}

// 3. the whole value in a value position
function readsWhole(): u32 {
  let p: Plain = new Plain();
  let n: u32 = 0;
  n = p;                            // the whole value, not a copy on declaration
  return n;
}

export function run(): void {
  usesArray();
  usesManaged();
  readsWhole();
}
