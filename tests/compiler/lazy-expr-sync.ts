// The synchronous `@lazy` form, lowered: the initializer runs at the first read,
// once, and the value is memoized.
//
// The emitted shape is pinned in the `.wat` pair, and it is three things per
// read site: a flag test, the deferred expression inside it, and a read of the
// value cell. Two reads therefore emit two guarded copies and the flag makes
// only the first execute — measured at run time below (`calls == 1` after two
// reads), which is what makes this a memo and not merely a delay.
//
// Why the cells are compiler-allocated locals rather than a synthesized getter:
// a getter would need a *type* for its cell, and the transform stage that could
// synthesize one runs before resolution, when an unannotated initializer's type
// is not yet known. The compiler has the type because that is what it is doing.
// The visible cost is the duplicated guarded initializer, and it is deliberate.

let calls: i32 = 0;

function counted(): i32 {
  calls += 1;
  return 41;
}

// Two reads, one call.
export function twoReads(): i32 {
  let a = @lazy counted();
  let first: i32 = a;
  let second: i32 = a;
  assert(calls == 1);   // the second read did not re-evaluate
  return first + second;
}

// Nothing is deferred about the *value*: `@lazy EXPR` has the type of EXPR, so
// an annotated binding converts exactly as it would without the wrapper.
export function annotated(): i32 {
  let a: i32 = @lazy counted();
  return a;
}

// The operand is transparent to closure analysis: reading a captured binding
// inside it is rewritten onto the environment like any other read.
export function operandReadsCapture(): i32 {
  let x: i32 = 5;
  let read = (): i32 => x;
  let a = @lazy x;
  return read() + a;
}

// A never-read `@lazy` binding never evaluates its initializer.
export function neverRead(): i32 {
  let before = calls;
  let a = @lazy counted();
  assert(calls == before);   // the declaration did not evaluate it
  return before;
}

export function main(): i32 {
  assert(twoReads() == 82);
  assert(annotated() == 41);
  assert(operandReadsCapture() == 10);
  neverRead();
  return 0;
}
