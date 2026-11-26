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
import { CommonFlags, Feature } from "./common";
import { ClosureLowerTransform } from "./closure/lower";
import { LazyAwaitTransform } from "./lazy/lower";
import { AsyncLowerTransform } from "./async/lower";
import { StackfulAsyncTransform } from "./async/stack";

import {
  NodeKind,
  LiteralKind,
  Statement,
  Expression,
  BlockStatement,
  ClassDeclaration,
  DoStatement,
  ExportDefaultStatement,
  ExpressionStatement,
  ForOfStatement,
  ForStatement,
  FunctionDeclaration,
  IfStatement,
  NamespaceDeclaration,
  ReturnStatement,
  SwitchStatement,
  ThrowStatement,
  TryStatement,
  VariableStatement,
  WhileStatement,
  ArrayLiteralExpression,
  AssertionExpression,
  AwaitExpression,
  BinaryExpression,
  CallExpression,
  ClassExpression,
  CommaExpression,
  ElementAccessExpression,
  FunctionExpression,
  LazyExpression,
  NewExpression,
  ObjectLiteralExpression,
  ParenthesizedExpression,
  PropertyAccessExpression,
  TemplateLiteralExpression,
  TernaryExpression,
  UnaryExpression,
  LiteralExpression
} from "./ast";

/**
 * Latches the two program-wide async facts the emitter needs, **before** the
 * lowering mutates the tree.
 *
 * `hasAsync` cannot be answered afterwards: the async lowering rewrites every
 * function it lowers and clears `declaration.isAsync` on the way (`lower.ts`),
 * so a post-transform scan would see none of them. `hasAwait` is latched at the
 * same time for the same reason — and because A1 needs the distinction, not
 * just the presence of `async`: a program with an `await` belongs to Backend A
 * and its bytes must not move, while an await-free async program is what the
 * continuation shell runs today.
 *
 * The scan is statement-recursive and expression-recursive rather than a
 * generic visitor because this file may not depend on `src/extra/ast.ts` (that
 * module is not part of the compiler's wasm graph). It is deliberately exact
 * about the shapes the language accepts and silent about the rest: a false
 * negative here costs a shell that a later round would emit anyway, a false
 * positive would change bytes for a program that never suspends.
 */
function latchAsyncUsage(program: Program): void {
  let sources = program.sources;
  // **The entry first**, and in its own pass: whether `main` itself is `async`
  // decides whether a shell exists at all (`shouldEmitAsyncShell`), while the
  // scan below stops as soon as it has seen an async declaration and an await
  // — which may be before it reaches `main`. A module exporting a synchronous
  // `main` that contains an async helper is not a program a shell should start.
  for (let i = 0, k = sources.length; i < k; ++i) {
    latchAsyncEntry(sources[i].statements, program);
  }
  for (let i = 0, k = sources.length; i < k; ++i) {
    scanStatements(sources[i].statements, program);
    if (program.hasAsync && program.hasAwait) return;
  }
}

/**
 * Top-level declarations only: `export async function main` is the entry a
 * shell can start.
 *
 * Exported is part of the test because `mainFunction` is set from the *export*
 * table (`compiler.ts:2247`) — a nested or unexported `async function main` is
 * not an entry and must not make a sync `main` look startable.
 */
function latchAsyncEntry(statements: Statement[], program: Program): void {
  for (let i = 0, k = statements.length; i < k; ++i) {
    let statement = statements[i];
    if (statement.kind != NodeKind.FunctionDeclaration) continue;
    let declaration = <FunctionDeclaration>statement;
    if (!declaration.isAsync) continue;
    if (!declaration.is(CommonFlags.Export)) continue;
    if (declaration.name.text != "main") continue;
    program.hasAsyncMain = true;
  }
}

function scanStatements(statements: Statement[], program: Program): void {
  for (let i = 0, k = statements.length; i < k; ++i) {
    scanStatement(statements[i], program);
    if (program.hasAsync && program.hasAwait) return;
  }
}

function scanStatement(statement: Statement, program: Program): void {
  switch (statement.kind) {
    case NodeKind.FunctionDeclaration:
    case NodeKind.MethodDeclaration: {
      let declaration = <FunctionDeclaration>statement;
      if (declaration.isAsync) program.hasAsync = true;
      let body = declaration.body;
      if (body) scanStatement(body, program);
      break;
    }
    case NodeKind.ClassDeclaration: {
      let members = (<ClassDeclaration>statement).members;
      for (let i = 0, k = members.length; i < k; ++i) scanStatement(members[i], program);
      break;
    }
    case NodeKind.NamespaceDeclaration: {
      let members = (<NamespaceDeclaration>statement).members;
      scanStatements(members, program);
      break;
    }
    case NodeKind.ExportDefault: {
      let declaration = (<ExportDefaultStatement>statement).declaration;
      if (declaration) scanStatement(declaration, program);
      break;
    }
    case NodeKind.Expression: {
      scanExpression((<ExpressionStatement>statement).expression, program);
      break;
    }
    case NodeKind.Variable: {
      let declarations = (<VariableStatement>statement).declarations;
      for (let i = 0, k = declarations.length; i < k; ++i) {
        let initializer = declarations[i].initializer;
        if (initializer) scanExpression(initializer, program);
      }
      break;
    }
    case NodeKind.Block: {
      scanStatements((<BlockStatement>statement).statements, program);
      break;
    }
    case NodeKind.If: {
      let ifStatement = <IfStatement>statement;
      scanExpression(ifStatement.condition, program);
      scanStatement(ifStatement.ifTrue, program);
      let ifFalse = ifStatement.ifFalse;
      if (ifFalse) scanStatement(ifFalse, program);
      break;
    }
    case NodeKind.For: {
      let forStatement = <ForStatement>statement;
      let initializer = forStatement.initializer;
      if (initializer) scanStatement(initializer, program);
      let condition = forStatement.condition;
      if (condition) scanExpression(condition, program);
      let incrementor = forStatement.incrementor;
      if (incrementor) scanExpression(incrementor, program);
      scanStatement(forStatement.body, program);
      break;
    }
    case NodeKind.ForOf: {
      let forOf = <ForOfStatement>statement;
      scanStatement(forOf.variable, program);
      scanExpression(forOf.iterable, program);
      scanStatement(forOf.body, program);
      break;
    }
    case NodeKind.While: {
      let whileStatement = <WhileStatement>statement;
      scanExpression(whileStatement.condition, program);
      scanStatement(whileStatement.body, program);
      break;
    }
    case NodeKind.Do: {
      let doStatement = <DoStatement>statement;
      scanStatement(doStatement.body, program);
      scanExpression(doStatement.condition, program);
      break;
    }
    case NodeKind.Return: {
      let value = (<ReturnStatement>statement).value;
      if (value) scanExpression(value, program);
      break;
    }
    case NodeKind.Switch: {
      let switchStatement = <SwitchStatement>statement;
      scanExpression(switchStatement.condition, program);
      let cases = switchStatement.cases;
      for (let i = 0, k = cases.length; i < k; ++i) {
        let label = cases[i].label;
        if (label) scanExpression(label, program);
        scanStatements(cases[i].statements, program);
      }
      break;
    }
    case NodeKind.Throw: {
      scanExpression((<ThrowStatement>statement).value, program);
      break;
    }
    case NodeKind.Try: {
      let tryStatement = <TryStatement>statement;
      scanStatements(tryStatement.bodyStatements, program);
      let catchStatements = tryStatement.catchStatements;
      if (catchStatements) scanStatements(catchStatements, program);
      let finallyStatements = tryStatement.finallyStatements;
      if (finallyStatements) scanStatements(finallyStatements, program);
      break;
    }
  }
}

function scanExpression(expression: Expression, program: Program): void {
  switch (expression.kind) {
    case NodeKind.Await: {
      program.hasAwait = true;
      scanExpression((<AwaitExpression>expression).operand, program);
      break;
    }
    case NodeKind.Function: {
      let declaration = (<FunctionExpression>expression).declaration;
      if (declaration.isAsync) program.hasAsync = true;
      let body = declaration.body;
      if (body) scanStatement(body, program);
      break;
    }
    case NodeKind.Class: {
      let members = (<ClassExpression>expression).declaration.members;
      for (let i = 0, k = members.length; i < k; ++i) scanStatement(members[i], program);
      break;
    }
    case NodeKind.Assertion: {
      scanExpression((<AssertionExpression>expression).expression, program);
      break;
    }
    case NodeKind.Binary: {
      let binary = <BinaryExpression>expression;
      scanExpression(binary.left, program);
      scanExpression(binary.right, program);
      break;
    }
    case NodeKind.Call: {
      let call = <CallExpression>expression;
      scanExpression(call.expression, program);
      let args = call.args;
      for (let i = 0, k = args.length; i < k; ++i) scanExpression(args[i], program);
      break;
    }
    case NodeKind.Comma: {
      let expressions = (<CommaExpression>expression).expressions;
      for (let i = 0, k = expressions.length; i < k; ++i) scanExpression(expressions[i], program);
      break;
    }
    case NodeKind.ElementAccess: {
      let access = <ElementAccessExpression>expression;
      scanExpression(access.expression, program);
      scanExpression(access.elementExpression, program);
      break;
    }
    case NodeKind.New: {
      let args = (<NewExpression>expression).args;
      for (let i = 0, k = args.length; i < k; ++i) scanExpression(args[i], program);
      break;
    }
    case NodeKind.Parenthesized: {
      scanExpression((<ParenthesizedExpression>expression).expression, program);
      break;
    }
    case NodeKind.PropertyAccess: {
      scanExpression((<PropertyAccessExpression>expression).expression, program);
      break;
    }
    case NodeKind.Ternary: {
      let ternary = <TernaryExpression>expression;
      scanExpression(ternary.condition, program);
      scanExpression(ternary.ifThen, program);
      scanExpression(ternary.ifElse, program);
      break;
    }
    case NodeKind.UnaryPostfix:
    case NodeKind.UnaryPrefix: {
      scanExpression((<UnaryExpression>expression).operand, program);
      break;
    }
    case NodeKind.Lazy: {
      scanExpression((<LazyExpression>expression).expression, program);
      break;
    }
    case NodeKind.Literal: {
      let literal = <LiteralExpression>expression;
      switch (literal.literalKind) {
        case LiteralKind.Template: {
          let template = <TemplateLiteralExpression>literal;
          let tag = template.tag;
          if (tag) scanExpression(tag, program);
          let expressions = template.expressions;
          for (let i = 0, k = expressions.length; i < k; ++i) scanExpression(expressions[i], program);
          break;
        }
        case LiteralKind.Array: {
          let elements = (<ArrayLiteralExpression>literal).elementExpressions;
          for (let i = 0, k = elements.length; i < k; ++i) scanExpression(elements[i], program);
          break;
        }
        case LiteralKind.Object: {
          let values = (<ObjectLiteralExpression>literal).values;
          for (let i = 0, k = values.length; i < k; ++i) scanExpression(values[i], program);
          break;
        }
      }
      break;
    }
  }
}

/**
 * Runs the in-tree `afterParse` transforms over a program, in pipeline order.
 *
 * A no-op for a program that captures nothing and declares no `async` function,
 * which is what keeps the output of such a program byte-identical.
 */
export function applyInTreeTransforms(program: Program): void {
  // The program-wide async facts the emitter reads, before any transform can
  // clear `isAsync` (`latchAsyncUsage` explains why this cannot be later).
  latchAsyncUsage(program);
  // The `@lazy await` lowering first: it splits a deferred-await declaration into
  // a flag and a cell and inserts a guard before each reading statement. Its
  // output is ordinary locals and an ordinary `if` with an `await` in its body,
  // which is what both transforms below already handle -- so running it first is
  // what makes it a rewrite rather than a third lowering.
  let lazyAwait = new LazyAwaitTransform();
  lazyAwait.program = program;
  lazyAwait.afterParse(program.parser);
  // Closure lowering next: `ClosureLower` rewrites captures onto synthesized
  // environment objects, and the async transform's lifting rule then sees an
  // ordinary environment local and ordinary field accesses (`§3.1`).
  let closure = new ClosureLowerTransform();
  closure.program = program;
  closure.afterParse(program.parser);
  // Then the async lowering, against the already-lowered tree.
  //
  // **Which lowering is a feature decision, not a version one.** A program
  // that opts into continuations with `--enable stack-switching` gets the
  // stackful backend; every other program — including one with an `await`
  // today — keeps Backend A byte for byte. That is the whole compatibility
  // story of the round, and it is checked by comparing the two builds.
  //
  // **`--stackful-backend=fiber` selects the same lowering without the feature
  // flag** (DL37). The flag used to be the only way in, so a fiber build had to
  // pass `--enable stack-switching` as well — and then the artifact declared the
  // shell's continuation types and demanded the feature it never used (I85). The
  // lowering is a choice of *mechanism*; a fiber build takes the same transform
  // and expresses its suspension as a call, so it needs no wasm proposal to be
  // selected or to load.
  // `Options.fiberBackendSelected`, not a literal `"fiber"` comparison: DL51 made `auto`
  // mean fiber, and a second spelling of "the fiber answer" here would have left the
  // transform on the promise lowering while the artifact declared `backend=fiber`.
  let stackfulBackend = program.options.hasFeature(Feature.StackSwitching)
    || program.options.fiberBackendSelected;
  if (program.hasAwait && stackfulBackend) {
    let stackful = new StackfulAsyncTransform();
    stackful.program = program;
    stackful.afterParse(program.parser);
  } else {
    let asyncLower = new AsyncLowerTransform();
    asyncLower.program = program;
    asyncLower.afterParse(program.parser);
  }
}
