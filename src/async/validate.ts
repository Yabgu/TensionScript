/**
 * Phase 2 of the async transform: the validation walk (Phase 3, commit 7).
 *
 * ## Why a second pass
 *
 * The lowering pass (`./lower.ts`) reaches a source's top level, a namespace's
 * members, a class body, and the statements of the async functions it lowers.
 * It does **not** reach the inside of a non-async function body, an object
 * literal, a class-field initializer beyond its root expression, a `try` or
 * `switch` outside an async body, or a top-level `if` block. An `async`
 * construct written in one of those places is invisible to it: it stays
 * `isAsync`, is never lowered and is never refused. Until now the parser's
 * Phase 1 guard was the only thing reporting such a construct; commit 7b
 * deletes that guard, so this walk is what must refuse it by name.
 *
 * ## The overlap rule
 *
 * The walk reports a construct only when no diagnostic has named it already.
 * "Already named" is the set of construct start positions the lowering pass
 * records as it refuses (`AsyncLowerTransform#refusals`), keyed per source.
 * The set is exact because the lowering pass answers those two cases
 * differently: a construct it *lowered* has `isAsync = false` (`lower.ts:644`,
 * which runs only after every artifact is built), and a construct it *refused*
 * is in the set while keeping `isAsync = true`. `isAsync` alone cannot tell
 * those two apart, which is why the set exists.
 *
 * One message per construct is structural, not conventional: the walk returns
 * from a refused construct without descending into it, and a construct the
 * lowering pass already refused is skipped at its first node.
 *
 * ## The allocation invariant
 *
 * This file allocates nothing: no node is created or cloned, nothing is pushed
 * into a structure reachable from the program, and no string keys are built.
 * It is a pure traversal that reports through `Parser#error`, and only when a
 * construct is actually refused. The reason is byte-identity: a program that
 * declares no `async` function must compile to the same bytes as before the
 * transform existed. That is a property of the emitted module, not of work
 * performed — the walk runs on every non-library source — so the traversal must
 * not perturb anything it visits. `tests/async/lower.js` enforces the four
 * forbidden constructs at source level (see "the walk allocates nothing").
 *
 * ## Message vocabulary
 *
 * A construct the lowering pass can lower or refuse keeps the lowering pass's
 * own message, because the set catches it and the walk never speaks. A
 * declaration or method the lowering pass never reached gets the one new
 * message below; an unreached function *expression* reuses the lowering pass's
 * expression message, because "nested in a non-async body" names a container
 * and an object literal is not a body.
 */

import { DiagnosticCode } from "../diagnostics";
import { Parser } from "../parser";
import {
  ArrowKind,
  ArrayLiteralExpression,
  AssertionExpression,
  AwaitExpression,
  BinaryExpression,
  BlockStatement,
  CallExpression,
  ClassDeclaration,
  ClassExpression,
  CommaExpression,
  DecoratorNode,
  DoStatement,
  ElementAccessExpression,
  EnumDeclaration,
  EnumValueDeclaration,
  ExportDefaultStatement,
  Expression,
  ExpressionStatement,
  FieldDeclaration,
  ForOfStatement,
  ForStatement,
  FunctionDeclaration,
  FunctionExpression,
  IfStatement,
  InstanceOfExpression,
  LiteralExpression,
  LiteralKind,
  MethodDeclaration,
  NamespaceDeclaration,
  NewExpression,
  Node,
  NodeKind,
  ObjectLiteralExpression,
  ParenthesizedExpression,
  PropertyAccessExpression,
  ReturnStatement,
  Source,
  Statement,
  SwitchStatement,
  TemplateLiteralExpression,
  TernaryExpression,
  ThrowStatement,
  TryStatement,
  UnaryPostfixExpression,
  UnaryPrefixExpression,
  VariableStatement,
  VoidStatement,
  WhileStatement
} from "../ast";

/** An `async` arrow function (the lowering pass's message, reused). */
export const MESSAGE_ASYNC_ARROW = "async arrow functions (async lowering)";
/** An `async` function expression (the lowering pass's message, reused). */
export const MESSAGE_ASYNC_FUNCTION_EXPRESSION = "async function expressions (async lowering)";
/**
 * An `async` declaration or method the lowering pass never reached. New in
 * commit 7: the guard's `AS100: Not implemented: Async functions` used to be
 * the only diagnostic for these, and it named no shape.
 */
export const MESSAGE_NESTED_IN_NON_ASYNC_BODY = "an async function nested in a non-async body (async lowering)";

/**
 * Walks one source's tree and refuses every `async` construct the lowering
 * pass left untouched. `refusals` is the lowering pass's per-source record of
 * construct start positions it already reported (or `null` when it refused
 * nothing); this function reads it and never writes it.
 */
export function validateAsyncConstructs(
  source: Source,
  parser: Parser,
  refused: Set<i32> | null
): void {
  validateStatements(source.statements, parser, refused);
}

/** Walks a statement list in order. */
function validateStatements(statements: Statement[], parser: Parser, refused: Set<i32> | null): void {
  for (let i = 0, k = statements.length; i < k; ++i) {
    validateStatement(statements[i], parser, refused);
  }
}

/** Walks one statement, descending into every shape that can hold a function. */
function validateStatement(statement: Statement, parser: Parser, refused: Set<i32> | null): void {
  switch (statement.kind) {
    case NodeKind.FunctionDeclaration:
    case NodeKind.MethodDeclaration: {
      validateDeclaration(<FunctionDeclaration>statement, parser, refused);
      return;
    }
    case NodeKind.ClassDeclaration: {
      validateClass(<ClassDeclaration>statement, parser, refused);
      return;
    }
    case NodeKind.NamespaceDeclaration: {
      validateStatements((<NamespaceDeclaration>statement).members, parser, refused);
      return;
    }
    case NodeKind.Block: {
      validateStatements((<BlockStatement>statement).statements, parser, refused);
      return;
    }
    case NodeKind.Do: {
      let loop = <DoStatement>statement;
      validateStatement(loop.body, parser, refused);
      validateExpression(loop.condition, parser, refused);
      return;
    }
    case NodeKind.Expression: {
      let expression = (<ExpressionStatement>statement).expression;
      if (expression.kind == NodeKind.Function) {
        let declaration = (<FunctionExpression>expression).declaration;
        if (declaration.isAsync && declaration.arrowKind == ArrowKind.None) {
          // AS parses `function f() {}` in a block as an expression statement
          // wrapping a function expression (the lowering pass plans it the same
          // way, `lower.ts` `Plan.nestedFunction`), so this is a declaration in
          // disguise and is named as one.
          refuse(parser, expression, MESSAGE_NESTED_IN_NON_ASYNC_BODY, refused);
          return;
        }
      }
      validateExpression(expression, parser, refused);
      return;
    }
    case NodeKind.For: {
      let loop = <ForStatement>statement;
      let initializer = loop.initializer;
      if (initializer != null) validateStatement(initializer, parser, refused);
      let condition = loop.condition;
      if (condition != null) validateExpression(condition, parser, refused);
      let incrementor = loop.incrementor;
      if (incrementor != null) validateExpression(incrementor, parser, refused);
      validateStatement(loop.body, parser, refused);
      return;
    }
    case NodeKind.ForOf: {
      let loop = <ForOfStatement>statement;
      validateStatement(loop.variable, parser, refused);
      validateExpression(loop.iterable, parser, refused);
      validateStatement(loop.body, parser, refused);
      return;
    }
    case NodeKind.If: {
      let branch = <IfStatement>statement;
      validateExpression(branch.condition, parser, refused);
      validateStatement(branch.ifTrue, parser, refused);
      let ifFalse = branch.ifFalse;
      if (ifFalse != null) validateStatement(ifFalse, parser, refused);
      return;
    }
    case NodeKind.Return: {
      let value = (<ReturnStatement>statement).value;
      if (value != null) validateExpression(value, parser, refused);
      return;
    }
    case NodeKind.Switch: {
      let switchStatement = <SwitchStatement>statement;
      validateExpression(switchStatement.condition, parser, refused);
      let cases = switchStatement.cases;
      for (let i = 0, k = cases.length; i < k; ++i) {
        let label = cases[i].label;
        if (label != null) validateExpression(label, parser, refused);
        validateStatements(cases[i].statements, parser, refused);
      }
      return;
    }
    case NodeKind.Throw: {
      validateExpression((<ThrowStatement>statement).value, parser, refused);
      return;
    }
    case NodeKind.Try: {
      let tryStatement = <TryStatement>statement;
      validateStatements(tryStatement.bodyStatements, parser, refused);
      let catchStatements = tryStatement.catchStatements;
      if (catchStatements != null) validateStatements(catchStatements, parser, refused);
      let finallyStatements = tryStatement.finallyStatements;
      if (finallyStatements != null) validateStatements(finallyStatements, parser, refused);
      return;
    }
    case NodeKind.Variable: {
      let declarations = (<VariableStatement>statement).declarations;
      for (let i = 0, k = declarations.length; i < k; ++i) {
        let declaration = declarations[i];
        validateDecorators(declaration.decorators, parser, refused);
        let initializer = declaration.initializer;
        if (initializer != null) validateExpression(initializer, parser, refused);
      }
      return;
    }
    case NodeKind.Void: {
      validateExpression((<VoidStatement>statement).expression, parser, refused);
      return;
    }
    case NodeKind.While: {
      let loop = <WhileStatement>statement;
      validateExpression(loop.condition, parser, refused);
      validateStatement(loop.body, parser, refused);
      return;
    }
    case NodeKind.EnumDeclaration: {
      let values = (<EnumDeclaration>statement).values;
      for (let i = 0, k = values.length; i < k; ++i) {
        validateStatement(values[i], parser, refused);
      }
      return;
    }
    case NodeKind.EnumValueDeclaration: {
      let initializer = (<EnumValueDeclaration>statement).initializer;
      if (initializer != null) validateExpression(initializer, parser, refused);
      return;
    }
    case NodeKind.FieldDeclaration: {
      let field = <FieldDeclaration>statement;
      validateDecorators(field.decorators, parser, refused);
      let initializer = field.initializer;
      if (initializer != null) validateExpression(initializer, parser, refused);
      return;
    }
    case NodeKind.ExportDefault: {
      validateStatement((<ExportDefaultStatement>statement).declaration, parser, refused);
      return;
    }
    default: {
      // `break`, `continue`, `empty`, `export { ... }`, the import forms,
      // interfaces, type declarations, `module`: none can hold a body.
      return;
    }
  }
}

/** Walks a function or method declaration: its decorators, parameters, body. */
function validateDeclaration(
  declaration: FunctionDeclaration,
  parser: Parser,
  refused: Set<i32> | null
): void {
  if (declaration.isAsync) {
    // The lowering pass lowered this (and cleared `isAsync`) or refused it (and
    // recorded it); reaching here `async` means neither happened.
    refuse(parser, declaration, MESSAGE_NESTED_IN_NON_ASYNC_BODY, refused);
    return;
  }
  validateDecorators(declaration.decorators, parser, refused);
  let parameters = declaration.signature.parameters;
  for (let i = 0, k = parameters.length; i < k; ++i) {
    let initializer = parameters[i].initializer;
    if (initializer != null) validateExpression(initializer, parser, refused);
  }
  let body = declaration.body;
  if (body != null) validateStatement(body, parser, refused);
}

/** Walks a class body: methods, field initializers, decorators. */
function validateClass(
  declaration: ClassDeclaration,
  parser: Parser,
  refused: Set<i32> | null
): void {
  validateDecorators(declaration.decorators, parser, refused);
  let members = declaration.members;
  for (let i = 0, k = members.length; i < k; ++i) {
    let member = members[i];
    switch (member.kind) {
      case NodeKind.FunctionDeclaration:
      case NodeKind.MethodDeclaration: {
        validateDeclaration(<FunctionDeclaration>member, parser, refused);
        break;
      }
      case NodeKind.FieldDeclaration: {
        let field = <FieldDeclaration>member;
        validateDecorators(field.decorators, parser, refused);
        let initializer = field.initializer;
        if (initializer != null) validateExpression(initializer, parser, refused);
        break;
      }
      default: {
        break;
      }
    }
  }
}

/** Walks decorator arguments: `@decorator(expression)`. */
function validateDecorators(
  decorators: DecoratorNode[] | null,
  parser: Parser,
  refused: Set<i32> | null
): void {
  if (decorators == null) return;
  for (let i = 0, k = decorators.length; i < k; ++i) {
    let decorator = decorators[i];
    validateExpression(decorator.name, parser, refused);
    let args = decorator.args;
    if (args != null) {
      for (let j = 0, l = args.length; j < l; ++j) {
        validateExpression(args[j], parser, refused);
      }
    }
  }
}

/** Walks one expression, descending into every shape that can hold a function. */
function validateExpression(
  expression: Expression,
  parser: Parser,
  refused: Set<i32> | null
): void {
  switch (expression.kind) {
    case NodeKind.Function: {
      let functionExpression = <FunctionExpression>expression;
      let declaration = functionExpression.declaration;
      if (declaration.isAsync) {
        // An expression the lowering pass refused is in the set (keyed by this
        // node's start, which is its declaration's start); one it never
        // reached is refused here, with the same words the lowering pass uses.
        refuse(
          parser,
          functionExpression,
          declaration.arrowKind != ArrowKind.None
            ? MESSAGE_ASYNC_ARROW
            : MESSAGE_ASYNC_FUNCTION_EXPRESSION,
          refused
        );
        return;
      }
      validateDecorators(declaration.decorators, parser, refused);
      let parameters = declaration.signature.parameters;
      for (let i = 0, k = parameters.length; i < k; ++i) {
        let initializer = parameters[i].initializer;
        if (initializer != null) validateExpression(initializer, parser, refused);
      }
      let body = declaration.body;
      if (body != null) validateStatement(body, parser, refused);
      return;
    }
    case NodeKind.Class: {
      validateClass((<ClassExpression>expression).declaration, parser, refused);
      return;
    }
    case NodeKind.Assertion: {
      validateExpression((<AssertionExpression>expression).expression, parser, refused);
      return;
    }
    case NodeKind.Await: {
      validateExpression((<AwaitExpression>expression).operand, parser, refused);
      return;
    }
    case NodeKind.Binary: {
      let binary = <BinaryExpression>expression;
      validateExpression(binary.left, parser, refused);
      validateExpression(binary.right, parser, refused);
      return;
    }
    case NodeKind.Call: {
      let call = <CallExpression>expression;
      validateExpression(call.expression, parser, refused);
      let args = call.args;
      for (let i = 0, k = args.length; i < k; ++i) {
        validateExpression(args[i], parser, refused);
      }
      return;
    }
    case NodeKind.Comma: {
      let expressions = (<CommaExpression>expression).expressions;
      for (let i = 0, k = expressions.length; i < k; ++i) {
        validateExpression(expressions[i], parser, refused);
      }
      return;
    }
    case NodeKind.ElementAccess: {
      let access = <ElementAccessExpression>expression;
      validateExpression(access.expression, parser, refused);
      validateExpression(access.elementExpression, parser, refused);
      return;
    }
    case NodeKind.InstanceOf: {
      validateExpression((<InstanceOfExpression>expression).expression, parser, refused);
      return;
    }
    case NodeKind.New: {
      let args = (<NewExpression>expression).args;
      for (let i = 0, k = args.length; i < k; ++i) {
        validateExpression(args[i], parser, refused);
      }
      return;
    }
    case NodeKind.Parenthesized: {
      validateExpression((<ParenthesizedExpression>expression).expression, parser, refused);
      return;
    }
    case NodeKind.PropertyAccess: {
      validateExpression((<PropertyAccessExpression>expression).expression, parser, refused);
      return;
    }
    case NodeKind.Ternary: {
      let ternary = <TernaryExpression>expression;
      validateExpression(ternary.condition, parser, refused);
      validateExpression(ternary.ifThen, parser, refused);
      validateExpression(ternary.ifElse, parser, refused);
      return;
    }
    case NodeKind.UnaryPostfix: {
      validateExpression((<UnaryPostfixExpression>expression).operand, parser, refused);
      return;
    }
    case NodeKind.UnaryPrefix: {
      validateExpression((<UnaryPrefixExpression>expression).operand, parser, refused);
      return;
    }
    case NodeKind.Literal: {
      let literal = <LiteralExpression>expression;
      switch (literal.literalKind) {
        case LiteralKind.Template: {
          let parts = (<TemplateLiteralExpression>literal).expressions;
          for (let i = 0, k = parts.length; i < k; ++i) {
            validateExpression(parts[i], parser, refused);
          }
          return;
        }
        case LiteralKind.Array: {
          let elements = (<ArrayLiteralExpression>literal).elementExpressions;
          for (let i = 0, k = elements.length; i < k; ++i) {
            validateExpression(elements[i], parser, refused);
          }
          return;
        }
        case LiteralKind.Object: {
          let values = (<ObjectLiteralExpression>literal).values;
          for (let i = 0, k = values.length; i < k; ++i) {
            validateExpression(values[i], parser, refused);
          }
          return;
        }
        default: {
          return;
        }
      }
    }
    default: {
      // `identifier`, `this`, `super`, the literals, `omitted`, `compiled`:
      // no child can hold an async construct.
      return;
    }
  }
}

/**
 * Reports `construct` unless the lowering pass already did. `refused` is the
 * lowering pass's per-source set of construct starts; a hit means the diagnostic
 * exists and this walk says nothing.
 */
function refuse(parser: Parser, construct: Node, message: string, refused: Set<i32> | null): void {
  if (refused != null && refused.has(construct.range.start)) return;
  parser.error(DiagnosticCode.Not_implemented_0, construct.range, message);
}
