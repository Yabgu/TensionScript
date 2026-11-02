// Element-safe assignability for array types.
//
// Landing 1 shipped `[T *]` with a known residual: `equals` compared the element
// for both array kinds, but the *assignment* paths reached a kind-equality test
// first, so `[u32 *]` was assignable to `[f64 *]` and `u32[4]` to `f64[4]`.
// Benign while nothing could index; a memory-safety hole once `y[i]` takes the
// element type from the pointer, because the callee then reads f64s out of u32
// bytes.
//
// The line is deliberate and is the same one Rust draws:
//
//   - **Assignment** promises the bytes mean the same thing, so a different
//     element type is refused — for `[T *]` *and* for `T[N]`.
//   - **`changetype`** promises only that the caller said so out loud, so a
//     different element type is allowed. It is the reinterpretation escape hatch,
//     and it compiles in this file as a positive case.
//
// Two sites enforce the refusal, and each is load-bearing on its own:
//
//   - `convertExpression`'s "same kind" early return — the path a declaration,
//     an assignment and an argument all take.
//   - `Type#isStrictlyAssignableTo` — the path a function expression's
//     contextual signature takes.
//
// The `T[N]` half is only observable through the type-level check: any `T[N]` in
// a local or parameter position reaches `Type#toRef`'s assert first (Landing 5's
// crash), so an assignment-level probe cannot isolate the assignability question
// from that.

@unmanaged struct BodyState {
  x: f64;
  y: f64;
}

// --- changetype across element types: allowed ------------------------------
//
// The escape hatch. Numerically distinct elements so a future "helpfully"
// inserting a conversion would be visible.

export function reinterpretU32AsF64(p: [u32 *]): [f64 *] {
  return changetype<[f64 *]>(p);
}

export function reinterpretF64AsBodyState(p: [f64 *]): [BodyState *] {
  return changetype<[BodyState *]>(p);
}

// --- same element: still assigns -------------------------------------------
//
// The control. If this ever starts failing, the refusal above is too wide.

export function sameElement(p: [u32 *]): [u32 *] {
  const q: [u32 *] = p;
  return q;
}

// --- function-expression signatures ----------------------------------------
//
// The refusal those guards produce is pinned in `array-star-element-refused.ts`,
// which is a compile-fail fixture: a file cannot both compile (this one) and
// carry refused constructs, and a positive shape left in a refused file would
// only be asserted by the *absence* of a line in the expected stderr.
