// `[T * N]` of a **record** — Landing 5b.1: SROA locals for record elements.
//
// A record element is several leaves per element (`Props{x, y}` is two `f64`s),
// so `[Props * 4]` becomes **eight** WASM locals and the element is a
// placeholder carrying its field leaves — the same representation a nested
// `@inline` field gets, and for the same reason: `arr[0]` names a whole
// sub-value that no single local can hold, while `arr[0].x` descends one hop to
// a leaf.
//
// Two access shapes, and the branch structure differs:
//
//   1. **Constant index** — `arr[2].x` is `local.get` on one leaf. No dispatch.
//   2. **Runtime index** — `arr[i].x` is a `br_table` over the elements, each
//      block yielding that element's `x` leaf. A record element cannot be
//      selected as one value (it is several leaves), but a *field* can: one leaf
//      per candidate. This is the collision solver's shape — `arr[i].x` with a
//      runtime `i` over a run of records.
//
// Construction is field-by-field (`arr[0].x = 10.5`), not an element literal:
// `Props { x: 10.5, y: 20.5 }` in an array literal goes through the class path
// and *allocates* a heap record behind a pointer — measured, `P#constructor` plus
// setters — which is not a value. The field-by-field route writes the leaves
// directly, which is what the representation wants.

@unmanaged struct Props {
  x: f64;
  y: f64;
}

// --- constant index -------------------------------------------------------

export function constant(): f64 {
  let arr: [Props * 4];
  arr[0].x = 10.5; arr[0].y = 20.5;
  arr[1].x = 30.5; arr[1].y = 40.5;
  arr[2].x = 50.5; arr[2].y = 60.5;
  arr[3].x = 70.5; arr[3].y = 80.5;
  return arr[2].x * 1000.0 + arr[2].y;   // 50500 + 60.5 = 50560.5
}

// The second field, so the access is the second leaf of the element and not
// just the first local of it. A layout bug that happened to hit `x` fails here.
export function constantSecondField(): f64 {
  let arr: [Props * 4];
  arr[1].x = 30.5; arr[1].y = 40.5;
  return arr[1].y;
}

// --- runtime index --------------------------------------------------------

export function runtime(i: i32): f64 {
  let arr: [Props * 4];
  arr[0].x = 10.5;
  arr[1].x = 30.5;
  arr[2].x = 50.5;
  arr[3].x = 70.5;
  return arr[i].x;
}

// A runtime **write** as well: the collision solver computes a derivative per
// element and stores it back through the index.
export function runtimeWrite(i: i32, v: f64): f64 {
  let arr: [Props * 4];
  arr[i].x = v;
  return arr[i].x;
}

// --- copy ----------------------------------------------------------------

// `let b = a` copies every leaf, so a write through `b` is invisible through
// `a`. Encoded as one number so a regression shows up as a value, not a shape:
// 50.5 * 1000 + 99.5 = 50599.5.
export function copyIndependence(): f64 {
  let a: [Props * 4];
  a[0].x = 10.5; a[1].x = 30.5; a[2].x = 50.5; a[3].x = 70.5;
  let b: [Props * 4] = a;
  b[2].x = 99.5;
  return a[2].x * 1000.0 + b[2].x;
}

// --- the collision example's element shape -------------------------------
//
// Four `f64` fields per body: 16 WASM locals for four elements, and `arr[1].x`
// is the fifth leaf. This is `BodyState` verbatim.

@unmanaged struct BodyState {
  x: f64;
  y: f64;
  vx: f64;
  vy: f64;
}

export function bodyState(): f64 {
  let arr: [BodyState * 4];
  arr[0].x = 10.0; arr[0].y = 20.0; arr[0].vx = 1.0; arr[0].vy = 2.0;
  arr[1].x = 30.0; arr[1].y = 40.0; arr[1].vx = 3.0; arr[1].vy = 4.0;
  arr[2].x = 50.0; arr[2].y = 60.0; arr[2].vx = 5.0; arr[2].vy = 6.0;
  arr[3].x = 70.0; arr[3].y = 80.0; arr[3].vx = 7.0; arr[3].vy = 8.0;
  return arr[1].x;
}
