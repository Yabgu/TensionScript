/**
 * Backend A of the async lowering: the `afterParse` AST→AST transform that turns
 * an `async function` into a state machine.
 * (`docs/async-await-plan-v2.md` §4 for the shape, §4.5 for the seam.)
 *
 * **Why the AST stage and not `src/compiler.ts`'s custom-pass block.** That
 * block runs at the end of `Compiler#compile()`, over the finished Binaryen
 * module (`compiler.ts:778-784`). There is no AST, no `Local` element, no
 * `Signature` there, and no supported entry point to synthesize a *managed*
 * class — the state struct has to be an ordinary class with ordinary layout,
 * typeinfo and a `__visit` the collector can follow. This hook instead runs
 * before the program is instantiated (`cli/index.js:697-701`), and
 * `program.initialize()` walks every source's `statements` in array order
 * (`program.ts:1102-1113`), so what is synthesized here becomes an ordinary
 * element of the program. A consequence that is easy to get wrong: **the state
 * class must be inserted before the function that references it** in that array.
 *
 * **Scope of this revision — the skeleton (Phase 3, commit 2).** It lowers
 * `async function` *declarations* whose body is straight-line, contains no
 * `await` and no `this`. Everything else is refused with a named `AS100`
 * diagnostic rather than left for codegen:
 *
 * | Refused | Until |
 * |---|---|
 * | any `await` in the body | commit 3 (awaits as state transitions) |
 * | control flow, nested functions, `this` in the body | commit 5 (the six cases) |
 * | async arrows, methods, function expressions | commit 6 / deferred by arrow-this |
 * | generic, optional/rest-parameter, `this`-parameter functions | later, with the state struct's own type parameters |
 *

 * The parser's Phase 1 `AS100` guard (`parser.ts:323`, `:2498`, `:3897`,
 * `:3909`, `:3940`) refuses every `async` construct at the same time, and is
 * deleted in commit 7 — so during commits 2–6 nothing reaches codegen
 * unlowered, and the refusals here are what make that true once the guard is
 * gone.
 *
 * **What it emits, for `async function f(a: i32): i32 { … }`** (§4.1's three
 * artifacts, in the order `initialize()` will see them):
 *
 * ```ts
 * class f$State {                 // 1. the state struct, before `f`
 *   a: i32;                       //    one field per parameter
 *   resumePoint: i32;             //    the resume-point discriminator
 *   result: i32;                  //    STAND-IN for the record payload (§3.2)
 *   handle!: Task<i32>;           //    STAND-IN until Phase 4's rt.register(state)
 *   constructor(a: i32) {
 *     this.a = a;
 *     this.resumePoint = 0;
 *   }
 * }
 * function f(a: i32): Task<i32> { // 2. the entry: `f` itself, rewritten
 *   const state = new f$State(a);
 *   f$resume(state);              //    §4.1: the synchronous prefix runs HERE,
 *   return state.handle;          //    before `f` returns (§1.2 rule 1)
 * }
 * function f$resume(state: f$State): void {   // 3. the resume function
 *   const a = state.a;            //    §4.3: "it reads them from the state struct"
 *   return `a + 1` as: state.result = a + 1; state.resumePoint = 1; return;
 * }
 * ```
 *
 * Two things in that shape are placeholders this commit cannot fill, and both
 * are called out here rather than hidden:
 *
 * - **`handle` is never assigned**, so the entry returns `null` until Phase 4's
 *   runtime creates the record and its handle (§3.2, §6). Nothing calls a
 *   lowered function yet.
 * - **`result` stands in for the record's payload.** The final shape writes the
 *   terminal value through the record (§3.2's offset table is what makes that
 *   possible without the transform knowing the framework's field names); today
 *   the value lands in the state struct, which is the one object that provably
 *   outlives the return.
 *
 * **Invariant for commit 3 and later, stated here because breaking it is
 * silent:** the resume function copies the lifted bindings *in* from the state
 * struct at entry (`const a = state.a`). Every path that leaves the resume
 * function before it runs to completion — that is, every suspension — must
 * therefore copy them *out* first, or the value a task wrote before suspending
 * is lost on re-entry. Commit 2 has no suspension and exactly one exit, so
 * copy-in alone is faithful here; commit 3 must add the copy-out at each
 * transition, together with commit 4's liveness decision about *which* bindings
 * are copied at all (§4.3, §4.4).
 */

import { CommonFlags } from "../common";
import { DiagnosticCode, Range } from "../diagnostics";
import { Parser } from "../parser";
import { Program } from "../program";
import { Token } from "../tokenizer";
import {
  ArrowKind,
  ArrayLiteralExpression,
  AssertionExpression,
  BinaryExpression,
  BlockStatement,
  CallExpression,
  ClassDeclaration,
  CommaExpression,
  DeclarationStatement,
  ElementAccessExpression,
  Expression,
  ExpressionStatement,
  FieldDeclaration,
  FunctionDeclaration,
  FunctionExpression,
  IdentifierExpression,
  InstanceOfExpression,
  LiteralExpression,
  LiteralKind,
  MethodDeclaration,
  NamedTypeNode,
  NamespaceDeclaration,
  NewExpression,
  Node,
  NodeKind,
  ObjectLiteralExpression,
  ParameterKind,
  ParameterNode,
  ParenthesizedExpression,
  PropertyAccessExpression,
  ReturnStatement,
  Source,
  Statement,
  TemplateLiteralExpression,
  TernaryExpression,
  TypeNode,
  UnaryPostfixExpression,
  UnaryPrefixExpression,
  VariableStatement
} from "../ast";

/** Suffix of the synthesized state struct for a lowered `async function f`. */
const STATE_SUFFIX = "$State";
/** Suffix of the synthesized resume function for a lowered `async function f`. */
const RESUME_SUFFIX = "$resume";

/**
 * The in-tree `afterParse` transform. Registered in the CLI's transforms
 * collection (`cli/index.js:403-449`); the CLI assigns `program` and the other
 * `Transform` members onto the prototype before instantiating
 * (`cli/index.js:455-462`), which is why `program` is declared here rather than
 * taken as a constructor argument.
 */
export class AsyncLowerTransform {

  /** The program being compiled. Assigned by the CLI onto the prototype. */
  readonly program!: Program;

  /** `Transform#afterParse` — runs after parsing, before initialization. */
  afterParse(parser: Parser): void {
    let sources = this.program.sources;
    for (let i = 0, k = sources.length; i < k; ++i) {
      let source = sources[i];
      // Library sources are never lowered: the standard library and the runtime
      // declare no `async` function, and skipping them keeps the transform out
      // of the standard library's own compilation path entirely.
      if (source.isLibrary) continue;
      this.lowerStatementList(source, source.statements, parser);
    }
  }

  /**
   * Lowers the `async` function declarations in one statement list (a source's
   * top level, or a namespace's members), in place.
   */
  private lowerStatementList(
    source: Source,
    statements: Statement[],
    parser: Parser
  ): void {
    // Fast path, and the reason a program that does not use `async` compiles to
    // the same bytes as before this transform existed: if nothing in this list
    // can produce a lowering, nothing is inspected, allocated or mutated.
    let relevant = false;
    for (let i = 0, k = statements.length; i < k; ++i) {
      let kind = statements[i].kind;
      if (kind == NodeKind.FunctionDeclaration) {
        if ((<FunctionDeclaration>statements[i]).isAsync) {
          relevant = true;
          break;
        }
      } else if (kind == NodeKind.NamespaceDeclaration || kind == NodeKind.ClassDeclaration) {
        relevant = true;
        break;
      } else if (kind == NodeKind.Variable) {
        // An async function expression or arrow can be written as an
        // initializer, and it is this level's business to refuse it.
        let declarations = (<VariableStatement>statements[i]).declarations;
        for (let j = 0, l = declarations.length; j < l; ++j) {
          let initializer = declarations[j].initializer;
          if (
            initializer != null &&
            initializer.kind == NodeKind.Function &&
            (<FunctionExpression>initializer).declaration.isAsync
          ) {
            relevant = true;
            break;
          }
        }
        if (relevant) break;
      }
    }
    if (!relevant) return;

    // Names this level already declares: a synthesized name must not collide
    // with one. (`$` is rare in user code, but "rare" is not "impossible", and a
    // collision would silently merge two declarations.)
    let declared = new Array<string>();
    for (let i = 0, k = statements.length; i < k; ++i) {
      let name = declarationNameOf(statements[i]);
      if (name != null) declared.push(name);
    }

    let out = new Array<Statement>();
    for (let i = 0, k = statements.length; i < k; ++i) {
      let statement = statements[i];
      switch (statement.kind) {
        case NodeKind.FunctionDeclaration: {
          let declaration = <FunctionDeclaration>statement;
          if (declaration.isAsync) {
            let lowered = this.lowerAsyncFunction(source, declaration, declared, parser);
            if (lowered) {
              // The state class first: `initialize()` walks this array in order
              // (`program.ts:1102-1113`) and the entry references the class.
              for (let j = 0, l = lowered.length; j < l; ++j) out.push(lowered[j]);
            } else {
              out.push(statement); // refused; left as parsed
            }
          } else {
            out.push(statement);
          }
          break;
        }
        case NodeKind.NamespaceDeclaration: {
          let namespace = <NamespaceDeclaration>statement;
          this.lowerStatementList(source, namespace.members, parser);
          out.push(statement);
          break;
        }
        case NodeKind.ClassDeclaration: {
          this.refuseAsyncMembers(<ClassDeclaration>statement, parser);
          out.push(statement);
          break;
        }
        case NodeKind.Variable: {
          let declarations = (<VariableStatement>statement).declarations;
          for (let j = 0, l = declarations.length; j < l; ++j) {
            let initializer = declarations[j].initializer;
            if (initializer) this.refuseAsyncFunctionExpression(initializer, parser);
          }
          out.push(statement);
          break;
        }
        default: {
          out.push(statement);
          break;
        }
      }
    }
    statements.length = 0;
    for (let i = 0, k = out.length; i < k; ++i) statements.push(out[i]);
  }

  /**
   * Lowers one `async function` declaration, or refuses it and returns `null`.
   * The declaration is mutated in place — it *becomes* the entry — and the other
   * two artifacts are returned in array order.
   */
  private lowerAsyncFunction(
    source: Source,
    declaration: FunctionDeclaration,
    declared: Array<string>,
    parser: Parser
  ): Statement[] | null {
    let signature = declaration.signature;
    let name = declaration.name.text;
    let range = declaration.range;

    // Shapes the skeleton does not lower yet. Each refusal names itself, so a
    // reader of the diagnostic knows what is missing rather than that "async"
    // is missing.
    if (declaration.arrowKind != ArrowKind.None) {
      return this.refuse(parser, declaration.range, "async arrow functions (async lowering)");
    }
    if (declaration.typeParameters != null) {
      return this.refuse(parser, declaration.range, "async generic functions (async lowering)");
    }
    if (signature.explicitThisType != null) {
      return this.refuse(parser, declaration.range, "`this` parameters in an async function (async lowering)");
    }
    let parameters = signature.parameters;
    for (let i = 0, k = parameters.length; i < k; ++i) {
      if (parameters[i].parameterKind != ParameterKind.Default) {
        return this.refuse(parser, parameters[i].range, "optional or rest parameters in an async function (async lowering)");
      }
    }
    let body = declaration.body;
    if (!body || body.kind != NodeKind.Block) {
      return this.refuse(parser, declaration.range, "an async function without a block body (async lowering)");
    }
    let block = <BlockStatement>body;
    let unsupported = this.firstUnsupportedStatement(block.statements);
    if (unsupported) {
      return this.refuse(parser, unsupported.range, reasonFor(unsupported, parameters));
    }

    // The synthesized names, checked against what this level already declares.
    let stateName = name + STATE_SUFFIX;
    let resumeName = name + RESUME_SUFFIX;
    for (let i = 0, k = declared.length; i < k; ++i) {
      let taken = declared[i];
      if (taken == stateName || taken == resumeName) {
        return this.refuse(parser, declaration.name.range, "an async function whose synthesized name is taken (async lowering)");
      }
    }

    // The state struct (§4.1 artifact 2). `state` and the parameter names are
    // re-used inside the two generated bodies, so both generated functions pick
    // a name for the state local that no parameter shadows.
    let stateVarName = nameForState(parameters);
    let stateIdent = Node.createIdentifierExpression(stateVarName, range);
    let thisIdent = Node.createThisExpression(range);

    let stateFields = new Array<DeclarationStatement>();
    for (let i = 0, k = parameters.length; i < k; ++i) {
      let parameter = parameters[i];
      stateFields.push(Node.createFieldDeclaration(
        Node.createIdentifierExpression(parameter.name.text, parameter.name.range),
        null, CommonFlags.Instance,
        parameter.type,
        null,
        parameter.name.range
      ));
    }
    stateFields.push(Node.createFieldDeclaration(
      Node.createIdentifierExpression("resumePoint", range),
      null, CommonFlags.Instance,
      typeNode("i32", range),
      null,
      range
    ));
    let returnType = signature.returnType;
    let returnsValue = returnType != null && !isVoidTypeNode(returnType);
    if (returnsValue) {
      stateFields.push(Node.createFieldDeclaration(
        Node.createIdentifierExpression("result", range),
        null, CommonFlags.Instance | CommonFlags.DefinitelyAssigned,
        returnType,
        null,
        range
      ));
    }
    let taskType = taskTypeNode(returnType, range);
    stateFields.push(Node.createFieldDeclaration(
      Node.createIdentifierExpression("handle", range),
      null, CommonFlags.Instance | CommonFlags.DefinitelyAssigned,
      taskType,
      null,
      range
    ));

    // The constructor: what makes `new f$State(args)` in the entry the whole
    // parameter hand-off, and what satisfies the compiler's field
    // initialization check for reference-typed parameters without a `!` flag.
    let ctorParameters = new Array<ParameterNode>();
    let ctorStatements = new Array<Statement>();
    for (let i = 0, k = parameters.length; i < k; ++i) {
      let parameter = parameters[i];
      ctorParameters.push(Node.createParameter(
        ParameterKind.Default,
        Node.createIdentifierExpression(parameter.name.text, parameter.name.range),
        parameter.type,
        null,
        parameter.range
      ));
      ctorStatements.push(Node.createExpressionStatement(
        Node.createBinaryExpression(
          Token.Equals,
          Node.createPropertyAccessExpression(thisIdent, Node.createIdentifierExpression(parameter.name.text, parameter.range), parameter.range),
          Node.createIdentifierExpression(parameter.name.text, parameter.range),
          parameter.range
        )
      ));
    }
    ctorStatements.push(Node.createExpressionStatement(
      assignField(thisIdent, "resumePoint", Node.createIntegerLiteralExpression(i64_new(0), range), range)
    ));
    stateFields.push(Node.createMethodDeclaration(
      Node.createConstructorExpression(range),
      null, CommonFlags.Constructor | CommonFlags.Instance,
      null,
      Node.createFunctionType(ctorParameters, typeNode("void", range), null, false, range),
      Node.createBlockStatement(ctorStatements, range),
      range
    ));
    let stateClass = Node.createClassDeclaration(
      Node.createIdentifierExpression(stateName, declaration.name.range),
      null, CommonFlags.None,
      null, null, null,
      stateFields,
      range
    );

    // The entry (§4.1 artifact 3): the declaration itself, its body replaced.
    let resumeIdent = Node.createIdentifierExpression(resumeName, range);
    let args = new Array<Expression>();
    for (let i = 0, k = parameters.length; i < k; ++i) {
      args.push(Node.createIdentifierExpression(parameters[i].name.text, parameters[i].range));
    }
    let entryStatements = new Array<Statement>();
    entryStatements.push(Node.createVariableStatement(
      null,
      [
        Node.createVariableDeclaration(
          Node.createIdentifierExpression(stateVarName, range),
          null, CommonFlags.Const,
          typeNode(stateName, range),
          Node.createNewExpression(Node.createSimpleTypeName(stateName, range), null, args, range),
          range
        )
      ],
      range
    ));
    entryStatements.push(Node.createExpressionStatement(
      Node.createCallExpression(resumeIdent, null, [ stateIdent ], range)
    ));
    entryStatements.push(Node.createReturnStatement(
      Node.createPropertyAccessExpression(stateIdent, Node.createIdentifierExpression("handle", range), range),
      range
    ));
    declaration.body = Node.createBlockStatement(entryStatements, range);
    declaration.signature.returnType = taskType;
    // The call-site type is now the declared one. `async` on the *element* is
    // what makes a call yield `Task<T>` (`resolver.ts:2669`); the entry's
    // declared return type is already that handle, so keeping the trait would
    // wrap it twice.
    declaration.isAsync = false;

    // The resume function (§4.1 artifact 1). Commit 2: straight-line only — the
    // body verbatim, with each `return` turned into the terminal transition.
    let resumeVarName = nameForState(parameters);
    let resumeStateIdent = Node.createIdentifierExpression(resumeVarName, range);
    let resumeStatements = new Array<Statement>();
    for (let i = 0, k = parameters.length; i < k; ++i) {
      let parameter = parameters[i];
      // §4.3: the resume function's parameter list carries no wasm parameters —
      // "it reads them from the state struct". (Commit 4 decides which of them
      // are lifted rather than copied; for a body with no suspension, all of
      // them are.)
      resumeStatements.push(Node.createVariableStatement(
        null,
        [
          Node.createVariableDeclaration(
            Node.createIdentifierExpression(parameter.name.text, parameter.name.range),
            null, CommonFlags.None,
            null,
            Node.createPropertyAccessExpression(resumeStateIdent, Node.createIdentifierExpression(parameter.name.text, parameter.range), parameter.range),
            parameter.range
          )
        ],
        parameter.range
      ));
    }
    let bodyStatements = block.statements;
    for (let i = 0, k = bodyStatements.length; i < k; ++i) {
      let statement = bodyStatements[i];
      if (statement.kind == NodeKind.Return) {
        let returnStatement = <ReturnStatement>statement;
        let value = returnStatement.value;
        if (value != null) {
          if (returnsValue) {
            resumeStatements.push(Node.createExpressionStatement(
              assignField(resumeStateIdent, "result", value, returnStatement.range)
            ));
          } else {
            // `return voidExpr;` — the expression's effect, without a value.
            resumeStatements.push(Node.createExpressionStatement(value));
          }
        }
        resumeStatements.push(Node.createExpressionStatement(
          assignField(resumeStateIdent, "resumePoint", Node.createIntegerLiteralExpression(i64_new(1), returnStatement.range), returnStatement.range)
        ));
        resumeStatements.push(Node.createReturnStatement(null, returnStatement.range));
      } else {
        resumeStatements.push(statement);
      }
    }
    // The terminal transition, for a body that runs off its end. (A trailing
    // `return` already wrote it; appending would emit dead code.)
    if (!bodyStatements.length || bodyStatements[bodyStatements.length - 1].kind != NodeKind.Return) {
      resumeStatements.push(Node.createExpressionStatement(
        assignField(resumeStateIdent, "resumePoint", Node.createIntegerLiteralExpression(i64_new(1), range), range)
      ));
    }

    let resumeFunction = Node.createFunctionDeclaration(
      Node.createIdentifierExpression(resumeName, declaration.name.range),
      null, CommonFlags.None,
      null,
      Node.createFunctionType(
        [
          Node.createParameter(
            ParameterKind.Default,
            Node.createIdentifierExpression(resumeVarName, range),
            typeNode(stateName, range),
            null,
            range
          )
        ],
        typeNode("void", range),
        null, false,
        range
      ),
      Node.createBlockStatement(resumeStatements, range),
      ArrowKind.None,
      range
    );

    return [ stateClass, declaration, resumeFunction ];
  }

  /**
   * Refuses the `async` constructs a member list can hold: an async method, and
   * an async function expression or arrow in a field initializer. Both are
   * invisible to a walk that only reads statements, and both would otherwise
   * reach codegen unlowered once the parser's guard is gone.
   */
  private refuseAsyncMembers(classDeclaration: ClassDeclaration, parser: Parser): void {
    let members = classDeclaration.members;
    for (let i = 0, k = members.length; i < k; ++i) {
      let member = members[i];
      if (member.kind == NodeKind.MethodDeclaration) {
        let method = <MethodDeclaration>member;
        if (method.isAsync) {
          this.refuse(parser, method.range, "async methods (async lowering)");
        }
      } else if (member.kind == NodeKind.FieldDeclaration) {
        let initializer = (<FieldDeclaration>member).initializer;
        if (initializer) this.refuseAsyncFunctionExpression(initializer, parser);
      }
    }
  }

  /** Refuses an async function expression or arrow where one can be written. */
  private refuseAsyncFunctionExpression(expression: Expression, parser: Parser): void {
    if (expression.kind != NodeKind.Function) return;
    let declaration = (<FunctionExpression>expression).declaration;
    if (!declaration.isAsync) return;
    this.refuse(parser, declaration.range,
      declaration.arrowKind != ArrowKind.None
        ? "async arrow functions (async lowering)"
        : "async function expressions (async lowering)"
    );
  }

  /** Reports `Not implemented: <what>` and answers `null`. */
  private refuse(parser: Parser, range: Range, what: string): null {
    parser.error(DiagnosticCode.Not_implemented_0, range, what);
    return null;
  }

  // Shape checks. Both walkers answer the first node they cannot lower, so the
  // diagnostic can point at it, and both treat an unknown kind as unsupported —
  // a body this transform does not understand is refused, never lowered.

  /** The first statement in `statements` the skeleton cannot lower, or `null`. */
  private firstUnsupportedStatement(statements: Statement[]): Node | null {
    for (let i = 0, k = statements.length; i < k; ++i) {
      let statement = statements[i];
      switch (statement.kind) {
        case NodeKind.Empty: {
          break;
        }
        case NodeKind.Expression: {
          let found = this.firstUnsupportedExpression((<ExpressionStatement>statement).expression);
          if (found) return found;
          break;
        }
        case NodeKind.Variable: {
          let declarations = (<VariableStatement>statement).declarations;
          for (let j = 0, l = declarations.length; j < l; ++j) {
            let initializer = declarations[j].initializer;
            if (initializer) {
              let found = this.firstUnsupportedExpression(initializer);
              if (found) return found;
            }
          }
          break;
        }
        case NodeKind.Return: {
          let value = (<ReturnStatement>statement).value;
          if (value) {
            let found = this.firstUnsupportedExpression(value);
            if (found) return found;
          }
          break;
        }
        default: {
          return statement;
        }
      }
    }
    return null;
  }

  /** The first subexpression of `expression` the skeleton cannot lower, or `null`. */
  private firstUnsupportedExpression(expression: Expression): Node | null {
    switch (expression.kind) {
      case NodeKind.Identifier:
      case NodeKind.This: {
        return null;
      }
      case NodeKind.True:
      case NodeKind.False:
      case NodeKind.Null: {
        return null;
      }
      case NodeKind.Literal: {
        let literal = <LiteralExpression>expression;
        switch (literal.literalKind) {
          case LiteralKind.Float:
          case LiteralKind.Integer:
          case LiteralKind.String:
          case LiteralKind.RegExp: {
            return null;
          }
          case LiteralKind.Template: {
            let parts = (<TemplateLiteralExpression>literal).expressions;
            for (let i = 0, k = parts.length; i < k; ++i) {
              let found = this.firstUnsupportedExpression(parts[i]);
              if (found) return found;
            }
            return null;
          }
          case LiteralKind.Array: {
            let elements = (<ArrayLiteralExpression>literal).elementExpressions;
            for (let i = 0, k = elements.length; i < k; ++i) {
              let found = this.firstUnsupportedExpression(elements[i]);
              if (found) return found;
            }
            return null;
          }
          case LiteralKind.Object: {
            let values = (<ObjectLiteralExpression>literal).values;
            for (let i = 0, k = values.length; i < k; ++i) {
              let found = this.firstUnsupportedExpression(values[i]);
              if (found) return found;
            }
            return null;
          }
          default: {
            return expression;
          }
        }
      }
      case NodeKind.Assertion: {
        let assertion = <AssertionExpression>expression;
        return this.firstUnsupportedExpression(assertion.expression)
          || (assertion.toType != null ? this.firstUnsupportedType(assertion.toType) : null);
      }
      case NodeKind.Binary: {
        let binary = <BinaryExpression>expression;
        return this.firstUnsupportedExpression(binary.left)
          || this.firstUnsupportedExpression(binary.right);
      }
      case NodeKind.Call: {
        let call = <CallExpression>expression;
        let found = this.firstUnsupportedExpression(call.expression);
        if (found) return found;
        let args = call.args;
        for (let i = 0, k = args.length; i < k; ++i) {
          found = this.firstUnsupportedExpression(args[i]);
          if (found) return found;
        }
        return null;
      }
      case NodeKind.Comma: {
        let expressions = (<CommaExpression>expression).expressions;
        for (let i = 0, k = expressions.length; i < k; ++i) {
          let found = this.firstUnsupportedExpression(expressions[i]);
          if (found) return found;
        }
        return null;
      }
      case NodeKind.ElementAccess: {
        let elementAccess = <ElementAccessExpression>expression;
        return this.firstUnsupportedExpression(elementAccess.expression)
          || this.firstUnsupportedExpression(elementAccess.elementExpression);
      }
      case NodeKind.InstanceOf: {
        return this.firstUnsupportedExpression((<InstanceOfExpression>expression).expression);
      }
      case NodeKind.New: {
        let newExpression = <NewExpression>expression;
        let args = newExpression.args;
        for (let i = 0, k = args.length; i < k; ++i) {
          let found = this.firstUnsupportedExpression(args[i]);
          if (found) return found;
        }
        return null;
      }
      case NodeKind.Parenthesized: {
        return this.firstUnsupportedExpression((<ParenthesizedExpression>expression).expression);
      }
      case NodeKind.PropertyAccess: {
        return this.firstUnsupportedExpression((<PropertyAccessExpression>expression).expression);
      }
      case NodeKind.Ternary: {
        let ternary = <TernaryExpression>expression;
        return this.firstUnsupportedExpression(ternary.condition)
          || this.firstUnsupportedExpression(ternary.ifThen)
          || this.firstUnsupportedExpression(ternary.ifElse);
      }
      case NodeKind.UnaryPostfix: {
        return this.firstUnsupportedExpression((<UnaryPostfixExpression>expression).operand);
      }
      case NodeKind.UnaryPrefix: {
        return this.firstUnsupportedExpression((<UnaryPrefixExpression>expression).operand);
      }
      default: {
        // `NodeKind.Await` lands here, and so does anything else this revision
        // does not know: refuse, never lower.
        return expression;
      }
    }
  }

  /** Type positions the skeleton can carry verbatim (a type argument list). */
  private firstUnsupportedType(type: TypeNode): Node | null {
    if (type.kind != NodeKind.NamedType) return type;
    let typeArguments = (<NamedTypeNode>type).typeArguments;
    if (typeArguments != null) {
      for (let i = 0, k = typeArguments.length; i < k; ++i) {
        let found = this.firstUnsupportedType(typeArguments[i]);
        if (found) return found;
      }
    }
    return null;
  }
}

/** The name a declaration statement introduces, if it introduces one. */
function declarationNameOf(statement: Statement): string | null {
  switch (statement.kind) {
    case NodeKind.FunctionDeclaration:
    case NodeKind.MethodDeclaration:
    case NodeKind.ClassDeclaration:
    case NodeKind.EnumDeclaration:
    case NodeKind.InterfaceDeclaration:
    case NodeKind.NamespaceDeclaration:
    case NodeKind.TypeDeclaration: {
      return (<DeclarationStatement>statement).name.text;
    }
    case NodeKind.Variable: {
      // Only the first name; a lowered name colliding with any of them is
      // already worth refusing.
      let declarations = (<VariableStatement>statement).declarations;
      return declarations.length ? declarations[0].name.text : null;
    }
    default: {
      return null;
    }
  }
}

/** Why the node cannot be lowered yet, said in one line. */
function reasonFor(node: Node, parameters: ParameterNode[]): string {
  switch (node.kind) {
    case NodeKind.Await: return "await (async lowering)";
    case NodeKind.Function: {
      return (<FunctionExpression>node).declaration.isAsync
        ? "async function expressions (async lowering)"
        : "a nested function in an async function body (async lowering)";
    }
    case NodeKind.Class: return "a nested class in an async function body (async lowering)";
    case NodeKind.This: return "this in an async function body (async lowering)";
    case NodeKind.Super: return "super in an async function body (async lowering)";
    case NodeKind.Throw: return "throw in an async function body (async lowering)";
    case NodeKind.Try: return "try/catch in an async function body (async lowering)";
    case NodeKind.Switch: return "switch in an async function body (async lowering)";
    case NodeKind.If: return "if in an async function body (async lowering)";
    case NodeKind.For: return "for in an async function body (async lowering)";
    case NodeKind.ForOf: return "for-of in an async function body (async lowering)";
    case NodeKind.While: return "while in an async function body (async lowering)";
    case NodeKind.Do: return "do in an async function body (async lowering)";
    case NodeKind.Block: return "a nested block in an async function body (async lowering)";
    case NodeKind.Break: return "break in an async function body (async lowering)";
    case NodeKind.Continue: return "continue in an async function body (async lowering)";
    default: return "this async body (async lowering)";
  }
}

/** A name for the generated state local that no parameter shadows. */
function nameForState(parameters: ParameterNode[]): string {
  let name = "state";
  while (hasParameterNamed(parameters, name)) name = "$" + name;
  return name;
}

function hasParameterNamed(parameters: ParameterNode[], name: string): bool {
  for (let i = 0, k = parameters.length; i < k; ++i) {
    if (parameters[i].name.text == name) return true;
  }
  return false;
}

/** A `void` return type annotation is written `void` and nothing else. */
function isVoidTypeNode(type: TypeNode): bool {
  return type.kind == NodeKind.NamedType
    && (<NamedTypeNode>type).name.identifier.text == "void";
}

/** `Task<T>` — what a call to the lowered entry yields (§1.2 rule 2). */
function taskTypeNode(typeArgument: TypeNode, range: Range): NamedTypeNode {
  return Node.createNamedType(
    Node.createSimpleTypeName("Task", range),
    [ typeArgument ],
    false,
    range
  );
}

/** A named type node for a built-in type name. */
function typeNode(name: string, range: Range): NamedTypeNode {
  return Node.createNamedType(Node.createSimpleTypeName(name, range), null, false, range);
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
