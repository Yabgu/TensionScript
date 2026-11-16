// A base class, one derived class and one sibling — the hierarchy slice.
//
// **The sibling's field is `f64` on purpose.** wasm GC type identity is
// *structural*: two classes whose field lists have the same types canonicalize
// to one type, so `ref.test` could not tell them apart. That is a property of the
// encoding, not of this compiler, and the fixture is shaped so the sibling
// negative tests the thing it claims to test.
class Base {
  a: i32;
  constructor(a: i32) { this.a = a; }
}
class Derived extends Base {
  b: i32;
  constructor(a: i32, b: i32) { super(a); this.b = b; }
}
class Sibling extends Base {
  c: f64;
  constructor(a: i32, c: f64) { super(a); this.c = c; }
}

export function makeBase(a: i32): Base { return new Base(a); }
export function makeDerived(a: i32, b: i32): Derived { return new Derived(a, b); }
export function makeSibling(a: i32, c: f64): Sibling { return new Sibling(a, c); }

/** A base field read through a base-typed reference: the prefix property. */
export function readA(v: Base): i32 { return v.a; }
export function readB(v: Derived): i32 { return v.b; }
export function bumpB(v: Derived): i32 { v.b = v.b + 1; return v.b; }

export function isBase(v: Base): bool { return v instanceof Base; }
export function isDerived(v: Base): bool { return v instanceof Derived; }
export function isSibling(v: Base): bool { return v instanceof Sibling; }

/** Everything in one call, so a host can assert one number. */
export function probe(tag: i32): i32 {
  let d = makeDerived(tag, tag + 1);
  let s = makeSibling(tag + 2, 0.5);
  let acc = 0;
  if (isBase(d)) acc += 1;
  if (isDerived(d)) acc += 2;
  if (isSibling(d)) acc += 4;   // must NOT be set
  if (isBase(s)) acc += 8;
  if (isDerived(s)) acc += 16;  // must NOT be set
  if (isSibling(s)) acc += 32;
  acc += readA(d) * 100;        // the prefix
  acc += bumpB(d) * 10000;      // a derived write, read back
  return acc;
}
