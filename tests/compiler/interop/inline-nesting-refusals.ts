// Inline nesting, sub-phase A — the two hazards, and the deferral.
//
// Three refusals, each for a different reason, plus one control that compiles.
//
// **1. Recursive inline struct (direct).** `A { self: A }` where `A` is
// `@inline` would need an infinite extent. Before this check the shape produced
// `sizeof<A>() == 0` **with no diagnostic**: `resolveClass` returns the *pending*
// instance on re-entry (`resolver.ts:3587-3590`), and a pending instance still
// carries the default extent 0 and alignment 0, so the layout loop read 0 bytes
// for a field that was still being laid out. The check uses the `pendingClasses`
// set that already answers this question for bases and interfaces, and it runs
// **before** the field takes an extent — so the wrong extent is never computed,
// not computed-then-refused.
//
// **2. Recursive inline struct (indirect).** The same hazard through a second
// record. Whichever of the two is resolved first sees the other pending.
//
// **3. A GC-reference leaf.** `Bad` has a `Node` field. `Bad` itself resolves
// and lays out (`sizeof<Bad>() == 4` — measured; the refusal for its own GC
// field fires only when a *local* of it is declared), so nesting it would put a
// collected pointer inside a value where neither `__visit` (which walks a
// class's fields) nor a write barrier can see it. Both outer kinds refuse, with
// their own reasoning: the `@managed` one names the `__visit` blind spot.
//
// **4. The deferral.** A nested inline value inside an `@inline` **outer** is not
// a cycle and not a GC hazard — it is sub-phase B's SROA flattening, refused by
// name so it cannot ship as a half-copy.
//
// Control: `@unmanaged struct Ok { inner: @inline Good }` compiles. It is in
// `inline-nesting-layout.ts` and `inline-nesting-access.ts`; here it appears as
// `Fine` so that "everything in this file is refused" is not an accident of the
// file's contents.

class Node {
  v: u32 = 0;
}

@inline struct Bad {
  r: Node;
}

@inline struct Good {
  a: u32 = 0;
}

// 1. direct recursion
@inline struct SelfRef {
  self: @inline SelfRef;
}

// 2. indirect recursion
@inline struct Ping {
  pong: @inline Pong;
}

@inline struct Pong {
  ping: @inline Ping;
}

// 3. a GC-reference leaf, through both outer kinds
@managed struct ManagedBad {
  inner: @inline Bad = {};
}

@unmanaged struct UnmanagedBad {
  inner: Bad;
}

// 3b. and through a nested inline struct, so the walk is transitive
@inline struct BadWrapper {
  bad: @inline Bad;
}

@unmanaged struct TransitivelyBad {
  inner: BadWrapper;
}

// 5. a non-empty initializer on an inline field. The value is stored inline and
// has no address, so there is nothing a `store` could copy from — and the
// constructor's field loop used to `continue` past it. Measured: with the field
// initializer `{ a: 11, b: 22 }` the constructor emitted nothing and the field
// read back 0, with no diagnostic, which is this phase's own silent-wrong
// class. `= {}` stays legal because the allocation is already zero.
@unmanaged struct Initialized {
  inner: Good = { a: 5 };
}

// 6. the whole-value forms. The field *is* its bytes, so a whole-value read has
// no value to produce and a whole-value write has no address to copy from; both
// refuse rather than compile to something that silently does neither.
@unmanaged struct WholeRead {
  inner: Good = {};
}

@unmanaged struct WholeWrite {
  inner: Good = {};
}

// 4. the deferral: an inline value inside an @inline value
@inline struct OuterInline {
  inner: @inline Good = {};
}

// control: an inline value inside a pointer-layout record
@unmanaged struct Fine {
  inner: Good = {};
}

function wholeRead(): u32 {
  let w = changetype<WholeRead>(heap.alloc(16));
  let q: Good = w.inner;   // no value to read
  return q.a;
}

function wholeWrite(v: Good): void {
  let w = changetype<WholeWrite>(heap.alloc(16));
  w.inner = v;             // no address to store from
}

export function run(): void {
  // Every layout above is forced from here, because a refusal inside a type that
  // nothing resolves never fires (measured — the same reachability the nesting
  // refusal always had).
  let n: u32 = sizeof<SelfRef>() + sizeof<Ping>() + sizeof<ManagedBad>() +
    sizeof<UnmanagedBad>() + sizeof<TransitivelyBad>() + sizeof<Initialized>() +
    sizeof<OuterInline>() + sizeof<Fine>() + sizeof<WholeRead>() +
    sizeof<WholeWrite>();
  if (n == 1) n = 2;
  // The constructor is where a field initializer is compiled, so the refusal
  // needs a construction to be reachable.
  if (n == 3) new Initialized();
  if (n == 4) wholeWrite(new Good());
  if (n == 5) n = wholeRead();
}
