// An async function reaches the compiler and is refused by name.
//
// Phase 1 recognizes `async`/`await` and builds the AST; there is no lowering
// yet. The guarantee this pins is that the pipeline reports
// `AS100: Not implemented: Async functions` and **emits no code**, rather than
// walking an expression it does not understand into codegen's
// unhandled-kind `assert(false)` -- which is what `yield` does today.
// See ASYNC_PHASE1.md.

async function notYet(): void {}

export function main(): void {
  notYet();
}
