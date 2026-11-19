/**
 * Backend B of the async lowering: the **stackful** transform.
 *
 * A1 built the shell — `main` is resumed on a continuation, never called.
 * A2 makes a call to a may-suspend `async function` create that continuation
 * and stash its arguments in a task cell, so the call itself runs none of the
 * body (`docs/async-core-loop.md` §4.1). The body is a separate ordinary
 * function, `f$body`, called by the synthesized zero-argument continuation
 * `f$start`; because a resumed continuation cannot be handed arguments
 * (§3.1's note, A1's `BinaryenResume` limitation), the arguments live in a
 * per-task record that `f$start` reads on entry.
 *
 * There is **no state machine**. The continuation's own stack holds every local
 * across a suspension; the transform only splits the call path from the body
 * path and gives the body a cell.
 *
 * ## What is emitted, per `async function f(...): R` that contains an `await`
 *
 * ```ts
 * class f$Rec extends TaskRecord { $p0: T0; ... }   // the arguments
 * function f$body(...): R { <the original body> }    // the body, unchanged
 * function f$start(): i32 {                          // the continuation
 *   let $rec = changetype<f$Rec>(__currentRecord());
 *   let $r = f$body($rec.$p0, ...);
 *   $rec.payload = $r; $rec.done = 1;
 *   return 0;
 * }
 * function f(...): Task<R> {                         // the entry (the call site)
 *   let $rec = new f$Rec(args...);
 *   let $task = new Task<R>();
 *   $task._record = $rec;
 *   let $slot = __asyncSlotFor($rec);
 *   __installCont($slot, f$start);
 *   $rec.key = $slot;
 *   return $task;
 * }
 * ```
 *
 * `await` reads `$task._record` after the suspend and loads the value the
 * continuation wrote. That is the whole value path: the call parks the caller
 * with the awaited continuation's slot, the coreloop resumes it, the
 * continuation writes its result into its own record and completes, and the
 * caller — whose record reference is on its suspended stack — reads it back.
 *
 * ## What is *not* transformed
 *
 * - `main`. It is the root task (A2 lets it await), and its continuation is
 *   built directly from its compiled function; wrapping it would give the
 *   program a task whose body `main$start` never runs.
 * - An `async function` whose body contains no `await`. §4.4: `async` means
 *   *may* suspend; the modifier is cleared, the call is an ordinary call, and
 *   `await g()` reads a value that is already there. This is not an
 *   optimization — it is the rule that keeps a non-suspending `async` from
 *   paying for a stack.
 *
 * Everything else in the language is refused **by name** here rather than
 * silently left to a backend that will not run: async methods, async arrows and
 * function expressions, generic async functions, parameters that cannot be
 * stored in a record, and results other than `i32`/`void`. A2's mechanism is
 * complete for the shapes it accepts; the refusals mark the shapes it does not
 * yet accept.
 */

/* eslint-disable @typescript-eslint/no-explicit-any --
 * The scanner walks AST node fields that are not part of the compiler's wasm
 * graph (`src/extra/ast.ts` is deliberately unavailable here). Each cast is a
 * field read on a `NodeKind` already narrowed by the switch; the alternative
 * is importing every statement/expression class just to restate fields this
 * file does not modify. */
import { Parser } from "../parser";
import { Program } from "../program";
import { DiagnosticCode, Range } from "../diagnostics";
import { Token } from "../tokenizer";
import { CommonFlags } from "../common";
import {
  ArrowKind,
  BlockStatement,
  CallExpression,
  ClassDeclaration,
  DeclarationStatement,
  Expression,
  ExpressionStatement,
  FunctionDeclaration,
  FunctionExpression,
  MethodDeclaration,
  LiteralKind,
  NamedTypeNode,
  Node,
  NodeKind,
  ParameterKind,
  ParameterNode,
  Statement,
  TypeNode,
  VariableStatement
} from "../ast";

/** Writes the handle's record without its managed setter (`async-stack.ts`). */
const SET_RECORD = "__setTaskRecord";
/** Suffix of the synthesized body function. */
const BODY_SUFFIX = "$body";
/** Suffix of the synthesized continuation function. */
const START_SUFFIX = "$start";
/** Suffix of the synthesized argument record class. */
const RECORD_SUFFIX = "$Rec";
/** The cell's slot field (`TaskRecord.key`, `std/assembly/task.ts`). */
const SLOT_FIELD = "key";
/** The cell's completion flag. */
const DONE_FIELD = "done";
/** The cell's integer result slot. */
const PAYLOAD_FIELD = "payload";
/** The current task record (`std/assembly/async-stack.ts`). */
const CURRENT_RECORD = "__currentRecord";
/** Bump-allocates a zeroed task cell (`std/assembly/async-stack.ts`). */
const ALLOC_CELL = "__allocCell";
/** Installs a continuation at a slot (`src/builtins.ts`). */
const INSTALL_CONT = "__installCont";
/** `Task<R>` — the handle type (`std/assembly/task.ts`). */
const TASK_NAME = "Task";
/** The base record (`std/assembly/task.ts`). */
const TASK_RECORD_NAME = "TaskRecord";

export class StackfulAsyncTransform {

  /** The program being transformed. Assigned by `applyInTreeTransforms`. */
  program!: Program;

  /** `Transform#afterParse` — runs after parsing, before initialization. */
  afterParse(parser: Parser): void {
    let sources = this.program.sources;
    for (let i = 0, k = sources.length; i < k; ++i) {
      let source = sources[i];
      // The compiler's own std is never transformed. It declares no `async`
      // function, and skipping it keeps the transform out of std entirely.
      if (this.program.stdSources.has(source)) continue;
      this.transformStatements(source.statements, parser);
    }
  }

  /** Rewrites one statement list in place. */
  private transformStatements(statements: Statement[], parser: Parser): void {
    let declared = new Array<string>();
    for (let i = 0, k = statements.length; i < k; ++i) {
      let name = declarationName(statements[i]);
      if (name != null) declared.push(name);
    }

    let out = new Array<Statement>();
    for (let i = 0, k = statements.length; i < k; ++i) {
      let statement = statements[i];
      switch (statement.kind) {
        case NodeKind.FunctionDeclaration: {
          let declaration = <FunctionDeclaration>statement;
          // `main` is the root task. Its continuation is the compiled function
          // itself, wrapped by `main$start` in the compiler; transforming it
          // would create a second body that nothing resumes.
          if (declaration.name.text == "main") {
            // `main` is the root task: its body stays where it is, and its
            // `await`s are compiled by the shell's await path. A `try` around
            // one is refused by name here, before the compiler's generic
            // "Exceptions" diagnostic, so the message names the suspension.
            let tryNode = findTryAroundAwait(declaration.body);
            if (tryNode != null) {
              this.refuse(parser, tryNode.range, "a try/catch around an await (the stackful backend; exceptions do not yet cross a suspension)");
            }
            if (this.refuseUnsupportedAsyncConstructs(declaration.body, parser)) break;
            out.push(statement);
            break;
          }
          let artifacts = this.transformFunction(declaration, declared, parser);
          if (artifacts != null) {
            for (let j = 0, l = artifacts.length; j < l; ++j) out.push(artifacts[j]);
          } else {
            out.push(statement);
          }
          break;
        }
        case NodeKind.NamespaceDeclaration: {
          // `NamespaceDeclaration.members` is a statement list like any other.
          this.transformStatements((<any>statement).members, parser);
          out.push(statement);
          break;
        }
        case NodeKind.ClassDeclaration: {
          let classDeclaration = <ClassDeclaration>statement;
          this.transformClass(classDeclaration, parser);
          out.push(statement);
          break;
        }
        default: {
          this.refuseUnsupportedAsyncConstructs(statement, parser);
          out.push(statement);
          break;
        }
      }
    }

    statements.length = 0;
    for (let i = 0, k = out.length; i < k; ++i) statements.push(out[i]);
  }

  /**
   * Transforms one `async function` declaration, or returns `null` when it is
   * refused (the diagnostic has already been reported).
   *
   * The declaration is mutated into the **entry** and keeps its name, flags,
   * decorators and parameter list; the body moves to `f$body`, which has new
   * parameter nodes with the same names.
   */
  private transformFunction(
    declaration: FunctionDeclaration,
    declared: string[],
    parser: Parser
  ): Statement[] | null {
    if (!declaration.isAsync) {
      // An `await` in a non-async function is the parser's diagnostic (AS1308);
      // it cannot occur here, but a nested async construct can.
      this.refuseUnsupportedAsyncConstructs(declaration.body, parser);
      return null;
    }

    // §4.4 first: a body that cannot suspend is free. Clearing the modifier is
    // the whole lowering — the call becomes an ordinary call, and `await` on it
    // is the resolver's identity rule.
    if (!containsAwait(declaration.body)) {
      declaration.isAsync = false;
      this.refuseUnsupportedAsyncConstructs(declaration.body, parser);
      return null;
    }

    let range = declaration.range;
    if (declaration.typeParameters != null && declaration.typeParameters.length != 0) {
      this.refuse(parser, range, "a generic async function (the stackful backend)");
      return null;
    }
    if (declaration.signature.explicitThisType != null) {
      this.refuse(parser, range, "an explicit `this:` parameter on an async function (the stackful backend)");
      return null;
    }
    let body = declaration.body;
    if (body == null || body.kind != NodeKind.Block) {
      this.refuse(parser, range, "an async function without a block body (the stackful backend)");
      return null;
    }
    let returnType = declaration.signature.returnType;
    if (returnType == null || isOmittedTypeNode(returnType)) {
      this.refuse(parser, range, "an async function without a declared return type (the stackful backend)");
      return null;
    }
    if (!isVoidTypeNode(returnType) && !isI32TypeNode(returnType)) {
      this.refuse(
        parser, returnType.range,
        "an async function whose result is not i32 or void (the stackful backend stores the result in TaskRecord.payload; A2 carries one i32)"
      );
      return null;
    }

    let parameters = declaration.signature.parameters;
    for (let i = 0, k = parameters.length; i < k; ++i) {
      let parameter = parameters[i];
      if (parameter.parameterKind != ParameterKind.Default || parameter.initializer != null) {
        this.refuse(parser, parameter.range, "an optional or defaulted parameter on an async function (the stackful backend)");
        return null;
      }
      if (parameter.name.text == "$rec" || parameter.name.text == "$task" || parameter.name.text == "$slot") {
        this.refuse(parser, parameter.name.range, "a parameter named `$rec`, `$task` or `$slot` (the stackful backend's entry locals)");
        return null;
      }
    }

    let name = declaration.name.text;
    let bodyName = name + BODY_SUFFIX;
    let startName = name + START_SUFFIX;
    let recordName = name + RECORD_SUFFIX;
    for (let i = 0, k = declared.length; i < k; ++i) {
      let taken = declared[i];
      if (taken == bodyName || taken == startName || taken == recordName) {
        this.refuse(parser, declaration.name.range, "an async function whose synthesized name is taken (the stackful backend)");
        return null;
      }
    }
    // A `try` around an await needs an exception to travel out of a captured
    // continuation; wasm-time EH does not provide that yet, so refuse it by
    // name instead of emitting a `suspend` an exception handler cannot see.
    let tryNode = findTryAroundAwait(body);
    if (tryNode != null) {
      this.refuse(parser, tryNode.range, "a try/catch around an await (the stackful backend; exceptions do not yet cross a suspension)");
      return null;
    }
    // A nested async construct inside the body has no home in this backend:
    // the transform only splits top-level and namespaced declarations.
    if (this.refuseUnsupportedAsyncConstructs(body, parser)) return null;

    // --- the body function -------------------------------------------------

    let bodyParameters = new Array<ParameterNode>(parameters.length);
    for (let i = 0, k = parameters.length; i < k; ++i) {
      let parameter = parameters[i];
      unchecked(bodyParameters[i] = Node.createParameter(
        ParameterKind.Default,
        Node.createIdentifierExpression(parameter.name.text, parameter.name.range),
        parameter.type,
        null,
        parameter.range
      ));
    }
    let bodyFunction = Node.createFunctionDeclaration(
      Node.createIdentifierExpression(bodyName, declaration.name.range),
      null, CommonFlags.None,
      null,
      Node.createFunctionType(
        bodyParameters,
        returnType,
        null, false,
        range
      ),
      body,
      ArrowKind.None,
      range
    );

    // --- the argument record ----------------------------------------------

    let recordFields = new Array<DeclarationStatement>(parameters.length + 1);
    let ctorParameters = new Array<ParameterNode>(parameters.length);
    let ctorStatements = new Array<Statement>(parameters.length + 1);
    ctorStatements[0] = Node.createExpressionStatement(
      Node.createCallExpression(Node.createSuperExpression(range), null, [], range)
    );
    for (let i = 0, k = parameters.length; i < k; ++i) {
      let parameter = parameters[i];
      let fieldName = parameterFieldName(i);
      unchecked(recordFields[i] = Node.createFieldDeclaration(
        Node.createIdentifierExpression(fieldName, parameter.name.range),
        null, CommonFlags.Instance,
        parameter.type,
        null,
        parameter.range
      ));
      unchecked(ctorParameters[i] = Node.createParameter(
        ParameterKind.Default,
        Node.createIdentifierExpression(parameter.name.text, parameter.name.range),
        parameter.type,
        null,
        parameter.range
      ));
      unchecked(ctorStatements[i + 1] = Node.createExpressionStatement(
        assignField(
          Node.createThisExpression(parameter.range),
          fieldName,
          Node.createIdentifierExpression(parameter.name.text, parameter.range),
          parameter.range
        )
      ));
    }
    unchecked(recordFields[parameters.length] = Node.createMethodDeclaration(
      Node.createConstructorExpression(range),
      null, CommonFlags.Constructor | CommonFlags.Instance,
      null,
      Node.createFunctionType(ctorParameters, typeNode("void", range), null, false, range),
      Node.createBlockStatement(ctorStatements, range),
      range
    ));
    let recordClass = Node.createClassDeclaration(
      Node.createIdentifierExpression(recordName, declaration.name.range),
      null, CommonFlags.None,
      null,
      typeNode(TASK_RECORD_NAME, range),
      null,
      recordFields,
      range
    );

    // --- the continuation --------------------------------------------------

    let recIdent = Node.createIdentifierExpression("$rec", range);
    let startStatements = new Array<Statement>();
    startStatements.push(Node.createVariableStatement(
      null,
      [
        Node.createVariableDeclaration(
          Node.createIdentifierExpression("$rec", range),
          null, CommonFlags.Let,
          typeNode(recordName, range),
          Node.createCallExpression(
            Node.createIdentifierExpression("changetype", range),
            [ typeNode(recordName, range) ],
            [ Node.createCallExpression(Node.createIdentifierExpression(CURRENT_RECORD, range), null, [], range) ],
            range
          ),
          range
        )
      ],
      range
    ));
    let bodyArgs = new Array<Expression>(parameters.length);
    for (let i = 0, k = parameters.length; i < k; ++i) {
      unchecked(bodyArgs[i] = Node.createPropertyAccessExpression(
        recIdent,
        Node.createIdentifierExpression(parameterFieldName(i), parameters[i].range),
        parameters[i].range
      ));
    }
    let bodyCall = Node.createCallExpression(
      Node.createIdentifierExpression(bodyName, range),
      null,
      bodyArgs,
      range
    );
    if (!isVoidTypeNode(returnType)) {
      startStatements.push(Node.createVariableStatement(
        null,
        [
          Node.createVariableDeclaration(
            Node.createIdentifierExpression("$r", range),
            null, CommonFlags.Let,
            returnType,
            bodyCall,
            range
          )
        ],
        range
      ));
      startStatements.push(Node.createExpressionStatement(
        assignField(recIdent, PAYLOAD_FIELD, Node.createIdentifierExpression("$r", range), range)
      ));
    } else {
      startStatements.push(Node.createExpressionStatement(bodyCall));
    }
    startStatements.push(Node.createExpressionStatement(
      assignField(recIdent, DONE_FIELD, intLiteral(1, range), range)
    ));
    startStatements.push(Node.createReturnStatement(intLiteral(0, range), range));
    let startFunction = Node.createFunctionDeclaration(
      Node.createIdentifierExpression(startName, declaration.name.range),
      null, CommonFlags.None,
      null,
      Node.createFunctionType(
        new Array<ParameterNode>(),
        typeNode("i32", range),
        null, false,
        range
      ),
      Node.createBlockStatement(startStatements, range),
      ArrowKind.None,
      range
    );

    // --- the entry (the declaration itself) --------------------------------

    let entryStatements = new Array<Statement>();
    let recVar = Node.createIdentifierExpression("$rec", range);
    entryStatements.push(Node.createVariableStatement(
      null,
      [
        Node.createVariableDeclaration(
          Node.createIdentifierExpression("$rec", range),
          null, CommonFlags.Let,
          typeNode(recordName, range),
          Node.createCallExpression(
            Node.createIdentifierExpression("changetype", range),
            [ typeNode(recordName, range) ],
            [ Node.createCallExpression(
              Node.createIdentifierExpression(ALLOC_CELL, range),
              null,
              [ Node.createCallExpression(
                Node.createIdentifierExpression("changetype", range),
                [ typeNode("i32", range) ],
                [ Node.createCallExpression(
                  Node.createIdentifierExpression("sizeof", range),
                  [ typeNode(recordName, range) ],
                  [],
                  range
                ) ],
                range
              ) ],
              range
            ) ],
            range
          ),
          range
        )
      ],
      range
    ));
    // The record is zeroed by the arena; the entry writes only what it owns.
    for (let i = 0, k = parameters.length; i < k; ++i) {
      entryStatements.push(Node.createExpressionStatement(
        assignField(
          recVar,
          parameterFieldName(i),
          Node.createIdentifierExpression(parameters[i].name.text, parameters[i].range),
          parameters[i].range
        )
      ));
    }
    let taskVar = Node.createIdentifierExpression("$task", range);
    entryStatements.push(Node.createVariableStatement(
      null,
      [
        Node.createVariableDeclaration(
          Node.createIdentifierExpression("$task", range),
          null, CommonFlags.Let,
          taskTypeNode(returnType, range),
          Node.createCallExpression(
            Node.createIdentifierExpression("changetype", range),
            [ taskTypeNode(returnType, range) ],
            [ Node.createCallExpression(
              Node.createIdentifierExpression(ALLOC_CELL, range),
              null,
              [ Node.createCallExpression(
                Node.createIdentifierExpression("changetype", range),
                [ typeNode("i32", range) ],
                [ Node.createCallExpression(
                  Node.createIdentifierExpression("sizeof", range),
                  [ taskTypeNode(returnType, range) ],
                  [],
                  range
                ) ],
                range
              ) ],
              range
            ) ],
            range
          ),
          range
        )
      ],
      range
    ));
    // Direct store, not `$task._record = $rec`: the generated setter calls the
    // runtime's `__link`, which a static-arena cell does not need and which
    // would pull the runtime into a module that otherwise imports nothing.
    entryStatements.push(Node.createExpressionStatement(
      Node.createCallExpression(
        Node.createIdentifierExpression(SET_RECORD, range),
        null,
        [
          Node.createCallExpression(
            Node.createIdentifierExpression("changetype", range),
            [ typeNode("i32", range) ],
            [ taskVar ],
            range
          ),
          Node.createCallExpression(
            Node.createIdentifierExpression("changetype", range),
            [ typeNode("i32", range) ],
            [ recVar ],
            range
          )
        ],
        range
      )
    ));
    // `rec.key = __installCont(rec, f$start)` — the slot is the continuation
    // table entry; the record address is what a park carries.
    entryStatements.push(Node.createExpressionStatement(
      assignField(
        recVar,
        SLOT_FIELD,
        Node.createCallExpression(
          Node.createIdentifierExpression(INSTALL_CONT, range),
          null,
          [
            Node.createIdentifierExpression(startName, declaration.name.range)
          ],
          range
        ),
        range
      )
    ));
    entryStatements.push(Node.createReturnStatement(taskVar, range));

    declaration.body = Node.createBlockStatement(entryStatements, range);
    declaration.signature.returnType = taskTypeNode(returnType, range);
    declaration.isAsync = false;

    return [ recordClass, bodyFunction, startFunction, declaration ];
  }

  /** Refuses an async method; clears the modifier on a non-suspending one. */
  private transformClass(declaration: ClassDeclaration, parser: Parser): void {
    let members = declaration.members;
    for (let i = 0, k = members.length; i < k; ++i) {
      let member = members[i];
      if (member.kind == NodeKind.MethodDeclaration) {
        let method = <MethodDeclaration>member;
        if (method.isAsync) {
          if (containsAwait(method.body)) {
            this.refuse(parser, method.range, "an async method (the stackful backend)");
          } else {
            method.isAsync = false;
          }
        }
      }
    }
  }

  /**
   * Refuses an `async` construct this backend does not lower, anywhere inside
   * `node`. Returns `true` when something was refused.
   *
   * The shapes are exactly the ones the old lowering accepted — a nested async
   * function, an async function expression — so a program that hits this is
   * being told the round's boundary rather than being silently miscompiled.
   */
  private refuseUnsupportedAsyncConstructs(node: Node | null, parser: Parser): bool {
    if (node == null) return false;
    switch (node.kind) {
      case NodeKind.FunctionDeclaration: {
        let declaration = <FunctionDeclaration>node;
        if (declaration.isAsync && containsAwait(declaration.body)) {
          this.refuse(parser, declaration.range, "a nested async function with an await (the stackful backend)");
          return true;
        }
        return this.refuseUnsupportedAsyncConstructs(declaration.body, parser);
      }
      case NodeKind.Function: {
        let declaration = (<FunctionExpression>node).declaration;
        if (declaration.isAsync && containsAwait(declaration.body)) {
          this.refuse(parser, declaration.range, "an async function expression with an await (the stackful backend)");
          return true;
        }
        return this.refuseUnsupportedAsyncConstructs(declaration.body, parser);
      }
      case NodeKind.Block: {
        let statements = (<BlockStatement>node).statements;
        for (let i = 0, k = statements.length; i < k; ++i) {
          if (this.refuseUnsupportedAsyncConstructs(statements[i], parser)) return true;
        }
        return false;
      }
      case NodeKind.Expression: {
        return this.refuseUnsupportedAsyncConstructs((<ExpressionStatement>node).expression, parser);
      }
      case NodeKind.Return: {
        let value = (<any>node).value;
        return value != null ? this.refuseUnsupportedAsyncConstructs(value, parser) : false;
      }
      case NodeKind.Variable: {
        let declarations = (<VariableStatement>node).declarations;
        for (let i = 0, k = declarations.length; i < k; ++i) {
          let initializer = declarations[i].initializer;
          if (initializer != null && this.refuseUnsupportedAsyncConstructs(initializer, parser)) return true;
        }
        return false;
      }
      case NodeKind.Call: {
        let args = (<CallExpression>node).args;
        for (let i = 0, k = args.length; i < k; ++i) {
          if (this.refuseUnsupportedAsyncConstructs(args[i], parser)) return true;
        }
        return false;
      }
      case NodeKind.If: {
        let ifStatement = <any>node;
        if (this.refuseUnsupportedAsyncConstructs(ifStatement.condition, parser)) return true;
        if (this.refuseUnsupportedAsyncConstructs(ifStatement.ifTrue, parser)) return true;
        return this.refuseUnsupportedAsyncConstructs(ifStatement.ifFalse, parser);
      }
    }
    return false;
  }

  /** Reports a named refusal. */
  private refuse(parser: Parser, range: Range, what: string): void {
    parser.error(DiagnosticCode.Not_implemented_0, range, what);
  }
}

// --- small AST helpers ------------------------------------------------------

function parameterFieldName(index: i32): string {
  return "$p" + index.toString();
}

function typeNode(name: string, range: Range): NamedTypeNode {
  return Node.createNamedType(Node.createSimpleTypeName(name, range), null, false, range);
}

function taskTypeNode(typeArgument: TypeNode, range: Range): NamedTypeNode {
  return Node.createNamedType(
    Node.createSimpleTypeName(TASK_NAME, range),
    [ typeArgument ],
    false,
    range
  );
}

function intLiteral(value: i32, range: Range): Expression {
  return Node.createIntegerLiteralExpression(i64_new(value), range);
}

/** `<owner>.<field> = <value>`. */
function assignField(owner: Expression, field: string, value: Expression, range: Range): Expression {
  return Node.createBinaryExpression(
    Token.Equals,
    Node.createPropertyAccessExpression(owner, Node.createIdentifierExpression(field, range), range),
    value,
    range
  );
}

function isVoidTypeNode(type: TypeNode): bool {
  return type.kind == NodeKind.NamedType
    && (<any>type).name.identifier.text == "void";
}

function isI32TypeNode(type: TypeNode): bool {
  return type.kind == NodeKind.NamedType
    && (<any>type).name.identifier.text == "i32";
}

function isOmittedTypeNode(type: TypeNode): bool {
  return type.kind == NodeKind.NamedType
    && (<any>type).name.identifier.text == "";
}

function declarationName(statement: Statement): string | null {
  switch (statement.kind) {
    case NodeKind.FunctionDeclaration:
    case NodeKind.ClassDeclaration:
    case NodeKind.NamespaceDeclaration:
      return (<any>statement).name.text;
  }
  return null;
}

// --- the await scan ---------------------------------------------------------
//
// A focused scanner rather than a generic visitor: `src/extra/ast.ts` is not in
// the compiler's wasm graph, and this transform needs one bit — "does this
// body contain an `await` that runs in this function's own stack?" Nested
// function bodies are not descended: their awaits belong to another stack, and
// `refuseUnsupportedAsyncConstructs` refuses them separately.

function containsAwait(node: Node | null): bool {
  if (node == null) return false;
  switch (node.kind) {
    case NodeKind.Await:
      return true;
    case NodeKind.Function:
      // A nested body's await is not this function's suspension.
      return false;
    case NodeKind.FunctionDeclaration: {
      let declaration = <FunctionDeclaration>node;
      return containsAwait(declaration.body);
    }
    case NodeKind.Block: {
      let statements = (<BlockStatement>node).statements;
      for (let i = 0, k = statements.length; i < k; ++i) {
        if (containsAwait(statements[i])) return true;
      }
      return false;
    }
    case NodeKind.Expression:
      return containsAwait((<ExpressionStatement>node).expression);
    case NodeKind.Variable: {
      let declarations = (<VariableStatement>node).declarations;
      for (let i = 0, k = declarations.length; i < k; ++i) {
        if (containsAwait(declarations[i].initializer)) return true;
      }
      return false;
    }
    case NodeKind.Return:
      return containsAwait((<any>node).value);
    case NodeKind.Throw:
      return containsAwait((<any>node).value);
    case NodeKind.If: {
      let ifStatement = <any>node;
      return containsAwait(ifStatement.condition)
        || containsAwait(ifStatement.ifTrue)
        || containsAwait(ifStatement.ifFalse);
    }
    case NodeKind.While:
      return containsAwait((<any>node).condition) || containsAwait((<any>node).body);
    case NodeKind.Do:
      return containsAwait((<any>node).body) || containsAwait((<any>node).condition);
    case NodeKind.For: {
      let forStatement = <any>node;
      return containsAwait(forStatement.initializer)
        || containsAwait(forStatement.condition)
        || containsAwait(forStatement.incrementor)
        || containsAwait(forStatement.body);
    }
    case NodeKind.ForOf: {
      let forOf = <any>node;
      return containsAwait(forOf.variable) || containsAwait(forOf.iterable) || containsAwait(forOf.body);
    }
    case NodeKind.Switch: {
      let switchStatement = <any>node;
      if (containsAwait(switchStatement.condition)) return true;
      let cases = switchStatement.cases;
      for (let i = 0, k = cases.length; i < k; ++i) {
        if (containsAwait(cases[i].label)) return true;
        let statements = cases[i].statements;
        for (let j = 0, l = statements.length; j < l; ++j) {
          if (containsAwait(statements[j])) return true;
        }
      }
      return false;
    }
    case NodeKind.Try: {
      let tryStatement = <any>node;
      if (containsAwaitInList(tryStatement.bodyStatements)) return true;
      if (containsAwaitInList(tryStatement.catchStatements)) return true;
      return containsAwaitInList(tryStatement.finallyStatements);
    }
    case NodeKind.Call: {
      let args = (<CallExpression>node).args;
      for (let i = 0, k = args.length; i < k; ++i) {
        if (containsAwait(args[i])) return true;
      }
      return false;
    }
    case NodeKind.Binary:
      return containsAwait((<any>node).left) || containsAwait((<any>node).right);
    case NodeKind.UnaryPrefix:
    case NodeKind.UnaryPostfix:
      return containsAwait((<any>node).operand);
    case NodeKind.Ternary:
      return containsAwait((<any>node).condition)
        || containsAwait((<any>node).ifThen)
        || containsAwait((<any>node).ifElse);
    case NodeKind.PropertyAccess:
      return containsAwait((<any>node).expression);
    case NodeKind.ElementAccess:
      return containsAwait((<any>node).expression) || containsAwait((<any>node).elementExpression);
    case NodeKind.Parenthesized:
    case NodeKind.Assertion:
      return containsAwait((<any>node).expression);
    case NodeKind.Comma: {
      let expressions = (<any>node).expressions;
      for (let i = 0, k = expressions.length; i < k; ++i) {
        if (containsAwait(expressions[i])) return true;
      }
      return false;
    }
    case NodeKind.New: {
      let args = (<any>node).args;
      for (let i = 0, k = args.length; i < k; ++i) {
        if (containsAwait(args[i])) return true;
      }
      return false;
    }
    case NodeKind.Literal: {
      let literal = <any>node;
      if (literal.literalKind == LiteralKind.Array) {
        let elements = literal.elementExpressions;
        for (let i = 0, k = elements.length; i < k; ++i) {
          if (containsAwait(elements[i])) return true;
        }
      } else if (literal.literalKind == LiteralKind.Object) {
        let values = literal.values;
        for (let i = 0, k = values.length; i < k; ++i) {
          if (containsAwait(values[i])) return true;
        }
      }
      return false;
    }
  }
  return false;
}

function containsAwaitInList(statements: Statement[] | null): bool {
  if (statements == null) return false;
  for (let i = 0, k = statements.length; i < k; ++i) {
    if (containsAwait(statements[i])) return true;
  }
  return false;
}

/** The first `try` whose body contains an `await`, or `null`. */
function findTryAroundAwait(node: Node | null): Node | null {
  if (node == null) return null;
  switch (node.kind) {
    case NodeKind.Try: {
      let tryStatement = <any>node;
      if (containsAwaitInList(tryStatement.bodyStatements)
        || containsAwaitInList(tryStatement.catchStatements)
        || containsAwaitInList(tryStatement.finallyStatements)) return node;
      if (findTryAroundAwaitInList(tryStatement.bodyStatements) != null) return node;
      if (findTryAroundAwaitInList(tryStatement.catchStatements) != null) return node;
      return findTryAroundAwaitInList(tryStatement.finallyStatements);
    }
    case NodeKind.Block:
      return findTryAroundAwaitInList((<BlockStatement>node).statements);
    case NodeKind.Expression:
      return findTryAroundAwait((<ExpressionStatement>node).expression);
    case NodeKind.If: {
      let ifStatement = <any>node;
      return findTryAroundAwait(ifStatement.ifTrue)
        || findTryAroundAwait(ifStatement.ifFalse);
    }
    case NodeKind.While:
    case NodeKind.Do:
      return findTryAroundAwait((<any>node).body);
    case NodeKind.For:
    case NodeKind.ForOf:
      return findTryAroundAwait((<any>node).body);
    case NodeKind.Call: {
      let args = (<CallExpression>node).args;
      for (let i = 0, k = args.length; i < k; ++i) {
        let found = findTryAroundAwait(args[i]);
        if (found != null) return found;
      }
      return null;
    }
  }
  return null;
}

function findTryAroundAwaitInList(statements: Statement[] | null): Node | null {
  if (statements == null) return null;
  for (let i = 0, k = statements.length; i < k; ++i) {
    let found = findTryAroundAwait(statements[i]);
    if (found != null) return found;
  }
  return null;
}
