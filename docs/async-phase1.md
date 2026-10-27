# Async/await — Phase 1 (parser + AST)

Scope note for the first phase of `docs/async-await-plan-v2.md`. Phase 1
recognizes `async` and `await` and builds the AST nodes. It contains **no
lowering, no resolver semantics and no runtime**; those are later phases.

## What this phase adds

- `NodeKind.Await` and `AwaitExpression` (`operand`, `range`) in `src/ast.ts`,
  with `Node.createAwaitExpression`.
- `isAsync` on `FunctionDeclaration` — a field, not a node kind and not a
  `CommonFlags` bit (the flag word has no free bit: its last is
  `InternallyNullable = 1 << 31`). One field covers functions, methods
  (`MethodDeclaration` extends `FunctionDeclaration`) and arrows / function
  expressions (`FunctionExpression` wraps a declaration).
- Parser recognition of `async function`, `async` methods, `async` arrows and
  `async function` expressions, and of `await` as a prefix expression.
- An AST printer case, so a parsed module round-trips.

`Token.Async` and `Token.Await` already exist in the tokenizer
(`src/tokenizer.ts:48-49`, produced by `tokenFromKeyword` at `:191-192`) and are
already reserved — they are absent from `tokenIsAlsoIdentifier` (`:356-378`),
so `let await = 5;` already fails today. This phase adds a *consumer* for tokens
that previously produced parse errors.

## Deliberate behaviour until the lowering lands

1. **`async` is recognized and reported as not implemented.**
   Every `async` function, method, arrow and function expression emits
   `AS100: Not implemented: Async functions` (a recoverable diagnostic) while
   still producing the correct AST. This is what makes the phase safe: without
   it, a parsed `await` would reach codegen's unhandled-kind `assert(false)`
   (the behaviour `yield` has today, measured) and abort the compiler. With it,
   `tensionscript` reports a named, non-zero-exit error and emits no code.
   **When the lowering lands, delete the three `Not_implemented_0` calls marked
   `TODO(lowering)` in `src/parser.ts`; nothing else in this phase needs to
   change.**
2. **`await` outside an async function is `AS1308`**, matching TypeScript's code
   and text: *"'await' expressions are only allowed within async functions and
   at the top levels of modules."* The async context does not leak into a nested
   non-async function, which is TypeScript's behaviour too (measured against
   tsc 6.0.3). Top-level `await` is **not** implemented — TensionScript's entry
   point is an ordinary function — so the second clause of that message never
   applies to us; the message is TS's verbatim so that the code and text agree.
3. **`async` in a position TypeScript rejects is rejected**, using TS1042
   (`'{0}' modifier cannot be used here.`) for the cases TS reports as 1042: a
   class property or accessor, a non-function declaration, an `async` that
   begins no function. Four finer TS codes are *not* reproduced (they are absent
   from this fork's message inventory): 1029 (`static` must precede `async`),
   1040 (ambient context), 1070 (type member) and 1089 (constructor
   declaration). Those inputs are still rejected, with 1042 instead.

## Divergences from the plan, recorded

- The plan's §0.2 puts a "defensive diagnostic" in `src/compiler.ts`. Phase 1
  puts the not-implemented diagnostic in the parser instead, so that no file
  outside the phase's declared scope is touched. The effect is equivalent (no
  code is emitted, the error is named) and it moves to the plan's location when
  the lowering transform exists.

## Tests

`tests/parser/async-*.ts` (+ fixtures) for recognition and AST shape,
`tests/parser/async-errors.ts` for the negative paths, and
`tests/compiler/async-not-implemented.ts` (+ `.json`) for the end-to-end
"compiles to a named error, not to code" guarantee.
