// SROA's own refusals: the two things a per-field-local representation cannot
// carry in this phase. Both are named, and both are *features* — each is a case
// where the alternative would be a silent wrong answer.
//
//   1. **A `T[N]` field.** SROA keeps one WASM local per field, and an array is
//      an extent, not a value: it needs N locals (deep SROA) and a `makeZero`
//      case that does not exist yet (`makeZero` has no `FixedArray` arm — it
//      asserts). Refused rather than decomposed.
//
//   2. **A GC-reference field.** A bare `local.set` skips the write barrier
//      (`link`), so a collected object could be stored into a local the
//      collector has no reason to trace. Refused rather than emitted unsafely.
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
  m: Managed;                       // a @managed struct: a GC reference
}

@managed struct Managed { v: u32 = 0; }

@inline struct Plain { x: u32 = 0; }

// 1. a T[N] field
function usesArray(): void {
  let a: WithArray = new WithArray();
}

// 2. a GC-reference field
function usesManaged(): void {
  let m: WithManaged = new WithManaged();
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
