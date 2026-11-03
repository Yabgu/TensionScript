// `[T * N]` — Landing 5b.3: the value form as a **return**.
//
// A value has no address, so there is no destination sret could write into. The
// return crosses as **multivalue**: one WASM result per element leaf,
// element-major, and the caller unpacks them into its own leaves. `make():
// [u32 * 4]` is `(result i32 i32 i32 i32)`.
//
// Three things this pins:
//
//   1. **The signature.** One result per leaf, and the count follows the element
//      — 4 for scalars, 16 for `[BodyState * 4]` (four records of four `f64`).
//   2. **The unpack.** The caller binds the tuple to a local whose slot type is
//      a `TypeRef` with **no `Type` behind it** (`Local#typeRefOverride`) and
//      extracts each leaf out of it. That local is the whole reason 5b.2 stopped
//      here: a tuple is not a `Type`, and every other local slot is typed by one.
//   3. **No flag.** `Feature.MultiValue` is turned on when the return type is
//      *resolved*, so a module that returns an array gets the feature and one
//      that does not never does. A consumer writes `function make(): [T * 4]`
//      and does not have to know how it is lowered.
//
// Two shapes reach the return emitter, and the fixture covers both: a value-form
// **local** (`return arr`) pushes its SROA leaves, and a fresh **array literal**
// (`return [10, 20, 30, 40]`) compiles element by element into the results
// through the same walk a call argument uses. The diagnostic this position emits
// promised the literal shape from 5b.3 on while the condition only read
// identifiers — Tension PR #46 measured the gap: `return [10, 20, 30, 40]`
// refused with a message saying literals were accepted.
//
// The return copies: the caller's leaves are filled from the tuple, so writing
// through the result cannot reach the callee's storage — there is none left to
// reach.

@unmanaged struct BodyState {
  x: f64;
  y: f64;
  vx: f64;
  vy: f64;
}

// --- scalar elements ------------------------------------------------------

function make(): [u32 * 4] {
  const arr: [u32 * 4] = [10, 20, 30, 40];
  return arr;
}

export function scalarReturn(): u32 {
  const arr: [u32 * 4] = make();
  return arr[2];                                 // 30
}

// Every leaf, so an off-by-one in the unpack shows up as a wrong value rather
// than a wrong index nobody reads.
export function scalarReturnAll(): u32 {
  const arr: [u32 * 4] = make();
  return arr[0] + arr[1] * 10 + arr[2] * 100 + arr[3] * 1000;   // 43210
}

// --- a fresh array literal ------------------------------------------------

// No local at all: the four results are the four constants. A literal shorter
// than the extent zero-fills the rest, because the slot exists either way.
function makeLiteral(): [u32 * 4] {
  return [10, 20, 30, 40];
}

function makeShortLiteral(): [u32 * 4] {
  return [7, 8];
}

export function literalReturn(): u32 {
  const arr: [u32 * 4] = makeLiteral();
  return arr[2];                                 // 30
}

export function literalReturnAll(): u32 {
  const arr: [u32 * 4] = makeLiteral();
  return arr[0] + arr[1] * 10 + arr[2] * 100 + arr[3] * 1000;   // 43210
}

export function shortLiteralZeroFills(): u32 {
  const arr: [u32 * 4] = makeShortLiteral();
  return arr[0] + arr[1] * 10 + arr[2] * 100 + arr[3] * 1000;   // 87
}

// --- the result is a value ------------------------------------------------

// Writing through the returned array cannot touch what the callee returned
// from: the tuple put the leaves in this frame.
export function returnIsACopy(): u32 {
  let arr: [u32 * 4] = make();
  arr[0] = 99;
  const again: [u32 * 4] = make();
  return again[0];                               // 10
}

// --- record elements ------------------------------------------------------
//
// Sixteen results for four `f64` fields across four elements. Constructed
// field-by-field, which is the route that works: an object literal inside an
// array literal allocates a heap record.

function makeStates(): [BodyState * 4] {
  let arr: [BodyState * 4];
  arr[0].x = 10.0; arr[0].y = 20.0; arr[0].vx = 1.0; arr[0].vy = 2.0;
  arr[1].x = 30.0; arr[1].y = 40.0; arr[1].vx = 3.0; arr[1].vy = 4.0;
  arr[2].x = 50.0; arr[2].y = 60.0; arr[2].vx = 5.0; arr[2].vy = 6.0;
  arr[3].x = 70.0; arr[3].y = 80.0; arr[3].vx = 7.0; arr[3].vy = 8.0;
  return arr;
}

export function recordReturnX(): f64 {
  const arr: [BodyState * 4] = makeStates();
  return arr[2].x;                               // 50
}

// A field from the last element and a different field, so the unpack order is
// pinned: element-major, fields in declaration order.
export function recordReturnLast(): f64 {
  const arr: [BodyState * 4] = makeStates();
  return arr[3].vy;                              // 8
}

export function recordReturnSum(): f64 {
  const arr: [BodyState * 4] = makeStates();
  return arr[0].x + arr[1].vx + arr[2].y + arr[3].vy;   // 10 + 3 + 60 + 8
}
