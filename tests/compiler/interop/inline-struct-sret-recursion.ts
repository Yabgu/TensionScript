// `@inline struct` return, **recursive** — the slot-lifetime test.
//
// A per-call-site slot would be overwritten by the recursive call: `sum(n - 1)`
// returns into the same address the outer frame is about to use, so the outer
// result would be built from the inner frame's dead data. The mechanism is
// per-call-**frame**: the bump pointer is saved into a WASM local before the
// allocation and restored from it afterwards, and a WASM local is inherently
// per-frame, so each recursion depth has its own mark and the slot stack is
// LIFO.
//
// `sum(5).x` is 5 + 4 + 3 + 2 + 1 = 15. The inner call's `y` is `n - 1` at each
// depth, and `sum(0)` returns zeros, so a clobbered slot shows a wrong sum
// rather than a crash.

@inline struct P {
  x: i32;
  y: i32;
}

function sum(n: i32): P {
  if (n == 0) return new P();
  let r: P = sum(n - 1);
  let out: P = new P();
  out.x = r.x + n;
  out.y = n;
  return out;
}

export function run(): i32 {
  return <i32>(sum(5).x);
}

assert(sum(5).x == 15);
assert(sum(0).x == 0);
assert(sum(1).x == 1);
assert(sum(10).x == 55);

// Two calls in one expression, each with its own frame: the inner result is
// read while the outer slot is already allocated, and both are correct.
assert(sum(sum(3).x).x == 21); // sum(6).x = 21
