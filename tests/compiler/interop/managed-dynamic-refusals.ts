// `@managed @dynamic [T * n]` — what refuses in Landing 4d.1, and why.
//
// The type resolves and binds as a GC reference this landing. What does **not**
// work yet is everything that needs the descriptor's offsets or a buffer whose
// lifetime is arranged:
//
//   1. `y[i]` — element access. The descriptor carries `dataPtr` and `length`,
//      so the address is `dataPtr + i*sizeof(T)` with a bounds check against
//      `length`; that is Landing 4d.2. Refused **by name** rather than by the
//      generic "index signature is missing in type '~lib/dynamicarray/
//      DynamicArray<T>'", which would name an internal class and read as a bug
//      in the shape rather than as work not yet done.
//
//   2. `changetype<@managed @dynamic [T * n]>(p, len)` — construction. The
//      two-argument form is the designated way to build a descriptor, and it is
//      Landing 4d.2. Refused before the arity checker, which would otherwise
//      say `Expected 1 arguments, but got 2` and mention nothing about the
//      feature.
//
//   3. A **GC-managed element** — same rule as `[Foo *]` (Landing 3's CX1) and
//      `@unmanaged @dynamic [Foo * n]`: the data buffer is not scanned, so a
//      reference stored in it is not a root and would dangle.
//
//   4. `sizeof` — the value is a class reference, so `byteSize` would answer 4
//      and look like a legitimate pointer size. The extent is
//      `length * sizeof<T>` with `length` a runtime field.
//
//   5. A bare `struct` element — bare structs are `@inline`, and an `@inline`
//      value cannot be a class type argument ("value types are not implemented
//      here yet; a pointer would alias"). This is the same limitation
//      `Array<BareStruct>` has, not something specific to this feature. The
//      collision solver's actual declaration is `@unmanaged struct BodyState`,
//      so the primary case is unaffected. Documented, not fixed — see
//      `docs/interop-c-abi.md`.

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

// 1. Indexing.
export function index(y: @managed @dynamic [BodyState * n], i: i32): f64 {
  return y[i].x;
}

// 2. Construction.
export function construct(p: usize, len: i32): @managed @dynamic [BodyState * n] {
  return changetype<@managed @dynamic [BodyState * n]>(p, len);
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
