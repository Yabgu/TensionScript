/**
 * Backend A of the async lowering: the `afterParse` AST→AST transform that turns
 * an `async function` into a state machine.
 * (`docs/async-await-plan-v2.md` §4 for the shape, §4.5 for the seam, §4.7 for
 * the runtime symbols it names.)
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
 * **Scope of this revision (Phase 3, commit 3).** It lowers `async function`
 * *declarations* whose body is straight-line — no control flow, no nested
 * functions, no `this` — and whose `await`s sit in one of four positions, one
 * await per statement:
 *
 * | Position | Example |
 * |---|---|
 * | expression statement | `await h;` |
 * | single-declaration initializer | `let x: i32 = await h;` |
 * | assignment | `x = await h;` |
 * | return | `return await h;` |
 *
 * Everything else is refused with a named `AS100` diagnostic — never left for
 * codegen, never emitted as wrong code:
 *
 * | Refused | Until |
 * |---|---|
 * | an `await` anywhere else (a sub-expression, a second await in one statement) | later revisions |
 * | control flow, nested functions/classes, `this`/`super` | commit 5 (the six cases) |
 * | a local that crosses an await, and a parameter written before one and read after | commit 4 (lifting) |
 * | async arrows, methods, function expressions, generics, optional parameters | commit 6 / deferred by arrow-this |
 * | an `async` function with no declared return type | — (permanent: `T` is what `Task<T>` names) |
 *
 * **What it emits, for `async function f(h: Task<i32>): i32 { … }`** — §4.1's
 * three artifacts, with `N` awaits numbered `1..N` in textual order (`0` is the
 * entry, `N+1` the terminal):
 *
 * ```ts
 * class f$State extends TaskState {     // 1. the state struct, before `f`
 *   h: Task<i32>;                       //    one field per parameter
 *   resumePoint: i32;                   //    the resume-point discriminator
 *   $awaited1!: TaskRecord;             //    one per await: the awaited record
 *   result: i32;                        //    STAND-IN for the record payload
 *   handle!: Task<i32>;                 //    what the entry returns
 *   constructor(h: Task<i32>) { … }     //    parameters + resumePoint = 0
 * }
 * function f(h: Task<i32>): Task<i32> { // 2. the entry: `f` itself
 *   const state = new f$State(h);
 *   state.handle = new Task<i32>();
 *   state.handle._record = __taskRegister(state);
 *   f$resume(state);                    //    §4.1: the sync prefix runs HERE
 *   return state.handle;                //    §1.2 rule 1: it may be settled
 * }
 * function f$resume(state: f$State): void {   // 3. the resume function
 *   const h = state.h;                  //    §4.3: read from the state struct
 *   if (state.resumePoint == 0) {       //    region 0
 *     state.$awaited1 = h._record;      //    the operand, evaluated once
 *     state.resumePoint = 1;
 *     if (!__taskSettled(state.$awaited1)) {  // §1.2 rule 4
 *       __taskPark(state, state.$awaited1);
 *       return;                         //    a suspension is a return
 *     }
 *   }
 *   if (state.resumePoint == 1) {       //    region 1
 *     let x: i32 = `await h`;           //    codegen's typed read (§4.7.4)
 *     state.result = x + 1;
 *     state.resumePoint = 2;            //    the terminal
 *     return;
 *   }
 * }
 * ```
 *
 * Three things in that shape are deliberate and worth stating:
 *
 * - **The suspension sits at the *end* of the preceding region**, after the
 *   statements that precede it and before the statement that reads the value.
 *   That is what keeps evaluation order: the operand is evaluated where the
 *   `await` is written, and the guarded region that follows is re-entered on
 *   resume. The settled path falls through into region `K`, which is how §1.2
 *   rule 4 works without a second resume point.
 * - **The awaited record lives in the state struct** (`$awaitedK`) — the
 *   operand's result survives the return; the *value* does not, because the
 *   record is the value's bearer (§3.2, §4.7.4).
 * - **The read is codegen's**, not the transform's: `AwaitExpression` nodes stay
 *   in the tree and the side table (`src/async/ir.ts`) tells `compiler.ts` where
 *   to read from. The transform never needs `T` (§4.7.4).
 *
 * **`result` is still a stand-in.** §4.1's terminal writes the task's value; the
 * final shape writes it through the record (§3.2's offsets), which needs the
 * runtime's record instance (Phase 4). Until then the value lands in the state
 * struct, the one object that provably outlives the return.
 *
 * **Invariant for the next revision, restated because breaking it is silent:**
 * parameters are copied *in* from the state struct at the top of `f$resume`
 * (§4.3), so a parameter written in one region is not visible in a later one —
 * which is why a parameter written before an await and read after it is refused
 * here, by name, rather than lowered.
 */

import { CommonFlags } from "../common";
import { DiagnosticCode, Range } from "../diagnostics";
import { Parser } from "../parser";
import { Program } from "../program";
import { Token } from "../tokenizer";
import { awaitSites, AwaitSite } from "./ir";
import {
  ArrowKind,
  ArrayLiteralExpression,
  AssertionExpression,
  AwaitExpression,
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
/** Base class of every state struct (`std/assembly/task-rt.ts`, §4.7). */
const TASK_STATE_NAME = "TaskState";
/** The runtime's park symbol (§4.7.3). */
const PARK_NAME = "__taskPark";
/** The runtime's settled check (§4.7.3). */
const SETTLED_NAME = "__taskSettled";
/** The runtime's register symbol (§4.7.3). */
const REGISTER_NAME = "__taskRegister";
/** The handle's record field (`std/assembly/task.ts`). */
const RECORD_FIELD = "_record";
/** Prefix of the state struct's per-await record fields. */
const AWAITED_PREFIX = "$awaited";
/** The state struct's resume-point field. */
const RESUME_POINT_FIELD = "resumePoint";
/** The state struct's terminal-value field (the payload stand-in). */
const RESULT_FIELD = "result";
/** The state struct's handle field. */
const HANDLE_FIELD = "handle";

/** The in-tree `afterParse` `Transform`. */
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

  /** Lowers the `async` declarations in one statement list, in place. */
  private lowerStatementList(
    source: Source,
    statements: Statement[],
    parser: Parser
  ): void {
    // Fast path, and the reason a program that does not use `async` compiles to
    // the same bytes as before this transform existed: if nothing in this list
    // can produce a lowering, nothing is inspected, allocated or mutated.
    if (!hasLowerable(statements)) return;

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

    // Shapes this revision does not lower. Each refusal names itself, so a
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
      let parameter = parameters[i];
      if (parameter.parameterKind != ParameterKind.Default) {
        return this.refuse(parser, parameter.range, "optional or rest parameters in an async function (async lowering)");
      }
      if (isReservedStateField(parameter.name.text)) {
        return this.refuse(parser, parameter.name.range, "a parameter whose name is reserved by the state struct (async lowering)");
      }
    }
    // §2.3: `async function f(): T` declares `T` and the call yields `Task<T>`.
    // Without an annotation there is no `T` to name — the parser produces an
    // empty `NamedType` for an omitted return type — and `Task<>` is not a type.
    let returnType = signature.returnType;
    if (returnType == null || isOmittedTypeNode(returnType)) {
      return this.refuse(parser, declaration.name.range, "an async function without a declared return type (async lowering)");
    }
    let body = declaration.body;
    if (!body || body.kind != NodeKind.Block) {
      return this.refuse(parser, declaration.range, "an async function without a block body (async lowering)");
    }
    let block = <BlockStatement>body;

    // The plan: which awaits, where they suspend, and which names cross one.
    let plans = this.planBody(parser, block, parameters);
    if (!plans) return null;
    let awaitCount = 0;
    for (let i = 0, k = plans.length; i < k; ++i) {
      if (plans[i].info) awaitCount++;
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

    let stateVarName = nameForState(parameters, block);
    let stateIdent = Node.createIdentifierExpression(stateVarName, range);
    let thisIdent = Node.createThisExpression(range);

    // --- artifact 2: the state struct -------------------------------------

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
      Node.createIdentifierExpression(RESUME_POINT_FIELD, range),
      null, CommonFlags.Instance,
      typeNode("i32", range),
      null,
      range
    ));
    let returnsValue = !isVoidTypeNode(returnType);
    if (returnsValue) {
      // No `!` here, and a `changetype<R>(0)` default in the constructor: the
      // definite-assignment flag would say "unnecessary" for a value type and
      // "always assigned" for a nullable reference (`compiler.ts:9232-9257`),
      // and neither note helps. The default is what the field holds until the
      // terminal write.
      stateFields.push(Node.createFieldDeclaration(
        Node.createIdentifierExpression(RESULT_FIELD, range),
        null, CommonFlags.Instance,
        returnType,
        null,
        range
      ));
    }
    // One record field per await: the awaited task's record, which is what
    // survives the suspension (§4.2's "store its record reference in the state
    // struct"). `TaskRecord` is a reference type, so the field is traced by the
    // generated visitor and the record's chain stays alive (§4.4).
    for (let i = 0, k = plans.length; i < k; ++i) {
      let info = plans[i].info;
      if (!info) continue;
      stateFields.push(Node.createFieldDeclaration(
        Node.createIdentifierExpression(info.fieldName, range),
        null, CommonFlags.Instance | CommonFlags.DefinitelyAssigned,
        typeNode("TaskRecord", range),
        null,
        range
      ));
    }
    let taskType = taskTypeNode(returnType, range);
    stateFields.push(Node.createFieldDeclaration(
      Node.createIdentifierExpression(HANDLE_FIELD, range),
      null, CommonFlags.Instance | CommonFlags.DefinitelyAssigned,
      taskType,
      null,
      range
    ));

    // The constructor: the whole parameter hand-off, and what satisfies the
    // compiler's field initialization check for reference-typed parameters
    // without a `!` flag.
    let ctorParameters = new Array<ParameterNode>();
    let ctorStatements = new Array<Statement>();
    // The state struct extends `TaskState`, so its constructor must call
    // `super()` first (`AS2377`). `super` in an expression position is a call
    // on a `SuperExpression` (`parser.ts:4231-4239`).
    ctorStatements.push(Node.createExpressionStatement(
      Node.createCallExpression(Node.createSuperExpression(range), null, [], range)
    ));
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
        assignField(thisIdent, parameter.name.text,
          Node.createIdentifierExpression(parameter.name.text, parameter.range), parameter.range)
      ));
    }
    ctorStatements.push(Node.createExpressionStatement(
      assignField(thisIdent, RESUME_POINT_FIELD, intLiteral(0, range), range)
    ));
    if (returnsValue) {
      // `changetype<R>(0)`: the same expression works for every `R` — a value
      // type gets its zero, a reference type a null it will never read (the
      // terminal writes the real value first).
      ctorStatements.push(Node.createExpressionStatement(
        assignField(thisIdent, RESULT_FIELD,
          Node.createCallExpression(
            Node.createIdentifierExpression("changetype", range),
            [ returnType ],
            [ intLiteral(0, range) ],
            range
          ),
          range)
      ));
    }
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
      null,
      typeNode(TASK_STATE_NAME, range), // extends TaskState (§4.7.3)
      null,
      stateFields,
      range
    );

    // --- artifact 3: the entry (the declaration itself, rewritten) ----------

    let resumeIdent = Node.createIdentifierExpression(resumeName, range);
    let args = new Array<Expression>();
    for (let i = 0, k = parameters.length; i < k; ++i) {
      args.push(Node.createIdentifierExpression(parameters[i].name.text, parameters[i].range));
    }
    let handleAccess = Node.createPropertyAccessExpression(
      stateIdent, Node.createIdentifierExpression(HANDLE_FIELD, range), range
    );
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
    // state.handle = new Task<R>();
    entryStatements.push(Node.createExpressionStatement(
      assignField(stateIdent, HANDLE_FIELD,
        Node.createNewExpression(Node.createSimpleTypeName("Task", range), [ returnType ], [], range),
        range)
    ));
    // state.handle._record = __taskRegister(state);
    entryStatements.push(Node.createExpressionStatement(
      Node.createBinaryExpression(
        Token.Equals,
        Node.createPropertyAccessExpression(handleAccess, Node.createIdentifierExpression(RECORD_FIELD, range), range),
        Node.createCallExpression(Node.createIdentifierExpression(REGISTER_NAME, range), null, [ stateIdent ], range),
        range
      )
    ));
    // f$resume(state);   — §4.1: the synchronous prefix runs here.
    entryStatements.push(Node.createExpressionStatement(
      Node.createCallExpression(resumeIdent, null, [ stateIdent ], range)
    ));
    entryStatements.push(Node.createReturnStatement(handleAccess, range));
    declaration.body = Node.createBlockStatement(entryStatements, range);
    declaration.signature.returnType = taskType;
    // The call-site type is now the declared one. `async` on the *element* is
    // what makes a call yield `Task<T>` (`resolver.ts:2669`); the entry's
    // declared return type is already that handle, so keeping the trait would
    // wrap it twice.
    declaration.isAsync = false;

    // --- artifact 1: the resume function -----------------------------------

    let resumeVarName = nameForState(parameters, block);
    let resumeStateIdent = Node.createIdentifierExpression(resumeVarName, range);
    // The side table the compiler reads (§4.7.4): where each lowered `await`
    // finds its value. Filled here, once the resume function's state local has
    // its name.
    for (let i = 0, k = plans.length; i < k; ++i) {
      let info = plans[i].info;
      if (!info) continue;
      awaitSites.set(info.node, new AwaitSite(
        info.discriminator,
        awaitedFieldExpression(resumeVarName, info.fieldName, info.node.range)
      ));
    }
    let resumeStatements = new Array<Statement>();
    for (let i = 0, k = parameters.length; i < k; ++i) {
      let parameter = parameters[i];
      // §4.3: the resume function's parameter list carries no wasm parameters —
      // "it reads them from the state struct". This copy-in is unconditional, so
      // it lands in every region; a *write* to the parameter in an earlier region
      // is therefore lost on re-entry, which is why such a write is refused
      // (`planBody`).
      resumeStatements.push(Node.createVariableStatement(
        null,
        [
          Node.createVariableDeclaration(
            Node.createIdentifierExpression(parameter.name.text, parameter.name.range),
            null, CommonFlags.Let, // `let`: the assignment position writes it
            null,
            Node.createPropertyAccessExpression(resumeStateIdent,
              Node.createIdentifierExpression(parameter.name.text, parameter.range), parameter.range),
            parameter.range
          )
        ],
        parameter.range
      ));
    }

    // Split the body into regions: region 0 runs from entry to the first
    // suspension, region K resumes at await K and runs to the next suspension,
    // region N runs from the last await to the terminal.
    let regions = new Array<Array<Statement>>();
    regions.push(new Array<Statement>());
    let regionIndex = 0;
    let bodyStatements = block.statements;
    for (let i = 0, k = bodyStatements.length; i < k; ++i) {
      let statement = bodyStatements[i];
      let plan = plans[i];
      let info = plan.info;
      if (info) {
        let region = regions[regionIndex];
        // The operand, evaluated where the `await` is written — before the
        // suspension, after everything that precedes it.
        region.push(Node.createExpressionStatement(
          Node.createBinaryExpression(
            Token.Equals,
            awaitedField(resumeStateIdent, info.fieldName, range),
            Node.createPropertyAccessExpression(info.operand, Node.createIdentifierExpression(RECORD_FIELD, range), range),
            range
          )
        ));
        // The resume point is written *before* the park, so a completion that
        // arrives first still finds a valid point (§4.2).
        region.push(Node.createExpressionStatement(
          assignField(resumeStateIdent, RESUME_POINT_FIELD, intLiteral(info.discriminator, range), range)
        ));
        // §1.2 rule 4: a settled await does not suspend. The settled path falls
        // through into region `discriminator`, which the guard below opens.
        region.push(Node.createIfStatement(
          Node.createUnaryPrefixExpression(
            Token.Exclamation,
            Node.createCallExpression(
              Node.createIdentifierExpression(SETTLED_NAME, range), null,
              [ awaitedField(resumeStateIdent, info.fieldName, range) ],
              range
            ),
            range
          ),
          Node.createBlockStatement([
            Node.createExpressionStatement(
              Node.createCallExpression(
                Node.createIdentifierExpression(PARK_NAME, range), null,
                [ resumeStateIdent, awaitedField(resumeStateIdent, info.fieldName, range) ],
                range
              )
            ),
            Node.createReturnStatement(null, range) // a suspension is a return
          ], range),
          null,
          range
        ));
        // Open the region that reads the awaited value.
        regionIndex++;
        regions.push(new Array<Statement>());
        appendAfterPart(regions[regionIndex], statement, resumeVarName, awaitCount + 1, returnsValue);
      } else {
        regions[regionIndex].push(rewriteStatement(statement, resumeVarName, awaitCount + 1, returnsValue));
      }
    }
    // The terminal, for a body that runs off its end.
    let lastRegion = regions[regionIndex];
    if (!lastRegion.length || lastRegion[lastRegion.length - 1].kind != NodeKind.Return) {
      lastRegion.push(Node.createExpressionStatement(
        assignField(resumeStateIdent, RESUME_POINT_FIELD, intLiteral(awaitCount + 1, range), range)
      ));
    }
    for (let i = 0, k = regions.length; i < k; ++i) {
      resumeStatements.push(Node.createIfStatement(
        Node.createBinaryExpression(
          Token.Equals_Equals,
          Node.createPropertyAccessExpression(resumeStateIdent,
            Node.createIdentifierExpression(RESUME_POINT_FIELD, range), range),
          intLiteral(i, range),
          range
        ),
        Node.createBlockStatement(regions[i], range),
        null,
        range
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
   * Plans a body: the statements, the awaits in them, and the name crossings.
   * Reports a refusal and answers `null` when the body cannot be lowered.
   */
  private planBody(
    parser: Parser,
    block: BlockStatement,
    parameters: ParameterNode[]
  ): Array<StatementPlan> | null {
    let statements = block.statements;
    let plans = new Array<StatementPlan>();
    let awaits = new Array<AwaitInfo>();
    for (let i = 0, k = statements.length; i < k; ++i) {
      let plan = this.planStatement(parser, statements[i], awaits.length + 1, i);
      if (!plan) return null;
      if (plan.info) awaits.push(plan.info);
      plans.push(plan);
    }
    if (!this.checkCrossings(parser, block, parameters, plans, awaits)) return null;
    return plans;
  }

  /**
   * Plans one statement: its references, and the `await` it suspends on when the
   * await sits in a position this revision lowers.
   */
  private planStatement(
    parser: Parser,
    statement: Statement,
    discriminator: i32,
    index: i32
  ): StatementPlan | null {
    let awaits = new Array<AwaitExpression>();
    switch (statement.kind) {
      case NodeKind.Empty: {
        return new StatementPlan(null, new NameSet(), new NameSet());
      }
      case NodeKind.Expression: {
        let expression = (<ExpressionStatement>statement).expression;
        // `await h;`
        if (expression.kind == NodeKind.Await) {
          let awaitNode = <AwaitExpression>expression;
          let info = new AwaitInfo(
            awaitNode, awaitNode.operand, discriminator,
            AWAITED_PREFIX + discriminator.toString(), index
          );
          let before = new NameSet();
          if (!this.walkExpression(parser, info.operand, before, null, false)) return null;
          return new StatementPlan(info, before, new NameSet());
        }
        // `x = await h;`
        if (
          expression.kind == NodeKind.Binary &&
          (<BinaryExpression>expression).operator == Token.Equals &&
          (<BinaryExpression>expression).right.kind == NodeKind.Await
        ) {
          let binary = <BinaryExpression>expression;
          let awaitNode = <AwaitExpression>binary.right;
          let info = new AwaitInfo(
            awaitNode, awaitNode.operand, discriminator,
            AWAITED_PREFIX + discriminator.toString(), index
          );
          let before = new NameSet();
          if (!this.walkExpression(parser, info.operand, before, null, false)) return null;
          let after = new NameSet();
          // The target is written *after* the suspension: it is the value's
          // destination, not its source.
          if (!this.walkExpression(parser, binary.left, after, null, true)) return null;
          return new StatementPlan(info, before, after);
        }
        break;
      }
      case NodeKind.Variable: {
        let declarations = (<VariableStatement>statement).declarations;
        if (declarations.length == 1) {
          let initializer = declarations[0].initializer;
          if (initializer != null && initializer.kind == NodeKind.Await) {
            let awaitNode = <AwaitExpression>initializer;
            let info = new AwaitInfo(
              awaitNode, awaitNode.operand, discriminator,
              AWAITED_PREFIX + discriminator.toString(), index
            );
            let before = new NameSet();
            if (!this.walkExpression(parser, info.operand, before, null, false)) return null;
            return new StatementPlan(info, before, new NameSet());
          }
        }
        break;
      }
      case NodeKind.Return: {
        let value = (<ReturnStatement>statement).value;
        if (value != null && value.kind == NodeKind.Await) {
          let awaitNode = <AwaitExpression>value;
          let info = new AwaitInfo(
            awaitNode, awaitNode.operand, discriminator,
            AWAITED_PREFIX + discriminator.toString(), index
          );
          let before = new NameSet();
          if (!this.walkExpression(parser, info.operand, before, null, false)) return null;
          return new StatementPlan(info, before, new NameSet());
        }
        break;
      }
      default: {
        return this.refuse(parser, statement.range, reasonFor(statement));
      }
    }

    // No supported await in this statement — walk it whole. Any `await` found is
    // in a position this revision does not lower, and the walker says so.
    let after = new NameSet();
    switch (statement.kind) {
      case NodeKind.Expression: {
        if (!this.walkExpression(parser, (<ExpressionStatement>statement).expression, after, awaits, false)) return null;
        break;
      }
      case NodeKind.Variable: {
        let declarations = (<VariableStatement>statement).declarations;
        for (let i = 0, k = declarations.length; i < k; ++i) {
          let initializer = declarations[i].initializer;
          if (initializer && !this.walkExpression(parser, initializer, after, awaits, false)) return null;
        }
        break;
      }
      case NodeKind.Return: {
        let value = (<ReturnStatement>statement).value;
        if (value && !this.walkExpression(parser, value, after, awaits, false)) return null;
        break;
      }
      default: { // unreachable: the switch above returns for every other kind
        return this.refuse(parser, statement.range, reasonFor(statement));
      }
    }
    if (awaits.length) {
      let where = awaits.length > 1
        ? "more than one await in one statement (async lowering)"
        : "await in an unsupported position (async lowering)";
      return this.refuse(parser, awaits[0].range, where);
    }
    return new StatementPlan(null, new NameSet(), after);
  }

  /**
   * Refuses the names that cannot survive a suspension:
   *
   * - a local declared before an await and referenced after it — its storage
   *   would have to be lifted (commit 4), and it is not;
   * - a parameter *written* before an await and *read* after it — the resume
   *   function copies parameters in from the state struct at entry, so the write
   *   is lost on re-entry.
   *
   * References *before* a suspension are fine: the operand of an `await` is
   * evaluated before the park, in the region that parks.
   */
  private checkCrossings(
    parser: Parser,
    block: BlockStatement,
    parameters: ParameterNode[],
    plans: Array<StatementPlan>,
    awaits: Array<AwaitInfo>
  ): bool {
    if (!awaits.length) return true;

    for (let a = 0, ak = awaits.length; a < ak; ++a) {
      let index = awaits[a].statementIndex;

      // Everything referenced after this suspension: the await statement's own
      // after-part, then every later statement whole.
      let referenced = new Set<string>();
      addAll(referenced, plans[index].after.reads);
      addAll(referenced, plans[index].after.writes);
      for (let j = index + 1, jk = plans.length; j < jk; ++j) {
        addAll(referenced, plans[j].before.reads);
        addAll(referenced, plans[j].before.writes);
        addAll(referenced, plans[j].after.reads);
        addAll(referenced, plans[j].after.writes);
      }

      // A local declared before the suspension and referenced after it would
      // have to be carried across — its storage is a wasm local in the region
      // that declares it, and regions are blocks. That is lifting, and lifting
      // is commit 4's.
      let crossed = false;
      let crossedAt = block.range;
      for (let j = 0; j < index && !crossed; ++j) {
        let locals = declaredLocalsOf(block.statements[j]);
        for (let l = 0, lk = locals.length; l < lk; ++l) {
          if (referenced.has(locals[l])) {
            crossed = true;
            crossedAt = block.statements[j].range;
            break;
          }
        }
      }
      if (crossed) {
        this.refuse(parser, crossedAt, "a local that crosses an await (async lowering)");
        return false;
      }

      // Parameters read after this suspension: any write to them in an earlier
      // region is lost, because the copy-in re-runs on every entry.
      let readAfter = new Set<string>();
      addAll(readAfter, plans[index].after.reads);
      for (let j = index + 1, jk = plans.length; j < jk; ++j) {
        addAll(readAfter, plans[j].before.reads);
        addAll(readAfter, plans[j].after.reads);
      }
      let writeBefore = new Set<string>();
      for (let j = 0; j < index; ++j) {
        addAll(writeBefore, plans[j].before.writes);
        addAll(writeBefore, plans[j].after.writes);
      }
      addAll(writeBefore, plans[index].before.writes);
      for (let i = 0, k = parameters.length; i < k; ++i) {
        let name = parameters[i].name.text;
        if (writeBefore.has(name) && readAfter.has(name)) {
          this.refuse(parser, parameters[i].range,
            "a parameter written before an await and read after it (async lowering)");
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Walks an expression: collects identifier references, collects the `await`
   * nodes it finds, and refuses the expression kinds this revision does not
   * lower. `writeTarget` marks the walked expression as an assignment target.
   */
  private walkExpression(
    parser: Parser,
    expression: Expression,
    names: NameSet | null,
    awaits: Array<AwaitExpression> | null,
    writeTarget: bool
  ): bool {
    switch (expression.kind) {
      case NodeKind.Identifier: {
        if (names) {
          let text = (<IdentifierExpression>expression).text;
          if (writeTarget) names.writes.add(text);
          else names.reads.add(text);
        }
        return true;
      }
      case NodeKind.True:
      case NodeKind.False:
      case NodeKind.Null: {
        return true;
      }
      case NodeKind.This: {
        this.refuse(parser, expression.range, "this in an async function body (async lowering)");
        return false;
      }
      case NodeKind.Super: {
        this.refuse(parser, expression.range, "super in an async function body (async lowering)");
        return false;
      }
      case NodeKind.Await: {
        let awaitNode = <AwaitExpression>expression;
        if (awaits) {
          awaits.push(awaitNode);
          return true;
        }
        this.refuse(parser, awaitNode.range, "await in an unsupported position (async lowering)");
        return false;
      }
      case NodeKind.Literal: {
        let literal = <LiteralExpression>expression;
        switch (literal.literalKind) {
          case LiteralKind.Float:
          case LiteralKind.Integer:
          case LiteralKind.String:
          case LiteralKind.RegExp: {
            return true;
          }
          case LiteralKind.Template: {
            let parts = (<TemplateLiteralExpression>literal).expressions;
            for (let i = 0, k = parts.length; i < k; ++i) {
              if (!this.walkExpression(parser, parts[i], names, awaits, false)) return false;
            }
            return true;
          }
          case LiteralKind.Array: {
            let elements = (<ArrayLiteralExpression>literal).elementExpressions;
            for (let i = 0, k = elements.length; i < k; ++i) {
              if (!this.walkExpression(parser, elements[i], names, awaits, false)) return false;
            }
            return true;
          }
          case LiteralKind.Object: {
            let values = (<ObjectLiteralExpression>literal).values;
            for (let i = 0, k = values.length; i < k; ++i) {
              if (!this.walkExpression(parser, values[i], names, awaits, false)) return false;
            }
            return true;
          }
          default: {
            this.refuse(parser, expression.range, reasonFor(expression));
            return false;
          }
        }
      }
      case NodeKind.Assertion: {
        let assertion = <AssertionExpression>expression;
        if (!this.walkExpression(parser, assertion.expression, names, awaits, writeTarget)) return false;
        return assertion.toType == null;
      }
      case NodeKind.Binary: {
        let binary = <BinaryExpression>expression;
        let isAssignment = isAssignmentOperator(binary.operator);
        if (!this.walkExpression(parser, binary.left, names, awaits, isAssignment ? true : writeTarget)) return false;
        return this.walkExpression(parser, binary.right, names, awaits, false);
      }
      case NodeKind.Call: {
        let call = <CallExpression>expression;
        if (!this.walkExpression(parser, call.expression, names, awaits, false)) return false;
        let args = call.args;
        for (let i = 0, k = args.length; i < k; ++i) {
          if (!this.walkExpression(parser, args[i], names, awaits, false)) return false;
        }
        return true;
      }
      case NodeKind.Comma: {
        let expressions = (<CommaExpression>expression).expressions;
        for (let i = 0, k = expressions.length; i < k; ++i) {
          if (!this.walkExpression(parser, expressions[i], names, awaits, i == k - 1 ? writeTarget : false)) return false;
        }
        return true;
      }
      case NodeKind.ElementAccess: {
        let elementAccess = <ElementAccessExpression>expression;
        if (!this.walkExpression(parser, elementAccess.expression, names, awaits, false)) return false;
        return this.walkExpression(parser, elementAccess.elementExpression, names, awaits, false);
      }
      case NodeKind.InstanceOf: {
        return this.walkExpression(parser, (<InstanceOfExpression>expression).expression, names, awaits, false);
      }
      case NodeKind.New: {
        let args = (<NewExpression>expression).args;
        for (let i = 0, k = args.length; i < k; ++i) {
          if (!this.walkExpression(parser, args[i], names, awaits, false)) return false;
        }
        return true;
      }
      case NodeKind.Parenthesized: {
        return this.walkExpression(parser, (<ParenthesizedExpression>expression).expression, names, awaits, writeTarget);
      }
      case NodeKind.PropertyAccess: {
        return this.walkExpression(parser, (<PropertyAccessExpression>expression).expression, names, awaits, false);
      }
      case NodeKind.Ternary: {
        let ternary = <TernaryExpression>expression;
        if (!this.walkExpression(parser, ternary.condition, names, awaits, false)) return false;
        if (!this.walkExpression(parser, ternary.ifThen, names, awaits, writeTarget)) return false;
        return this.walkExpression(parser, ternary.ifElse, names, awaits, writeTarget);
      }
      case NodeKind.UnaryPostfix: {
        let postfix = <UnaryPostfixExpression>expression;
        let isUpdate = postfix.operator == Token.Plus_Plus || postfix.operator == Token.Minus_Minus;
        return this.walkExpression(parser, postfix.operand, names, awaits, isUpdate ? true : writeTarget);
      }
      case NodeKind.UnaryPrefix: {
        let prefix = <UnaryPrefixExpression>expression;
        let isUpdate = prefix.operator == Token.Plus_Plus || prefix.operator == Token.Minus_Minus;
        return this.walkExpression(parser, prefix.operand, names, awaits, isUpdate ? true : writeTarget);
      }
      default: {
        this.refuse(parser, expression.range, reasonFor(expression));
        return false;
      }
    }
  }

  /** Refuses the `async` methods and field initializers of a class body. */
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
}

/** One planned statement: its references, and the await it suspends on. */
class StatementPlan {
  constructor(
    /** The await this statement suspends on, if any. */
    public info: AwaitInfo | null,
    /** References evaluated *before* that suspension (the operand alone). */
    public before: NameSet,
    /** References evaluated *after* it — or the whole statement, when none. */
    public after: NameSet
  ) {}
}

/** One lowered `await`, with the parts that surround it. */
class AwaitInfo {
  constructor(
    /** The await node, which stays in the tree as codegen's typed read. */
    public node: AwaitExpression,
    /** The operand — evaluated before the suspension. */
    public operand: Expression,
    /** The resume-point discriminator (`1..N`, textual order). */
    public discriminator: i32,
    /** The state field holding the awaited record. */
    public fieldName: string,
    /** Index of the statement it sits in. */
    public statementIndex: i32
  ) {}
}

/** Identifier references, split by position. */
class NameSet {
  reads: Set<string> = new Set();
  writes: Set<string> = new Set();
}

/** Adds every member of `source` to `target`. */
function addAll(target: Set<string>, source: Set<string>): void {
  source.forEach((value: string): void => { target.add(value); });
}

/** Whether `statements` can produce a lowering (the fast path's test). */
function hasLowerable(statements: Statement[]): bool {
  for (let i = 0, k = statements.length; i < k; ++i) {
    let kind = statements[i].kind;
    if (kind == NodeKind.FunctionDeclaration) {
      if ((<FunctionDeclaration>statements[i]).isAsync) return true;
    } else if (kind == NodeKind.NamespaceDeclaration || kind == NodeKind.ClassDeclaration) {
      return true;
    } else if (kind == NodeKind.Variable) {
      // An async function expression or arrow can be written as an initializer,
      // and it is this level's business to refuse it.
      let declarations = (<VariableStatement>statements[i]).declarations;
      for (let j = 0, l = declarations.length; j < l; ++j) {
        let initializer = declarations[j].initializer;
        if (
          initializer != null &&
          initializer.kind == NodeKind.Function &&
          (<FunctionExpression>initializer).declaration.isAsync
        ) return true;
      }
    }
  }
  return false;
}

/** The names a statement introduces, if it is a local declaration. */
function declaredLocalsOf(statement: Statement): Array<string> {
  if (statement.kind != NodeKind.Variable) return [];
  let declarations = (<VariableStatement>statement).declarations;
  let names = new Array<string>();
  for (let i = 0, k = declarations.length; i < k; ++i) names.push(declarations[i].name.text);
  return names;
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

/** The after-part of an await-bearing statement, as the resume region's head. */
function appendAfterPart(
  region: Array<Statement>,
  statement: Statement,
  stateName: string,
  terminal: i32,
  returnsValue: bool
): void {
  // Three of the four positions push the statement unchanged: its `await` node
  // is exactly what codegen compiles as the typed read (§4.7.4), and its
  // operand — still attached — is deliberately not compiled again. A `return`
  // is the exception: it *is* the terminal transition, so it takes the same
  // rewrite a plain `return` takes. (Before this was split out,
  // `return await h;` compiled the read and dropped it, leaving `state.result`
  // untouched — a wrong-value bug, caught in the emitted wat.)
  if (statement.kind == NodeKind.Return) {
    region.push(rewriteStatement(statement, stateName, terminal, returnsValue));
  } else {
    region.push(statement);
  }
}

/**
 * A statement as the resume function carries it: returns become the terminal
 * write (§4.1), everything else is verbatim.
 */
function rewriteStatement(statement: Statement, stateName: string, terminal: i32, returnsValue: bool): Statement {
  if (statement.kind != NodeKind.Return) return statement;
  let returnStatement = <ReturnStatement>statement;
  let value = returnStatement.value;
  let range = returnStatement.range;
  let out = new Array<Statement>();
  if (value != null) {
    if (returnsValue) {
      out.push(Node.createExpressionStatement(
        Node.createBinaryExpression(
          Token.Equals,
          Node.createPropertyAccessExpression(
            Node.createIdentifierExpression(stateName, range), // the resume parameter, by name
            Node.createIdentifierExpression(RESULT_FIELD, range),
            range
          ),
          value,
          range
        )
      ));
    } else {
      // `return voidExpr;` — the expression's effect, without a value.
      out.push(Node.createExpressionStatement(value));
    }
  }
  out.push(Node.createExpressionStatement(
    Node.createBinaryExpression(
      Token.Equals,
      Node.createPropertyAccessExpression(
        Node.createIdentifierExpression(stateName, range),
        Node.createIdentifierExpression(RESUME_POINT_FIELD, range),
        range
      ),
      intLiteral(terminal, range),
      range
    )
  ));
  out.push(Node.createReturnStatement(null, range));
  return Node.createBlockStatement(out, range);
}

/** Why the node cannot be lowered, said in one line. */
function reasonFor(node: Node): string {
  switch (node.kind) {
    case NodeKind.Await: return "await in an unsupported position (async lowering)";
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

/** A name for the generated state local that no parameter or local shadows. */
function nameForState(parameters: ParameterNode[], block: BlockStatement): string {
  let name = "state";
  while (hasName(parameters, block, name)) name = "$" + name;
  return name;
}

function hasName(parameters: ParameterNode[], block: BlockStatement, name: string): bool {
  for (let i = 0, k = parameters.length; i < k; ++i) {
    if (parameters[i].name.text == name) return true;
  }
  return declaresName(block, name);
}

/** Whether `name` is declared anywhere inside `block`. */
function declaresName(block: BlockStatement, name: string): bool {
  let statements = block.statements;
  for (let i = 0, k = statements.length; i < k; ++i) {
    let locals = declaredLocalsOf(statements[i]);
    for (let j = 0, l = locals.length; j < l; ++j) {
      if (locals[j] == name) return true;
    }
  }
  return false;
}

/** State-struct members a parameter must not be named. */
function isReservedStateField(name: string): bool {
  if (
    name == RESUME_POINT_FIELD ||
    name == RESULT_FIELD ||
    name == HANDLE_FIELD ||
    name == "record" // inherited from TaskState (§4.7.3)
  ) return true;
  return name.startsWith(AWAITED_PREFIX);
}

/** The state struct's per-await field, as an expression. */
function awaitedField(state: Expression, fieldName: string, range: Range): Expression {
  return Node.createPropertyAccessExpression(
    state,
    Node.createIdentifierExpression(fieldName, range),
    range
  );
}

/** The same field, for the compiler's side table (a fresh node, not in the tree). */
function awaitedFieldExpression(stateName: string, fieldName: string, range: Range): Expression {
  return awaitedField(Node.createIdentifierExpression(stateName, range), fieldName, range);
}

/** Whether the parser produced the empty type node of an omitted annotation. */
function isOmittedTypeNode(type: TypeNode): bool {
  return type.kind == NodeKind.NamedType && (<NamedTypeNode>type).name.identifier.text == "";
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

/** `true` for the compound and simple assignment operators. */
function isAssignmentOperator(token: Token): bool {
  switch (token) {
    case Token.Equals:
    case Token.Plus_Equals:
    case Token.Minus_Equals:
    case Token.Asterisk_Equals:
    case Token.Asterisk_Asterisk_Equals:
    case Token.Slash_Equals:
    case Token.Percent_Equals:
    case Token.LessThan_LessThan_Equals:
    case Token.GreaterThan_GreaterThan_Equals:
    case Token.GreaterThan_GreaterThan_GreaterThan_Equals:
    case Token.Ampersand_Equals:
    case Token.Caret_Equals:
    case Token.Bar_Equals: {
      return true;
    }
    default: return false;
  }
}

/** An integer literal node. */
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
