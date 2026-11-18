// A GC class with a field whose type is another GC class — acyclic.
//
// `Holder` holds a `Leaf` by reference: the field is a `(ref null $Leaf)`, its
// zero is `ref.null`, and the value is reachable through the holding struct, so
// the engine's tracer follows it without a write barrier or a visitor.
//
// **Not attempted: mutually recursive classes** (`A { b: B }`, `B { a: A }`).
// Both types would have to reference each other inside one recursion group, and
// `ensureClassType` builds a supertype-ordered chain, not a group. That is a
// separate problem.
class Leaf {
  v: i32;
  constructor(v: i32) { this.v = v; }
}
class Holder {
  leaf: Leaf;
  tag: i32;
  constructor(tag: i32) { this.tag = tag; this.leaf = new Leaf(tag * 2); }
}

export function make(tag: i32): Holder { return new Holder(tag); }
export function leafValue(h: Holder): i32 { return h.leaf.v; }
export function tagOf(h: Holder): i32 { return h.tag; }
/** Replaces the held leaf, so the field write path is exercised too. */
export function retarget(h: Holder, v: i32): i32 {
  h.leaf = new Leaf(v);
  return h.leaf.v;
}
