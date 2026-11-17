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
// The cause here is an **`ArrayBuffer` field**, and it is the honest one: a dynamic
// array and a typed array both have a synthesised GC layout now, but `ArrayBuffer`
// itself is still a linear-memory block with an `rtSize` header, so a class holding
// one directly cannot be a struct. (`Uint8Array` no longer blocks anything — GC16
// gave the buffer views a synthesised layout — which is why this fixture uses the
// raw buffer.)
class HoldsArrayBuffer {
  data: ArrayBuffer;
  constructor(n: i32) { this.data = new ArrayBuffer(n); }
  size(): i32 { return this.data.byteLength; }
}

class HoldsArrayBufferToo {
  other: ArrayBuffer;
  constructor() { this.other = new ArrayBuffer(4); }
}

export function reportBlocked(): i32 {
  let a = new HoldsArrayBuffer(3);
  let b = new HoldsArrayBufferToo();
  return a.size() + b.other.byteLength; // 3 + 4
}
