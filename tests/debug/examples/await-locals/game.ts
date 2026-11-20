// await-locals — a local written before a suspension and read after it.
//
// `work` writes `before`, then `await inner(...)` parks `work`'s stack: the
// core loop resumes `inner`, settles it, and resumes `work` where it stopped.
// The stop the fixture asserts is on the line *after* that resume, inside
// `work$body` — a frame that was suspended and resumed, which is what a plain
// program's line table never exercises.
//
// `main` is the stackful backend's root continuation: the module's start
// function resumes it, so every suspension below happens during instantiation.
// `_start_game` is the harness's invoke target and nothing else — calling the
// exported `main` after its continuation has settled would run it a second
// time and trap on the spent continuation.

async function inner(v: i32): i32 {
  await 1;
  return v + 1;
}

async function work(x: i32): i32 {
  let before: i32 = x + 1;
  let r = await inner(before);
  let after: i32 = before + r;
  return after;
}

export async function main(): i32 {
  let carried: i32 = 10;
  let result = await work(carried);
  return result + carried;
}

export function _start_game(): void {}
