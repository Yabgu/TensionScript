// The coverage report: what `--wasmGc` actually did to *this* program.
//
// The flag makes two different promises depending on the program, and a reader must
// be able to tell which one they got without inspecting the module. A flag that
// claims to move managed classes to another representation, and silently moves
// zero, is indistinguishable from one that works — which is why the report is
// gated on `--wasmGc` and **not** on the latch.
//
// Two programs, and the pair is the point:
//
// - `coverage-uniform.ts` is uniform, and reports INFO TS6413 `N of N`.
// - this file is not uniform: a `TypedArray` field is an unmigrated
//   standard-library type, so no class may be a GC struct. It reports WARNING
//   TS6414, naming that cause.
//
// Every export answers a value compiled from the same program the report describes.
class HoldsTypedArray {
  data: Uint8Array;
  constructor(n: i32) { this.data = new Uint8Array(n); }
  sum(): i32 {
    let s = 0;
    for (let i = 0; i < this.data.length; ++i) s += this.data[i];
    return s;
  }
}

class HoldsTypedArrayToo {
  data: Float64Array;
  constructor() { this.data = new Float64Array(2); }
}

export function reportBlocked(): i32 {
  let a = new HoldsTypedArray(3);
  let b = new HoldsTypedArrayToo();
  b.data[0] = 1.5;
  return a.sum() + a.data.length; // 0 + 3
}
