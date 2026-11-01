// `[T *]` — Landing 1: it parses and binds, but it does not index and it has no
// `sizeof`.
//
// The type is a **pointer to T with unknown length**. That is enough for it to
// be a parameter, a local, a return and a field — one `i32` slot, which is what
// `Type#toRef` answering the pointer type buys, and the reason none of the five
// emitters that crash on `T[N]` (`Type#toRef`'s `assert(false)`) crash here.
//
// What it is *not* yet is an array you can subscript: indexing is Landings 2-3,
// and until then `a[0]` must be a clean refusal rather than a silent
// reinterpretation or a compiler crash. This fixture is that refusal, twice:
//
//   1. `a[0]` — the resolver's index-signature lookup finds no class to hang an
//      operator on, so it reports `TS2329` naming the type as the source spells
//      it (`[u32 *]`, not `UnmanagedArray`). The spelling comes from
//      `Type#kindToString`'s new case.
//
//   2. `sizeof<[u32 *]>()` — a pointer with no length has **no extent**. The
//      tempting answer is the pointer's byte size (4), which is the one number a
//      caller is most likely to mistake for an element count, so it is refused
//      by name (`builtins.ts`, `builtin_sizeof`) and the real answer is spelled
//      out: `sizeof<T>()` plus a count carried separately.
//
// Both refusals are reachable from one file: neither aborts the compile, so the
// pair is reported together and the `.json` beside this fixture holds both.

@unmanaged struct BodyState {
  x: f64;
  y: f64;
}

// 1. Indexing a `[T *]` — scalar element.
export function indexScalar(p: usize): u32 {
  const a = changetype<[u32 *]>(p);
  return a[0];
}

// 1b. Indexing a `[T *]` — record element. The element type is the reason the
//     form exists (a pointer to a run of records), and it is refused by the very
//     same lookup: the refusal is about this *landing*, not about the element.
export function indexRecord(p: usize): f64 {
  const a = changetype<[BodyState *]>(p);
  return a[0].x;
}

// 2. `sizeof` of the view itself.
export function sizeOfView(p: usize): usize {
  return sizeof<[u32 *]>();
}
