/// <reference path="./rt/index.d.ts" />

/**
 * The runtime half of one closure rule: a captured binding read before it was
 * assigned is a *defined* failure, not a silent zero.
 *
 * `docs/closures-plan.md` §2.5. When a local is captured, it stops being a wasm
 * local and becomes a field of a synthesized environment object. That demotion
 * removes it from AS's definite-assignment analysis, and the environment's
 * fields are zero-initialized — so without this guard `let x: i32; const f =
 * () => x; f();` would read `0` and look correct. Instead the transform emits an
 * `$init$<name>` flag for every captured declaration without an initializer,
 * sets it on the first assignment, and routes every read through this function,
 * which aborts with the binding's name.
 *
 * A separate helper rather than `assert` because `assert` is omitted under
 * `--noAssert`, and this is a correctness guard, not a debug check.
 */
export function __closureInit<T>(value: T, initialized: bool, name: string): T {
  if (!initialized) abort("reading an uninitialized captured binding " + name);
  return value;
}
