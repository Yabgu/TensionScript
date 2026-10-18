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

import { FunctionDeclaration, FunctionExpression } from "../ast";

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

/**
 * What the closure transform decided for one nested function
 * (`docs/closures-plan.md` §3.3, as amended by C5a).
 */
export class EnvInfo {
  constructor(
    /** What `_env` means for this function. */
    public kind: EnvKind = EnvKind.None,
    /**
     * The synthesized class of the environment this function's `_env` names —
     * its **head** env (§4.7.1). `null` for `None` and `Receiver`.
     */
    public envClass: string | null = null,
    /**
     * This function's body (or one of its nested scopes) allocates an
     * environment (§3.3).
     */
    public ownEnv: boolean = false,
    /**
     * This function is a closure value: it has `$closureEnvIn` and a prologue
     * (§3.3). True exactly when `kind == Struct`.
     */
    public receivesEnv: boolean = false,
    /**
     * The class of the env this function's **OWN body env** links to (C5a);
     * `null` at a root, or when the body owns nothing (§3.3).
     */
    public parentClass: string | null = null,
    /**
     * C5b: the head env carries `$this` at field 0 (§4.7.5). True when the
     * function's scope has a receiver and either the body or an arrow needs it.
     */
    public hasThis: boolean = false
  ) {}
}

/**
 * The environment **owned by a function's own body**, keyed by its declaration
 * (§3.3). One record per analysed function that owns one, including nested
 * owners and the analysis root.
 *
 * Why this is separate from `envInfoOf`: that table answers "what does this
 * function value's `_env` mean", and is keyed by the `FunctionExpression` a
 * closure is created from. A method or a top-level function is not a closure
 * value and has no such expression, but the async transform still needs to know
 * what its body allocates — that is what this table answers (C5b, §4.7.5).
 */
export const ownerEnvOf = new Map<FunctionDeclaration, EnvInfo>();

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
