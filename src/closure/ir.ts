/**
 * Backend-independent records the closure lowering produces as *analysis
 * results*, plus the one flag codegen reads.
 *
 * `docs/closures-plan.md` §3.3: capture facts are not AST facts — the AST is
 * cloned (`compiler.ts:7335`, `expression.declaration.clone()`), and metadata
 * hung on a node is stale after a clone. They live here, keyed by node
 * identity, the same discipline as `src/async/ir.ts`.
 *
 * The flag itself (`FunctionPrototype#envKind`) is a compile-time
 * representation fact, not a bit in `_env`: `_env` is a plain `usize` word whose
 * meaning is fixed per function, exactly as `capturesThis` fixed it for the
 * shipped this-only arrow path.
 */

import { FunctionExpression } from "../ast";

/**
 * What a function's `_env` word means.
 *
 * - `None` — no capture. The value is the static `Function<T>` instance with
 *   `_env = 0` (`compiler.ts:2194-2210`), and nothing is allocated.
 * - `Receiver` — a this-only arrow. The value is a heap `Function<T>` whose
 *   `_env` names the creating function's receiver (`compiler.ts:7534-7558`),
 *   and the callee's prologue reads it into its `this` local. This is the
 *   shipped arrow-`this` path and is untouched by the closure transform.
 * - `Struct` — at least one non-`this` capture. The value is a heap
 *   `Function<T>` whose `_env` names a synthesized environment object; the
 *   callee's prologue reads it into `$closureEnvIn`.
 */
export const enum EnvKind {
  None,
  Receiver,
  Struct
}

/** What the closure transform decided for one nested function. */
export class EnvInfo {
  constructor(
    /** What `_env` means for this function. */
    public kind: EnvKind = EnvKind.None,
    /**
     * The synthesized environment class this function reads, as a source-level
     * type name. `null` for `None` and `Receiver`.
     */
    public envClass: string | null = null
  ) {}
}

/**
 * One entry per nested `FunctionExpression` the transform rewrote. Keyed by the
 * expression node: `compileFunctionExpression` receives exactly this node
 * before it clones the declaration (`compiler.ts:7335`), so the key survives
 * the clone.
 */
export const envInfoOf = new Map<FunctionExpression, EnvInfo>();

/**
 * The local that holds the environment to store in a closure's `_env`, keyed
 * by the **creation site** (`FunctionExpression`). The same function declaration
 * can be created in more than one scope, and the local is the innermost owning
 * scope's at that site — so the site is the key, not the declaration.
 */
export const creationEnvOf = new Map<FunctionExpression, string>();
