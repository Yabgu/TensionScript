// `@managed @dynamic [T * n]` — the foundation. Landing 4d.1.
//
// The managed form resolves to a **std class reference**, `DynamicArray<T>`,
// with fields `dataPtr: usize` and `length: u32`. That is the whole design
// decision, and the reason it is a class rather than a `TypeKind.DynamicArray`
// carrying a "managed" flag:
//
//   `Type.dynamicArray` builds its type with `TypeFlags.None` (`types.ts`), so
//   `isInternalReference` is false, so `Type#isManaged` is false, so the
//   collector does not scan a local holding one. A descriptor allocated into
//   such a local would be freed while still referenced — use-after-free by
//   construction.
//
// A class reference has `TypeFlags.Reference`, so `isManaged` is true, the
// value is rooted, and `.length` is an ordinary field.
//
// What is pinned here:
//
//   - the ABI is **one `i32` slot** — a traced one, unlike `@unmanaged`;
//   - `.length` is a class field read, not a header load, because this
//     descriptor owns the length (the data buffer is bare);
//   - the type is **nullable**, which only a reference can be. That is the
//     predicate test: `y == null` compiles here and is refused for `[T *]`.
//
// Indexing and construction are Landing 4d.2 and refuse by name.

@unmanaged struct BodyState {
  x: f64;
  y: f64;
}

// --- the ABI: one traced slot ---------------------------------------------

export function lengthOf(y: @managed @dynamic [BodyState * n]): i32 {
  return i32(y.length);
}

// --- nullable: the predicate that distinguishes the two memory models ------
//
// `[BodyState *]` and `@unmanaged @dynamic [...]` are plain pointers and cannot
// be null; this one can, because it is a GC reference.

export function isNull(y: @managed @dynamic [BodyState * n]): bool {
  return y == null;
}

// A scalar element is admitted too — the element-kind rules are the same as the
// unmanaged form's, minus the header.

export function lengthU32(y: @managed @dynamic [u32 * n]): i32 {
  return i32(y.length);
}

// --- the descriptor is the std class --------------------------------------
//
// Reading both fields proves the layout lands where `DynamicArray<T>` declares
// them: `dataPtr` first, `length` second. `dataPtr` is the caller's buffer, so
// this is also the shape 4d.2's construction has to produce.

export function dataPtrOf(y: @managed @dynamic [u32 * n]): usize {
  return y.dataPtr;
}

// --- the reference survives a call boundary -------------------------------
//
// A managed value can be passed on, which is what rooting buys. The callee's
// parameter is the same traced slot.

function pass(y: @managed @dynamic [u32 * n]): i32 {
  return i32(y.length);
}

export function through(y: @managed @dynamic [u32 * n]): i32 {
  return pass(y);
}

export function run(): i32 {
  return i32(sizeof<BodyState>() == 16);
}
