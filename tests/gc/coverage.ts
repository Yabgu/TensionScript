// The coverage report: what `--wasmGc` actually did to *this* program.
//
// The flag makes two different promises depending on the program, and a reader must
// be able to tell which one they got without inspecting the module. A flag that
// claims to move managed classes to another representation, and silently moves
// zero, is indistinguishable from one that works — which is why the report is
// gated on `--wasmGc` and **not** on the latch.
//
// Two programs, and the pair is the point: `coverage-uniform.ts` is uniform and
// reports INFO TS6413 `N of N`; this file is not uniform and reports WARNING TS6414
// naming the cause.
//
// The cause here is a **function value**, and it is the last fixable one: `String`,
// `StaticArray`, `Array`, the typed arrays, `ArrayBuffer`, `Map` and `Set` all have a
// synthesised GC layout now, so what is left is a field whose representation has not
// been decided. (A function value could be `ref func` or a table index; that is a design
// question, not a missing emitter case.)
class HoldsFunction {
  cb: (x: i32) => i32 = (x: i32): i32 => x;
  n: i32 = 0;
}

class HoldsFunctionToo {
  other: (x: i32) => i32 = (x: i32): i32 => x + 1;
}

export function reportBlocked(): i32 {
  let a = new HoldsFunction();
  let b = new HoldsFunctionToo();
  return a.cb(3) + b.other(4); // 3 + 5
}
