// `@managed @dynamic [T * n]` — what still refuses, after Landing 4d.2.
//
// 4d.1 refused indexing, two-argument `changetype` and the return path; all
// three work now and moved to `managed-dynamic-abi.ts`. What remains is about
// the *shape* of the data, not about work not yet done:
//
//   1. **1-argument `changetype`** — a descriptor cannot be conjured from a bare
//      pointer: there is no length. Target-specific; every other
//      `changetype<X>(ptr)` reinterpretation stays legal. It used to *compile*,
//      through `isChangeableTo`'s integer arm (a class type is
//      `TypeFlags.Integer`), and produce a class reference whose `length` was
//      whatever the memory after the pointer happened to say — measured at
//      1076166656 for a buffer whose first element was 10.5.
//
//   2. **Cross-model `changetype`** — `@managed` <-> `@unmanaged`, both
//      directions. Both are one `i32` slot, so `isChangeableTo` waved them
//      through, but the shapes are unrelated: a GC reference to a descriptor
//      versus a pointer to a header-prefixed buffer. Measured before the
//      refusal: the managed->unmanaged cast emitted `i32.load` of the
//      descriptor's `dataPtr` field as if it were the buffer's length.
//
//   3. A **GC-managed element** — the data buffer is not scanned (Landing 3 CX1).
//
//   4. `sizeof` — the extent is `length * sizeof<T>` with `length` a runtime
//      field; answering the reference size would look like a legitimate
//      pointer size.
//
//   5. A **bare `struct` element** — bare structs are `@inline`, and an
//      `@inline` value cannot be a class type argument. The same limitation
//      `Array<BareStruct>` has; the collision solver declares `@unmanaged
//      struct BodyState`, so the primary case is unaffected.

class GcRef {
  x: i32 = 0;
}

struct InlineRecord {
  x: f64 = 0;
  y: f64 = 0;
}

@unmanaged struct BodyState {
  x: f64;
  y: f64;
}

// 1. One argument is not enough to build a descriptor.
export function oneArg(p: usize): void {
  changetype<@managed @dynamic [BodyState * n]>(p);
}

// 2a. Managed -> unmanaged.
export function managedToUnmanaged(y: @managed @dynamic [BodyState * ln]): usize {
  const p = changetype<@unmanaged @dynamic [BodyState * m]>(y);
  return <usize>p;
}

// 2b. Unmanaged -> managed, one argument.
export function unmanagedToManaged(p: usize): void {
  changetype<@managed @dynamic [BodyState * n]>(p);
}

// 3. A GC-managed element.
export function gcElement(y: @managed @dynamic [GcRef * n]): i32 {
  return 0;
}

// 4. sizeof of the view.
export function sizeOfView(y: @managed @dynamic [u32 * n]): usize {
  return sizeof<@managed @dynamic [u32 * n]>();
}

// 5. A bare (inline) struct element.
export function inlineElement(y: @managed @dynamic [InlineRecord * n]): i32 {
  return 0;
}
