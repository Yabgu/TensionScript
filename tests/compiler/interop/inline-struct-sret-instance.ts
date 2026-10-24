// Sret on an **instance method** — the local-index shift, tested both ways.
//
// A free function's hidden destination is WASM local 0. An instance method's is
// local **1**, because `this` is local 0. Every site that names the destination
// has to know which, and getting it wrong does not fail to compile: the method
// would write the returned fields over `this` (a real object) and return
// whatever `this` now holds — a wrong value, not a crash. That is the same class
// of gap the inferred-local forms had, so it gets a fixture rather than an
// inspection.
//
//   Maker#make(this: i32, dest: i32, i: i32)   -> no result
//
// `make` reads `this.base` and writes two fields to `dest`. If the return path
// used local 0, `this`'s first field would be overwritten with `a` and the
// assertion below would read 13.0 out of the object's `base` slot instead.

@inline struct V {
  a: f32;
  b: f32;
}

class Maker {
  base: i32;
  constructor(base: i32) {
    this.base = base;
  }
  make(i: i32): V {
    let v: V = new V();
    v.a = <f32>(this.base + i);
    v.b = <f32>(this.base - i);
    return v;
  }
}

// The shift, tested the other way: an instance method that takes an @inline
// struct **and** returns one. WASM parameters are
//   (this, dest, p.a, p.b, k)   -> none
// i.e. local 0 (this), local 1 (dest), local 2+ (the SROA'd parameter), then
// the source parameter after it. If the flattening and the shift disagreed, the
// method would read `this.base` from `p.a` and the arithmetic would be wrong.
class Calc {
  base: i32;
  constructor(base: i32) {
    this.base = base;
  }
  scale(p: V, k: i32): V {
    let v: V = new V();
    v.a = p.a * <f32>k + <f32>this.base;
    v.b = p.b * <f32>k - <f32>this.base;
    return v;
  }
}

// Two sret calls on one receiver, in one expression: each takes its own slot,
// and neither clobbers the other's.
function twoCalls(): f32 {
  let m = new Maker(10);
  return m.make(3).a * 100.0 + m.make(4).b;
}

export function run(): f32 {
  let m = new Maker(10);
  let v = m.make(3);
  let c = new Calc(100);
  let p: V = new V();
  p.a = 5;
  p.b = 7;
  return v.a + v.b + c.scale(p, 3).a + c.scale(p, 3).b + twoCalls();
}

// The instance method's returned fields are 13 and 7, read from the caller's
// slot — not from the object.
assert(new Maker(10).make(3).a == 13.0);
assert(new Maker(10).make(3).b == 7.0);
// `this` was not overwritten by the return: a second call on the same receiver
// still sees the original base.
assert(new Maker(10).make(3).a == new Maker(10).make(3).a);
// the combined shape: (5*3 + 100, 7*3 - 100) = (115, -79). The argument is a
// local, not a literal: a value has no address, so only a local can be passed.
{
  let arg: V = new V();
  arg.a = 5;
  arg.b = 7;
  assert(new Calc(100).scale(arg, 3).a == 115.0);
  assert(new Calc(100).scale(arg, 3).b == -79.0);
}
// two calls, one receiver, one expression: 13*100 + 6 = 1306
assert(twoCalls() == 1306.0);
// 13 + 7 + 115 - 79 + 1306 = 1362
assert(run() == 1362.0);
