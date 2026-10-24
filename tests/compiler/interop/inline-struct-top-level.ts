// `@inline struct` at top level is **refused**, and the refusal is load-bearing.
//
// **Three-way, and the refuse cell is measured.**
//
//   refuse  (before this commit): a top-level value with an *inferred* type
//           compiled silently as an `i32` pointer global, and two of them
//           aliased. Measured:
//
//               @inline struct P { x: u32 = 0; y: u32 = 0; }
//               const G = new P();
//               const H = G;                 // no annotation: unchecked
//               export function f(): u32 { G.x = 5; H.x = 99; return G.x; }
//
//           `f()` returned 99 — `H.x = 99` changed `G.x`. Both were
//           `(global $G (mut i32) …)`, i.e. pointer slots.
//
//           The *annotated* form was already refused (`const G: P = …`), because
//           that check sits in the annotated branch. The gap was the inferred
//           one, which takes the other branch.
//
//   partial (a fix that checks only the annotated branch): the annotated case
//           still refuses with the top-level message, but the inferred case
//           compiles and aliases. This file's second and third cases catch it.
//
//   fixed   (this commit): both forms refuse, with a message that names the
//           alternative — declare it inside a function, where SROA applies.
//
// SROA for top-level statics (per-field WASM *globals*, or a shadow slot) is a
// filed follow-up, not part of this phase: a global is one `i32` slot, and a
// value needs one per field.

@inline struct P { x: u32 = 0; y: u32 = 0; }

// 1. annotated: was already refused
const WITH_TYPE: P = new P(1, 2);

// 2. inferred: the gap this commit closes
const WITHOUT_TYPE = new P(1, 2);

// 3. a second inferred value, which is what made the aliasing observable
const SECOND = WITHOUT_TYPE;

// 4. `let` takes the same path (a top-level `let` is a global too)
let MUTABLE = new P(1, 2);

// 5. and a static class field, annotated
class Holder {
  static g: P = new P(1, 2);
}

export function run(): i32 {
  return <i32>(WITH_TYPE.x + WITHOUT_TYPE.x + SECOND.x + MUTABLE.x + Holder.g.x);
}
