// `@inline struct` **returns** — sret: the caller allocates the slot, the callee
// fills it, and no value flows back through the WASM value stack.
//
// **Three-way, and the partial cell is the whole point.**
//
//   refuse  (before this commit): a function returning an `@inline struct` was
//           refused at the signature (`AS100: an @inline struct value in a
//           return type`). That refusal is gone — it was the right answer while
//           there was nowhere to write the value, and it is the wrong answer now
//           that there is.
//
//   partial (a slot that is read after the bump pointer is restored, or one that
//           is reused per call site instead of per frame): the read below comes
//           back as a stale or clobbered field. `copyOut` and `readField` both
//           read a different slot from the one the call wrote, so the numbers
//           disagree with the arithmetic rather than crashing.
//
//   fixed   (this commit): `make(n)` writes `x = n, y = n + 1` into the caller's
//           slot; `readField` loads `x` from it; `copyOut` copies both fields
//           into the local's own SROA locals; `discard` allocates and unwinds
//           without reading.
//
// **The mechanism.** A call passes the slot's address as the hidden **first**
// WASM parameter (after `this`). The slot comes from a static call-temp stack
// inside the data segment (`[16, __data_end)`), outside the region `visitStack`
// scans, so nothing here is ever a GC root. The bump pointer is a plain `i32`
// global that `compileVisitGlobals` does not visit. Each call saves the bump in
// a WASM local (inherently per-frame), allocates, calls, reads, and restores —
// so a nested or recursive call has its own mark and cannot clobber this one.
//
// **Memory-only.** There is no `@inline struct` value in the pipeline: `f().x`
// is a load from the slot, `let q: P = f()` is per-field loads into `q`'s
// locals. Every other use of the result is still refused (see
// `inline-struct-sret-refusals.ts`).

@inline struct P {
  x: i32;
  y: i32;
}

function make(n: i32): P {
  let p: P = new P();
  p.x = n;
  p.y = n + 1;
  return p;
}

// `f().x` — a load from the caller's slot
function readField(n: i32): i32 {
  return make(n).x;
}

// `let q: P = f()` — the fields are copied out into `q`'s own locals
function copyOut(n: i32): i32 {
  let q: P = make(n);
  return q.x * 100 + q.y;
}

// A discarded result still allocates and unwinds; it must not leave the bump
// pointer advanced, or the next call starts somewhere else.
function discard(n: i32): i32 {
  make(n);
  return make(n).y;
}

// `return new P()`: the slot receives zeros. A zero local would have been free;
// a zero *slot* is four stores, and the value is still not a local.
function zero(): P {
  return new P();
}

export function run(): i32 {
  let total = 0;
  total += readField(41); // 41
  total += copyOut(7); // 708
  total += discard(10); // 11
  total += zero().x + zero().y; // 0
  return <i32>total;
}

// The assertions that make the above load-bearing. `assert` aborts at
// instantiation, so a wrong value fails the fixture rather than reporting one.
assert(readField(41) == 41);
assert(readField(0) == 0);
assert(copyOut(7) == 708);
// the slot is unwound: a second call must start where the first one started
assert(discard(10) == 11);
assert(discard(10) == 11);
assert(zero().x == 0);
assert(zero().y == 0);

// Two consumers of two calls in one expression: each call takes its own slot,
// and the inner call's slot is still live while the outer result is read.
assert(readField(make(5).y) == 6);
