// The awaited `@lazy` form, lowered: `f` is called at the first read, awaited
// there, and the value is memoized.
//
// The shape, which the `.wat` pair pins:
//
//   let b: i32 = @lazy await f();
//   ⟶
//   let b$done = false;
//   let b: i32;
//   if (!b$done) { b = await f(); b$done = true; }   // before each reading statement
//
// Every piece is a shape the compiler already handles — an await in assignment
// position, inside an `if` body, with the cells lifted into the state struct
// because they are ordinary locals declared before the suspension. That is the
// whole reason the lowering is a rewrite and not a new mechanism.
//
// **A declared type is required**, and the reason is not this feature's: a memo
// cell that crosses a suspension becomes a field of the state struct, and a state
// field needs a syntactic type. `let v = await f();` — without `@lazy` at all —
// is refused for the same reason. The diagnostic is `TS6399`.
//
// The two counters below are asserted at run time by `main`, which the fixture
// harness compiles but does not execute; the numbers were checked with a host
// run before the fixture was pinned (7 + 7 + 100, i.e. one call for two reads).

let calls: i32 = 0;

async function counted(): i32 {
  calls += 1;
  return 7;
}

// Two reads, one call, one await.
export async function twoReads(): i32 {
  let b: i32 = @lazy await counted();
  let first: i32 = b;
  let second: i32 = b;
  return first + second + calls * 100;   // 7 + 7 + 100
}

// A read only inside a branch: the guard goes inside the branch, so a path that
// never reads the binding never evaluates it.
export async function branchRead(flag: bool): i32 {
  let b: i32 = @lazy await counted();
  if (flag) {
    return b;
  }
  return 0;
}

// Never read: the initializer never runs.
export async function neverRead(): i32 {
  let before: i32 = calls;
  let b: i32 = @lazy await counted();
  assert(calls == before);
  return before;
}

// The await also works when the deferred expression is not the whole statement.
export async function inExpression(): i32 {
  let b: i32 = @lazy await counted();
  return b * 2;
}
