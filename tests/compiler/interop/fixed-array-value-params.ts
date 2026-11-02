// `[T * N]` — Landing 5b.2: the value form as a **parameter**.
//
// A value has no address, so there is nothing to pass: the parameter flattens to
// **one WASM parameter per element leaf**, element-major, and the callee binds
// them as the same SROA locals a local declaration gets. `sum(arr: [u32 * 4])`
// is `(param i32 i32 i32 i32)`.
//
// Two consequences worth pinning:
//
//   1. **The call copies.** The callee's leaves are WASM parameters, not the
//      caller's locals, so a store inside the callee cannot be seen by the
//      caller. That is the property the whole representation exists for — a
//      value you can pass without thinking about who else has it.
//
//   2. **A record element costs its fields, not its extent.** `[Props * 4]` with
//      `Props{x, y: f64}` is 8 parameters, in element-major field order
//      (`0.x, 0.y, 1.x, 1.y, ...`). The caller pushes its leaves and the callee
//      binds them back into the same tree shape.
//
// **Not** at an export boundary. An exported `[T * N]` parameter would make the
// element count and layout part of the *host* ABI — the caller is not this
// compiler and cannot be told the shape changed. That case is refused, and the
// refusal names the pointer view instead.

@unmanaged struct Props {
  x: f64;
  y: f64;
}

// --- scalar elements ------------------------------------------------------

function sum(arr: [u32 * 4]): u32 {
  return arr[0] + arr[1] + arr[2] + arr[3];
}

export function callWithLiteral(): u32 {
  return sum([10, 20, 30, 40]);                 // 100
}

// A value-form local as the argument: no literal, so the operands come from the
// caller's own leaves.
export function callWithLocal(): u32 {
  const arr: [u32 * 4] = [1, 2, 3, 4];
  return sum(arr);                              // 10
}

// A runtime index inside the callee, over the parameter's leaves.
function at(arr: [u32 * 4], i: i32): u32 {
  return arr[i];
}

export function callIndexed(): u32 {
  const arr: [u32 * 4] = [7, 8, 9, 10];
  return at(arr, 0) * 100 + at(arr, 3);         // 710
}

// --- value semantics ------------------------------------------------------

// The callee stores into its own parameter leaves. The caller's array keeps its
// values: 1, not 99.
function mutate(arr: [u32 * 4]): void {
  arr[0] = 99;
}

export function copyAtCall(): u32 {
  const a: [u32 * 4] = [1, 2, 3, 4];
  mutate(a);
  return a[0];
}

// --- record elements ------------------------------------------------------

function sumX(arr: [Props * 4]): f64 {
  return arr[0].x + arr[1].x + arr[2].x + arr[3].x;
}

export function callRecord(): f64 {
  let arr: [Props * 4];
  arr[0].x = 1.5;  arr[0].y = 0.0;
  arr[1].x = 2.5;  arr[1].y = 0.0;
  arr[2].x = 4.0;  arr[2].y = 0.0;
  arr[3].x = 8.0;  arr[3].y = 0.0;
  return sumX(arr);                             // 16
}

// Two parameters of the same shape in one signature: 8 leaves, in order.
function dot(a: [u32 * 4], b: [u32 * 4]): u32 {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

export function twoArrays(): u32 {
  const a: [u32 * 4] = [1, 2, 3, 4];
  const b: [u32 * 4] = [10, 20, 30, 40];
  return dot(a, b);                             // 300
}
