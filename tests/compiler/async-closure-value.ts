// §8.3(a): the async function *is* itself a closure value.
//
// A bare `async function inner() {}` written in a function body parses as an
// expression statement wrapping a `FunctionExpression` (measured) — the only
// async shape that can itself capture. Its environment arrives through `~env`
// at the entry, but its body runs in `f$resume`, a synthesized free function
// with no `_env` of its own. The entry therefore stores the received local in
// `state.$env`, and the resume re-declares it from there and reads the captured
// binding through it — including after a suspension.
//
// This is the whole-pipeline copy of the async suite's §8.3(a) case, as for
// case 6 in `async-closures-case6.ts`. The module is not executed:
// `__taskRegister` is Phase 4's runtime and traps until then.

async function outer(h: Task<i32>): i32 {
  let x: i32 = 1;
  async function inner(g: Task<i32>): i32 {
    await g;
    return x;
  }
  await h;
  inner(changetype<Task<i32>>(0));
  return x;
}

let sink: Task<i32> | null = null;

export function main(): i32 {
  sink = outer(changetype<Task<i32>>(0));
  return 1;
}
