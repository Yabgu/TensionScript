/**
 * @fileoverview The compiler's own in-tree `afterParse` transforms, applied from
 * inside the compiler.
 *
 * Both transforms read {@link Program} and nothing else: neither references
 * `binaryen`, the filesystem, the console or the injected `baseDir` (measured —
 * zero uses of every dependency the CLI used to assign onto their prototypes).
 * That is what makes them runnable from the compiler itself, in a host that
 * cannot construct them.
 *
 * The CLI used to instantiate both classes from JS and set `program` on their
 * prototypes. That works when the compiler *is* JS, and is impossible when it
 * is WebAssembly: compiler classes cross the boundary as opaque `__Internref`
 * handles — the host may pass one back into an exported function, but it
 * cannot construct one, extend one, or read a field off one — and the program
 * lives inside the instance. So the order lives here, once, and each host calls
 * this one function with the handle it already holds.
 *
 * Order is load-bearing: closures are lowered **first**, so the async transform
 * sees ordinary code — an environment local and ordinary field accesses — which
 * its lifting rule already handles (`docs/closures-plan.md` §3.1).
 */

import { Program } from "./program";
import { ClosureLowerTransform } from "./closure/lower";
import { AsyncLowerTransform } from "./async/lower";

/**
 * Runs the in-tree `afterParse` transforms over a program, in pipeline order.
 *
 * A no-op for a program that captures nothing and declares no `async` function,
 * which is what keeps the output of such a program byte-identical.
 */
export function applyInTreeTransforms(program: Program): void {
  // Closure lowering first: `ClosureLower` rewrites captures onto synthesized
  // environment objects, and the async transform's lifting rule then sees an
  // ordinary environment local and ordinary field accesses (`§3.1`).
  let closure = new ClosureLowerTransform();
  closure.program = program;
  closure.afterParse(program.parser);
  // Then the async lowering, against the already-lowered tree.
  let asyncLower = new AsyncLowerTransform();
  asyncLower.program = program;
  asyncLower.afterParse(program.parser);
}
