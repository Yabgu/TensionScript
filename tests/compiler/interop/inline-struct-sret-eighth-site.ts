// Sret plus a **managed** argument — the operand-stream test.
//
// A managed argument is spilled to the shadow stack before the call
// (`operandsTostack`): the GC may move it, and only a spilled slot is updated.
// That walk maps WASM operand indices to *source* parameters, and sret makes the
// two lists differ at the front as well as in the middle:
//
//   source:  fromBox(b: Box, n: i32): P
//   WASM:    (dest, b, n) -> none
//
// The hidden destination is operand 0 and belongs to **no** source parameter.
// A walk that treats `sourceIndexOf(-1)` as "past the end" stops there and never
// spills `b` — the managed value is then a bare `local.get` across the call, and
// whether the assertion below fails depends on whether a GC happened to run.
// The walk must advance **both** indices past the hidden slot and keep going.
//
// **How this fixture catches it.** The runtime assertions check the value, and
// they only fail if a collection actually ran and moved `b` — so the precise
// guard is the checked-in WAT: with the pre-fix `break`, the caller emits
// `local.get $b` straight into the call and the
// `local.set`/`global.get __stack_pointer`/`i32.store` spill block is missing.
// Measured by reverting the loop: the WAT diff is exactly those five lines, and
// this fixture fails on it.

@inline struct P {
  x: i32;
  y: i32;
}

class Box {
  v: i32 = 0;
}

function fromBox(b: Box, n: i32): P {
  let r: P = new P();
  // `b.v` is read *after* the call into the getter, so `b` must be live across
  // that call — exactly what the spill exists for.
  r.x = b.v + n;
  r.y = b.v;
  return r;
}

function viaBox(v: i32, n: i32): i32 {
  let b = new Box();
  b.v = v;
  let out: P = fromBox(b, n);
  return out.x * 100 + out.y;
}

export function run(): i32 {
  return <i32>(viaBox(40, 1) + viaBox(0, 7));
}

assert(viaBox(40, 1) == 4140); // (40+1)*100 + 40
assert(viaBox(0, 7) == 700); //    (0+7)*100 + 0
assert(viaBox(-5, 5) == -5); //   (-5+5)*100 + (-5)
