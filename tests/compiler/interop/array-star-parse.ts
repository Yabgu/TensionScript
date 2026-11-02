// `[T *]` — the parts that still refuse after Landing 2.
//
// Landing 1 pinned two refusals here: `a[0]` (no index arm) and
// `sizeof<[T *]>()`. Landing 2 removed the first — `y[i]` reads and
// `y[i].field` composes, and the positive shapes moved to
// `array-star-index-read.ts`. What remains is the one refusal that is about the
// *type* rather than about a landing:
//
//   `sizeof<[T *]>()` — a pointer with no length has **no extent**. The
//   tempting answer is the pointer's own byte size (4), which is the one number
//   a caller is most likely to mistake for an element count, so it is refused by
//   name (`builtins.ts`, `builtin_sizeof`) and the real answer is spelled out:
//   `sizeof<T>()` for the element, plus a count carried separately.
//
// This is not a landing boundary: `[T *]` will never have a `sizeof`, because
// the length is exactly what it does not carry. `@dynamic` (Landing 4) adds a
// *runtime* length beside the pointer; it does not give this type an extent.

@unmanaged struct BodyState {
  x: f64;
  y: f64;
}

// The refusal. The array is otherwise perfectly usable — the parameter is a live
// `[T *]`, so this is not an "unknown type" error dressed up.
export function sizeOfView(p: [u32 *]): usize {
  return sizeof<[u32 *]>();
}
