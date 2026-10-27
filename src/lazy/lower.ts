/**
 * The `@lazy await EXPR` lowering: a deferred await, memoized per binding.
 *
 * ## Why this is an AST transform and the synchronous form is not
 *
 * `@lazy EXPR` without an `await` is lowered by the compiler (`compileLazyLocal`
 * in `compiler.ts`): it allocates the two cells and emits the guard at each read,
 * because at compile time the type of an unannotated initializer is known.
 *
 * The awaited form cannot be lowered there. `await` is a state transition of the
 * *enclosing* function's state machine — it sets `resumePoint`, parks, and
 * returns — so the suspension has to be planned by `src/async/lower.ts`, which
 * runs on the AST before resolution. A value cell that crosses a suspension
 * becomes a field of the state struct, and a state field needs a *syntactic*
 * type. So this transform rewrites the declaration into a shape the async
 * transform already knows how to lower, and lets it do the rest.
 *
 * ## The shape
 *
 * ```
 * let b: T = @lazy await f();          // the source
 *
 * let b$done = false;                  // the first-read flag
 * let b: T;                            // the value cell
 * if (!b$done) {                       // inserted before each statement that reads b
 *   b = await f();
 *   b$done = true;
 * }
 * ```
 *
 * Every piece of that is a shape the compiler already handles:
 *
 * - `b = await f()` is an await in *assignment* position (`§4.7.4`'s four
 *   positions include it);
 * - the `if` body contains the await, and an `if` with an await in its body is
 *   planned like any other construct;
 * - `b` and `b$done` are ordinary locals declared before the await, so the async
 *   transform lifts them into state fields and copies them in and out around the
 *   park — exactly the lifting every other cross-await local gets.
 *
 * Measured end to end before this file existed: the hand-written shape compiles
 * and runs, `f` called once for two reads (`7 + 100` — the counter proves it),
 * because the second guard's flag is already set.
 *
 * ## Why a guard per *statement* and not per read
 *
 * A read can sit anywhere inside an expression, and the guard is a statement.
 * Putting one before each *containing statement* covers every read in it with a
 * single test, and it terminates: the guard is idempotent, so an extra one is a
 * no-op. The alternative — a guard per read — would need a temporary and a
 * sequence expression at each read, which is a larger change to the expression
 * pipeline for no observable difference.
 *
 * The same idempotence is what makes the read *detection* allowed to be
 * approximate in one direction: over-inserting is harmless, under-inserting
 * reads an uninitialized cell. The walker below is therefore written to reach
 * every statement-list-bearing construct, and it refuses by name the two things
 * it cannot place — a binding with no declared type, and a binding read from a
 * nested function (which is a *capture*, and the closure transform owns those).
 *
 * ## Order
 *
 * Runs **before** the closure transform and before the async transform
 * (`src/transforms.ts`): the cells it synthesizes are ordinary locals, so the
 * closure transform sees them like any other, and the awaits it synthesizes are
 * planned by the async transform. Both directions are needed.
 */

import { Parser } from "../parser";
import { CommonFlags } from "../common";
import { Program } from "../program";
import { DiagnosticCode, Range } from "../diagnostics";
import { Token } from "../tokenizer";
import { getMapEntry } from "../util/collections";
import {
  AwaitExpression,
  DoStatement,
  ExportDefaultStatement,
  NamespaceDeclaration,
  TernaryExpression,
  BinaryExpression,
  BlockStatement,
  CallExpression,
  ClassDeclaration,
  CommaExpression,
  ElementAccessExpression,
  Expression,
  ExpressionStatement,
  ForOfStatement,
  ForStatement,
  FunctionDeclaration,
  FunctionExpression,
  IdentifierExpression,
  IfStatement,
  InstanceOfExpression,
  LazyExpression,
  NewExpression,
  Node,
  NodeKind,
  ParenthesizedExpression,
  PropertyAccessExpression,
  ReturnStatement,
  Statement,
  SwitchStatement,
  ThrowStatement,
  TryStatement,
  UnaryPostfixExpression,
  UnaryPrefixExpression,
  VariableDeclaration,
  VariableStatement,
  VoidStatement,
  WhileStatement,
  AssertionExpression
} from "../ast";

/** The suffix of the synthesized first-read flag. Reserved by the transforms. */
const DONE_SUFFIX = "$lazyDone";

/** The suffix of the synthesized task cell for `@lazy await spawn(...)`. */
const TASK_SUFFIX = "$lazyTask";

/** The marker that makes a call escape `@lazy`'s deferral. */
const SPAWN_MARKER = "spawn";

/** One `@lazy await` binding being lowered, as the walk carries it. */
class PendingLazyAwait {
  constructor(
    /** The binding's source name. */
    public name: string,
    /** The synthesized flag's name. */
    public doneName: string,
    /** The expression awaited at the first read (`f()` in `@lazy await f()`). */
    public awaitOperand: Expression,
    /** The declaration that introduced it, whose type node the cells reuse. */
    public declaration: VariableDeclaration,
    /** Where to report a capture. */
    public range: Range
  ) {
  }

  /** The hoisted task cell's name, when the operand was a `spawn`. */
  taskName: string | null = null;

  /** The call that fills the task cell at the declaration. */
  taskCall: CallExpression | null = null;
}

export class LazyAwaitTransform {

  /** The program being compiled. Assigned by `applyInTreeTransforms`. */
  program!: Program;

  /** The parser, for reporting. */
  private parser!: Parser;

  /**
   * `Transform#afterParse`: rewrite every `@lazy await` declaration in every
   * function body of every non-library source.
   *
   * A program with no `@lazy await` is untouched — nothing is allocated, nothing
   * is rewritten — so byte identity for such a program holds by construction.
   */
  afterParse(parser: Parser): void {
    this.parser = parser;
    let sources = this.program.sources;
    for (let i = 0, k = sources.length; i < k; ++i) {
      let source = sources[i];
      if (source.isLibrary) continue;
      this.walkFunctions(source.statements);
    }
  }

  /** Finds every function body in a statement list and rewrites it. */
  private walkFunctions(statements: Statement[]): void {
    for (let i = 0, k = statements.length; i < k; ++i) {
      let statement = statements[i];
      switch (statement.kind) {
        case NodeKind.FunctionDeclaration: {
          this.rewriteBodyStatement((<FunctionDeclaration>statement).body);
          break;
        }
        case NodeKind.ClassDeclaration: {
          let members = (<ClassDeclaration>statement).members;
          if (members != null) {
            for (let j = 0, l = members.length; j < l; ++j) {
              let member = members[j];
              if (
                member.kind == NodeKind.MethodDeclaration ||
                member.kind == NodeKind.FunctionDeclaration
              ) {
                this.rewriteBodyStatement((<FunctionDeclaration>member).body);
              }
            }
          }
          break;
        }
        case NodeKind.NamespaceDeclaration: {
          this.walkFunctions((<NamespaceDeclaration>statement).members);
          break;
        }
        case NodeKind.ExportDefault: {
          let declaration = (<ExportDefaultStatement>statement).declaration;
          if (declaration != null) this.walkFunctions([ declaration ]);
          break;
        }
        default: break;
      }
    }
  }

  /** Rewrites a body whose static type is `Statement` (a function's body). */
  private rewriteBodyStatement(body: Statement | null): void {
    if (body == null || body.kind != NodeKind.Block) return;
    this.rewriteBody(<BlockStatement>body);
  }

  /** Rewrites one function body, then the nested functions inside it. */
  private rewriteBody(body: BlockStatement | null): void {
    if (body == null) return;
    let statements = body.statements;
    body.statements = this.rewriteList(statements, new Map<string, PendingLazyAwait>());
    // Nested function *declarations* are new scopes; function *expressions* are
    // reached through the statement walk, which processes their bodies where it
    // finds them (`collectOwnReads` refuses a capture rather than descending).
    this.walkFunctions(body.statements);
    this.rewriteNestedFunctionExpressions(body.statements);
  }

  /**
   * Rewrites a statement list: splits `@lazy await` declarations into a flag and
   * a cell, and inserts a guard before every statement that reads one.
   */
  private rewriteList(
    statements: Statement[],
    pending: Map<string, PendingLazyAwait>
  ): Statement[] {
    let out = new Array<Statement>();
    for (let i = 0, k = statements.length; i < k; ++i) {
      let statement = statements[i];

      // W3 / the `spawn` marker outside `@lazy`. `spawn(f)` is `f(...)` with a
      // marker; the marker means "this is a launch", and its only uses are the
      // escape inside `@lazy await` (handled in `rewriteDeclaration`) and a
      // plain eager launch. At statement position the resulting Task is
      // discarded, which is what the warning says.
      if (statement.kind == NodeKind.Expression) {
        let expressionStatement = <ExpressionStatement>statement;
        let expression = expressionStatement.expression;
        if (isSpawnCall(expression)) {
          this.parser.warning(
            DiagnosticCode.A_spawn_produces_a_Task_this_one_is_never_awaited_so_the_task_s_result_is_discarded,
            expression.range
          );
          let target = spawnTarget(<CallExpression>expression);
          if (target != null) expressionStatement.expression = target;
        }
      } else if (statement.kind == NodeKind.Variable) {
        // A marker around a declaration's initializer is just the call; whether
        // the binding is later awaited is the read walk's question, not this
        // one's, and it is a follow-up (see the PR body).
        let declarations = (<VariableStatement>statement).declarations;
        for (let j = 0, l = declarations.length; j < l; ++j) {
          let initializer = declarations[j].initializer;
          if (initializer != null && isSpawnCall(initializer)) {
            let target = spawnTarget(<CallExpression>initializer);
            if (target != null) declarations[j].initializer = target;
          }
        }
      }

      // A declaration this list introduces.
      if (statement.kind == NodeKind.Variable) {
        let replaced = this.rewriteDeclaration(<VariableStatement>statement, pending);
        if (replaced != null) {
          for (let j = 0, l = replaced.length; j < l; ++j) out.push(replaced[j]);
          continue;
        }
      }

      // A compound statement: recurse into its bodies first, so a read in a
      // branch or a loop body gets its guard *there* rather than before the
      // construct (which would evaluate the initializer on a path that never
      // reads it).
      this.recurseInto(statement, pending);

      // Then this statement's own expressions.
      let reads = this.collectOwnReads(statement, pending, new Array<string>());
      for (let j = 0, l = reads.length; j < l; ++j) {
        out.push(this.makeGuard(assert(getMapEntry(pending, reads[j])), statement.range));
      }
      out.push(statement);
    }
    return out;
  }

  /**
   * Rewrites a `let b: T = @lazy await f();` declaration into the flag + cell
   * pair, and records it as pending. Answers `null` for anything else.
   */
  private rewriteDeclaration(
    statement: VariableStatement,
    pending: Map<string, PendingLazyAwait>
  ): Statement[] | null {
    let declarations = statement.declarations;
    let rewritten: VariableDeclaration | null = null;
    let pendingEntry: PendingLazyAwait | null = null;
    for (let i = 0, k = declarations.length; i < k; ++i) {
      let declaration = declarations[i];
      let initializer = declaration.initializer;
      if (initializer == null || initializer.kind != NodeKind.Lazy) continue;
      let lazy = <LazyExpression>initializer;
      if (lazy.expression.kind != NodeKind.Await) continue; // sync form: the compiler's
      if (declarations.length != 1) {
        // A mixed `let a = 1, b = @lazy await f();` would have to split the
        // statement; refused rather than silently mis-lowered.
        this.parser.error(
          DiagnosticCode.Not_implemented_0,
          declaration.range,
          "a '@lazy await' binding in a multi-declarator statement"
        );
        this.degrade(declaration, lazy);
        return null;
      }
      let type = declaration.type;
      if (type == null) {
        // The cell is lifted into the state struct, and a state field needs a
        // syntactic type. This is the same rule the async lowering already
        // states for an ordinary awaited local ("a local without a declared type
        // that crosses an await"), spelled here because the user cannot see
        // where it comes from.
        this.parser.error(
          DiagnosticCode.A_lazy_await_binding_needs_a_declared_type_the_memo_cells_are_lifted_into_the_task_s_state_struct_and_a_state_field_needs_a_syntactic_type_0,
          declaration.name.range, declaration.name.text
        );
        this.degrade(declaration, lazy);
        return null;
      }
      let name = declaration.name.text;
      if (getMapEntry(pending, name) != null) {
        // Two `@lazy await` bindings of one name in one block: the inner one
        // shadows the outer, and the guard would not know which it meant.
        this.parser.error(
          DiagnosticCode.Not_implemented_0,
          declaration.name.range,
          "a redeclared '@lazy await' binding in one block"
        );
        return null;
      }
      let doneName = name + DONE_SUFFIX;
      let operand = (<AwaitExpression>lazy.expression).operand;
      // `@lazy await spawn(f())`: `spawn` is a marker, not a call. It says the
      // launch must happen at the *declaration* while the await stays deferred,
      // so the call is hoisted into a task cell and the guard awaits that cell.
      // This is the only place `spawn` escapes the deferral -- everywhere else a
      // call is deferred like any other expression, which is the ratified rule.
      let taskName: string | null = null;
      if (isSpawnCall(operand)) {
        let hoisted = spawnTarget(<CallExpression>operand);
        if (hoisted == null) {
          this.parser.error(
            DiagnosticCode.Not_implemented_0,
            operand.range,
            "a 'spawn' whose argument is not a call or a function name"
          );
          this.degrade(declaration, lazy);
          return null;
        }
        taskName = name + TASK_SUFFIX;
        operand = Node.createIdentifierExpression(taskName, operand.range);
      }
      pendingEntry = new PendingLazyAwait(
        name, doneName, operand, declaration, declaration.range
      );
      pendingEntry.taskName = taskName;
      if (taskName != null) {
        pendingEntry.taskCall = spawnTarget(<CallExpression>(<AwaitExpression>lazy.expression).operand);
      }
      rewritten = Node.createVariableDeclaration(
        declaration.name,
        declaration.decorators,
        declaration.flags,
        type,
        null, // the value is assigned by the guard
        declaration.range
      );
      break;
    }
    if (pendingEntry == null || rewritten == null) return null;
    pending.set(pendingEntry.name, pendingEntry);
    let out = new Array<Statement>();
    let taskName = pendingEntry.taskName;
    if (taskName != null) {
      // `let b$task: Task<T> = f();` — the launch, at the declaration, which is
      // what `spawn` inside `@lazy` asks for. The declared type is the one the
      // user wrote, wrapped: a call to an `async function f(): T` produces
      // `Task<T>`, so the type is known syntactically here for the same reason
      // the value cell's was (`TS6399` fired otherwise).
      let taskType = Node.createNamedType(
        Node.createSimpleTypeName("Task", pendingEntry.range),
        [ assert(pendingEntry.declaration.type) ],
        false,
        pendingEntry.range
      );
      out.push(Node.createVariableStatement(
        null,
        [ Node.createVariableDeclaration(
          Node.createIdentifierExpression(taskName, pendingEntry.range),
          null,
          CommonFlags.Let,
          taskType,
          pendingEntry.taskCall,
          pendingEntry.range
        ) ],
        pendingEntry.range
      ));
    }
    out.push(Node.createVariableStatement(
      null,
      [ Node.createVariableDeclaration(
        Node.createIdentifierExpression(pendingEntry.doneName, pendingEntry.range),
        null,
        CommonFlags.Let,
        null,
        Node.createFalseExpression(pendingEntry.range),
        pendingEntry.range
      ) ],
      pendingEntry.range
    ));
    out.push(Node.createVariableStatement(null, [ rewritten ], statement.range));
    return out;
  }

  /**
   * Rewrites a refused declaration back to something the later stages can plan,
   * so one mistake yields **one** diagnostic.
   *
   * The `@lazy` wrapper is dropped and the call is left in place. The program does
   * not compile -- a diagnostic has already been reported -- so what this changes
   * is only which follow-on errors are printed, and the alternative is the async
   * transform refusing the whole enclosing body with a message about the body.
   */
  private degrade(declaration: VariableDeclaration, lazy: LazyExpression): void {
    let inner = lazy.expression;
    declaration.initializer = inner.kind == NodeKind.Await
      ? (<AwaitExpression>inner).operand
      : inner;
  }

  /**
   * `if (!b$done) { b = await EXPR; b$done = true; }`
   *
   * An `if` rather than a block so the guard is a single statement wherever it
   * lands; the async planner treats an `if` with an await in its body as an
   * ordinary construct.
   */
  private makeGuard(pending: PendingLazyAwait, range: Range): Statement {
    let doneRef = Node.createIdentifierExpression(pending.doneName, range);
    return Node.createIfStatement(
      Node.createUnaryPrefixExpression(Token.Exclamation, doneRef, range),
      Node.createBlockStatement([
        Node.createExpressionStatement(
          Node.createBinaryExpression(
            Token.Equals,
            Node.createIdentifierExpression(pending.name, range),
            Node.createAwaitExpression(pending.awaitOperand, range),
            range
          )
        ),
        Node.createExpressionStatement(
          Node.createBinaryExpression(
            Token.Equals,
            Node.createIdentifierExpression(pending.doneName, range),
            Node.createTrueExpression(range),
            range
          )
        )
      ], range),
      null,
      range
    );
  }

  /** Recurses into a compound statement's child statement lists, in place. */
  private recurseInto(statement: Statement, pending: Map<string, PendingLazyAwait>): void {
    switch (statement.kind) {
      case NodeKind.Block: {
        let block = <BlockStatement>statement;
        block.statements = this.rewriteList(block.statements, pending);
        break;
      }
      case NodeKind.If: {
        let ifStatement = <IfStatement>statement;
        ifStatement.ifTrue = this.rewriteSingleBody(ifStatement.ifTrue, pending);
        if (ifStatement.ifFalse != null) {
          ifStatement.ifFalse = this.rewriteSingleBody(assert(ifStatement.ifFalse), pending);
        }
        break;
      }
      case NodeKind.While: {
        let whileStatement = <WhileStatement>statement;
        whileStatement.body = this.rewriteSingleBody(whileStatement.body, pending);
        break;
      }
      case NodeKind.Do: {
        let doStatement = <DoStatement>statement;
        doStatement.body = this.rewriteSingleBody(doStatement.body, pending);
        break;
      }
      case NodeKind.For: {
        let forStatement = <ForStatement>statement;
        forStatement.body = this.rewriteSingleBody(forStatement.body, pending);
        break;
      }
      case NodeKind.ForOf: {
        let forOf = <ForOfStatement>statement;
        forOf.body = this.rewriteSingleBody(forOf.body, pending);
        break;
      }
      case NodeKind.Switch: {
        let switchStatement = <SwitchStatement>statement;
        let cases = switchStatement.cases;
        for (let i = 0, k = cases.length; i < k; ++i) {
          let case_ = cases[i];
          case_.statements = this.rewriteList(case_.statements, pending);
        }
        break;
      }
      case NodeKind.Try: {
        let tryStatement = <TryStatement>statement;
        tryStatement.bodyStatements = this.rewriteList(tryStatement.bodyStatements, pending);
        let catches = tryStatement.catchStatements;
        if (catches != null) tryStatement.catchStatements = this.rewriteList(catches, pending);
        let finals = tryStatement.finallyStatements;
        if (finals != null) tryStatement.finallyStatements = this.rewriteList(finals, pending);
        break;
      }
      default: break;
    }
  }

  /** A single-statement body gets a block when the rewrite produced several. */
  private rewriteSingleBody(statement: Statement, pending: Map<string, PendingLazyAwait>): Statement {
    if (statement.kind == NodeKind.Block) {
      this.recurseInto(statement, pending);
      return statement;
    }
    let rewritten = this.rewriteList([ statement ], pending);
    return rewritten.length == 1
      ? rewritten[0]
      : Node.createBlockStatement(rewritten, statement.range);
  }

  /**
   * The names this statement itself reads — its conditions, initializers, return
   * values — *not* the ones inside its child statement lists, which
   * `recurseInto` handles where the guard belongs.
   *
   * Over-reporting is safe (the guard is idempotent) but under-reporting is not,
   * so the walker covers every expression kind that can hold an identifier.
   */
  private collectOwnReads(
    statement: Statement,
    pending: Map<string, PendingLazyAwait>,
    into: string[]
  ): string[] {
    switch (statement.kind) {
      case NodeKind.Expression: {
        this.collectReads((<ExpressionStatement>statement).expression, pending, into);
        break;
      }
      case NodeKind.Variable: {
        let declarations = (<VariableStatement>statement).declarations;
        for (let i = 0, k = declarations.length; i < k; ++i) {
          let initializer = declarations[i].initializer;
          if (initializer != null) this.collectReads(initializer, pending, into);
        }
        break;
      }
      case NodeKind.Return: {
        let value = (<ReturnStatement>statement).value;
        if (value != null) this.collectReads(value, pending, into);
        break;
      }
      case NodeKind.If: {
        this.collectReads((<IfStatement>statement).condition, pending, into);
        break;
      }
      case NodeKind.While: {
        this.collectReads((<WhileStatement>statement).condition, pending, into);
        break;
      }
      case NodeKind.Do: {
        this.collectReads((<DoStatement>statement).condition, pending, into);
        break;
      }
      case NodeKind.For: {
        let forStatement = <ForStatement>statement;
        let initializer = forStatement.initializer;
        if (initializer != null && initializer.kind != NodeKind.Variable) {
          // The parser wraps a `for` header expression in a statement, so this
          // delegates rather than treating it as a bare expression.
          this.collectOwnReads(initializer, pending, into);
        }
        let condition = forStatement.condition;
        if (condition != null) this.collectReads(condition, pending, into);
        let incrementor = forStatement.incrementor;
        if (incrementor != null) this.collectReads(incrementor, pending, into);
        break;
      }
      case NodeKind.Switch: {
        this.collectReads((<SwitchStatement>statement).condition, pending, into);
        break;
      }
      case NodeKind.Throw: {
        this.collectReads((<ThrowStatement>statement).value, pending, into);
        break;
      }
      case NodeKind.Void: {
        this.collectReads((<VoidStatement>statement).expression, pending, into);
        break;
      }
      default: break;
    }
    return into;
  }

  /** Collects pending names read anywhere inside an expression. */
  private collectReads(
    expression: Expression,
    pending: Map<string, PendingLazyAwait>,
    into: string[]
  ): void {
    switch (expression.kind) {
      case NodeKind.Identifier: {
        let name = (<IdentifierExpression>expression).text;
        if (getMapEntry(pending, name) != null && !into.includes(name)) into.push(name);
        break;
      }
      case NodeKind.Call: {
        let call = <CallExpression>expression;
        this.collectReads(call.expression, pending, into);
        let args = call.args;
        for (let i = 0, k = args.length; i < k; ++i) this.collectReads(args[i], pending, into);
        break;
      }
      case NodeKind.Binary: {
        let binary = <BinaryExpression>expression;
        this.collectReads(binary.left, pending, into);
        this.collectReads(binary.right, pending, into);
        break;
      }
      case NodeKind.UnaryPrefix: {
        this.collectReads((<UnaryPrefixExpression>expression).operand, pending, into);
        break;
      }
      case NodeKind.UnaryPostfix: {
        this.collectReads((<UnaryPostfixExpression>expression).operand, pending, into);
        break;
      }
      case NodeKind.Comma: {
        let comma = <CommaExpression>expression;
        let expressions = comma.expressions;
        for (let i = 0, k = expressions.length; i < k; ++i) {
          this.collectReads(expressions[i], pending, into);
        }
        break;
      }
      case NodeKind.Ternary: {
        let ternary = <TernaryExpression>expression;
        this.collectReads(ternary.condition, pending, into);
        this.collectReads(ternary.ifThen, pending, into);
        this.collectReads(ternary.ifElse, pending, into);
        break;
      }
      case NodeKind.PropertyAccess: {
        this.collectReads((<PropertyAccessExpression>expression).expression, pending, into);
        break;
      }
      case NodeKind.ElementAccess: {
        let access = <ElementAccessExpression>expression;
        this.collectReads(access.expression, pending, into);
        this.collectReads(access.elementExpression, pending, into);
        break;
      }
      case NodeKind.Assertion: {
        this.collectReads((<AssertionExpression>expression).expression, pending, into);
        break;
      }
      case NodeKind.Parenthesized: {
        this.collectReads((<ParenthesizedExpression>expression).expression, pending, into);
        break;
      }
      case NodeKind.Await: {
        this.collectReads((<AwaitExpression>expression).operand, pending, into);
        break;
      }
      case NodeKind.Lazy: {
        this.collectReads((<LazyExpression>expression).expression, pending, into);
        break;
      }
      case NodeKind.New: {
        let newExpression = <NewExpression>expression;
        let args = newExpression.args;
        if (args != null) {
          for (let i = 0, k = args.length; i < k; ++i) this.collectReads(args[i], pending, into);
        }
        break;
      }
      case NodeKind.InstanceOf: {
        this.collectReads((<InstanceOfExpression>expression).expression, pending, into);
        break;
      }
      case NodeKind.Function: {
        // A nested function reading the binding is a *capture*: its storage
        // would have to move, and this transform cannot move a state field into
        // a closure environment. Refused rather than silently mis-lowered.
        let inner = new Array<string>();
        this.collectReadsInFunctionBody(<FunctionExpression>expression, pending, inner);
        for (let i = 0, k = inner.length; i < k; ++i) {
          this.parser.error(
            DiagnosticCode.A_lazy_await_binding_cannot_be_read_from_a_nested_function_a_capture_moves_the_storage_and_the_memo_cell_is_a_state_field_0,
            expression.range, inner[i]
          );
        }
        break;
      }
      default: break;
    }
  }

  /** Reads of a pending name inside a nested function body (a capture). */
  private collectReadsInFunctionBody(
    expression: FunctionExpression,
    pending: Map<string, PendingLazyAwait>,
    into: string[]
  ): void {
    let body = expression.declaration.body;
    if (body == null || body.kind != NodeKind.Block) return;
    let statements = (<BlockStatement>body).statements;
    for (let i = 0, k = statements.length; i < k; ++i) {
      this.collectOwnReads(statements[i], pending, into);
      this.recurseCollect(statements[i], pending, into);
    }
  }

  /** `collectReadsInFunctionBody`'s statement recursion. */
  private recurseCollect(
    statement: Statement,
    pending: Map<string, PendingLazyAwait>,
    into: string[]
  ): void {
    switch (statement.kind) {
      case NodeKind.Block: {
        let statements = (<BlockStatement>statement).statements;
        for (let i = 0, k = statements.length; i < k; ++i) {
          this.collectOwnReads(statements[i], pending, into);
          this.recurseCollect(statements[i], pending, into);
        }
        break;
      }
      case NodeKind.If: {
        let ifStatement = <IfStatement>statement;
        this.recurseCollect(ifStatement.ifTrue, pending, into);
        if (ifStatement.ifFalse != null) this.recurseCollect(assert(ifStatement.ifFalse), pending, into);
        break;
      }
      case NodeKind.While: {
        this.recurseCollect((<WhileStatement>statement).body, pending, into);
        break;
      }
      case NodeKind.Do: {
        this.recurseCollect((<DoStatement>statement).body, pending, into);
        break;
      }
      case NodeKind.For: {
        this.recurseCollect((<ForStatement>statement).body, pending, into);
        break;
      }
      case NodeKind.ForOf: {
        this.recurseCollect((<ForOfStatement>statement).body, pending, into);
        break;
      }
      case NodeKind.Switch: {
        let cases = (<SwitchStatement>statement).cases;
        for (let i = 0, k = cases.length; i < k; ++i) {
          let statements = cases[i].statements;
          for (let j = 0, l = statements.length; j < l; ++j) this.recurseCollect(statements[j], pending, into);
        }
        break;
      }
      default: break;
    }
  }

  /** Rewrites the bodies of function *expressions* found in a statement list. */
  private rewriteNestedFunctionExpressions(statements: Statement[]): void {
    // Function expressions are reached through expressions; the statement walk
    // above covers declarations, and this covers `let g = () => { ... }` and the
    // like. A body that introduced its own `@lazy await` is a separate scope.
    for (let i = 0, k = statements.length; i < k; ++i) {
      let statement = statements[i];
      if (statement.kind == NodeKind.Variable) {
        let declarations = (<VariableStatement>statement).declarations;
        for (let j = 0, l = declarations.length; j < l; ++j) {
          let initializer = declarations[j].initializer;
          if (initializer != null && initializer.kind == NodeKind.Function) {
            let body = (<FunctionExpression>initializer).declaration.body;
            if (body != null && body.kind == NodeKind.Block) {
              this.rewriteBody(<BlockStatement>body);
            }
          }
        }
      }
    }
  }
}

/** Whether a call is the `spawn` marker. */
function isSpawnCall(expression: Expression): bool {
  if (expression.kind != NodeKind.Call) return false;
  let callee = (<CallExpression>expression).expression;
  return callee.kind == NodeKind.Identifier
    && (<IdentifierExpression>callee).text == SPAWN_MARKER;
}

/**
 * The call a `spawn(...)` marker wraps: `spawn(f(a))` is `f(a)`, and
 * `spawn(f)` — a bare function name — is `f()`.
 *
 * `null` for any other spelling. The marker exists to mark a call, so a marker
 * around something that is not a call has no reading; the caller refuses it.
 */
function spawnTarget(expression: CallExpression): CallExpression | null {
  let args = expression.args;
  if (args.length != 1) return null;
  let target = args[0];
  if (target.kind == NodeKind.Call) return <CallExpression>target;
  if (target.kind == NodeKind.Identifier) {
    return Node.createCallExpression(<IdentifierExpression>target, null, [], expression.range);
  }
  return null;
}
