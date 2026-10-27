// `@lazy` in a type position: refused (`TS6396`).
//
// Measured before this refusal existed: `let x: i32 @lazy = 5;` compiled clean.
// `parseType`'s post-type loop accepts any decorator that is not a memory model
// as a *type attribute* (`x: f32 @abi.alias("f")`), so `@lazy` was read as one
// and then ignored — the worst kind of acceptance, because the spelling looks
// like it might mean something.
//
// The reading is impossible rather than merely unimplemented: `@lazy` defers an
// *expression*, and there is no expression here to defer — the decorator follows
// a type. So the refusal names the correct position instead of the wrong one.
//
// This is the same trap the memory-model phase closed for `V @inline` (`TS6392`),
// and the fix is in the same place, one branch below it. `@abi.alias` and every
// other attribute are unaffected: the check matches the name `lazy` and nothing
// else.
//
// The pre-type position (`v: @lazy V`) is a different diagnostic — `AS212`,
// "Decorator '@lazy' is not valid here" — because there the decorator is at least
// in a decorator position; it is simply not a memory model.

export function attributeAfterType(): i32 {
  let x: i32 @lazy = 5;
  return x;
}
