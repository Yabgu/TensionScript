// `@inline struct` **parameters and a return** in one signature — the combined
// shape, where the WASM parameter list is longer than the source parameter list
// in two directions at once.
//
//   source:  combine(p: P, q: i32): P
//   WASM:    (dest, p.x, p.y, q) -> none
//
// The destination is **first**, before the flattened `p`, so the callee's local
// binding is `$sretDest`, then `p$x`, `p$y`, then `q`. A binding that forgot
// either offset would read `q` as `p$y` and still compile — the numbers below
// are chosen so that mistake is a wrong value, not a crash.
//
// The callee's body reads `p.x`, `p.y` and `q` (three locals) and writes two
// fields into the destination slot; the caller copies them out. Both at -O0 and
// -O3.

@inline struct P {
  x: i32;
  y: i32;
}

function combine(p: P, q: i32): P {
  let r: P = new P();
  r.x = p.x + q;
  r.y = p.y * 2;
  return r;
}

function combined(px: i32, py: i32, q: i32): i32 {
  let p: P = new P();
  p.x = px;
  p.y = py;
  let out: P = combine(p, q);
  return out.x * 1000 + out.y;
}

// The whole shape in one expression: a discarded call, a call result read, and
// a call whose result is copied out, in that order.
function nested(n: i32): i32 {
  let p: P = new P();
  p.x = n;
  p.y = n;
  combine(p, 1); // discarded: the slot is allocated and unwound, nothing read
  return combine(p, n).x + combined(p.x, p.y, n) - combine(p, n).y;
}

export function run(): i32 {
  return <i32>(
    combined(2, 3, 10) + combined(0, 0, 0) + nested(4)
  );
}

assert(combined(2, 3, 10) == 12006); // (2+10)*1000 + 3*2
assert(combined(0, 0, 0) == 0);
assert(combined(-1, -2, 1) == -4); // (-1+1)*1000 + (-2)*2
// nested(4): combine(p,4).x == 8, combined(4,4,4) == 8008, combine(p,4).y == 8
assert(nested(4) == 8 + 8008 - 8);
