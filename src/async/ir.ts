/**
 * Backend-independent records the async lowering produces as *analysis results*.
 *
 * `docs/async-await-plan-v2.md` §5.5: backend metadata lives in side tables
 * keyed by node identity, never on the AST. The rule exists so a backend can be
 * deleted without touching a node — and so the AST stays the syntax it parses.
 * `lower.ts` fills these tables; `compiler.ts` reads the one entry it needs
 * (the typed read of a lowered `await`, §4.7.4).
 */

import { AwaitExpression, Expression } from "../ast";

/** One lowered `await`, as the lowering recorded it. */
export class AwaitSite {
  constructor(
    /**
     * The resume-point discriminator this await resumes at: `0` is the entry,
     * `1..N` are the await sites in textual source order, `N+1` is the terminal
     * (§4.1 artifact 1).
     */
    public discriminator: i32,
    /**
     * The synthesized state-struct field holding the awaited task's record —
     * `state.$awaited<K>` — as an expression the compiler can emit. It is not
     * in the tree; its range is the lowered file's, which is what
     * `maybeCompileEnclosingSource` needs to find the enclosing source.
     */
    public recordExpression: Expression
  ) {}
}

/**
 * Every lowered `await`, keyed by the `AwaitExpression` node that survives in
 * the tree. Identity-keyed: `Map` hashes a reference key by its address and
 * compares with `==` (`std/assembly/map.ts:92`, `std/assembly/util/hash.ts:4-8`),
 * which is exactly node identity.
 *
 * One table for the process, like `program.uniqueSignatures` — the transform and
 * the compiler are two halves of the same compiler, and the table is the seam
 * between them.
 */
export const awaitSites = new Map<AwaitExpression, AwaitSite>();
