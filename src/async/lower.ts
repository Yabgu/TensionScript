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
 * ## The state machine, as emitted
 *
 * §4.1's three artifacts, per async function:
 *
 * 1. **The state struct** — `class f$State extends TaskState`, with a field per
 *    parameter, a field per lifted local (§4.3), `resumePoint`, `result` (the
 *    payload stand-in until Phase 4), one `$awaited<K>` record field per await,
 *    and `handle`.
 * 2. **The entry** — `f` itself, rewritten: allocate the state, build and
 *    register the handle, run `f$resume` (the synchronous prefix, §4.1, §1.2
 *    rule 1), return the handle.
 * 3. **The resume function** — `f$resume(state): void`, the body with each
 *    `await` replaced by a state transition.
 *
 * **The dispatch rule, which is what makes nested control flow work.** The
 * resume function keeps the body's *structure* — loops stay loops, `if`s stay
 * `if`s — and each node is guarded on `state.resumePoint`:
 *
 * - `resumePoint == 0` means "running normally": every unexecuted statement runs.
 * - `resumePoint == K` means "resuming at await K": statements before K are
 *   skipped, and the continuation for K runs.
 * - **Each continuation clears `resumePoint` to 0 as its first statement.** That
 *   is the linchpin: everything after the resumed position — the rest of the
 *   enclosing block, later iterations of an enclosing loop, statements after the
 *   loop — then runs normally, exactly once.
 * - A construct (block, `if`, loop) is entered when `resumePoint == 0` **or**
 *   when the resume point is in the construct's own discriminator range — which
 *   is how a resumed iteration re-enters its enclosing loops without
 *   re-evaluating their conditions (whose side effects must not repeat) and
 *   without re-running the statements before the await.
 *
 * A loop's iteration is therefore resumable: `while (resumePoint != 0 || cond)`
 * enters the body unconditionally on the resumed pass, runs from the
 * continuation, clears the point, and the *next* iteration evaluates `cond`
 * again. An `if` never re-evaluates its condition on resume; it dispatches on
 * whether the resume point is in the then-range or the else-range, which is also
 * what makes "the branch did not execute" harmless — the await in it was never
 * parked, so nothing resumes there.
 *
 * ## Scope
 *
 * Lowered: `async function` declarations at a source's top level, in a
 * namespace, or nested inside another function (each is its own machine, with
 * its own discriminators starting at 1); bodies made of declarations,
 * expressions, `return`, `if`/`else`, `while`, `for`, blocks, and nested function
 * declarations; `await` in one of four positions, one await per statement:
 *
 * | Position | Example |
 * |---|---|
 * | expression statement | `await h;` |
 * | initializer | `let x: i32 = await h;` |
 * | assignment | `x = await h;` |
 * | return | `return await h;` |
 *
 * Bindings live across a suspension are **lifted** (§4.3): a local declared
 * before an await and referenced after it becomes a state field, and so does any
 * local declared *inside* a construct that contains an await (its declaration
 * would otherwise sit inside a guard block and go out of scope). A parameter
 * written before an await and read after it gets a copy-out. Every suspension
 * copies all lifted bindings out before the park; the resume function copies them
 * in at entry. Locals that cross nothing stay wasm locals.
 *
 * Refused by name, never emitted as wrong code: an `await` in any other position
 * (a sub-expression, a second await in one statement, a loop condition); `switch`,
 * `try`, `do`, `for-of`, `break`, `continue`, `throw`; `this`/`super` in the body;
 * async arrows, methods and function expressions; generic async functions;
 * optional/rest parameters; an omitted return type; a local with no declared type
 * that must be lifted; a reference-typed await result; a name the state struct
 * reserves.
 *
 * **`this` and captured bindings are not lifted** (§4.4): a captured binding's
 * storage is the environment, and the state struct will reference the environment
 * rather than copy the binding. Closures are unimplemented in this fork and `this`
 * has no path into an async function today (an async method is refused, and there
 * is no other construct that supplies `this`), so that rule is stated and
 * currently unreachable — commit 6's job once closures land.
 */

import { CommonFlags } from "../common";
import { DiagnosticCode, Range } from "../diagnostics";
import { Parser } from "../parser";
import { Program } from "../program";
import { Token } from "../tokenizer";
import { awaitSites, AwaitSite } from "./ir";
import { creationEnvOf } from "../closure/ir";
import {
  validateAsyncConstructs,
  MESSAGE_ASYNC_ARROW,
  MESSAGE_ASYNC_FUNCTION_EXPRESSION
} from "./validate";
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
  DoStatement,
  ElementAccessExpression,
  Expression,
  ExpressionStatement,
  FieldDeclaration,
  ForStatement,
  FunctionDeclaration,
  FunctionExpression,
  IdentifierExpression,
  IfStatement,
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
  SwitchStatement,
  TemplateLiteralExpression,
  TernaryExpression,
  TypeNode,
  UnaryPostfixExpression,
  UnaryPrefixExpression,
  VariableDeclaration,
  VariableStatement,
  WhileStatement
} from "../ast";

/** Suffix of the synthesized state struct for a lowered `async function f`. */
const STATE_SUFFIX = "$State";
/** Suffix of the synthesized resume function for a lowered `async function f`. */
const RESUME_SUFFIX = "$resume";
/** Base class of every state struct (`std/assembly/task-rt.ts`, §4.7). */
const TASK_STATE_NAME = "TaskState";
/** Base class of a task's environment (`std/assembly/task-rt.ts`, §4.4). */
const TASK_ENV_NAME = "TaskEnv";
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
/** The state struct's environment reference (§4.4). */
const ENV_FIELD = "$env";
/** The this-struct's receiver field, at field 0 (§7.4). */
const THIS_FIELD = "$this";
/** Prefix of the synthesized condition temporaries of `if` statements. */
const COND_TEMP_PREFIX = "$cond";

/** The in-tree `afterParse` `Transform`. */
export class AsyncLowerTransform {

  /** The program being compiled. Assigned by the CLI onto the prototype. */
  readonly program!: Program;

  /**
   * Construct start positions already refused, per source.
   *
   * Phase 2 (the validation walk) reports a construct only if no diagnostic has
   * named it already, and this is how it knows: `isAsync` answers `false` for a
   * lowered construct and keeps `true` for a refused one, so it cannot tell the
   * two apart. Keyed by an `i32` start rather than a built string because the
   * walk's lookup must not allocate; the map and its sets exist only once a
   * refusal has happened.
   */
  private refusals: Map<Source, Set<i32>> | null = null;

  /**
   * The function or method currently being lowered, for the refusal record.
   * A refusal anywhere inside it — a parameter, a return type, a `this` in the
   * body — aborts the whole construct, so the walk must see that construct as
   * already reported. Without this every sub-construct refusal would leave the
   * declaration looking unreached, and the walk would report a second message
   * for it.
   */
  private currentConstruct: Node | null = null;

  /** `Transform#afterParse` — runs after parsing, before initialization. */
  afterParse(parser: Parser): void {
    let sources = this.program.sources;
    for (let i = 0, k = sources.length; i < k; ++i) {
      let source = sources[i];
      // Library sources are never lowered: the standard library and the runtime
      // declare no `async` function, and skipping them keeps the transform out
      // of the standard library's own compilation path entirely.
      if (source.isLibrary) continue;
      // Phase 1: lower (or refuse by name) everything this pass reaches.
      this.lowerStatementList(source, source.statements, parser);
      // Phase 2 (commit 7): refuse by name the `async` constructs phase 1 never
      // reached. A pure traversal — see `./validate.ts`.
      let refusals = this.refusals;
      let refused = refusals != null ? refusals.get(source) : null;
      validateAsyncConstructs(source, parser, refused != null ? refused : null);
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
            let hoisted = new Array<Statement>();
            let lowered = this.lowerAsyncFunction(source, declaration, declared, parser, hoisted);
            if (lowered) {
              // The state class first: `initialize()` walks this array in order
              // (`program.ts:1102-1113`) and the entry references the class.
              for (let j = 0, l = lowered.length; j < l; ++j) out.push(lowered[j]);
              // Nested async functions' artifacts (§4.1 for a nested machine):
              // they are top-level elements even though their entries stay nested.
              for (let j = 0, l = hoisted.length; j < l; ++j) out.push(hoisted[j]);
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
          // An async instance method is a state machine whose receiver has no
          // home in the resume function: `f$resume(state)` is a free function,
          // so `this` cannot be `param 0` there. The state struct's `$env` is
          // populated with a one-field this-struct at the entry, and the body's
          // `this` reads it (docs/closures-plan.md §7.4, §8.3).
          let classDeclaration = <ClassDeclaration>statement;
          let artifacts = this.lowerAsyncMethods(source, classDeclaration, declared, parser);
          for (let j = 0, l = artifacts.length; j < l; ++j) out.push(artifacts[j]);
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
   * two artifacts are returned in array order. Nested async functions' artifacts
   * are appended to `hoisted`.
   */
  private lowerAsyncFunction(
    source: Source,
    declaration: FunctionDeclaration,
    declared: Array<string>,
    parser: Parser,
    hoisted: Array<Statement>,
    /**
     * The receiver type, when the function has one: an instance method's class,
     * or an explicit `this:` parameter's type. Non-null means the body's `this`
     * is replaced by a read of the state struct's this-struct.
     */
    thisType: TypeNode | null = null
  ): Statement[] | null {
    // Every refusal while lowering this construct belongs to this construct,
    // and the wrapper records it even when the abort came from a nested one:
    // the walk must not report an enclosing function the lowering pass was
    // already working on.
    let priorConstruct = this.currentConstruct;
    this.currentConstruct = declaration;
    let artifacts = this.lowerAsyncFunctionInner(
      source, declaration, declared, parser, hoisted, thisType
    );
    this.currentConstruct = priorConstruct;
    if (artifacts == null) this.recordRefusal(declaration);
    return artifacts;
  }

  /** The body of {@link lowerAsyncFunction}; see the wrapper for the record. */
  private lowerAsyncFunctionInner(
    source: Source,
    declaration: FunctionDeclaration,
    declared: Array<string>,
    parser: Parser,
    hoisted: Array<Statement>,
    thisType: TypeNode | null
  ): Statement[] | null {
    let signature = declaration.signature;
    let name = declaration.name.text;
    let range = declaration.range;

    // Shapes this revision does not lower. Each refusal names itself, so a
    // reader of the diagnostic knows what is missing rather than that "async"
    // is missing.
    if (declaration.arrowKind != ArrowKind.None) {
      return this.refuse(parser, declaration.range, MESSAGE_ASYNC_ARROW);
    }
    if (declaration.typeParameters != null) {
      return this.refuse(parser, declaration.range, "async generic functions (async lowering)");
    }
    // An explicit `this:` parameter is the free-function spelling of a
    // receiver: `this` is `param 0`, exactly as it is for a method, so the same
    // this-struct carries it across a suspension (closures plan §7.1a).
    if (thisType == null && signature.explicitThisType != null) {
      thisType = signature.explicitThisType;
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

    // --- the receiver, when the function has one ----------------------------

    // `this` is not available in `f$resume`: the resume function is free, and
    // the method's receiver is `param 0` of the *entry*. So the entry stores it
    // in `state.$env` (a one-field this-struct), and every `this` in the body
    // becomes a read of that field. Reads, not a hoisted local: a local would
    // need lifting, and the field is always current by construction.
    let thisEnvName = thisType != null ? name + "$ThisEnv" : "";
    let thisEnvClass: ClassDeclaration | null = null;
    if (thisType != null) {
      let thisField = Node.createFieldDeclaration(
        Node.createIdentifierExpression(THIS_FIELD, range),
        null, CommonFlags.Instance,
        thisType,
        Node.createCallExpression(
          Node.createIdentifierExpression("changetype", range),
          [ thisType ],
          [ intLiteral(0, range) ],
          range
        ),
        range
      );
      thisEnvClass = Node.createClassDeclaration(
        Node.createIdentifierExpression(thisEnvName, range),
        null, CommonFlags.None,
        null,
        typeNode(TASK_ENV_NAME, range),
        null,
        [ thisField ],
        range
      );
      replaceThis(block.statements, thisEnvName, stateVarNameOf(block, parameters));
    }

    // --- the plan: awaits, structure, and what has to be lifted -------------

    let lifting = new Lifting();
    let cursor = new PlanCursor();
    let seq = this.planSeq(parser, block.statements, cursor, false, source, hoisted, declared, lifting);
    if (!seq) return null;
    let awaitCount = cursor.next - 1;
    // An environment local that a closure creation reads must survive a
    // suspension: the creation statement is emitted unguarded (it is a function
    // *declaration* in effect), so on a resumed pass it re-reads the local. A
    // local declared inside a guarded region would be out of scope there — so
    // the env is lifted exactly as any other cross-await local is, and the
    // creation reads the copy-in (`docs/closures-plan.md` §8.3(b)).
    if (awaitCount != 0) this.liftCreationEnvs(block, lifting);
    this.collectLifting(parser, seq, lifting);
    // Parameters whose value is written somewhere: the resume function's copy-in
    // re-reads the state field on every entry, so a write that happens before a
    // park must also be copied out — which is what lifting the parameter means
    // (§4.3). Conservative on purpose: *any* write in an awaiting body lifts the
    // parameter, and a parameter that is never written stays exactly the copy-in
    // it was.
    if (awaitCount != 0) {
      let written = new Set<string>();
      collectWrites(seq, written);
      for (let i = 0, k = parameters.length; i < k; ++i) {
        if (written.has(parameters[i].name.text)) {
          lifting.liftParameter(parameters[i].name.text, parameters[i].name.range);
        }
      }
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

    let localNames = new Set<string>();
    collectLocalNames(block, localNames);
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
    // The environment reference (§4.4): a captured binding's storage is the
    // environment, and the state struct references it rather than copying the
    // binding. **Emitted and initialized to null, but unreachable until closures
    // land and `this`-in-an-async-body is un-refused** — every construct that
    // could supply a capture to an async body is refused by name today, so this
    // field is always null. It exists so the state struct's shape is stable
    // across that landing: the closures transform will populate it, and the type
    // (`TaskEnv`, `std/assembly/task-rt.ts`) is the base its environment will
    // extend. Being a class-typed field, it is traced by the generated visitor,
    // which is what lets the collector follow state -> environment once there is
    // something there to follow.
    stateFields.push(Node.createFieldDeclaration(
      Node.createIdentifierExpression(ENV_FIELD, range),
      null, CommonFlags.Instance,
      Node.createNamedType(
        Node.createSimpleTypeName(TASK_ENV_NAME, range),
        null, true, // nullable: absent today, and absent for a function that captures nothing
        range
      ),
      Node.createNullExpression(range),
      range
    ));
    // The lifted locals (§4.3): one field each, of the type the source declared.
    // No `!` — the constructor gives them a zero of their type, and `!` would
    // draw a note either way for a value type ("unnecessary") or a nullable
    // reference ("always assigned") (`compiler.ts:9232-9257`).
    for (let i = 0, k = lifting.locals.length; i < k; ++i) {
      let lift = lifting.locals[i];
      stateFields.push(Node.createFieldDeclaration(
        Node.createIdentifierExpression(lift.name, lift.declaration.name.range),
        null, CommonFlags.Instance,
        lift.type,
        null,
        lift.declaration.name.range
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
      stateFields.push(Node.createFieldDeclaration(
        Node.createIdentifierExpression(RESULT_FIELD, range),
        null, CommonFlags.Instance,
        returnType,
        null,
        range
      ));
    }
    // One record field per await: the awaited task's record, which is what
    // survives the suspension (§4.2). `TaskRecord` is a reference type, so the
    // generated visitor traces it and the record's chain stays alive (§4.4).
    let awaitFields = new Array<string>();
    collectAwaitFields(seq, awaitFields);
    for (let i = 0, k = awaitFields.length; i < k; ++i) {
      stateFields.push(Node.createFieldDeclaration(
        Node.createIdentifierExpression(awaitFields[i], range),
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
    // `super()` first (`AS2377`).
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
          changetypeZero(returnType, range), range)
      ));
    }
    // The lifted locals start at a zero of their type. The region that declares
    // one assigns the real value before any suspension can park.
    for (let i = 0, k = lifting.locals.length; i < k; ++i) {
      let lift = lifting.locals[i];
      ctorStatements.push(Node.createExpressionStatement(
        assignField(thisIdent, lift.name,
          changetypeZero(lift.type, lift.declaration.name.range), lift.declaration.name.range)
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
    // state.$env = new f$ThisEnv(this);   — §7.4: the receiver the resume
    // function cannot otherwise see. Populated unconditionally, and before the
    // prefix runs, so `this.x` is valid from the first statement.
    if (thisType != null) {
      entryStatements.push(Node.createExpressionStatement(
        assignField(stateIdent, ENV_FIELD,
          Node.createNewExpression(
            Node.createSimpleTypeName(thisEnvName, range),
            null,
            [ Node.createThisExpression(range) ],
            range
          ),
          range
        )
      ));
    }
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
    // The side table the compiler reads (§4.7.4): where each lowered `await`
    // finds its value. Filled here, once the resume function's state local has
    // its name.
    let infos = new Array<AwaitInfo>();
    collectAwaitInfos(seq, infos);
    for (let i = 0, k = infos.length; i < k; ++i) {
      let info = infos[i];
      awaitSites.set(info.node, new AwaitSite(
        info.discriminator,
        awaitedFieldExpression(resumeVarName, info.fieldName, info.node.range)
      ));
    }
    let resumeStatements = new Array<Statement>();
    // §4.3: the resume function's parameter list carries no wasm parameters —
    // "it reads them from the state struct". The copy-in is unconditional, so it
    // runs on every entry; a write in an earlier region survives because that
    // region's park copies it back out (`copyOutStatements`).
    for (let i = 0, k = parameters.length; i < k; ++i) {
      let parameter = parameters[i];
      resumeStatements.push(copyIn(parameter.name.text, parameter.name.range, resumeVarName));
    }
    // The lifted locals' copy-in, after the parameters and before the guards.
    for (let i = 0, k = lifting.locals.length; i < k; ++i) {
      let lift = lifting.locals[i];
      resumeStatements.push(copyIn(lift.name, lift.declaration.name.range, resumeVarName));
    }

    let ctx = new EmitContext(
      lifting, resumeVarName, awaitCount + 1, returnsValue, localNames
    );
    pushAll(resumeStatements, this.emitSeq(seq, ctx));

    // The terminal, for a body that runs off its end. Guarded on `resumePoint
    // == 0`: on a resumed pass the point is cleared by the continuation, so this
    // is reached normally — and if a path somehow leaves it set, the terminal
    // must not clobber it.
    if (!endsWithReturn(seq)) {
      resumeStatements.push(Node.createIfStatement(
        isZero(resumePointRead(resumeVarName, range), range),
        Node.createBlockStatement([
          Node.createExpressionStatement(
            resumePointWrite(resumeVarName, intLiteral(awaitCount + 1, range), range)
          )
        ], range),
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

    if (thisEnvClass != null) return [ thisEnvClass, stateClass, declaration, resumeFunction ];
    return [ stateClass, declaration, resumeFunction ];
  }

  /**
   * Lifts the environment locals that closure creations in this body read.
   *
   * `creationEnvOf` (§3.3 of the closures plan) names the local each creation
   * site stores in `_env`. A creation written as a `function` statement is
   * emitted unguarded by the resume function, so its read of that local happens
   * on every entry — including a resumed one. Lifting it is what makes the local
   * exist at that point, and the copy-in restores the same environment object.
   */
  private liftCreationEnvs(block: BlockStatement, lifting: Lifting): void {
    let names = new Set<string>();
    collectCreationEnvNames(block.statements, names);
    if (names.size == 0) return;
    liftDeclarationsNamed(block.statements, names, lifting);
  }

  // --- planning ------------------------------------------------------------

  /** Plans a statement list into a sequence. */
  private planSeq(
    parser: Parser,
    statements: Statement[],
    cursor: PlanCursor,
    forceLift: bool,
    source: Source,
    hoisted: Array<Statement>,
    declared: Array<string>,
    lifting: Lifting
  ): PlanSeq | null {
    let seq = new PlanSeq();
    for (let i = 0, k = statements.length; i < k; ++i) {
      let plan = this.planStatement(
        parser, statements[i], cursor, forceLift, source, hoisted, declared, lifting
      );
      if (!plan) return null;
      seq.add(plan);
    }
    return seq;
  }

  /** Plans one statement — a leaf, or a construct whose children are planned. */
  private planStatement(
    parser: Parser,
    statement: Statement,
    cursor: PlanCursor,
    forceLift: bool,
    source: Source,
    hoisted: Array<Statement>,
    declared: Array<string>,
    lifting: Lifting
  ): Plan | null {
    let plan = new Plan(statement);
    switch (statement.kind) {
      case NodeKind.Empty: {
        return plan;
      }
      case NodeKind.Expression: {
        let expression = (<ExpressionStatement>statement).expression;
        if (expression.kind == NodeKind.Function) {
          let nested = (<FunctionExpression>expression).declaration;
          if (nested.isAsync) {
            // Case 4: an inner async function is its own state machine, with its
            // own discriminators starting at 1. Its artifacts are hoisted to the
            // source's top level; its entry stays where it was declared.
            let artifacts = this.lowerAsyncFunction(source, nested, declared, parser, hoisted);
            if (!artifacts) return null;
            for (let i = 0, k = artifacts.length; i < k; ++i) {
              if (artifacts[i] !== statement) hoisted.push(artifacts[i]);
            }
          }
          plan.kind = PlanKind.Plain;
          plan.nestedFunction = true;
          return plan;
        }
        return this.planLeaf(parser, plan, cursor, lifting);
      }
      case NodeKind.Variable:
      case NodeKind.Return: {
        return this.planLeaf(parser, plan, cursor, lifting);
      }
      case NodeKind.Block: {
        let block = <BlockStatement>statement;
        let body = this.planSeq(parser, block.statements, cursor, forceLift, source, hoisted, declared, lifting);
        if (!body) return null;
        plan.kind = PlanKind.Block;
        plan.statements = body;
        plan.lo = body.lo;
        plan.hi = body.hi;
        if (body.lo != 0) this.liftDeclaredIn(parser, body, lifting);
        plan.all = refsOfSeq(body);
        return plan;
      }
      case NodeKind.If: {
        let ifs = <IfStatement>statement;
        // The condition is evaluated exactly once, on the normal path; a resume
        // never re-evaluates it (its side effects must not repeat).
        if (!this.walkExpression(parser, ifs.condition, plan.all, null, false)) return null;
        let thenSeq = this.planBranch(parser, ifs.ifTrue, cursor, forceLift, source, hoisted, declared, lifting);
        if (!thenSeq) return null;
        let elseSeq: PlanSeq | null = null;
        if (ifs.ifFalse != null) {
          elseSeq = this.planBranch(parser, assert(ifs.ifFalse), cursor, forceLift, source, hoisted, declared, lifting);
          if (!elseSeq) return null;
        }
        plan.kind = PlanKind.If;
        plan.cond = ifs.condition;
        plan.thenSeq = thenSeq;
        plan.elseSeq = elseSeq;
        plan.lo = minLo(thenSeq, elseSeq);
        plan.hi = maxHi(thenSeq, elseSeq);
        if (plan.lo != 0) {
          this.liftDeclaredIn(parser, thenSeq, lifting);
          if (elseSeq != null) this.liftDeclaredIn(parser, assert(elseSeq), lifting);
        }
        plan.all = unionOf(plan.all, unionOf(refsOfSeq(thenSeq), elseSeq ? refsOfSeq(elseSeq) : new NameSet()));
        return plan;
      }
      case NodeKind.While: {
        let loop = <WhileStatement>statement;
        if (!this.walkExpression(parser, loop.condition, plan.all, null, false)) return null;
        let body = this.planBranch(parser, loop.body, cursor, forceLift, source, hoisted, declared, lifting);
        if (!body) return null;
        plan.kind = PlanKind.While;
        plan.cond = loop.condition;
        plan.body = body;
        plan.lo = body.lo;
        plan.hi = body.hi;
        if (body.lo != 0) this.liftDeclaredIn(parser, body, lifting);
        plan.all = unionOf(plan.all, refsOfSeq(body));
        return plan;
      }
      case NodeKind.For: {
        let loop = <ForStatement>statement;
        // The body is planned first: whether the loop needs instrumenting (and
        // so whether its initializer's locals must be lifted) depends on it.
        let body = this.planBranch(parser, loop.body, cursor, forceLift, source, hoisted, declared, lifting);
        if (!body) return null;
        if (body.lo != 0) this.liftDeclaredIn(parser, body, lifting);
        let init = loop.initializer;
        if (init != null) {
          let initPlan = this.planStatement(
            parser, init, new PlanCursor(), false, source, hoisted, declared, lifting
          );
          if (!initPlan) return null;
          if (initPlan.info != null) {
            return this.refuse(parser, init.range, "await in a for initializer (async lowering)");
          }
          if (initPlan.lo != 0) return null; // already refused by the planner
        }
        if (loop.condition != null) {
          if (!this.walkExpression(parser, loop.condition, plan.all, null, false)) return null;
        }
        if (loop.incrementor != null) {
          if (!this.walkExpression(parser, loop.incrementor, plan.all, null, false)) return null;
        }
        plan.kind = PlanKind.For;
        plan.init = init;
        plan.cond = loop.condition;
        plan.incr = loop.incrementor;
        plan.body = body;
        plan.lo = body.lo;
        plan.hi = body.hi;
        plan.all = unionOf(plan.all, refsOfSeq(body));
        return plan;
      }
      case NodeKind.FunctionDeclaration: {
        let nested = <FunctionDeclaration>statement;
        if (nested.isAsync) {
          // A nested async function is its own state machine (case 4): lower it
          // now, with its own discriminator numbering, and hoist its artifacts.
          // Its entry stays nested; it captures nothing, because closures are
          // unimplemented — a nested function that referenced an outer local
          // would not resolve today.
          let artifacts = this.lowerAsyncFunction(source, nested, declared, parser, hoisted);
          if (!artifacts) return null;
          for (let i = 0, k = artifacts.length; i < k; ++i) {
            if (artifacts[i] !== statement) hoisted.push(artifacts[i]);
          }
        }
        // A function declaration has no runtime effect at its position (it is
        // hoisted), so it is emitted unguarded and its body is not walked.
        plan.kind = PlanKind.Plain;
        return plan;
      }
      default: {
        return this.refuse(parser, statement.range, reasonFor(statement));
      }
    }
  }

  /** Plans a branch or loop body, which need not be a block. */
  private planBranch(
    parser: Parser,
    statement: Statement,
    cursor: PlanCursor,
    forceLift: bool,
    source: Source,
    hoisted: Array<Statement>,
    declared: Array<string>,
    lifting: Lifting
  ): PlanSeq | null {
    let statements: Statement[];
    if (statement.kind == NodeKind.Block) statements = (<BlockStatement>statement).statements;
    else statements = [ statement ];
    return this.planSeq(parser, statements, cursor, forceLift, source, hoisted, declared, lifting);
  }

  /**
   * Plans a leaf statement: an ordinary one, or one of the four positions
   * where an `await` is lowered (§4.1).
   */
  private planLeaf(
    parser: Parser,
    plan: Plan,
    cursor: PlanCursor,
    lifting: Lifting
  ): Plan | null {
    let statement = plan.node;

    // `await h;`
    if (statement.kind == NodeKind.Expression) {
      let expression = (<ExpressionStatement>statement).expression;
      if (expression.kind == NodeKind.Await) {
        return this.planAwait(parser, plan, <AwaitExpression>expression, cursor, lifting);
      }
      // `x = await h;`
      if (expression.kind == NodeKind.Binary) {
        let binary = <BinaryExpression>expression;
        if (binary.operator == Token.Equals && binary.right.kind == NodeKind.Await) {
          return this.planAwait(parser, plan, <AwaitExpression>binary.right, cursor, lifting, binary.left);
        }
      }
    }
    // `let x: T = await h;`
    if (statement.kind == NodeKind.Variable) {
      let declarations = (<VariableStatement>statement).declarations;
      if (declarations.length == 1) {
        let declaration = declarations[0];
        let initializer = declaration.initializer;
        if (initializer != null && initializer.kind == NodeKind.Await) {
          // A local declared *at* an await sits inside the continuation block, so
          // it must live in the state struct (§4.3) — there is nowhere else its
          // declaration could be seen from.
          let lift = this.liftDeclarator(parser, declaration, lifting);
          if (!lift) return null;
          return this.planAwait(parser, plan, <AwaitExpression>initializer, cursor, lifting);
        }
      }
    }
    // `return await h;`
    if (statement.kind == NodeKind.Return) {
      let value = (<ReturnStatement>statement).value;
      if (value != null && value.kind == NodeKind.Await) {
        return this.planAwait(parser, plan, <AwaitExpression>value, cursor, lifting);
      }
    }

    // No supported await here. Walk the statement whole: any `await` found is in
    // a position this revision does not lower, and the walker says so. Every
    // reference counts as "after", because the statement is emitted inside a
    // guard block and any await it contains could resume past its start.
    let awaits = new Array<AwaitExpression>();
    switch (statement.kind) {
      case NodeKind.Expression: {
        if (!this.walkExpression(parser, (<ExpressionStatement>statement).expression, plan.all, awaits, false)) return null;
        break;
      }
      case NodeKind.Variable: {
        let declarations = (<VariableStatement>statement).declarations;
        for (let i = 0, k = declarations.length; i < k; ++i) {
          let declaration = declarations[i];
          plan.declarations.push(declaration);
          let initializer = declaration.initializer;
          if (initializer && !this.walkExpression(parser, initializer, plan.all, awaits, false)) return null;
        }
        break;
      }
      case NodeKind.Return: {
        let value = (<ReturnStatement>statement).value;
        if (value && !this.walkExpression(parser, value, plan.all, awaits, false)) return null;
        break;
      }
    }
    if (awaits.length) {
      let where = awaits.length > 1
        ? "more than one await in one statement (async lowering)"
        : "await in an unsupported position (async lowering)";
      return this.refuse(parser, awaits[0].range, where);
    }
    return plan;
  }

  /** Records one supported `await` as a suspension at the next discriminator. */
  private planAwait(
    parser: Parser,
    plan: Plan,
    node: AwaitExpression,
    cursor: PlanCursor,
    lifting: Lifting,
    writeTarget: Expression | null = null
  ): Plan | null {
    let discriminator = cursor.next++;
    let operand = node.operand;
    let before = new NameSet();
    if (!this.walkExpression(parser, operand, before, null, false)) return null;
    let after = new NameSet();
    if (writeTarget != null) {
      if (!this.walkExpression(parser, writeTarget, after, null, true)) return null;
    }
    plan.kind = PlanKind.Plain;
    plan.info = new AwaitInfo(
      node, operand, discriminator, AWAITED_PREFIX + discriminator.toString(),
      discriminator
    );
    plan.lo = discriminator;
    plan.hi = discriminator;
    plan.before = before;
    plan.after = after;
    plan.all = unionOf(before, after);
    return plan;
  }

  /**
   * Adds one declarator to the lifted set, refusing the ones a state field cannot
   * carry. `planLeaf` calls this for a declaration at an await, and the planner
   * for declarations inside an await-bearing construct.
   */
  private liftDeclarator(
    parser: Parser,
    declaration: VariableDeclaration,
    lifting: Lifting
  ): bool {
    let name = declaration.name.text;
    if (lifting.hasLocal(name)) return true;
    if (isReservedStateField(name)) {
      this.refuse(parser, declaration.name.range,
        "a local whose name is reserved by the state struct (async lowering)");
      return false;
    }
    let type = declaration.type;
    if (type == null) {
      // The field needs a type, and the transform runs before resolution:
      // `let v = 1;` has none it can name. (§4.7.4's limit, in a second place.)
      this.refuse(parser, declaration.name.range,
        "a local without a declared type that crosses an await (async lowering)");
      return false;
    }
    lifting.liftLocal(name, type, declaration);
    return true;
  }

  /**
   * Lifts every local declared inside a construct that contains an await
   * (§4.3): the construct's body is emitted inside a guard block, so a plain
   * declaration would go out of scope for everything after it. Constructs with
   * no await of their own are emitted verbatim, so their locals stay locals.
   */
  private liftDeclaredIn(parser: Parser, seq: PlanSeq, lifting: Lifting): bool {
    let plans = seq.plans;
    for (let i = 0, k = plans.length; i < k; ++i) {
      let plan = plans[i];
      let declarations = plan.declarations;
      for (let j = 0, jk = declarations.length; j < jk; ++j) {
        if (!this.liftDeclarator(parser, declarations[j], lifting)) return false;
      }
      if (plan.kind == PlanKind.Block && plan.lo != 0) {
        if (!this.liftDeclaredIn(parser, assert(plan.statements), lifting)) return false;
      } else if (plan.kind == PlanKind.If && plan.lo != 0) {
        if (!this.liftDeclaredIn(parser, assert(plan.thenSeq), lifting)) return false;
        if (plan.elseSeq != null && !this.liftDeclaredIn(parser, assert(plan.elseSeq), lifting)) return false;
      } else if ((plan.kind == PlanKind.While || plan.kind == PlanKind.For) && plan.lo != 0) {
        if (!this.liftDeclaredIn(parser, assert(plan.body), lifting)) return false;
      }
    }
    return true;
  }

  /**
   * The liveness half of lifting (§4.3): a local declared before a suspension
   * and referenced after it must survive it. Runs over a planned sequence, then
   * recursively over its constructs.
   */
  private collectLifting(parser: Parser, seq: PlanSeq, lifting: Lifting): void {
    let declaredBefore = new Array<VariableDeclaration>();
    let plans = seq.plans;
    for (let i = 0, k = plans.length; i < k; ++i) {
      let plan = plans[i];
      if (plan.lo != 0) {
        // Everything this statement references after its await, plus every
        // reference in the statements that follow it.
        let referenced = new NameSet();
        addAll(referenced.reads, plan.after.reads);
        addAll(referenced.writes, plan.after.writes);
        addAll(referenced.reads, plan.all.reads);
        addAll(referenced.writes, plan.all.writes);
        for (let j = i + 1, jk = plans.length; j < jk; ++j) {
          addAll(referenced.reads, plans[j].all.reads);
          addAll(referenced.writes, plans[j].all.writes);
        }
        for (let j = 0, jk = declaredBefore.length; j < jk; ++j) {
          let declaration = declaredBefore[j];
          let name = declaration.name.text;
          if (referenced.reads.has(name) || referenced.writes.has(name)) {
            if (!this.liftDeclarator(parser, declaration, lifting)) return;
          }
        }
      }
      // Declarations at this level, for the awaits that follow them.
      let declarations = plan.declarations;
      for (let j = 0, jk = declarations.length; j < jk; ++j) {
        let declaration = declarations[j];
        if (!lifting.hasLocal(declaration.name.text)) declaredBefore.push(declaration);
      }
      // Recurse. A construct's own locals were lifted during planning (they are
      // declared inside an await-bearing construct); its nested awaits still need
      // the sequence liveness rule, which the recursion provides.
      switch (plan.kind) {
        case PlanKind.Block: {
          this.collectLifting(parser, assert(plan.statements), lifting);
          break;
        }
        case PlanKind.If: {
          this.collectLifting(parser, assert(plan.thenSeq), lifting);
          if (plan.elseSeq != null) this.collectLifting(parser, assert(plan.elseSeq), lifting);
          break;
        }
        case PlanKind.While:
        case PlanKind.For: {
          this.collectLifting(parser, assert(plan.body), lifting);
          break;
        }
      }
    }
  }

  // --- emission ------------------------------------------------------------

  /** Emits one planned sequence as resume-function statements. */
  private emitSeq(seq: PlanSeq, ctx: EmitContext): Array<Statement> {
    let out = new Array<Statement>();
    let plans = seq.plans;
    for (let i = 0, k = plans.length; i < k; ++i) {
      pushAll(out, this.emitPlan(plans[i], ctx));
    }
    return out;
  }

  /** Emits one planned statement. */
  private emitPlan(plan: Plan, ctx: EmitContext): Array<Statement> {
    let out = new Array<Statement>();
    let node = plan.node;
    let range = node.range;
    switch (plan.kind) {
      case PlanKind.Plain: {
        if (plan.nestedFunction || node.kind == NodeKind.FunctionDeclaration) {
          // A declaration is hoisted, so it is emitted unguarded: wrapping it in
          // a guard block would put a function declaration in a block.
          out.push(node);
          return out;
        }
        if (plan.info != null) {
          let info = plan.info;
          // The prefix: evaluate the operand where the `await` is written, set
          // the resume point, and suspend unless the task is already settled.
          let prefix = new Array<Statement>();
          prefix.push(Node.createExpressionStatement(
            Node.createBinaryExpression(
              Token.Equals,
              awaitedFieldOf(ctx.stateName, info.fieldName, range),
              Node.createPropertyAccessExpression(
                info.operand, Node.createIdentifierExpression(RECORD_FIELD, range), range
              ),
              range
            )
          ));
          prefix.push(Node.createExpressionStatement(
            resumePointWrite(ctx.stateName, intLiteral(info.discriminator, range), range)
          ));
          // §1.2 rule 4: a settled await does not suspend. The settled path falls
          // through into the continuation below, which the resume point opens.
          let park = new Array<Statement>();
          pushAll(park, copyOutStatements(ctx.lifting, ctx.stateName, range));
          park.push(Node.createExpressionStatement(
            Node.createCallExpression(
              Node.createIdentifierExpression(PARK_NAME, range), null,
              [ Node.createIdentifierExpression(ctx.stateName, range), awaitedFieldOf(ctx.stateName, info.fieldName, range) ],
              range
            )
          ));
          park.push(Node.createReturnStatement(null, range)); // a suspension is a return
          // `if (!__taskSettled($awaitedK)) { <copy-out>; park; return; }` — the
          // condition is the negation itself, not a comparison of it (an `== 0`
          // here would invert the guard and park a settled await).
          prefix.push(Node.createIfStatement(
            Node.createUnaryPrefixExpression(
              Token.Exclamation,
              Node.createCallExpression(
                Node.createIdentifierExpression(SETTLED_NAME, range), null,
                [ awaitedFieldOf(ctx.stateName, info.fieldName, range) ],
                range
              ),
              range
            ),
            Node.createBlockStatement(park, range),
            null,
            range
          ));
          out.push(Node.createIfStatement(
            isZero(resumePointRead(ctx.stateName, range), range),
            Node.createBlockStatement(prefix, range),
            null,
            range
          ));
          // The continuation: the statement itself, whose `await` node codegen
          // compiles as the typed read (§4.7.4). Clearing the resume point first
          // is what lets everything after it run normally, once.
          let continuation = new Array<Statement>();
          continuation.push(Node.createExpressionStatement(
            resumePointWrite(ctx.stateName, intLiteral(0, range), range)
          ));
          pushAll(continuation, rewriteStatement(node, ctx));
          out.push(Node.createIfStatement(
            equals(
              resumePointRead(ctx.stateName, range),
              intLiteral(info.discriminator, range),
              range
            ),
            Node.createBlockStatement(continuation, range),
            null,
            range
          ));
          return out;
        }
        if (plan.lo == 0) {
          // An ordinary statement: runs on the normal pass, skipped on any resume
          // that has not yet cleared the point.
          out.push(Node.createIfStatement(
            isZero(resumePointRead(ctx.stateName, range), range),
            Node.createBlockStatement(rewriteStatement(node, ctx), range),
            null,
            range
          ));
        }
        return out;
      }
      case PlanKind.Block: {
        let inner = this.emitSeq(assert(plan.statements), ctx);
        if (plan.lo == 0) return guarded(rewriteReturns(node, ctx), ctx, range);
        out.push(Node.createIfStatement(
          enterGuard(ctx.stateName, plan.lo, plan.hi, range),
          Node.createBlockStatement(inner, range),
          null,
          range
        ));
        return out;
      }
      case PlanKind.If: {
        if (plan.lo == 0) return guarded(rewriteReturns(node, ctx), ctx, range);
        let thenStatements = this.emitSeq(assert(plan.thenSeq), ctx);
        let elseStatements = plan.elseSeq != null ? this.emitSeq(assert(plan.elseSeq), ctx) : new Array<Statement>();
        let temp = ctx.freshTemp(range);
        let body = new Array<Statement>();
        // The condition is evaluated only on the normal path. On a resume it is
        // dispatched on the branch the resume point belongs to, which is also why
        // an await in a branch that did not run is harmless: nothing parked.
        body.push(Node.createVariableStatement(
          null,
          [ Node.createVariableDeclaration(
            Node.createIdentifierExpression(temp, range),
            null, CommonFlags.Let,
            typeNode("bool", range),
            Node.createFalseExpression(range),
            range
          ) ],
          range
        ));
        body.push(Node.createIfStatement(
          isZero(resumePointRead(ctx.stateName, range), range),
          Node.createBlockStatement([
            Node.createExpressionStatement(simpleAssign(temp, assert(plan.cond), range))
          ], range),
          Node.createBlockStatement([
            Node.createExpressionStatement(simpleAssign(
              temp,
              inRangeExpression(ctx.stateName, plan.thenSeq != null ? assert(plan.thenSeq).lo : 0,
                plan.thenSeq != null ? assert(plan.thenSeq).hi : 0, range),
              range
            ))
          ], range),
          range
        ));
        body.push(Node.createIfStatement(
          Node.createIdentifierExpression(temp, range),
          Node.createBlockStatement(thenStatements, range),
          elseStatements.length
            ? Node.createBlockStatement(elseStatements, range)
            : null,
          range
        ));
        out.push(Node.createIfStatement(
          enterGuard(ctx.stateName, plan.lo, plan.hi, range),
          Node.createBlockStatement(body, range),
          null,
          range
        ));
        return out;
      }
      case PlanKind.While: {
        if (plan.lo == 0) return guarded(rewriteReturns(node, ctx), ctx, range);
        let bodyStatements = this.emitSeq(assert(plan.body), ctx);
        // `resumePoint != 0 || cond`: a resumed pass enters the body without
        // re-evaluating the condition, then its continuation clears the point, so
        // the next iteration evaluates it normally.
        let condition = Node.createBinaryExpression(
          Token.Bar_Bar,
          notZero(resumePointRead(ctx.stateName, range), range),
          plan.cond != null ? plan.cond : Node.createTrueExpression(range),
          range
        );
        out.push(Node.createIfStatement(
          enterGuard(ctx.stateName, plan.lo, plan.hi, range),
          Node.createBlockStatement([
            Node.createWhileStatement(
              condition,
              Node.createBlockStatement(bodyStatements, range),
              range
            )
          ], range),
          null,
          range
        ));
        return out;
      }
      case PlanKind.For: {
        if (plan.lo == 0) return guarded(rewriteReturns(node, ctx), ctx, range);
        let bodyStatements = this.emitSeq(assert(plan.body), ctx);
        if (plan.incr != null) {
          bodyStatements.push(Node.createExpressionStatement(assert(plan.incr)));
        }
        let loopStatements = new Array<Statement>();
        if (plan.init != null) {
          // The initializer runs once, on the normal pass. A lifted loop variable
          // becomes an assignment (`rewriteStatement`), and its copy-in already
          // declared it at function scope.
          loopStatements.push(Node.createIfStatement(
            isZero(resumePointRead(ctx.stateName, range), range),
            Node.createBlockStatement(rewriteStatement(assert(plan.init), ctx), range),
            null,
            range
          ));
        }
        loopStatements.push(Node.createWhileStatement(
          Node.createBinaryExpression(
            Token.Bar_Bar,
            notZero(resumePointRead(ctx.stateName, range), range),
            plan.cond != null ? plan.cond : Node.createTrueExpression(range),
            range
          ),
          Node.createBlockStatement(bodyStatements, range),
          range
        ));
        out.push(Node.createIfStatement(
          enterGuard(ctx.stateName, plan.lo, plan.hi, range),
          Node.createBlockStatement(loopStatements, range),
          null,
          range
        ));
        return out;
      }
    }
    return out;
  }

  // --- expression walking --------------------------------------------------

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
      case NodeKind.Function: {
        let declaration = (<FunctionExpression>expression).declaration;
        if (declaration.isAsync) {
          this.refuse(parser, expression.range,
            declaration.arrowKind != ArrowKind.None
              ? MESSAGE_ASYNC_ARROW
              : MESSAGE_ASYNC_FUNCTION_EXPRESSION);
          return false;
        }
        // A plain function value is opaque here: its body is not part of this
        // state machine, and the closure transform has already rewritten any
        // capture it makes into environment accesses (`closures-plan.md` §8.2).
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

  /**
   * Lowers the `async` instance methods of a class body and answers the
   * top-level artifacts they need (the this-env class, the state class, the
   * resume function), in that order.
   *
   * A static async method is refused by name: `this` there is the class object,
   * not a receiver parameter, and there is no value the this-struct could hold.
   * The closure transform excludes static methods for the same reason
   * (closures plan §7.1a).
   */
  private lowerAsyncMethods(
    source: Source,
    classDeclaration: ClassDeclaration,
    declared: Array<string>,
    parser: Parser
  ): Statement[] {
    let out = new Array<Statement>();
    let members = classDeclaration.members;
    for (let i = 0, k = members.length; i < k; ++i) {
      let member = members[i];
      if (member.kind == NodeKind.MethodDeclaration) {
        let method = <MethodDeclaration>member;
        if (!method.isAsync) continue;
        if (method.is(CommonFlags.Static)) {
          this.refuse(parser, method.range, "async static methods (async lowering)", method);
          continue;
        }
        if (method.body == null) continue;
        let artifacts = this.lowerAsyncFunction(
          source, method, declared, parser, out,
          typeNode(classDeclaration.name.text, method.range)
        );
        if (artifacts) {
          // The method stays a class member — it *is* the entry, rewritten in
          // place. Everything else is a top-level element.
          for (let j = 0, l = artifacts.length; j < l; ++j) {
            if (artifacts[j] !== method) out.push(artifacts[j]);
          }
        }
      } else if (member.kind == NodeKind.FieldDeclaration) {
        let initializer = (<FieldDeclaration>member).initializer;
        if (initializer) this.refuseAsyncFunctionExpression(initializer, parser);
      }
    }
    return out;
  }

  /** Refuses an async function expression or arrow where one can be written. */
  private refuseAsyncFunctionExpression(expression: Expression, parser: Parser): void {
    if (expression.kind != NodeKind.Function) return;
    let declaration = (<FunctionExpression>expression).declaration;
    if (!declaration.isAsync) return;
    this.refuse(parser, declaration.range,
      declaration.arrowKind != ArrowKind.None
        ? MESSAGE_ASYNC_ARROW
        : MESSAGE_ASYNC_FUNCTION_EXPRESSION,
      expression
    );
  }

  /**
   * Reports `Not implemented: <what>` and answers `null`.
   *
   * Also records the *construct* the refusal aborts — `construct` when the call
   * site names one, otherwise the declaration being lowered — so the validation
   * walk can skip it. The record is keyed by the construct's start, never the
   * diagnostic's: the optional/rest-parameter refusal and the omitted-return-type
   * refusal report at a parameter or declaration *name*, which is where the user
   * should look, and a walk keyed on the diagnostic range would miss them and
   * report the same construct twice.
   */
  private refuse(parser: Parser, range: Range, what: string, construct: Node | null = null): null {
    let node = construct != null ? construct : this.currentConstruct;
    if (node != null) this.recordRefusalStart(node.range.source, node.range.start);
    else this.recordRefusalStart(range.source, range.start);
    parser.error(DiagnosticCode.Not_implemented_0, range, what);
    return null;
  }

  /** Records one construct start as already reported (see `refusals`). */
  private recordRefusal(construct: Node): void {
    this.recordRefusalStart(construct.range.source, construct.range.start);
  }

  /** Records one start position for one source. */
  private recordRefusalStart(source: Source, start: i32): void {
    let refusals = this.refusals;
    if (refusals == null) {
      refusals = new Map();
      this.refusals = refusals;
    }
    let starts = refusals.get(source);
    if (starts == null) {
      starts = new Set();
      refusals.set(source, starts);
    }
    starts.add(start);
  }
}

// --- plans -----------------------------------------------------------------

/** What a planned statement is. */
const enum PlanKind {
  /** A leaf: an ordinary statement, or one that awaits directly. */
  Plain,
  /** A `{ ... }` block. */
  Block,
  /** An `if`/`else`. */
  If,
  /** A `while` loop. */
  While,
  /** A `for` loop, emitted as a `while` plus initializer and incrementor. */
  For
}

/** A planned statement: a leaf, or a construct with planned children. */
class Plan {
  kind: PlanKind = PlanKind.Plain;
  /** Discriminator range of the awaits in this subtree (`0` when none). */
  lo: i32 = 0;
  hi: i32 = 0;
  /** The direct await, when this statement is one of the four positions. */
  info: AwaitInfo | null = null;
  /** References evaluated before the suspension (the operand alone). */
  before: NameSet = new NameSet();
  /** References evaluated after it — or all of them, when there is no direct await. */
  after: NameSet = new NameSet();
  /** Every reference in the subtree. */
  all: NameSet = new NameSet();
  // structure
  statements: PlanSeq | null = null; // Block
  cond: Expression | null = null;    // If, While, For
  thenSeq: PlanSeq | null = null;    // If
  elseSeq: PlanSeq | null = null;    // If
  body: PlanSeq | null = null;       // While, For
  init: Statement | null = null;     // For
  incr: Expression | null = null;    // For
  /** The declarators this statement introduces, when it is a declaration. */
  declarations: Array<VariableDeclaration> = new Array();
  /**
   * Whether this is a nested function declaration in disguise. AS parses
   * `function inner() {}` inside a function body as an *expression statement*
   * whose expression is a `FunctionExpression` (measured: kind 40 wrapping
   * kind 15), not as a `FunctionDeclaration` — and such a statement is hoisted,
   * so it is emitted unguarded.
   */
  nestedFunction: bool = false;
  range: Range;

  constructor(
    /** The source statement. */
    public node: Statement
  ) {
    this.range = node.range;
  }
}

/** A planned statement list. */
class PlanSeq {
  plans: Array<Plan> = new Array();
  /** Discriminator range of the awaits in this sequence (`0` when none). */
  lo: i32 = 0;
  hi: i32 = 0;

  add(plan: Plan): void {
    if (plan.lo != 0) {
      if (this.lo == 0 || plan.lo < this.lo) this.lo = plan.lo;
      if (plan.hi > this.hi) this.hi = plan.hi;
    }
    this.plans.push(plan);
  }

}

/** The discriminator counter of one async function. */
class PlanCursor {
  next: i32 = 1;
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
    /** Ordinal within the function (informational). */
    public ordinal: i32
  ) {}
}

/** Identifier references, split by position. */
class NameSet {
  reads: Set<string> = new Set();
  writes: Set<string> = new Set();
}

/** Per-function emission state. */
class EmitContext {
  private tempCount: i32 = 0;
  constructor(
    /** What is lifted (for the copy-out). */
    public lifting: Lifting,
    /** The resume function's state parameter name. */
    public stateName: string,
    /** The terminal resume point (`N+1`). */
    public terminal: i32,
    /** Whether the function returns a value. */
    public returnsValue: bool,
    /** Every local name in the body, so a temp never shadows one. */
    public localNames: Set<string>
  ) {}

  /** A fresh temporary name for an `if`'s condition. */
  freshTemp(range: Range): string {
    let name = COND_TEMP_PREFIX;
    while (this.localNames.has(name)) {
      name = COND_TEMP_PREFIX + (++this.tempCount).toString();
    }
    this.localNames.add(name); // the next one gets a suffix
    return name;
  }
}

// --- helpers ---------------------------------------------------------------

/** Adds every member of `source` to `target`. */
function addAll(target: Set<string>, source: Set<string>): void {
  source.forEach((value: string): void => { target.add(value); });
}

/** The union of two name sets, as a new set. */
function unionOf(a: NameSet, b: NameSet): NameSet {
  let out = new NameSet();
  addAll(out.reads, a.reads);
  addAll(out.writes, a.writes);
  addAll(out.reads, b.reads);
  addAll(out.writes, b.writes);
  return out;
}

/** Every reference in a planned sequence. */
function refsOfSeq(seq: PlanSeq): NameSet {
  let out = new NameSet();
  let plans = seq.plans;
  for (let i = 0, k = plans.length; i < k; ++i) {
    addAll(out.reads, plans[i].all.reads);
    addAll(out.writes, plans[i].all.writes);
  }
  return out;
}

/** The smaller of two sequences' first discriminators, `0` for "none". */
function minLo(a: PlanSeq | null, b: PlanSeq | null): i32 {
  let lo = 0;
  if (a != null && a.lo != 0) lo = a.lo;
  if (b != null && b.lo != 0 && (lo == 0 || b.lo < lo)) lo = b.lo;
  return lo;
}

/** The larger of two sequences' last discriminators. */
function maxHi(a: PlanSeq | null, b: PlanSeq | null): i32 {
  let hi = 0;
  if (a != null && a.hi > hi) hi = a.hi;
  if (b != null && b.hi > hi) hi = b.hi;
  return hi;
}

/** Every `$awaited<K>` field a planned sequence needs. */
function collectAwaitFields(seq: PlanSeq, into: Array<string>): void {
  let plans = seq.plans;
  for (let i = 0, k = plans.length; i < k; ++i) {
    let plan = plans[i];
    if (plan.info != null) into.push(assert(plan.info).fieldName);
    if (plan.statements != null) collectAwaitFields(assert(plan.statements), into);
    if (plan.thenSeq != null) collectAwaitFields(assert(plan.thenSeq), into);
    if (plan.elseSeq != null) collectAwaitFields(assert(plan.elseSeq), into);
    if (plan.body != null) collectAwaitFields(assert(plan.body), into);
  }
}

/** Every name written anywhere in a planned sequence. */
function collectWrites(seq: PlanSeq, into: Set<string>): void {
  let plans = seq.plans;
  for (let i = 0, k = plans.length; i < k; ++i) {
    let plan = plans[i];
    addAll(into, plan.all.writes);
    addAll(into, plan.before.writes);
    if (plan.statements != null) collectWrites(assert(plan.statements), into);
    if (plan.thenSeq != null) collectWrites(assert(plan.thenSeq), into);
    if (plan.elseSeq != null) collectWrites(assert(plan.elseSeq), into);
    if (plan.body != null) collectWrites(assert(plan.body), into);
  }
}

/** Every `AwaitInfo` a planned sequence holds. */
function collectAwaitInfos(seq: PlanSeq, into: Array<AwaitInfo>): void {
  let plans = seq.plans;
  for (let i = 0, k = plans.length; i < k; ++i) {
    let plan = plans[i];
    if (plan.info != null) into.push(assert(plan.info));
    if (plan.statements != null) collectAwaitInfos(assert(plan.statements), into);
    if (plan.thenSeq != null) collectAwaitInfos(assert(plan.thenSeq), into);
    if (plan.elseSeq != null) collectAwaitInfos(assert(plan.elseSeq), into);
    if (plan.body != null) collectAwaitInfos(assert(plan.body), into);
  }
}

/** Whether a sequence's last statement is a `return`. */
function endsWithReturn(seq: PlanSeq): bool {
  let plans = seq.plans;
  if (!plans.length) return false;
  let last = plans[plans.length - 1];
  return last.kind == PlanKind.Plain && last.node.kind == NodeKind.Return;
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

/** Every local name declared anywhere in `statement`, for temp naming. */
/**
 * Collects the environment locals read by closure creations in `statements`,
 * recursively. The closure transform's side table names them (`creationEnvOf`).
 */
function collectCreationEnvNames(statements: Statement[], into: Set<string>): void {
  for (let i = 0, k = statements.length; i < k; ++i) {
    let statement = statements[i];
    switch (statement.kind) {
      case NodeKind.Expression: {
        let expression = (<ExpressionStatement>statement).expression;
        if (expression.kind == NodeKind.Function) {
          let env = creationEnvOf.get(<FunctionExpression>expression);
          if (env != null) into.add(env);
        }
        break;
      }
      case NodeKind.Variable: {
        let declarations = (<VariableStatement>statement).declarations;
        for (let j = 0, l = declarations.length; j < l; ++j) {
          let initializer = declarations[j].initializer;
          if (initializer != null && initializer.kind == NodeKind.Function) {
            let env = creationEnvOf.get(<FunctionExpression>initializer);
            if (env != null) into.add(env);
          }
        }
        break;
      }
      case NodeKind.Block: {
        collectCreationEnvNames((<BlockStatement>statement).statements, into);
        break;
      }
      case NodeKind.If: {
        let ifs = <IfStatement>statement;
        collectCreationEnvNames([ ifs.ifTrue ], into);
        if (ifs.ifFalse != null) collectCreationEnvNames([ ifs.ifFalse ], into);
        break;
      }
      case NodeKind.While: {
        collectCreationEnvNames([ (<WhileStatement>statement).body ], into);
        break;
      }
      case NodeKind.Do: {
        collectCreationEnvNames([ (<DoStatement>statement).body ], into);
        break;
      }
      case NodeKind.For: {
        let loop = <ForStatement>statement;
        if (loop.initializer != null) collectCreationEnvNames([ loop.initializer ], into);
        collectCreationEnvNames([ loop.body ], into);
        break;
      }
      default: break;
    }
  }
}

/** Lifts every declaration in `statements` whose name is in `names`. */
function liftDeclarationsNamed(
  statements: Statement[],
  names: Set<string>,
  lifting: Lifting
): void {
  for (let i = 0, k = statements.length; i < k; ++i) {
    let statement = statements[i];
    switch (statement.kind) {
      case NodeKind.Variable: {
        let declarations = (<VariableStatement>statement).declarations;
        for (let j = 0, l = declarations.length; j < l; ++j) {
          let declaration = declarations[j];
          let name = declaration.name.text;
          if (!names.has(name) || lifting.hasLocal(name)) continue;
          let type = declaration.type;
          if (type == null) continue; // the creation env always has one
          lifting.liftLocal(name, type, declaration);
        }
        break;
      }
      case NodeKind.Block: {
        liftDeclarationsNamed((<BlockStatement>statement).statements, names, lifting);
        break;
      }
      case NodeKind.If: {
        let ifs = <IfStatement>statement;
        liftDeclarationsNamed([ ifs.ifTrue ], names, lifting);
        if (ifs.ifFalse != null) liftDeclarationsNamed([ ifs.ifFalse ], names, lifting);
        break;
      }
      default: break;
    }
  }
}

function collectLocalNames(statement: Statement, into: Set<string>): void {
  switch (statement.kind) {
    case NodeKind.Block: {
      let statements = (<BlockStatement>statement).statements;
      for (let i = 0, k = statements.length; i < k; ++i) collectLocalNames(statements[i], into);
      break;
    }
    case NodeKind.If: {
      let ifs = <IfStatement>statement;
      collectLocalNames(ifs.ifTrue, into);
      if (ifs.ifFalse != null) collectLocalNames(assert(ifs.ifFalse), into);
      break;
    }
    case NodeKind.While: {
      collectLocalNames((<WhileStatement>statement).body, into);
      break;
    }
    case NodeKind.For: {
      let loop = <ForStatement>statement;
      if (loop.initializer != null) collectLocalNames(assert(loop.initializer), into);
      collectLocalNames(loop.body, into);
      break;
    }
    case NodeKind.Variable: {
      let declarations = (<VariableStatement>statement).declarations;
      for (let i = 0, k = declarations.length; i < k; ++i) into.add(declarations[i].name.text);
      break;
    }
    default: break;
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
      let declarations = (<VariableStatement>statement).declarations;
      return declarations.length ? declarations[0].name.text : null;
    }
    default: {
      return null;
    }
  }
}

/** `let <name> = <state>.<name>;` for a lifted binding's copy-in. */
function copyIn(name: string, range: Range, stateName: string): Statement {
  return Node.createVariableStatement(
    null,
    [
      Node.createVariableDeclaration(
        Node.createIdentifierExpression(name, range),
        null, CommonFlags.Let,
        null,
        Node.createPropertyAccessExpression(
          Node.createIdentifierExpression(stateName, range),
          Node.createIdentifierExpression(name, range),
          range
        ),
        range
      )
    ],
    range
  );
}

/**
 * A statement as the resume function carries it: `return`s become the terminal
 * write (§4.1), a declaration of a lifted local becomes an assignment (§4.3),
 * everything else is verbatim.
 */
function rewriteStatement(statement: Statement, ctx: EmitContext): Array<Statement> {
  let stateName = ctx.stateName;
  if (statement.kind == NodeKind.Return) {
    let returnStatement = <ReturnStatement>statement;
    let value = returnStatement.value;
    let range = returnStatement.range;
    let out = new Array<Statement>();
    if (value != null) {
      if (ctx.returnsValue) {
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
      resumePointWrite(stateName, intLiteral(ctx.terminal, range), range)
    ));
    out.push(Node.createReturnStatement(null, range));
    return out;
  }
  if (statement.kind == NodeKind.Variable) {
    let declarations = (<VariableStatement>statement).declarations;
    let lifted: bool = false;
    for (let i = 0, k = declarations.length; i < k; ++i) {
      if (ctx.lifting.hasLocal(declarations[i].name.text)) { lifted = true; break; }
    }
    if (!lifted) return [ statement ]; // a plain local: nothing changes
    // A lifted local already exists — the copy-in declared it at function scope.
    // Its declarator becomes an assignment, in source order; declarators that were
    // not lifted keep their declaration (a mixed `let a = 1, b = 2;` stays
    // ordered).
    let out = new Array<Statement>();
    for (let i = 0, k = declarations.length; i < k; ++i) {
      let declaration = declarations[i];
      if (!ctx.lifting.hasLocal(declaration.name.text)) {
        out.push(Node.createVariableStatement(null, [ declaration ], declaration.range));
        continue;
      }
      let initializer = declaration.initializer;
      if (initializer != null) {
        // `let v: T = expr;` → `v = expr;`. The await-bearing declarator keeps
        // its `await` node in place, which is what codegen reads (§4.7.4).
        out.push(Node.createExpressionStatement(
          simpleAssign(declaration.name.text, initializer, declaration.range)
        ));
      }
    }
    return out;
  }
  return [ statement ];
}

/** A construct as the resume carries it when it holds no await of its own. */
function rewriteReturns(statement: Statement, ctx: EmitContext): Statement {
  switch (statement.kind) {
    case NodeKind.Block: {
      let block = <BlockStatement>statement;
      let out = new Array<Statement>();
      let statements = block.statements;
      for (let i = 0, k = statements.length; i < k; ++i) {
        let rewritten = rewriteReturns(statements[i], ctx);
        if (rewritten.kind == NodeKind.Block && statements[i].kind != NodeKind.Block) {
          // A return became several statements: splice them in.
          let inner = (<BlockStatement>rewritten).statements;
          for (let j = 0, l = inner.length; j < l; ++j) out.push(inner[j]);
        } else {
          out.push(rewritten);
        }
      }
      return Node.createBlockStatement(out, block.range);
    }
    case NodeKind.If: {
      let ifs = <IfStatement>statement;
      return Node.createIfStatement(
        ifs.condition,
        rewriteReturns(ifs.ifTrue, ctx),
        ifs.ifFalse != null ? rewriteReturns(assert(ifs.ifFalse), ctx) : null,
        ifs.range
      );
    }
    case NodeKind.While: {
      let loop = <WhileStatement>statement;
      return Node.createWhileStatement(loop.condition, rewriteReturns(loop.body, ctx), loop.range);
    }
    case NodeKind.For: {
      let loop = <ForStatement>statement;
      return Node.createForStatement(
        loop.initializer, loop.condition, loop.incrementor,
        rewriteReturns(loop.body, ctx), loop.range
      );
    }
    case NodeKind.Return: {
      let statements = rewriteStatement(statement, ctx);
      return statements.length == 1
        ? statements[0]
        : Node.createBlockStatement(statements, statement.range);
    }
    default: {
      return statement;
    }
  }
}

/** A statement (or construct) plus its "is this pass normal" guard. */
function guarded(statement: Statement, ctx: EmitContext, range: Range): Array<Statement> {
  return [
    Node.createIfStatement(
      isZero(resumePointRead(ctx.stateName, range), range),
      Node.createBlockStatement([ statement ], range),
      null,
      range
    )
  ];
}

/** Appends every statement of `statements` to `target`. */
function pushAll(target: Array<Statement>, statements: Array<Statement>): void {
  for (let i = 0, k = statements.length; i < k; ++i) target.push(statements[i]);
}

/**
 * The copy-out at a suspension (§4.3): each lifted binding's current value into
 * its state-struct field.
 */
function copyOutStatements(lifting: Lifting, stateName: string, range: Range): Array<Statement> {
  let out = new Array<Statement>();
  let parameters = lifting.parameterNames;
  for (let i = 0, k = parameters.length; i < k; ++i) {
    let name = parameters[i];
    let nameRange = lifting.parameterRange(name);
    out.push(Node.createExpressionStatement(
      simpleAssignTo(
        Node.createPropertyAccessExpression(
          Node.createIdentifierExpression(stateName, nameRange),
          Node.createIdentifierExpression(name, nameRange),
          nameRange
        ),
        Node.createIdentifierExpression(name, nameRange),
        nameRange
      )
    ));
  }
  for (let i = 0, k = lifting.locals.length; i < k; ++i) {
    let lift = lifting.locals[i];
    let nameRange = lift.declaration.name.range;
    out.push(Node.createExpressionStatement(
      simpleAssignTo(
        Node.createPropertyAccessExpression(
          Node.createIdentifierExpression(stateName, nameRange),
          Node.createIdentifierExpression(lift.name, nameRange),
          nameRange
        ),
        Node.createIdentifierExpression(lift.name, nameRange),
        nameRange
      )
    ));
  }
  return out;
}

/** Why the node cannot be lowered, said in one line. */
function reasonFor(node: Node): string {
  switch (node.kind) {
    case NodeKind.Await: return "await in an unsupported position (async lowering)";
    case NodeKind.Function: {
      return (<FunctionExpression>node).declaration.isAsync
        ? MESSAGE_ASYNC_FUNCTION_EXPRESSION
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
  let names = new Set<string>();
  collectLocalNames(block, names);
  return names.has(name);
}

/**
 * The name the state local will get, without needing the parameter list twice:
 * `nameForState` depends only on the parameters and the body, and this call site
 * has both.
 */
function stateVarNameOf(block: BlockStatement, parameters: ParameterNode[]): string {
  return nameForState(parameters, block);
}

/**
 * Replaces every `this` in `statements` with `changetype<env>(state.$env).$this`.
 *
 * Nested function expressions are **not** descended into: their `this` binding is
 * their own (a regular function) or is supplied by the shipped `Receiver` path (an
 * arrow), and neither survives the move into a free resume function — the
 * resolver reports TS2332 for such an arrow, which names the real problem.
 */
function replaceThis(
  statements: Statement[],
  envName: string,
  stateName: string
): void {
  for (let i = 0, k = statements.length; i < k; ++i) {
    replaceThisInStatement(statements[i], envName, stateName);
  }
}

function replaceThisInStatement(
  statement: Statement,
  envName: string,
  stateName: string
): void {
  switch (statement.kind) {
    case NodeKind.Expression: {
      let expression = (<ExpressionStatement>statement).expression;
      (<ExpressionStatement>statement).expression =
        replaceThisInExpression(expression, envName, stateName);
      break;
    }
    case NodeKind.Return: {
      let value = (<ReturnStatement>statement).value;
      if (value != null) {
        (<ReturnStatement>statement).value = replaceThisInExpression(value, envName, stateName);
      }
      break;
    }
    case NodeKind.Variable: {
      let declarations = (<VariableStatement>statement).declarations;
      for (let i = 0, k = declarations.length; i < k; ++i) {
        let initializer = declarations[i].initializer;
        if (initializer != null) {
          declarations[i].initializer = replaceThisInExpression(initializer, envName, stateName);
        }
      }
      break;
    }
    case NodeKind.Block: {
      replaceThis((<BlockStatement>statement).statements, envName, stateName);
      break;
    }
    case NodeKind.If: {
      let ifs = <IfStatement>statement;
      ifs.condition = replaceThisInExpression(ifs.condition, envName, stateName);
      replaceThisInStatement(ifs.ifTrue, envName, stateName);
      if (ifs.ifFalse != null) replaceThisInStatement(ifs.ifFalse, envName, stateName);
      break;
    }
    case NodeKind.While: {
      let loop = <WhileStatement>statement;
      loop.condition = replaceThisInExpression(loop.condition, envName, stateName);
      replaceThisInStatement(loop.body, envName, stateName);
      break;
    }
    case NodeKind.Do: {
      let loop = <DoStatement>statement;
      replaceThisInStatement(loop.body, envName, stateName);
      loop.condition = replaceThisInExpression(loop.condition, envName, stateName);
      break;
    }
    case NodeKind.For: {
      let loop = <ForStatement>statement;
      if (loop.initializer != null) replaceThisInStatement(loop.initializer, envName, stateName);
      if (loop.condition != null) loop.condition = replaceThisInExpression(loop.condition, envName, stateName);
      if (loop.incrementor != null) loop.incrementor = replaceThisInExpression(loop.incrementor, envName, stateName);
      replaceThisInStatement(loop.body, envName, stateName);
      break;
    }
    case NodeKind.Switch: {
      let switchStatement = <SwitchStatement>statement;
      switchStatement.condition = replaceThisInExpression(switchStatement.condition, envName, stateName);
      let cases = switchStatement.cases;
      for (let i = 0, k = cases.length; i < k; ++i) {
        if (cases[i].label != null) {
          cases[i].label = replaceThisInExpression(assert(cases[i].label), envName, stateName);
        }
        replaceThis(cases[i].statements, envName, stateName);
      }
      break;
    }
    default: break;
  }
}

function replaceThisInExpression(
  expression: Expression,
  envName: string,
  stateName: string
): Expression {
  switch (expression.kind) {
    case NodeKind.This: {
      return Node.createPropertyAccessExpression(
        Node.createCallExpression(
          Node.createIdentifierExpression("changetype", expression.range),
          [ typeNode(envName, expression.range) ],
          [
            Node.createPropertyAccessExpression(
              Node.createIdentifierExpression(stateName, expression.range),
              Node.createIdentifierExpression(ENV_FIELD, expression.range),
              expression.range
            )
          ],
          expression.range
        ),
        Node.createIdentifierExpression(THIS_FIELD, expression.range),
        expression.range
      );
    }
    case NodeKind.Binary: {
      let binary = <BinaryExpression>expression;
      binary.left = replaceThisInExpression(binary.left, envName, stateName);
      binary.right = replaceThisInExpression(binary.right, envName, stateName);
      return binary;
    }
    case NodeKind.Call: {
      let call = <CallExpression>expression;
      call.expression = replaceThisInExpression(call.expression, envName, stateName);
      let args = call.args;
      for (let i = 0, k = args.length; i < k; ++i) {
        args[i] = replaceThisInExpression(args[i], envName, stateName);
      }
      return call;
    }
    case NodeKind.PropertyAccess: {
      let access = <PropertyAccessExpression>expression;
      access.expression = replaceThisInExpression(access.expression, envName, stateName);
      return access;
    }
    case NodeKind.Parenthesized: {
      let parenthesized = <ParenthesizedExpression>expression;
      parenthesized.expression = replaceThisInExpression(parenthesized.expression, envName, stateName);
      return parenthesized;
    }
    case NodeKind.UnaryPrefix: {
      let prefix = <UnaryPrefixExpression>expression;
      prefix.operand = replaceThisInExpression(prefix.operand, envName, stateName);
      return prefix;
    }
    case NodeKind.UnaryPostfix: {
      let postfix = <UnaryPostfixExpression>expression;
      postfix.operand = replaceThisInExpression(postfix.operand, envName, stateName);
      return postfix;
    }
    case NodeKind.ElementAccess: {
      let elementAccess = <ElementAccessExpression>expression;
      elementAccess.expression = replaceThisInExpression(elementAccess.expression, envName, stateName);
      elementAccess.elementExpression = replaceThisInExpression(elementAccess.elementExpression, envName, stateName);
      return elementAccess;
    }
    case NodeKind.Ternary: {
      let ternary = <TernaryExpression>expression;
      ternary.condition = replaceThisInExpression(ternary.condition, envName, stateName);
      ternary.ifThen = replaceThisInExpression(ternary.ifThen, envName, stateName);
      ternary.ifElse = replaceThisInExpression(ternary.ifElse, envName, stateName);
      return ternary;
    }
    case NodeKind.Comma: {
      let comma = <CommaExpression>expression;
      let expressions = comma.expressions;
      for (let i = 0, k = expressions.length; i < k; ++i) {
        expressions[i] = replaceThisInExpression(expressions[i], envName, stateName);
      }
      return comma;
    }
    case NodeKind.New: {
      let newExpression = <NewExpression>expression;
      let args = newExpression.args;
      for (let i = 0, k = args.length; i < k; ++i) {
        args[i] = replaceThisInExpression(args[i], envName, stateName);
      }
      return newExpression;
    }
    case NodeKind.InstanceOf: {
      let instanceOf = <InstanceOfExpression>expression;
      instanceOf.expression = replaceThisInExpression(instanceOf.expression, envName, stateName);
      return instanceOf;
    }
    case NodeKind.Assertion: {
      let assertion = <AssertionExpression>expression;
      assertion.expression = replaceThisInExpression(assertion.expression, envName, stateName);
      return assertion;
    }
    case NodeKind.Await: {
      let awaitNode = <AwaitExpression>expression;
      awaitNode.operand = replaceThisInExpression(awaitNode.operand, envName, stateName);
      return awaitNode;
    }
    default:
      // Includes `NodeKind.Function`: a nested function's `this` is its own.
      return expression;
  }
}

/** State-struct members a parameter or local must not be named. */
function isReservedStateField(name: string): bool {
  if (
    name == RESUME_POINT_FIELD ||
    name == RESULT_FIELD ||
    name == HANDLE_FIELD ||
    name == ENV_FIELD ||
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

/** The state struct's per-await field, addressed by the state's *name*. */
function awaitedFieldOf(stateName: string, fieldName: string, range: Range): Expression {
  return awaitedField(Node.createIdentifierExpression(stateName, range), fieldName, range);
}

/** The same field, for the compiler's side table (a fresh node, not in the tree). */
function awaitedFieldExpression(stateName: string, fieldName: string, range: Range): Expression {
  return awaitedFieldOf(stateName, fieldName, range);
}

/** The state struct's resume-point field, as an expression. */
function resumePointRead(stateName: string, range: Range): Expression {
  return Node.createPropertyAccessExpression(
    Node.createIdentifierExpression(stateName, range),
    Node.createIdentifierExpression(RESUME_POINT_FIELD, range),
    range
  );
}

/** `state.resumePoint = value`. */
function resumePointWrite(stateName: string, value: Expression, range: Range): Expression {
  return Node.createBinaryExpression(
    Token.Equals,
    resumePointRead(stateName, range),
    value,
    range
  );
}

/**
 * The guard that admits a construct: normal flow, or a resume into one of the
 * await discriminators in its own subtree.
 */
function enterGuard(stateName: string, lo: i32, hi: i32, range: Range): Expression {
  if (lo == 0) return isZero(resumePointRead(stateName, range), range);
  return Node.createBinaryExpression(
    Token.Bar_Bar,
    isZero(resumePointRead(stateName, range), range),
    inRangeExpression(stateName, lo, hi, range),
    range
  );
}

/** `resumePoint >= lo && resumePoint <= hi` — the construct's own range. */
function inRangeExpression(stateName: string, lo: i32, hi: i32, range: Range): Expression {
  if (lo == 0) return Node.createFalseExpression(range);
  return Node.createBinaryExpression(
    Token.Ampersand_Ampersand,
    Node.createBinaryExpression(
      Token.GreaterThan_Equals,
      resumePointRead(stateName, range),
      intLiteral(lo, range),
      range
    ),
    Node.createBinaryExpression(
      Token.LessThan_Equals,
      resumePointRead(stateName, range),
      intLiteral(hi, range),
      range
    ),
    range
  );
}

/** `expr == 0`. */
function isZero(expr: Expression, range: Range): Expression {
  return Node.createBinaryExpression(Token.Equals_Equals, expr, intLiteral(0, range), range);
}

/** `expr != 0`. */
function notZero(expr: Expression, range: Range): Expression {
  return Node.createBinaryExpression(Token.Exclamation_Equals, expr, intLiteral(0, range), range);
}

/** `a == b`. */
function equals(a: Expression, b: Expression, range: Range): Expression {
  return Node.createBinaryExpression(Token.Equals_Equals, a, b, range);
}

/** `<name> = <value>`, with the target an identifier. */
function simpleAssign(name: string, value: Expression, range: Range): Expression {
  return simpleAssignTo(Node.createIdentifierExpression(name, range), value, range);
}

/** `<target> = <value>`. */
function simpleAssignTo(target: Expression, value: Expression, range: Range): Expression {
  return Node.createBinaryExpression(Token.Equals, target, value, range);
}

/** `changetype<T>(0)` — a zero of any type, value or reference. */
function changetypeZero(type: TypeNode, range: Range): Expression {
  return Node.createCallExpression(
    Node.createIdentifierExpression("changetype", range),
    [ type ],
    [ intLiteral(0, range) ],
    range
  );
}

/** Whether the parser produced the empty type node of an omitted annotation. */
function isOmittedTypeNode(type: TypeNode): bool {
  return type.kind == NodeKind.NamedType && (<NamedTypeNode>type).name.identifier.text == "";
}

/** A local the lowering lifted into the state struct (§4.3). */
class LiftedLocal {
  constructor(
    /** The declared name. */
    public name: string,
    /** The declared type — the field's type. */
    public type: TypeNode,
    /** The declaration that introduced it, for ranges. */
    public declaration: VariableDeclaration
  ) {}
}

/**
 * What the lifting analysis decided for one async function (§4.3, §4.4): which
 * locals live in the state struct, and which parameters need their writes
 * carried across a suspension.
 *
 * `this` and captured bindings are **not** here, by §4.4's single-storage rule:
 * a captured binding's storage is the environment, and the state struct will
 * reference the environment rather than copy the binding. Closures and async
 * methods are both refused, so no path supplies `this` today — the rule is
 * stated and currently unreachable.
 */
class Lifting {
  /** Locals lifted into the state struct, in declaration order. */
  locals: Array<LiftedLocal> = new Array();
  /** Parameters whose writes must survive a suspension. */
  parameters: Set<string> = new Set();
  /** Parameter names in declaration order (for stable copy-out output). */
  parameterNames: Array<string> = new Array();
  /** Ranges by parameter name, for node construction. */
  private parameterRanges: Map<string, Range> = new Map();

  /** Records a lifted parameter. */
  liftParameter(name: string, range: Range): void {
    if (!this.parameters.has(name)) {
      this.parameters.add(name);
      this.parameterNames.push(name);
      this.parameterRanges.set(name, range);
    }
  }

  /** The range a lifted parameter was declared at. */
  parameterRange(name: string): Range {
    return assert(this.parameterRanges.get(name));
  }

  /** Records a lifted local. */
  liftLocal(name: string, type: TypeNode, declaration: VariableDeclaration): void {
    if (this.hasLocal(name)) return;
    this.locals.push(new LiftedLocal(name, type, declaration));
  }

  /** Whether `name` is a lifted local. */
  hasLocal(name: string): bool {
    for (let i = 0, k = this.locals.length; i < k; ++i) {
      if (this.locals[i].name == name) return true;
    }
    return false;
  }
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
