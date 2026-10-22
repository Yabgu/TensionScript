// An inline array of GC references on an `@managed struct` is refused by name,
// with a different reason from the scalar case.
//
// This is not the `makeZero` gap: the record lays out and `sizeof` is
// meaningful. The problem is the collector. `isManaged<Other[4]>()` is false
// (`Type.isManaged` consults only `isInternalReference`,
// `src/types.ts:372-379`, and a fixed array is built with `TypeFlags.None`,
// `:885-889`), while the visitor generator only walks fields whose type is
// managed (`src/builtins.ts:11128`). So the elements would be invisible to the
// collector and every referenced object in the array could be freed while live —
// a use-after-free, not a missing convenience.
//
// Three-way:
//   refuse  (before the check): the field compiled and `sizeof` was right; the
//           untraced elements only show up as a collected object under GC
//           pressure, which no fixture here produces.
//   partial (one shared T[N] message for both element kinds): the author of a
//           reference array would be told about `makeZero`, which is the wrong
//           cause and points at the wrong follow-up.
//   fixed:   this AS100, naming the trace gap.

class Other {
  v: i32 = 0;
}

@managed struct Holder {
  arr: Other[4];
}

export function use(h: Holder): i32 { return 0; }
