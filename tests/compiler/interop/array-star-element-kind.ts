// Element kinds a `[T *]` refuses — GC-managed elements.
//
// The buffer behind a `[T *]` is not scanned. A GC reference stored in it is not
// a root, so the collector may reclaim the object while the array still holds the
// word, and the next `y[i]` dereferences freed memory. That is a provenance
// question, not a layout one: no byte offset can make an unscanned slot a root.
//
// Measured before this refusal existed: `[Foo *]` over a `class Foo` compiled,
// with a stride of 4 (the reference width) and a load-then-getter read. The
// arithmetic was right and the ownership was not.
//
// Two shapes are refused, both `Type#isManaged`:
//
//   - an ordinary **class** — a GC reference. The array would hold bare words.
//   - a **`@managed struct`** — a GC-owned record. Its extent is known
//     (`nextMemoryOffset`), so the stride was right; what is missing is the
//     header the collector traces through.
//
// The kinds that keep working — scalar, `@unmanaged struct`, `@inline struct` —
// are pinned as positives in `array-star-index-read.ts` and
// `array-star-index-write.ts`, so this refusal cannot widen unnoticed.

class ManagedRef {
  x: i32 = 0;
}

@managed struct ManagedRecord {
  x: f64 = 0;
  y: f64 = 0;
}

// 1. A class element: a GC reference in an unscanned buffer.
export function classElement(p: [ManagedRef *]): i32 {
  return 0;
}

// 2. A `@managed struct` element: a GC-owned record, same provenance problem.
export function managedRecordElement(p: [ManagedRecord *]): i32 {
  return 0;
}
