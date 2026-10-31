// Default arguments when the callee returns an `@inline struct` by sret.
//
// A callee returning an inline struct takes a hidden destination pointer as
// WASM parameter 0, which shifts every source parameter one slot to the right.
// The call site's default-argument filling has to use post-shift positions: the
// `this` operand and the sret pointer are operands but not arguments, and
// counting either one as an argument makes a call that omits an optional
// parameter look complete.
//
// Before the fix, `make(2)` below emitted the sret pointer and `x` — two
// operands against a three-parameter signature — and the disagreement surfaced
// only in the WASM validator, as `call* param number must match`. This fixture
// pins the operands (`.debug.wat` / `.release.wat`) and the values (`.js`).

struct M { a: f32 = 0; b: f32 = 0; }

// sret callee, one defaulted parameter
function make(x: f32, y: f32 = 1.0): M {
  const m = new M();
  m.a = x;
  m.b = y;
  return m;
}

export function make_omitted(): f32 {
  const m = make(2);
  return m.a + m.b;
}

export function make_explicit(): f32 {
  const m = make(2, 5);
  return m.a + m.b;
}

// two defaults omitted at once
function make2(x: f32, y: f32 = 1.0, z: f32 = 2.0): M {
  const m = new M();
  m.a = x + y;
  m.b = z;
  return m;
}

export function make2_omitted(): f32 {
  const m = make2(10);
  return m.a + m.b;
}

// the same shape without sret: this path always filled defaults, and must keep
// filling them the same way
function flat(x: f32, y: f32 = 1.0): f32 {
  return x + y;
}

export function flat_control(): f32 {
  return flat(2);
}

// an instance method combines both adjustments — `this` and the sret pointer are
// each an operand that stands for no source parameter
class Box {
  base: f32 = 0;

  combine(x: f32, y: f32 = 1.0): M {
    const m = new M();
    m.a = this.base + x;
    m.b = y;
    return m;
  }
}

export function method_omitted(): f32 {
  const box = new Box();
  box.base = 4;
  const m = box.combine(2);
  return m.a + m.b;
}
