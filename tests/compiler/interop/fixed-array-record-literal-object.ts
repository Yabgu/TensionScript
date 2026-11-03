// `[T * N]` of a **record**, constructed from object literals — Landing 5b.4.
//
// The natural spelling for a value-form array of records:
//
//   const arr: [Props * 4] = [
//     { x: 10.5, y: 20.5 },
//     ...
//   ];
//
// It compiles to **leaves**: eight `f64` locals for four two-field elements, in
// element-major order (`0.x, 0.y, 1.x, 1.y, ...`). No heap record, no
// `Props#constructor`, no `__alloc`, no pointer. That is the whole point — the
// class path (`compileObjectLiteral`) *does* allocate, measured on the same
// spelling: `const p: Props = { x: 10.5 }` emits `Props#constructor` plus
// `__alloc(16)` and setters, i.e. an address, which is not a value. So this
// position cannot reuse it and walks the literal's fields directly
// (`Compiler#emitSroaObjectElementLeaves`).
//
// Four things this pins:
//
//   1. **Declaration order, not literal order.** The record's fields decide
//      where each value goes, because the leaves are positional. `{ y: 1, x: 2 }`
//      writes `y` to the second leaf and `x` to the first.
//   2. **All three positions.** A local declaration, a call argument, and a
//      return (the last via multivalue, eight results for four elements).
//   3. **An omitted field takes its declared default** — matching the
//      constructor the class path runs, which is `= 0` here. Measured
//      cross-check: `{ x: 10.0 }` on `{ x = 5.0; y = 7.0 }` yields `y = 7.0`
//      through the class path, and this path agrees for constant defaults.
//   4. **Last duplicate wins**, as it does through the class path's setters.
//
// Not here: a record **local** in element position (`[p0, p1]`). Under
// `@unmanaged` a `Props` local is one leaf — a pointer — while the array needs
// eight `f64`s, so that refusal stays (`fixed-array-value-refusals`).

@unmanaged struct Props {
  x: f64;
  y: f64;
}

// --- local declaration ----------------------------------------------------

export function localConstant(): f64 {
  const arr: [Props * 4] = [
    { x: 10.5, y: 20.5 },
    { x: 30.5, y: 40.5 },
    { x: 50.5, y: 60.5 },
    { x: 70.5, y: 80.5 }
  ];
  return arr[2].x;                               // 50.5
}

// The second field of the last element, so a transposed leaf order fails here
// rather than passing by coincidence.
export function localSecondField(): f64 {
  const arr: [Props * 4] = [
    { x: 10.5, y: 20.5 },
    { x: 30.5, y: 40.5 },
    { x: 50.5, y: 60.5 },
    { x: 70.5, y: 80.5 }
  ];
  return arr[3].y;                               // 80.5
}

// Literal order is not leaf order: `y` is written first here and `x` second.
export function localReorderedNames(): f64 {
  const arr: [Props * 1] = [{ y: 2.0, x: 1.0 }];
  return arr[0].x * 10.0 + arr[0].y;             // 12
}

// A **runtime** index over a literal-constructed array still dispatches over the
// elements' leaves; construction and access are independent.
export function localRuntimeIndex(i: i32): f64 {
  const arr: [Props * 4] = [
    { x: 10.5, y: 0.0 },
    { x: 30.5, y: 0.0 },
    { x: 50.5, y: 0.0 },
    { x: 70.5, y: 0.0 }
  ];
  return arr[i].x;
}

// --- omitted and duplicate fields -----------------------------------------

// `y` is omitted, so it takes its declared default (`= 0`, the struct's own).
export function localOmittedField(): f64 {
  const arr: [Props * 2] = [{ x: 10.5 }, { x: 30.5, y: 40.5 }];
  return arr[0].x + arr[0].y * 1000.0;           // 10.5
}

// Last wins, matching the class path's setter order.
export function localDuplicateName(): f64 {
  const arr: [Props * 1] = [{ x: 1.0, x: 2.0 }];
  return arr[0].x;                               // 2
}

// --- call argument --------------------------------------------------------

function sumX(arr: [Props * 4]): f64 {
  return arr[0].x + arr[1].x + arr[2].x + arr[3].x;
}

export function argument(): f64 {
  return sumX([
    { x: 1.0, y: 0.0 },
    { x: 2.0, y: 0.0 },
    { x: 3.0, y: 0.0 },
    { x: 4.0, y: 0.0 }
  ]);                                            // 10
}

// --- return ---------------------------------------------------------------

// Eight results for four elements of two fields each.
export function make(): [Props * 4] {
  return [
    { x: 10.5, y: 20.5 },
    { x: 30.5, y: 40.5 },
    { x: 50.5, y: 60.5 },
    { x: 70.5, y: 80.5 }
  ];
}

export function returnUnpacked(): f64 {
  const arr: [Props * 4] = make();
  return arr[2].x;                               // 50.5
}

export function returnUnpackedLast(): f64 {
  const arr: [Props * 4] = make();
  return arr[3].y;                               // 80.5
}
