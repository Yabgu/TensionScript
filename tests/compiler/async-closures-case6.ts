// A composition guard (Phase 3, commit 8): an async function captures a binding
// into a closure environment, suspends, and reads the binding again after the
// await.
//
// This is the top-level copy of the shape the async suite asserts in detail
// (case 6). It exercises the whole pipeline in one place — parse, the closure
// transform, the async transform, resolve, codegen, emit — so a break in the
// layering between closures and async fails this fixture, not only the nested
// tests that own each half. The wat fixtures pin the emitted shape: the
// environment reaches the resume function through the state struct's `$env`, the
// captured binding has exactly one home (the environment), and the resume reads
// it there.
//
// The module is not executed: `__taskRegister` is Phase 4's runtime and traps
// until then, for any async entry and not only this one.

async function outer(h: Task<i32>): i32 {
  let x: i32 = 1;
  function inner(): i32 { return x; }
  await h;
  return inner() + x;
}

let sink: Task<i32> | null = null;

export function main(): i32 {
  sink = outer(changetype<Task<i32>>(0));
  return 1;
}
