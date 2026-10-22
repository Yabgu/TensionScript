// `COPY_STRUCT<T>` where `T` is an `@managed struct` is refused by name.
//
// `COPY_STRUCT` is `memory.copy(dst, src, offsetof<T>())`
// (`std/assembly/util/bytes.ts:133-135`). For a borrowed record it is the
// struct-copy primitive. For a managed reference it is a byte copy that skips
// the collector's write barrier, so the destination can end up holding a
// pointer the next collection has no reason to trace; and a managed struct has
// no separate value view to copy *from*, because its reference already is its
// fields pointer. Managed copies need a method with the barrier in it (a
// `copyFrom` on the type), not a raw copy.
//
// Three-way:
//   refuse  (before the check): the call compiled to `memory.copy` with
//           `offsetof<T>()` as the length — a plausible-looking copy that
//           silently drops the barrier.
//   partial (a check on `isManaged<T>()` in general): it would also refuse
//           `COPY_STRUCT` of a managed *class*, where the type is a reference
//           and `offsetof` was never a value size — a different question, and
//           one this release does not change.
//   fixed:   this AS100, at the type argument.

import { COPY_STRUCT } from "util/bytes";

@managed struct Rec {
  a: i32 = 0;
}

export function copy(dst: usize, src: usize): void {
  COPY_STRUCT<Rec>(dst, src);
}
