// Mutually recursive class types, and the acyclic case they must not disturb.
//
// A class that holds another which holds it back cannot be built one type at a
// time: each needs the other's heap type before either exists. Those strongly
// connected components are emitted as a wasm `rec` group.

// --- two-class cycle -------------------------------------------------------
class Two { other: Two2 | null; tag: i32; constructor(t: i32) { this.tag = t; this.other = null; } }
class Two2 { other: Two | null; tag: i32; constructor(t: i32) { this.tag = t; this.other = null; } }

export function two(): i32 {
  let a = new Two(1); let b = new Two2(2);
  a.other = b; b.other = a;
  return a.tag + (<Two2>a.other).tag;
}

// --- three-class cycle -----------------------------------------------------
class A { b: B | null; t: i32; constructor(t: i32) { this.t = t; this.b = null; } }
class B { c: C | null; t: i32; constructor(t: i32) { this.t = t; this.c = null; } }
class C { a: A | null; t: i32; constructor(t: i32) { this.t = t; this.a = null; } }

export function three(): i32 {
  let a = new A(1); let b = new B(2); let c = new C(4);
  a.b = b; b.c = c; c.a = a;
  // walk the ring back to `c` and read its tag
  return a.t + b.t + c.t + (<C>(<B>(<A>c.a).b).c).t;
}

// --- a cycle mixed with inheritance ---------------------------------------
class Base { base: i32; constructor(v: i32) { this.base = v; } }
class Leaf extends Base { back: Holder | null; constructor(v: i32) { super(v); this.back = null; } }
class Holder { leaf: Leaf | null; t: i32; constructor(t: i32) { this.t = t; this.leaf = null; } }

export function mixed(): i32 {
  let l = new Leaf(10); let h = new Holder(20);
  l.back = h; h.leaf = l;
  return l.base + h.t + (<Leaf>h.leaf).base;
}
export function isBase(v: Base): bool { return v instanceof Base; }
export function isLeaf(v: Base): bool { return v instanceof Leaf; }
export function mixedProbe(): i32 {
  let l = new Leaf(1);
  let acc = 0;
  if (isBase(l)) acc += 1;
  if (isLeaf(l)) acc += 2;
  return acc;
}

// --- acyclic, which must stay out of any group ----------------------------
class Node2 { v: i32; constructor(v: i32) { this.v = v; } }
class Root2 { node: Node2; t: i32; constructor(t: i32) { this.t = t; this.node = new Node2(t * 3); } }

export function acyclic(): i32 { return new Root2(7).node.v; }
