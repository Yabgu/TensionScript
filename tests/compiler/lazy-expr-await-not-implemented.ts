// `@lazy await ...`: parsed, and refused until the lowering lands (`AS100`).
//
// The refusal is deliberate and early. The four target forms all *parse* -- that
// is what this foundation buys -- but only the synchronous one can be evaluated
// in the absence of the lowering, because an `await` inside the operand needs the
// async transform, and that transform cannot see through the wrapper.
//
// Measured before this refusal: the file failed later with
// `AS100: Not implemented: this async body (async lowering)`, which names the
// enclosing function and not the construct. A refusal at the construct is the
// honest one: it says what is missing and where.

async function one(): i32 { return 1; }

export async function deferredAwait(): i32 {
  let a = @lazy await one();
  return a;
}
