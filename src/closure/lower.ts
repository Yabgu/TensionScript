/**
 * The `afterParse` AST transform that lowers closures: capture analysis,
 * environment-class synthesis, and the rewrite that gives every captured
 * binding exactly one home.
 *
 * `docs/closures-plan.md` §3-§6 is the specification. The load-bearing rules,
 * restated here because the code is organised around them:
 *
 * - **One storage location per binding.** A binding captured by a nested
 *   function stops being a wasm local; it lives in a synthesized environment
 *   object, and every reference — inside the owning function and inside every
 *   closure — becomes an ordinary field access on that object (§2.1).
 * - **Closures lower before async.** The async transform runs after this one at
 *   the same `afterParse` seam and sees ordinary code: an env local, `new`, and
 *   field accesses. Its existing lifting rule then carries the env local across
 *   an await, which is the single-storage rule in practice (§3.1).
 * - **`_env` already means something.** The shipped arrow-`this` path stores the
 *   *receiver* there (`compiler.ts:7534-7558`) for a this-only arrow. This
 *   transform never touches that path: a this-only arrow stays `Receiver`, and
 *   only a function with a non-`this` capture becomes `Struct` (§4.5).
 *
 * ## What is lowered in this revision (C1)
 *
 * - A top-level `function` that declares bindings captured by a nested function,
 *   where the captured binding is a parameter or a local with a declared type.
 * - References are rewritten in place; assignments update the environment and
 *   an `$init$` flag (for declarations without an initializer).
 * - The closure value is a heap `Function<T>` whose `_env` is the environment
 *   (codegen's `Struct` branch); the callee reads it back through a prologue.
 *
 * Refused by name, never silently mishandled: async bodies, method bodies,
 * nested owners, for-header bindings (C3), `this` plus a local in one arrow
 * (C2), and the type gaps D10/D11.
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
  AwaitExpression,
  BinaryExpression,
  BlockStatement,
  CallExpression,
  ClassDeclaration,
  ClassExpression,
  CommaExpression,
  ContinueStatement,
  DeclarationStatement,
  DoStatement,
  ElementAccessExpression,
  EnumDeclaration,
  Expression,
  ExpressionStatement,
  FieldDeclaration,
  ForOfStatement,
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
  ParenthesizedExpression,
  PropertyAccessExpression,
  ReturnStatement,
  Source,
  Statement,
  SwitchCase,
  SwitchStatement,
  TemplateLiteralExpression,
  TernaryExpression,
  ThisExpression,
  ThrowStatement,
  TryStatement,
  TypeDeclaration,
  TypeNode,
  UnaryPostfixExpression,
  UnaryPrefixExpression,
  VariableDeclaration,
  VariableStatement,
  WhileStatement
} from "../ast";
import { EnvKind, EnvInfo, envInfoOf, creationEnvOf } from "./ir";

/** The local that holds the environment a function **owns**. */
const ENV_LOCAL = "$closureEnv";
/** The local that holds the environment a function **received**. */
const ENV_IN_LOCAL = "$closureEnvIn";
/** Prefix of a captured binding's initialization flag. */
const INIT_PREFIX = "$init$";
/** Suffix of a synthesized environment class. */
const ENV_SUFFIX = "$Env";
/** The std helper that guards an uninitialized captured read. */
const INIT_HELPER = "__closureInit";
/** The environment field that carries the receiver, when an arrow captures it. */
const THIS_FIELD = "$this";
/** The chain link C5a adds to a parented environment (`$parent`). */
const PARENT_FIELD = "$parent";
/** The async state struct's carrier field (§8.3); reserved here because the
 *  closure transform and the async transform share one reserved namespace. */
const STATE_ENV_FIELD = "$env";
/** The async state struct's per-await record fields (`$awaited<N>`). */
const AWAITED_FIELD_PREFIX = "$awaited";

/**
 * Whether `name` is one the lowering declares or synthesizes, in either
 * transform (`docs/closures-plan.md` §4.6, §4.7.4; review finding F14).
 *
 * The closure transform synthesizes `$closureEnv`, `$closureEnv$<n>`,
 * `$closureEnvIn` (locals), `$this`, `$parent`, `$init$<name>` (env fields) and
 * `<owner>$Env` (a class, matched by the synthesized-name check, not here). The
 * async transform synthesizes `$env`, `$awaited<N>`, `resumePoint`, `handle`,
 * and inherits `record`.
 *
 * **`resumePoint`, `handle` and `record` are deliberately absent.** They are
 * ordinary words a user may reasonably write, and the async transform already
 * refuses them at the only sites they can collide — a parameter, and a local
 * that is being lifted into the state struct (`isReservedStateField`,
 * `src/async/lower.ts:2871-2880`). A program-wide refusal would reject
 * `let handle: i32` in any program that also has a closure, for no collision.
 * `result` is absent too: the state struct no longer has that field (§4.7.3
 * retired it), so no name is synthesized — measured, a local named `result`
 * crossing an await compiles.
 */
function isReservedName(name: string): bool {
  let length = name.length;
  if (length == 0) return false;
  // `$closureEnv`, `$closureEnv$<n>` (§5.6), `$closureEnvIn`.
  if (hasPrefix(name, ENV_LOCAL)) {
    if (length == ENV_LOCAL.length) return true;
    if (name.charCodeAt(ENV_LOCAL.length) == 36 /* $ */) return true;
  }
  if (hasPrefix(name, ENV_IN_LOCAL)) return true;
  if (name == THIS_FIELD) return true;
  if (name == PARENT_FIELD) return true;
  if (name == STATE_ENV_FIELD) return true;
  if (hasPrefix(name, INIT_PREFIX)) return true;
  // `$awaited1`, `$awaited99` — digits only. `$awaitedX` is not a name the
  // transform can produce, so it stays available to a user.
  if (hasPrefix(name, AWAITED_FIELD_PREFIX)) {
    let from = AWAITED_FIELD_PREFIX.length;
    if (from >= length) return false;
    for (let i = from; i < length; ++i) {
      let c = name.charCodeAt(i);
      if (c < 48 /* 0 */ || c > 57 /* 9 */) return false;
    }
    return true;
  }
  return false;
}

/** Whether `text` begins with `prefix`; allocation-free (no substring). */
function hasPrefix(text: string, prefix: string): bool {
  let length = prefix.length;
  if (text.length < length) return false;
  for (let i = 0; i < length; ++i) {
    if (text.charCodeAt(i) != prefix.charCodeAt(i)) return false;
  }
  return true;
}

/** The in-tree `afterParse` `Transform`. */
export class ClosureLowerTransform {

  /** The program being compiled. Assigned by the CLI onto the prototype. */
  readonly program!: Program;

  /** Analyses computed in the collect phase, consumed by the emit phase. */
  private analyses: Map<FunctionDeclaration, OwnerAnalysis> | null = null;

  /**
   * `Transform#afterParse` — runs after parsing, before async lowering, in two
   * phases: **collect** (analyse every owner, mutate nothing) and **emit**
   * (synthesize and rewrite).
   *
   * The split exists for §4.6's reserved-name guard (review finding F14). The
   * guard must run *before* the transform synthesizes anything, or its own
   * `$closureEnv`/`$this`/`$parent` declarations would be seen as user
   * identifiers; and it must run only when the pass would synthesize at all, so
   * a program with no capture and no async keeps its `$parent` variable. The
   * collect phase is what answers "would this pass synthesize" — it is the
   * transform's own detection, run once and reused by the emit phase.
   */
  afterParse(parser: Parser): void {
    let sources = this.program.sources;
    this.analyses = null;
    let synthesizes = false;
    let scan = new ReservedScan();
    for (let i = 0, k = sources.length; i < k; ++i) {
      let source = sources[i];
      // Library sources are never lowered: std declares no closure, and skipping
      // them keeps this transform out of the standard library's own compilation.
      if (source.isLibrary) continue;
      if (this.collectStatementList(source.statements, parser)) synthesizes = true;
      scan.visitStatements(source.statements);
    }
    // The async transform synthesizes the state struct's names, so a program it
    // will lower needs the same guard. Its names and this transform's do not
    // overlap, and one reserved set covers both (§4.6).
    if (scan.sawAsync) synthesizes = true;
    if (synthesizes && scan.refuse(parser)) return; // reported; the AST is as parsed
    for (let i = 0, k = sources.length; i < k; ++i) {
      let source = sources[i];
      if (source.isLibrary) continue;
      this.lowerStatementList(source, source.statements, parser);
    }
  }

  /** Records an owner's analysis for phase two; allocates on the first owner. */
  private recordAnalysis(declaration: FunctionDeclaration, analysis: OwnerAnalysis): void {
    let analyses = this.analyses;
    if (analyses == null) {
      analyses = new Map<FunctionDeclaration, OwnerAnalysis>();
      this.analyses = analyses;
    }
    analyses.set(declaration, analysis);
  }

  /**
   * Phase one for one statement list: runs every owner's analysis, records it
   * for phase two, and answers whether any owner has a capture this pass will
   * lower. Mutates nothing.
   */
  private collectStatementList(statements: Statement[], parser: Parser): bool {
    let captures = false;
    for (let i = 0, k = statements.length; i < k; ++i) {
      let statement = statements[i];
      switch (statement.kind) {
        case NodeKind.FunctionDeclaration: {
          let declaration = <FunctionDeclaration>statement;
          if (declaration.body == null) break;
          let analysis = new OwnerAnalysis(this, parser, declaration);
          analysis.run();
          this.recordAnalysis(declaration, analysis);
          if (analysis.hasCaptures() && !analysis.refused) captures = true;
          break;
        }
        case NodeKind.NamespaceDeclaration: {
          if (this.collectStatementList((<NamespaceDeclaration>statement).members, parser)) captures = true;
          break;
        }
        case NodeKind.ClassDeclaration: {
          let className = (<ClassDeclaration>statement).name.text;
          let members = (<ClassDeclaration>statement).members;
          for (let j = 0, l = members.length; j < l; ++j) {
            if (members[j].kind != NodeKind.MethodDeclaration) continue;
            let method = <MethodDeclaration>members[j];
            if (method.body == null || method.is(CommonFlags.Static)) continue;
            let analysis = new OwnerAnalysis(this, parser, method, typeNode(className, method.range));
            analysis.run();
            this.recordAnalysis(method, analysis);
            if (analysis.hasCaptures() && !analysis.refused) captures = true;
          }
          break;
        }
        case NodeKind.Variable: {
          // A top-level function expression that owns captured bindings is a
          // nested owner, and this revision supports a top-level declaration
          // only — refused here, before phase two emits anything.
          let declarations = (<VariableStatement>statement).declarations;
          for (let j = 0, l = declarations.length; j < l; ++j) {
            let initializer = declarations[j].initializer;
            if (initializer == null || initializer.kind != NodeKind.Function) continue;
            let nested = <FunctionExpression>initializer;
            if (nested.declaration.body == null) continue;
            let analysis = new OwnerAnalysis(this, parser, nested.declaration);
            analysis.run();
            this.recordAnalysis(nested.declaration, analysis);
            if (analysis.hasCaptures() && !analysis.refused) {
              analysis.refuse(nested.declaration.range,
                "a capture from a top-level function expression (closures lowering)");
            }
          }
          break;
        }
        default: break;
      }
    }
    return captures;
  }

  /** Lowers the closures declared by one statement list, in place. */
  private lowerStatementList(source: Source, statements: Statement[], parser: Parser): void {
    let out = new Array<Statement>();
    let changed = false;
    for (let i = 0, k = statements.length; i < k; ++i) {
      let statement = statements[i];
      switch (statement.kind) {
        case NodeKind.FunctionDeclaration: {
          let declaration = <FunctionDeclaration>statement;
          if (declaration.body == null) {
            out.push(statement);
            break;
          }
          let analysis = assert(assert(this.analyses).get(declaration));
          if (!analysis.hasCaptures()) {
            out.push(statement);
            break;
          }
          if (analysis.refused) {
            out.push(statement); // refused; left as parsed
            break;
          }
          // The env classes first: `program.initialize()` walks this array in
          // order (`program.ts:1102-1113`), and the owner references them.
          let classes = analysis.makeEnvClasses();
          for (let j = 0, l = classes.length; j < l; ++j) out.push(classes[j]);
          analysis.rewrite();
          out.push(statement);
          changed = true;
          break;
        }
        case NodeKind.NamespaceDeclaration: {
          this.lowerStatementList(source, (<NamespaceDeclaration>statement).members, parser);
          out.push(statement);
          break;
        }
        case NodeKind.ClassDeclaration: {
          // A method body can own an environment (C2b): its `this` is a
          // parameter, so a combined `this` + local capture has a receiver to
          // store. The synthesized classes are top-level, so they are emitted
          // before the class that uses them.
          let classDeclaration = <ClassDeclaration>statement;
          let classes = this.lowerMethods(classDeclaration, parser);
          for (let j = 0, l = classes.length; j < l; ++j) out.push(classes[j]);
          if (classes.length > 0) changed = true;
          out.push(statement);
          break;
        }
        case NodeKind.Variable: {
          // A top-level function expression that captures is refused in the
          // collect phase (this revision supports a top-level *declaration*
          // only), so the statement is emitted exactly as parsed.
          out.push(statement);
          break;
        }
        default: {
          out.push(statement);
          break;
        }
      }
    }
    if (!changed) return;
    statements.length = 0;
    for (let i = 0, k = out.length; i < k; ++i) statements.push(out[i]);
  }

  /**
   * Lowers the method bodies of one class as owners in their own right, and
   * answers the environment classes they need.
   *
   * A method is a valid owner for the same reason a top-level function is: its
   * body declares bindings, and its `this` is `param 0`, so a `$this` field has
   * a value to hold at scope entry. The class name is what the field's type
   * names.
   */
  private lowerMethods(declaration: ClassDeclaration, parser: Parser): Array<ClassDeclaration> {
    let out = new Array<ClassDeclaration>();
    let members = declaration.members;
    for (let i = 0, k = members.length; i < k; ++i) {
      let member = members[i];
      if (member.kind != NodeKind.MethodDeclaration) continue;
      let method = <MethodDeclaration>member;
      if (method.body == null) continue;
      // A static method has no receiver; `this` there is the class object and a
      // `$this` field would name a value that does not exist as a parameter.
      if (method.is(CommonFlags.Static)) continue;
      let analysis = assert(assert(this.analyses).get(method));
      if (!analysis.hasCaptures() || analysis.refused) continue;
      let classes = analysis.makeEnvClasses();
      for (let j = 0, l = classes.length; j < l; ++j) out.push(classes[j]);
      analysis.rewrite();
    }
    return out;
  }
}

// --- the reserved-name scan (review F14) ------------------------------------

/** The first declaration of one reserved name, in source order. */
class ReservedNameHit {
  constructor(
    public name: string,
    public range: Range
  ) {}
}

/**
 * §4.6's reserved-name guard, as a whole-program declaration walk.
 *
 * **What it is for.** The lowering declares `$closureEnv`, `$closureEnvIn`,
 * `$closureEnv$<n>`, `$this`, `$parent`, `$init$<name>`, and (async) `$env`,
 * `$awaited<N>`. A user declaration with one of those names is not a name the
 * user gets to keep: in a capturing scope the transform would emit a second
 * declaration of the same name, and C5's `$parent` would turn a user binding
 * into the chain link. Measured before the guard: `let $parent: i32 = 7;
 * const f = (): i32 => $parent;` compiled into `main$Env.$parent`, which is the
 * field C5a is about to introduce.
 *
 * **What it is not.** It does not refuse ordinary words. `resumePoint`,
 * `handle` and `record` are the async state struct's names, but they collide
 * only when a local is lifted into the struct, and the async transform already
 * refuses exactly those sites (`isReservedStateField`, `src/async/lower.ts`).
 * `result` is not a field at all any more. Refusing the three flatly would
 * reject `let handle: i32` in any program that happens to contain a closure,
 * which is the over-refusal this pass must not do.
 *
 * **When it runs.** Only when the pass would synthesize a name: some owner has
 * a capture, or the program declares an async function (§4.6's gate). A
 * program with neither keeps every name it wrote — measured and asserted.
 *
 * **Cost.** No allocation on a clean program: `hits` stays null and nothing is
 * pushed. The walk visits declarations and the expressions that can contain a
 * nested function; it never resolves names.
 */
class ReservedScan {
  /** The first declaration of each reserved name. Allocated on first hit. */
  private hits: Array<ReservedNameHit> | null = null;
  /** Whether any declaration in the program is async. */
  sawAsync: bool = false;

  /** Records a declaration name, if reserved; one hit per name. */
  private check(name: string, range: Range): void {
    if (!isReservedName(name)) return;
    let hits = this.hits;
    if (hits == null) {
      hits = new Array<ReservedNameHit>();
      this.hits = hits;
    } else {
      for (let i = 0, k = hits.length; i < k; ++i) {
        if (hits[i].name == name) return;
      }
    }
    hits.push(new ReservedNameHit(name, range));
  }

  /** Reports every hit; answers whether anything was reported. */
  refuse(parser: Parser): bool {
    let hits = this.hits;
    if (hits == null) return false;
    for (let i = 0, k = hits.length; i < k; ++i) {
      parser.error(
        DiagnosticCode.Not_implemented_0,
        hits[i].range,
        "a user identifier named '" + hits[i].name + "' (closures lowering)"
      );
    }
    return true;
  }

  visitStatements(statements: Statement[]): void {
    for (let i = 0, k = statements.length; i < k; ++i) this.visitStatement(statements[i]);
  }

  private visitStatement(statement: Statement): void {
    switch (statement.kind) {
      case NodeKind.Block: {
        this.visitStatements((<BlockStatement>statement).statements);
        break;
      }
      case NodeKind.Do: {
        let loop = <DoStatement>statement;
        this.visitStatement(loop.body);
        this.visitExpression(loop.condition);
        break;
      }
      case NodeKind.Expression: {
        this.visitExpression((<ExpressionStatement>statement).expression);
        break;
      }
      case NodeKind.For: {
        let loop = <ForStatement>statement;
        if (loop.initializer != null) this.visitStatement(loop.initializer);
        if (loop.condition != null) this.visitExpression(loop.condition);
        if (loop.incrementor != null) this.visitExpression(loop.incrementor);
        this.visitStatement(loop.body);
        break;
      }
      case NodeKind.ForOf: {
        let loop = <ForOfStatement>statement;
        this.visitStatement(loop.variable);
        this.visitExpression(loop.iterable);
        this.visitStatement(loop.body);
        break;
      }
      case NodeKind.If: {
        let ifs = <IfStatement>statement;
        this.visitExpression(ifs.condition);
        this.visitStatement(ifs.ifTrue);
        if (ifs.ifFalse != null) this.visitStatement(ifs.ifFalse);
        break;
      }
      case NodeKind.Return: {
        let value = (<ReturnStatement>statement).value;
        if (value != null) this.visitExpression(value);
        break;
      }
      case NodeKind.Switch: {
        let switchStatement = <SwitchStatement>statement;
        this.visitExpression(switchStatement.condition);
        let cases = switchStatement.cases;
        for (let i = 0, k = cases.length; i < k; ++i) {
          let label = cases[i].label;
          if (label != null) this.visitExpression(label);
          this.visitStatements(cases[i].statements);
        }
        break;
      }
      case NodeKind.Throw: {
        this.visitExpression((<ThrowStatement>statement).value);
        break;
      }
      case NodeKind.Try: {
        let tryStatement = <TryStatement>statement;
        this.visitStatements(tryStatement.bodyStatements);
        let catchVariable = tryStatement.catchVariable;
        if (catchVariable != null) this.check(catchVariable.text, catchVariable.range);
        if (tryStatement.catchStatements != null) this.visitStatements(tryStatement.catchStatements);
        if (tryStatement.finallyStatements != null) this.visitStatements(tryStatement.finallyStatements);
        break;
      }
      case NodeKind.Variable: {
        let declarations = (<VariableStatement>statement).declarations;
        for (let i = 0, k = declarations.length; i < k; ++i) {
          let declaration = declarations[i];
          this.check(declaration.name.text, declaration.name.range);
          if (declaration.initializer != null) this.visitExpression(declaration.initializer);
        }
        break;
      }
      case NodeKind.While: {
        let loop = <WhileStatement>statement;
        this.visitExpression(loop.condition);
        this.visitStatement(loop.body);
        break;
      }
      case NodeKind.FunctionDeclaration:
      case NodeKind.MethodDeclaration: {
        this.visitFunction(<FunctionDeclaration>statement);
        break;
      }
      case NodeKind.ClassDeclaration: {
        this.visitClass(<ClassDeclaration>statement);
        break;
      }
      case NodeKind.EnumDeclaration: {
        let enumeration = <EnumDeclaration>statement;
        this.check(enumeration.name.text, enumeration.name.range);
        let values = enumeration.values;
        for (let i = 0, k = values.length; i < k; ++i) {
          this.check(values[i].name.text, values[i].name.range);
          let initializer = values[i].initializer;
          if (initializer != null) this.visitExpression(initializer);
        }
        break;
      }
      case NodeKind.NamespaceDeclaration: {
        let namespace = <NamespaceDeclaration>statement;
        this.check(namespace.name.text, namespace.name.range);
        this.visitStatements(namespace.members);
        break;
      }
      case NodeKind.TypeDeclaration: {
        let type = <TypeDeclaration>statement;
        this.check(type.name.text, type.name.range);
        break;
      }
      default: break;
    }
  }

  private visitFunction(declaration: FunctionDeclaration): void {
    let name = declaration.name;
    if (name.text.length != 0) this.check(name.text, name.range);
    if (declaration.isAsync) this.sawAsync = true;
    let parameters = declaration.signature.parameters;
    for (let i = 0, k = parameters.length; i < k; ++i) {
      let parameter = parameters[i];
      this.check(parameter.name.text, parameter.name.range);
      if (parameter.initializer != null) this.visitExpression(parameter.initializer);
    }
    let body = declaration.body;
    if (body != null) this.visitStatement(body);
  }

  private visitClass(declaration: ClassDeclaration): void {
    let name = declaration.name;
    if (name.text.length != 0) this.check(name.text, name.range);
    let members = declaration.members;
    for (let i = 0, k = members.length; i < k; ++i) {
      let member = members[i];
      switch (member.kind) {
        case NodeKind.FieldDeclaration: {
          let field = <FieldDeclaration>member;
          this.check(field.name.text, field.name.range);
          if (field.initializer != null) this.visitExpression(field.initializer);
          break;
        }
        case NodeKind.MethodDeclaration: {
          this.visitFunction(<MethodDeclaration>member);
          break;
        }
        default: break;
      }
    }
  }

  private visitExpression(expression: Expression): void {
    switch (expression.kind) {
      case NodeKind.Assertion: {
        this.visitExpression((<AssertionExpression>expression).expression);
        break;
      }
      case NodeKind.Binary: {
        let binary = <BinaryExpression>expression;
        this.visitExpression(binary.left);
        this.visitExpression(binary.right);
        break;
      }
      case NodeKind.Call: {
        let call = <CallExpression>expression;
        this.visitExpression(call.expression);
        let args = call.args;
        for (let i = 0, k = args.length; i < k; ++i) this.visitExpression(args[i]);
        break;
      }
      case NodeKind.Class: {
        this.visitClass((<ClassExpression>expression).declaration);
        break;
      }
      case NodeKind.Comma: {
        let expressions = (<CommaExpression>expression).expressions;
        for (let i = 0, k = expressions.length; i < k; ++i) this.visitExpression(expressions[i]);
        break;
      }
      case NodeKind.ElementAccess: {
        let access = <ElementAccessExpression>expression;
        this.visitExpression(access.expression);
        this.visitExpression(access.elementExpression);
        break;
      }
      case NodeKind.Function: {
        this.visitFunction((<FunctionExpression>expression).declaration);
        break;
      }
      case NodeKind.InstanceOf: {
        this.visitExpression((<InstanceOfExpression>expression).expression);
        break;
      }
      case NodeKind.Literal: {
        let literal = <LiteralExpression>expression;
        switch (literal.literalKind) {
          case LiteralKind.Template: {
            let expressions = (<TemplateLiteralExpression>literal).expressions;
            for (let i = 0, k = expressions.length; i < k; ++i) this.visitExpression(expressions[i]);
            break;
          }
          case LiteralKind.Array: {
            let elements = (<ArrayLiteralExpression>literal).elementExpressions;
            for (let i = 0, k = elements.length; i < k; ++i) this.visitExpression(elements[i]);
            break;
          }
          case LiteralKind.Object: {
            let values = (<ObjectLiteralExpression>literal).values;
            for (let i = 0, k = values.length; i < k; ++i) this.visitExpression(values[i]);
            break;
          }
          default: break;
        }
        break;
      }
      case NodeKind.New: {
        let args = (<NewExpression>expression).args;
        for (let i = 0, k = args.length; i < k; ++i) this.visitExpression(args[i]);
        break;
      }
      case NodeKind.Parenthesized: {
        this.visitExpression((<ParenthesizedExpression>expression).expression);
        break;
      }
      case NodeKind.PropertyAccess: {
        // The property name is a reference, not a declaration.
        this.visitExpression((<PropertyAccessExpression>expression).expression);
        break;
      }
      case NodeKind.Ternary: {
        let ternary = <TernaryExpression>expression;
        this.visitExpression(ternary.condition);
        this.visitExpression(ternary.ifThen);
        this.visitExpression(ternary.ifElse);
        break;
      }
      case NodeKind.UnaryPrefix: {
        this.visitExpression((<UnaryPrefixExpression>expression).operand);
        break;
      }
      case NodeKind.UnaryPostfix: {
        this.visitExpression((<UnaryPostfixExpression>expression).operand);
        break;
      }
      case NodeKind.Await: {
        this.visitExpression((<AwaitExpression>expression).operand);
        break;
      }
      default: break;
    }
  }
}

// --- analysis ---------------------------------------------------------------

const enum ScopeKind {
  Function,
  Block
}

/** One declared binding in a function's scope tree. */
class Binding {

  /** Whether some nested function references this binding. */
  captured: bool = false;

  /** Whether reads need the `$init$` guard (declared without an initializer). */
  hasInitFlag: bool = false;

  /** Whether this is a parameter (copied into the env at entry). */
  isParam: bool = false;

  /** Whether this is a `for`-header binding (per-iteration rules apply). */
  isLoopHeader: bool = false;

  /** The `for` statement whose header declared this binding, if any. */
  isLoopHeaderOf: ForStatement | null = null;

  /** The `Struct` closure this binding was initialised with, if any. */
  closureValue: FunctionExpression | null = null;

  /** Whether the declaration is `const` (assignment is an error). */
  isConst: bool = false;

  constructor(
    public name: string,
    public type: TypeNode | null,
    public scope: Scope,
    public declaration: Node,
    public hasInitializer: bool
  ) {}
}

/** One scope instance: a function body, a block, a loop, a switch clause. */
class Scope {

  bindings: Map<string, Binding> = new Map();

  /**
   * Named nested function expressions declared in this scope. Kept apart from
   * `bindings` on purpose: they are values, not captured variables, so the
   * capture analysis must not treat a reference to one as a capture.
   */
  functionValues: Map<string, FunctionExpression> = new Map();

  /** Captured bindings declared here, in declaration order. */
  captured: Array<Binding> = new Array();

  /** The env local's name, when this scope owns an environment. */
  localName: string | null = null;

  /** The synthesized class's name, when this scope owns an environment. */
  className: string | null = null;

  /**
   * Whether the environment carries `$this` at field 0 — an arrow in this scope
   * captures `this` and at least one local, so the receiver must travel with the
   * environment rather than through the shipped `Receiver` path (§7.1).
   */
  needsThis: bool = false;

  /**
   * Whether this scope is a `for` header that owns captured bindings, and so
   * needs the per-iteration clone (`docs/closures-plan.md` §2.3, §5.4).
   */
  isLoopHeader: bool = false;

  constructor(
    public kind: ScopeKind,
    public parent: Scope | null,
    public ownerFunction: FunctionDeclaration,
    public range: Range
  ) {}

  /** Resolves a named nested function through the scope chain. */
  resolveFunctionValue(name: string): FunctionExpression | null {
    let scope: Scope | null = this;
    while (scope != null) {
      let value = scope.functionValues.get(name);
      if (value) return value;
      scope = scope.parent;
    }
    return null;
  }

  /** Resolves a name through the scope chain; `null` when not declared. */
  resolve(name: string): Binding | null {
    let scope: Scope | null = this;
    while (scope != null) {
      let binding = scope.bindings.get(name);
      if (binding) return binding;
      scope = scope.parent;
    }
    return null;
  }
}

/**
 * One `this` expression inside an arrow, with the arrow chain it escapes and the
 * non-arrow function it belongs to.
 */
class ThisUse {
  constructor(
    public expression: ThisExpression,
    /** The arrow chain, innermost first. */
    public arrows: Array<FunctionInfo>
  ) {}
}

/** One identifier reference that resolved to a declared binding. */
class IdentifierRef {
  constructor(
    public identifier: IdentifierExpression,
    public binding: Binding,
    public write: bool
  ) {}
}

/** One function in the analysed tree. */
class FunctionInfo {

  children: Array<FunctionInfo> = new Array();

  /** The single environment this function needs delivered, if any. */
  needed: Scope | null = null;

  /** Whether a `this` reference in this function belongs to an outer function. */
  usesThis: bool = false;

  /** Whether this function references a binding of an enclosing function. */
  capturesLocal: bool = false;

  /** This function's own body scope. */
  ownsScope: Scope | null = null;

  constructor(
    public node: FunctionDeclaration,
    public expression: FunctionExpression | null,
    public isArrow: bool,
    public isAsync: bool,
    public parent: FunctionInfo | null
  ) {}
}

/** Capture analysis and the rewrite decision for one owner function. */
class OwnerAnalysis {

  /** Captured references, keyed by the identifier node to rewrite. */
  refs: Map<IdentifierExpression, Binding> = new Map();

  /** Captured references that are assignment targets. */
  writes: Set<IdentifierExpression> = new Set();

  /**
   * Every identifier reference that resolved to a declared binding, recorded
   * during the walk and filtered after it: a binding is only captured once the
   * *nested* function that references it has been seen, and the owner's own
   * references (which can precede that function textually) are rewritten too.
   */
  allRefs: Array<IdentifierRef> = new Array();

  /** Function info by declaration node. */
  infos: Map<FunctionDeclaration, FunctionInfo> = new Map();

  /** All scopes, in creation order. */
  scopes: Array<Scope> = new Array();

  /** Block node -> its scope (function body blocks excluded). */
  scopeOfBlock: Map<BlockStatement, Scope> = new Map();

  /** Switch case -> its scope. */
  scopeOfCase: Map<SwitchCase, Scope> = new Map();

  /** `for` statement -> its header scope. */
  scopeOfLoop: Map<ForStatement, Scope> = new Map();

  /** Block scopes that came from a `BlockStatement` (not switch/try). */
  plainBlocks: Set<Scope> = new Set();

  /** Every analysed function, in creation order. */
  allInfos: Array<FunctionInfo> = new Array();

  /** Variable declaration -> its binding. */
  bindingOf: Map<VariableDeclaration, Binding> = new Map();

  /** The env scope visible at a creation site; `null` would mean "received". */
  creationScope: Map<FunctionExpression, Scope | null> = new Map();

  /** Whether anything was captured at all. */
  captures: bool = false;

  /** Whether a refusal was reported (the AST is then left untouched). */
  refused: bool = false;

  /** Type parameter names of the owner, for the D11 check. */
  private typeParameters: Set<string> = new Set();

  /** Every `this` expression found inside an arrow. */
  thisUses: Array<ThisUse> = new Array();

  /** Function expressions that need an environment (so their `_env` is a struct). */
  structFunctions: Set<FunctionExpression> = new Set();

  /** `this` expressions that become a field read, and the env that holds it. */
  thisRefs: Map<ThisExpression, Scope> = new Map();

  /**
   * The type of the owner's own `this`, when it has one: a method's class, or an
   * explicit `this:` parameter. `null` for a free function, which has no `this`
   * to capture.
   */
  ownerThisType: TypeNode | null;

  constructor(
    private transform: ClosureLowerTransform,
    private parser: Parser,
    public owner: FunctionDeclaration,
    ownerThisType: TypeNode | null = null
  ) {
    this.ownerThisType = ownerThisType != null
      ? ownerThisType
      : owner.signature.explicitThisType;
    let typeParameters = owner.typeParameters;
    if (typeParameters) {
      for (let i = 0, k = typeParameters.length; i < k; ++i) {
        this.typeParameters.add(typeParameters[i].name.text);
      }
    }
  }

  /** Whether the owner has anything to rewrite. */
  hasCaptures(): bool {
    return this.captures;
  }

  /** Reports `Not implemented: <what>` and marks the owner refused. */
  refuse(range: Range, what: string): void {
    if (!this.refused) {
      this.refused = true;
      this.parser.error(DiagnosticCode.Not_implemented_0, range, what);
    }
  }

  /** Whether a block scope came from a `BlockStatement` (not switch/try). */
  private isPlainBlock(scope: Scope): bool {
    return this.plainBlocks.has(scope);
  }

  /** Runs the analysis over the owner's body. */
  run(): void {
    let info = this.analyzeFunction(this.owner, null, false, null, null);
    // The owner's own references now join the captured set.
    let refs = this.allRefs;
    for (let i = 0, k = refs.length; i < k; ++i) {
      let ref = refs[i];
      if (ref.binding.captured) {
        this.refs.set(ref.identifier, ref.binding);
        if (ref.write) this.writes.add(ref.identifier);
      }
    }
    // Assign environment names, and refuse the shapes C1 does not lower.
    let blockIndex = 0;
    let ownerName = this.owner.name.text;
    for (let i = 0, k = this.scopes.length; i < k; ++i) {
      let scope = this.scopes[i];
      if (scope.captured.length == 0) continue;
      if (scope.ownerFunction !== this.owner) {
        this.refuse(scope.range, "a capture from a nested function's body (closures lowering)");
        continue;
      }
      if (
        scope.kind == ScopeKind.Block &&
        !this.isPlainBlock(scope) &&
        !scope.isLoopHeader
      ) {
        this.refuse(scope.range, "a capture from a switch or try scope (closures lowering)");
        continue;
      }
      if (scope.kind == ScopeKind.Function) {
        scope.localName = ENV_LOCAL;
        scope.className = ownerName + ENV_SUFFIX;
      } else {
        ++blockIndex;
        scope.localName = ENV_LOCAL + "$" + blockIndex.toString();
        scope.className = ownerName + ENV_SUFFIX + "$" + blockIndex.toString();
      }
    }
    // `this` in an arrow: the shipped `Receiver` path when the arrow captures
    // nothing else, and a `$this` field when it does (§7.1).
    let uses = this.thisUses;
    for (let i = 0, k = uses.length; i < k; ++i) {
      let use = uses[i];
      let innermost = use.arrows[0];
      let env = innermost.needed;
      if (env == null) continue; // Receiver: delivered by the shipped path
      if (this.ownerThisType == null) {
        this.refuse(use.expression.range, "this in a capturing arrow (closures lowering)");
        continue;
      }
      if (env.ownerFunction !== this.owner) {
        this.refuse(use.expression.range,
          "a capture across more than one environment (closures lowering)");
        continue;
      }
      env.needsThis = true;
      this.thisRefs.set(use.expression, env);
    }
    if (info.needed != null) {
      this.refuse(this.owner.range,
        "a top-level function that captures (closures lowering)");
    }
  }

  // --- walking --------------------------------------------------------------

  private analyzeFunction(
    node: FunctionDeclaration,
    expression: FunctionExpression | null,
    isArrow: bool,
    parentScope: Scope | null,
    parentInfo: FunctionInfo | null
  ): FunctionInfo {
    let info = new FunctionInfo(node, expression, isArrow, node.isAsync, parentInfo);
    this.infos.set(node, info);
    this.allInfos.push(info);
    if (parentInfo) parentInfo.children.push(info);

    let scope = new Scope(ScopeKind.Function, parentScope, node, node.range);
    info.ownsScope = scope;
    this.scopes.push(scope);

    let parameters = node.signature.parameters;
    for (let i = 0, k = parameters.length; i < k; ++i) {
      let parameter = parameters[i];
      let binding = new Binding(parameter.name.text, parameter.type, scope, parameter, true);
      binding.isParam = true;
      scope.bindings.set(binding.name, binding);
    }

    let body = node.body;
    if (body != null) {
      if (body.kind == NodeKind.Block) {
        this.walkStatements((<BlockStatement>body).statements, scope, info);
      } else {
        this.walkStatement(body, scope, info);
      }
    }

    if (info.needed != null && expression != null) this.structFunctions.add(expression);

    // Propagate children's needs upward: a function that creates a closure
    // needing an environment must itself be handed that environment.
    for (let i = 0, k = info.children.length; i < k; ++i) {
      let child = info.children[i];
      if (child.needed != null) {
        if (child.needed.ownerFunction !== node) {
          this.needScope(info, child.needed, child.node.range);
        }
      }
    }
    return info;
  }

  /** Records that `info` needs `scope` delivered, refusing a second one (C1). */
  private needScope(info: FunctionInfo, scope: Scope, range: Range): void {
    if (info.needed == null) {
      info.needed = scope;
    } else if (info.needed !== scope) {
      this.refuse(range, "a capture across more than one environment (closures lowering)");
    }
  }

  private walkStatements(statements: Statement[], scope: Scope, info: FunctionInfo): void {
    for (let i = 0, k = statements.length; i < k; ++i) {
      this.walkStatement(statements[i], scope, info);
    }
  }

  private walkStatement(statement: Statement, scope: Scope, info: FunctionInfo): void {
    switch (statement.kind) {
      case NodeKind.Block: {
        let block = <BlockStatement>statement;
        let blockScope = new Scope(ScopeKind.Block, scope, info.node, block.range);
        this.scopeOfBlock.set(block, blockScope);
        this.plainBlocks.add(blockScope);
        this.scopes.push(blockScope);
        this.walkStatements(block.statements, blockScope, info);
        break;
      }
      case NodeKind.Variable: {
        let declarations = (<VariableStatement>statement).declarations;
        for (let i = 0, k = declarations.length; i < k; ++i) {
          this.declare(declarations[i], scope, false, info);
        }
        break;
      }
      case NodeKind.Expression: {
        let expression = (<ExpressionStatement>statement).expression;
        this.walkExpression(expression, scope, info, false);
        // A nested `function name() {}` is a *named function expression* in this
        // parser (`parser.ts:4274-4278`), and the compiler binds its name as a
        // scoped local. Record the same binding here so a later reference to it
        // can be recognised — the host-callback check needs exactly that.
        if (expression.kind == NodeKind.Function) {
          let closure = <FunctionExpression>expression;
          let name = closure.declaration.name;
          if (name.text.length > 0) scope.functionValues.set(name.text, closure);
        }
        break;
      }
      case NodeKind.Return: {
        let value = (<ReturnStatement>statement).value;
        if (value != null) this.walkExpression(value, scope, info, false);
        break;
      }
      case NodeKind.If: {
        let ifs = <IfStatement>statement;
        this.walkExpression(ifs.condition, scope, info, false);
        this.walkStatement(ifs.ifTrue, scope, info);
        if (ifs.ifFalse != null) this.walkStatement(ifs.ifFalse, scope, info);
        break;
      }
      case NodeKind.While: {
        let loop = <WhileStatement>statement;
        this.walkExpression(loop.condition, scope, info, false);
        this.walkStatement(loop.body, scope, info);
        break;
      }
      case NodeKind.Do: {
        let loop = <DoStatement>statement;
        this.walkStatement(loop.body, scope, info);
        this.walkExpression(loop.condition, scope, info, false);
        break;
      }
      case NodeKind.For: {
        let loop = <ForStatement>statement;
        let loopScope = new Scope(ScopeKind.Block, scope, info.node, loop.range);
        this.scopeOfLoop.set(loop, loopScope);
        this.scopes.push(loopScope);
        let initializer = loop.initializer;
        if (initializer != null) {
          if (initializer.kind == NodeKind.Variable) {
            let declarations = (<VariableStatement>initializer).declarations;
            for (let i = 0, k = declarations.length; i < k; ++i) {
              this.declare(declarations[i], loopScope, true, info, loop);
            }
          } else {
            this.walkStatement(initializer, loopScope, info);
          }
        }
        if (loop.condition != null) this.walkExpression(loop.condition, loopScope, info, false);
        if (loop.incrementor != null) this.walkExpression(loop.incrementor, loopScope, info, false);
        this.walkStatement(loop.body, loopScope, info);
        break;
      }
      case NodeKind.ForOf: {
        let loop = <ForOfStatement>statement;
        this.walkExpression(loop.iterable, scope, info, false);
        let loopScope = new Scope(ScopeKind.Block, scope, info.node, loop.range);
        this.scopes.push(loopScope);
        if (loop.variable.kind == NodeKind.Variable) {
          let declarations = (<VariableStatement>loop.variable).declarations;
          for (let i = 0, k = declarations.length; i < k; ++i) {
            this.declare(declarations[i], loopScope, true, info);
          }
        } else {
          this.walkStatement(loop.variable, loopScope, info);
        }
        this.walkStatement(loop.body, loopScope, info);
        break;
      }
      case NodeKind.Switch: {
        let switchStatement = <SwitchStatement>statement;
        this.walkExpression(switchStatement.condition, scope, info, false);
        let cases = switchStatement.cases;
        for (let i = 0, k = cases.length; i < k; ++i) {
          let switchCase = cases[i];
          if (switchCase.label != null) this.walkExpression(switchCase.label, scope, info, false);
          let caseScope = new Scope(ScopeKind.Block, scope, info.node, switchCase.range);
          this.scopeOfCase.set(switchCase, caseScope);
          this.scopes.push(caseScope);
          this.walkStatements(switchCase.statements, caseScope, info);
        }
        break;
      }
      case NodeKind.Try: {
        let tryStatement = <TryStatement>statement;
        let bodyScope = new Scope(ScopeKind.Block, scope, info.node, tryStatement.range);
        this.scopes.push(bodyScope);
        this.walkStatements(tryStatement.bodyStatements, bodyScope, info);
        if (tryStatement.catchStatements != null) {
          let catchScope = new Scope(ScopeKind.Block, scope, info.node, tryStatement.range);
          this.scopes.push(catchScope);
          let catchVariable = tryStatement.catchVariable;
          if (catchVariable != null) {
            let binding = new Binding(catchVariable.text, null, catchScope, catchVariable as Node as VariableDeclaration, true);
            catchScope.bindings.set(binding.name, binding);
          }
          this.walkStatements(tryStatement.catchStatements, catchScope, info);
        }
        if (tryStatement.finallyStatements != null) {
          let finallyScope = new Scope(ScopeKind.Block, scope, info.node, tryStatement.range);
          this.scopes.push(finallyScope);
          this.walkStatements(tryStatement.finallyStatements, finallyScope, info);
        }
        break;
      }
      case NodeKind.Throw: {
        this.walkExpression((<ThrowStatement>statement).value, scope, info, false);
        break;
      }
      case NodeKind.Break:
      case NodeKind.Continue:
      case NodeKind.Empty:
      case NodeKind.TypeDeclaration: {
        break;
      }
      default: {
        // A class or a nested declaration: the compiler refuses these shapes on
        // its own, and a capture inside them is refused at the declaration.
        break;
      }
    }
  }

  /** Declares one variable, at the point in the walk where it becomes visible. */
  private declare(
    declaration: VariableDeclaration,
    scope: Scope,
    isLoopHeader: bool,
    info: FunctionInfo,
    loop: ForStatement | null = null
  ): void {
    let initializer = declaration.initializer;
    if (initializer != null) {
      // The initializer runs before the binding is in scope (declaration order).
      this.walkExpression(initializer, scope, info, false);
    }
    let binding = new Binding(
      declaration.name.text,
      declaration.type,
      scope,
      declaration,
      initializer != null
    );
    binding.isLoopHeader = isLoopHeader;
    binding.isLoopHeaderOf = loop;
    if (initializer != null && initializer.kind == NodeKind.Function) {
      let closure = <FunctionExpression>initializer;
      if (this.structFunctions.has(closure)) binding.closureValue = closure;
    }
    binding.isConst = (declaration.flags & CommonFlags.Const) != 0;
    scope.bindings.set(binding.name, binding);
    this.bindingOf.set(declaration, binding);
  }

  private walkExpression(
    expression: Expression,
    scope: Scope,
    info: FunctionInfo,
    writeTarget: bool
  ): void {
    switch (expression.kind) {
      case NodeKind.Identifier: {
        let identifier = <IdentifierExpression>expression;
        let binding = scope.resolve(identifier.text);
        if (binding == null) return; // global, import, enum, type name
        this.allRefs.push(new IdentifierRef(identifier, binding, writeTarget));
        if (binding.scope.ownerFunction !== info.node) {
          this.capture(binding, identifier, info, writeTarget);
        }
        return;
      }
      case NodeKind.This: {
        this.markThis(<ThisExpression>expression, info);
        return;
      }
      case NodeKind.Super: {
        // `super` in an arrow needs the enclosing method's base class; see §7.5.
        if (info.isArrow) {
          this.refuse(expression.range, "super in a capturing arrow (closures lowering)");
        }
        return;
      }
      case NodeKind.True:
      case NodeKind.False:
      case NodeKind.Null: {
        return;
      }
      case NodeKind.Function: {
        let functionExpression = <FunctionExpression>expression;
        let declaration = functionExpression.declaration;
        let child = this.analyzeFunction(
          declaration,
          functionExpression,
          declaration.arrowKind != ArrowKind.None,
          scope,
          info
        );
        if (child.needed != null) {
          // The env at this site is the owning scope's local when this function
          // owns it, and the received env otherwise.
          this.creationScope.set(
            functionExpression,
            child.needed.ownerFunction === info.node ? child.needed : null
          );
        }
        return;
      }
      case NodeKind.Literal: {
        let literal = <LiteralExpression>expression;
        switch (literal.literalKind) {
          case LiteralKind.Template: {
            let parts = (<TemplateLiteralExpression>literal).expressions;
            for (let i = 0, k = parts.length; i < k; ++i) {
              this.walkExpression(parts[i], scope, info, false);
            }
            break;
          }
          case LiteralKind.Array: {
            let elements = (<ArrayLiteralExpression>literal).elementExpressions;
            for (let i = 0, k = elements.length; i < k; ++i) {
              this.walkExpression(elements[i], scope, info, false);
            }
            break;
          }
          case LiteralKind.Object: {
            let values = (<ObjectLiteralExpression>literal).values;
            for (let i = 0, k = values.length; i < k; ++i) {
              this.walkExpression(values[i], scope, info, false);
            }
            break;
          }
          default: break;
        }
        return;
      }
      case NodeKind.Binary: {
        let binary = <BinaryExpression>expression;
        let assignment = isAssignmentOperator(binary.operator);
        this.walkExpression(binary.left, scope, info, assignment);
        this.walkExpression(binary.right, scope, info, false);
        return;
      }
      case NodeKind.UnaryPrefix: {
        let prefix = <UnaryPrefixExpression>expression;
        let update = prefix.operator == Token.Plus_Plus || prefix.operator == Token.Minus_Minus;
        this.walkExpression(prefix.operand, scope, info, update);
        return;
      }
      case NodeKind.UnaryPostfix: {
        let postfix = <UnaryPostfixExpression>expression;
        let update = postfix.operator == Token.Plus_Plus || postfix.operator == Token.Minus_Minus;
        this.walkExpression(postfix.operand, scope, info, update);
        return;
      }
      case NodeKind.Call: {
        let call = <CallExpression>expression;
        this.walkExpression(call.expression, scope, info, false);
        let args = call.args;
        for (let i = 0, k = args.length; i < k; ++i) {
          this.walkExpression(args[i], scope, info, false);
        }
        if (isHostCallbackRegistration(call)) {
          for (let i = 0, k = args.length; i < k; ++i) {
            let closure = this.structClosureIn(args[i], scope);
            if (closure != null) {
              this.refuse(closure.range,
                "a closure captured by a host callback (closures lowering)");
            }
          }
        }
        return;
      }
      case NodeKind.Comma: {
        let expressions = (<CommaExpression>expression).expressions;
        for (let i = 0, k = expressions.length; i < k; ++i) {
          this.walkExpression(expressions[i], scope, info, i == k - 1 ? writeTarget : false);
        }
        return;
      }
      case NodeKind.ElementAccess: {
        let elementAccess = <ElementAccessExpression>expression;
        this.walkExpression(elementAccess.expression, scope, info, false);
        this.walkExpression(elementAccess.elementExpression, scope, info, false);
        return;
      }
      case NodeKind.InstanceOf: {
        this.walkExpression((<InstanceOfExpression>expression).expression, scope, info, false);
        return;
      }
      case NodeKind.New: {
        let args = (<NewExpression>expression).args;
        for (let i = 0, k = args.length; i < k; ++i) {
          this.walkExpression(args[i], scope, info, false);
        }
        return;
      }
      case NodeKind.Parenthesized: {
        this.walkExpression((<ParenthesizedExpression>expression).expression, scope, info, writeTarget);
        return;
      }
      case NodeKind.PropertyAccess: {
        // The property name is not a reference; only the receiver is walked.
        this.walkExpression((<PropertyAccessExpression>expression).expression, scope, info, false);
        return;
      }
      case NodeKind.Ternary: {
        let ternary = <TernaryExpression>expression;
        this.walkExpression(ternary.condition, scope, info, false);
        this.walkExpression(ternary.ifThen, scope, info, writeTarget);
        this.walkExpression(ternary.ifElse, scope, info, writeTarget);
        return;
      }
      case NodeKind.Assertion: {
        this.walkExpression((<AssertionExpression>expression).expression, scope, info, writeTarget);
        return;
      }
      case NodeKind.Await: {
        this.walkExpression((<AwaitExpression>expression).operand, scope, info, false);
        return;
      }
      default: {
        // Unknown expression kinds are not rewritten; if one hides a capture,
        // the compiler's own `declaredByFlow` check reports AS100.
        return;
      }
    }
  }

  /** Records one captured reference, and the refusals it implies. */
  private capture(
    binding: Binding,
    identifier: IdentifierExpression,
    info: FunctionInfo,
    writeTarget: bool
  ): void {
    this.captures = true;
    binding.captured = true;
    if (!binding.hasInitializer) binding.hasInitFlag = true;
    if (binding.isLoopHeader) {
      // A `for`-header binding is per-iteration in TypeScript; the loop's scope
      // owns the environment and clones it at the end of each body iteration
      // (§2.3, §5.4). A `for…of` header cannot be lowered this way — see the
      // refusal below.
      if (binding.isLoopHeaderOf == null) {
        this.refuse(identifier.range,
          "a captured for-of or for-in binding (closures lowering)");
      } else {
        binding.scope.isLoopHeader = true;
      }
    }
    // A capture inside an async body is lowered like any other: the environment
    // becomes an ordinary local of the async function's body, and the async
    // transform's own lifting rule carries that local across an await as a
    // managed state field — `docs/closures-plan.md` §8.3(b). No async-specific
    // code is involved, which is the layering the two plans were built for.
    if (binding.type == null) {
      this.refuse(identifier.range,
        "a captured local without a declared type (closures lowering)");
    } else if (mentionsTypeParameter(binding.type, this.typeParameters)) {
      this.refuse(identifier.range,
        "a captured local typed by a type parameter (closures lowering)");
    }
    if (writeTarget && binding.isConst) {
      this.refuse(identifier.range,
        "an assignment to a captured constant (closures lowering)");
    }
    if (binding.scope.ownerFunction !== this.owner) {
      this.refuse(identifier.range,
        "a capture from a nested function's body (closures lowering)");
    }
    info.capturesLocal = true;
    this.needScope(info, binding.scope, identifier.range);
    if (!binding.scope.captured.includes(binding)) binding.scope.captured.push(binding);
  }

  /**
   * Marks `this` as belonging to an enclosing function, through arrows only, and
   * records the arrow chain it escapes.
   *
   * The chain matters: every arrow between the reference and the non-arrow
   * function that supplies the receiver has to transport it — including an outer
   * arrow that does not itself mention `this`, but whose frame is where a nested
   * arrow is created (the shipped resolver marks exactly this set,
   * `resolver.ts:2295-2402`). If any arrow in the chain owns a local capture, the
   * whole chain is `Struct` and the receiver lives in the environment (§7.1).
   */
  /**
   * The `Struct` closure an argument denotes, if any: either a literal capturing
   * function expression, or a local initialised with one in this scope.
   *
   * A this-only arrow is deliberately *not* matched: its `_env` is the receiver,
   * and the shipped `makeCallbacks` guard already refuses it at run time
   * (`tension-framework/assembly/runtime/callbacks.ts:34-36`). This transform
   * refuses only the shape it creates (`docs/closures-plan.md` §9.1).
   */
  private structClosureIn(argument: Expression, scope: Scope): FunctionExpression | null {
    if (argument.kind == NodeKind.Function) {
      let closure = <FunctionExpression>argument;
      return this.structFunctions.has(closure) ? closure : null;
    }
    if (argument.kind == NodeKind.Identifier) {
      let name = (<IdentifierExpression>argument).text;
      let named = scope.resolveFunctionValue(name);
      if (named != null) return this.structFunctions.has(named) ? named : null;
      let binding = scope.resolve(name);
      if (binding != null && binding.closureValue != null) return binding.closureValue;
    }
    return null;
  }

  private markThis(expression: ThisExpression, info: FunctionInfo): void {
    let arrows = new Array<FunctionInfo>();
    let current: FunctionInfo | null = info;
    while (current != null && current.isArrow) {
      current.usesThis = true;
      arrows.push(current);
      current = current.parent;
    }
    if (arrows.length > 0) this.thisUses.push(new ThisUse(expression, arrows));
  }

  // --- emission -------------------------------------------------------------

  /** The env classes this owner needs, in scope order. */
  makeEnvClasses(): Array<ClassDeclaration> {
    let out = new Array<ClassDeclaration>();
    for (let i = 0, k = this.scopes.length; i < k; ++i) {
      let scope = this.scopes[i];
      if (scope.className == null) continue;
      out.push(this.makeEnvClass(scope));
    }
    return out;
  }

  private makeEnvClass(scope: Scope): ClassDeclaration {
    let fields = new Array<DeclarationStatement>();
    let range = scope.range;
    let bindings = scope.captured;
    // `$this` is field 0 whenever the environment carries the receiver
    // (`docs/closures-plan.md` §5.2, Decision 1). It is the only field whose
    // position is fixed; the rest follow in declaration order.
    if (scope.needsThis) {
      // `changetype<C>(0)`, not a bare declaration: a reference-typed field
      // without an initializer draws TS2564 (it is not assigned in the
      // constructor), and the value is written at the owner's scope entry
      // before any closure can read it.
      let thisType = assert(this.ownerThisType);
      fields.push(Node.createFieldDeclaration(
        Node.createIdentifierExpression(THIS_FIELD, range),
        null, CommonFlags.Instance,
        thisType,
        Node.createCallExpression(
          Node.createIdentifierExpression("changetype", range),
          [ thisType ],
          [ Node.createIntegerLiteralExpression(i64_new(0), range) ],
          range
        ),
        range
      ));
    }
    for (let i = 0, k = bindings.length; i < k; ++i) {
      fields.push(Node.createFieldDeclaration(
        Node.createIdentifierExpression(bindings[i].name, range),
        null, CommonFlags.Instance,
        bindings[i].type,
        null,
        range
      ));
    }
    for (let i = 0, k = bindings.length; i < k; ++i) {
      if (!bindings[i].hasInitFlag) continue;
      fields.push(Node.createFieldDeclaration(
        Node.createIdentifierExpression(INIT_PREFIX + bindings[i].name, range),
        null, CommonFlags.Instance,
        typeNode("bool", range),
        null,
        range
      ));
    }
    // A loop-header environment is cloned once per iteration (§5.4), so its
    // class carries the copy constructor that clone calls. `super()` is
    // required of a derived constructor (AS2377); every field is copied,
    // including `$this` (the receiver does not change between iterations) and
    // the `$init$` flags (a binding already assigned stays assigned).
    if (scope.isLoopHeader) {
      let selfName = assert(scope.className);
      let parameterName = "source";
      let statements = new Array<Statement>();
      statements.push(Node.createExpressionStatement(
        Node.createCallExpression(Node.createSuperExpression(range), null, [], range)
      ));
      let copies = new Array<Statement>();
      let all = new Array<string>();
      if (scope.needsThis) all.push(THIS_FIELD);
      for (let i = 0, k = bindings.length; i < k; ++i) {
        all.push(bindings[i].name);
        if (bindings[i].hasInitFlag) all.push(INIT_PREFIX + bindings[i].name);
      }
      for (let i = 0, k = all.length; i < k; ++i) {
        copies.push(Node.createExpressionStatement(
          this.assign(
            this.fieldOn("this", all[i], range),
            this.fieldOn(parameterName, all[i], range),
            range
          )
        ));
      }
      if (copies.length > 0) {
        statements.push(Node.createIfStatement(
          Node.createBinaryExpression(
            Token.Exclamation_Equals,
            Node.createIdentifierExpression(parameterName, range),
            Node.createNullExpression(range),
            range
          ),
          Node.createBlockStatement(copies, range),
          null,
          range
        ));
      }
      fields.push(Node.createMethodDeclaration(
        Node.createConstructorExpression(range),
        null, CommonFlags.Constructor | CommonFlags.Instance,
        null,
        Node.createFunctionType(
          [
            // `Optional` *with* an initializer, which is exactly how the
            // parser represents a defaulted parameter (`parser.ts:1490-1515`):
            // `Default` would make it required (`resolver.ts:392-400`), and an
            // optional parameter without an initializer is refused by the
            // varargs stub (`compiler.ts:6794-6797`). The plain `new X$Env()`
            // allocation stays valid, and `null` is the "first allocation" case.
            Node.createParameter(
              ParameterKind.Optional,
              Node.createIdentifierExpression(parameterName, range),
              Node.createNamedType(
                Node.createSimpleTypeName(selfName, range), null, true, range
              ),
              Node.createNullExpression(range),
              range
            )
          ],
          typeNode("void", range),
          null,
          false,
          range
        ),
        Node.createBlockStatement(statements, range),
        range
      ));
    }
    return Node.createClassDeclaration(
      Node.createIdentifierExpression(assert(scope.className), range),
      null, CommonFlags.None,
      null,
      typeNode("TaskEnv", range),
      null,
      fields,
      range
    );
  }

  /** Rewrites the owner and every nested function's body. */
  rewrite(): void {
    let info = assert(this.infos.get(this.owner));
    this.rewriteFunctionBody(info);
  }

  private rewriteFunctionBody(info: FunctionInfo): void {
    let body = info.node.body;
    if (body == null) return;
    let scope = assert(info.ownsScope);
    let statements: Array<Statement>;
    let expressionBody: ExpressionStatement | null = null;
    if (body.kind == NodeKind.Block) {
      statements = (<BlockStatement>body).statements;
    } else {
      expressionBody = <ExpressionStatement>body;
      statements = [ expressionBody ];
    }
    let rewritten = this.rewriteStatements(statements, scope, info.node);
    // The received-environment local is created by codegen, not declared here:
    // its declaration would land in a forked block flow, where the prologue
    // could not see it (`docs/closures-plan.md` §6.1).
    if (expressionBody != null) {
      // An arrow written as `(): T => expr` is parsed as an
      // `ExpressionStatement`, and the compiler treats that shape as an
      // implicit return (`compiler.ts:1816-1836`: a non-block body is an
      // expression statement, and only an arrow has one). Keep the shape: a
      // block with a bare expression statement would drop the return value.
      // The rewrite of an expression body cannot produce more than one
      // statement — a declaration needs a block, so an owning scope here is an
      // arrow whose env is delivered, not allocated.
      if (rewritten.length == 1 && rewritten[0].kind == NodeKind.Expression) {
        info.node.body = rewritten[0];
      } else {
        let returns = rewritten.length == 0
          ? new Array<Statement>()
          : rewritten.slice(0, rewritten.length - 1);
        let last = rewritten.length == 0 ? null : rewritten[rewritten.length - 1];
        if (last != null && last.kind == NodeKind.Expression) {
          returns.push(Node.createReturnStatement(
            (<ExpressionStatement>last).expression,
            last.range
          ));
        } else if (last != null) {
          returns.push(last);
        }
        info.node.body = Node.createBlockStatement(returns, expressionBody.range);
      }
    } else {
      let block = <BlockStatement>body;
      block.statements.length = 0;
      for (let i = 0, k = rewritten.length; i < k; ++i) block.statements.push(rewritten[i]);
    }
  }

  /** Rewrites one statement list, prepending an owned environment's setup. */
  private rewriteStatements(
    statements: Array<Statement>,
    scope: Scope,
    currentFunction: FunctionDeclaration,
    continueHook: Statement | null = null
  ): Array<Statement> {
    let out = new Array<Statement>();
    if (scope.localName != null) {
      out.push(this.makeEnvAllocation(scope));
      if (scope.needsThis) {
        // The receiver is a parameter of the owner, so it is in scope here.
        out.push(Node.createExpressionStatement(
          this.assign(
            this.fieldOn(assert(scope.localName), THIS_FIELD, scope.range),
            Node.createThisExpression(scope.range),
            scope.range
          )
        ));
      }
      let captured = scope.captured;
      for (let i = 0, k = captured.length; i < k; ++i) {
        let binding = captured[i];
        if (!binding.isParam) continue;
        out.push(Node.createExpressionStatement(
          this.assign(
            this.fieldOf(scope, binding, scope.range),
            Node.createIdentifierExpression(binding.name, scope.range),
            scope.range
          )
        ));
      }
    }
    for (let i = 0, k = statements.length; i < k; ++i) {
      let statement = this.rewriteStatement(statements[i], scope, currentFunction, continueHook);
      if (statement != null) out.push(statement);
    }
    return out;
  }

  /** `let $closureEnv: X$Env = new X$Env();` */
  private makeEnvAllocation(scope: Scope): Statement {
    let className = assert(scope.className);
    return Node.createVariableStatement(
      null,
      [
        Node.createVariableDeclaration(
          Node.createIdentifierExpression(assert(scope.localName), scope.range),
          null, CommonFlags.Let,
          typeNode(className, scope.range),
          Node.createNewExpression(Node.createSimpleTypeName(className, scope.range), null, [], scope.range),
          scope.range
        )
      ],
      scope.range
    );
  }

  private rewriteStatement(
    statement: Statement,
    scope: Scope,
    currentFunction: FunctionDeclaration,
    continueHook: Statement | null = null
  ): Statement | null {
    switch (statement.kind) {
      case NodeKind.Block: {
        let block = <BlockStatement>statement;
        let blockScope = this.scopeOfBlock.get(block);
        let inner = blockScope != null ? blockScope : scope;
        let rewritten = this.rewriteStatements(block.statements, inner, currentFunction, continueHook);
        return Node.createBlockStatement(rewritten, block.range);
      }
      case NodeKind.Variable: {
        let variable = <VariableStatement>statement;
        let kept = new Array<VariableDeclaration>();
        let out = new Array<Statement>();
        let declarations = variable.declarations;
        for (let i = 0, k = declarations.length; i < k; ++i) {
          let declaration = declarations[i];
          let binding = this.bindingOf.get(declaration);
          if (binding != null && binding.captured) {
            let initializer = declaration.initializer;
            if (initializer != null) {
              out.push(Node.createExpressionStatement(
                this.assign(
                  this.fieldOf(binding.scope, binding, declaration.name.range),
                  this.rewriteExpression(initializer, scope, currentFunction),
                  declaration.range
                )
              ));
            }
            // No initializer: the env field is zero-initialized and the flag is
            // false, which is exactly "declared, not yet assigned".
            continue;
          }
          if (declaration.initializer != null) {
            declaration.initializer = this.rewriteExpression(declaration.initializer, scope, currentFunction);
          }
          kept.push(declaration);
        }
        if (kept.length > 0) {
          out.unshift(Node.createVariableStatement(variable.decorators, kept, variable.range));
        }
        if (out.length == 0) return null;
        if (out.length == 1) return out[0];
        return Node.createBlockStatement(out, variable.range);
      }
      case NodeKind.Expression: {
        let expression = <ExpressionStatement>statement;
        return Node.createExpressionStatement(
          this.rewriteExpression(expression.expression, scope, currentFunction)
        );
      }
      case NodeKind.Return: {
        let ret = <ReturnStatement>statement;
        let value = ret.value;
        return Node.createReturnStatement(
          value != null ? this.rewriteExpression(value, scope, currentFunction) : null,
          ret.range
        );
      }
      case NodeKind.If: {
        let ifs = <IfStatement>statement;
        return Node.createIfStatement(
          this.rewriteExpression(ifs.condition, scope, currentFunction),
          assert(this.rewriteStatement(ifs.ifTrue, scope, currentFunction, continueHook)),
          ifs.ifFalse != null ? this.rewriteStatement(ifs.ifFalse, scope, currentFunction, continueHook) : null,
          ifs.range
        );
      }
      case NodeKind.While: {
        let loop = <WhileStatement>statement;
        // A nested loop owns its own `continue`: the hook from an outer loop
        // must not fire inside it.
        return Node.createWhileStatement(
          this.rewriteExpression(loop.condition, scope, currentFunction),
          assert(this.rewriteStatement(loop.body, scope, currentFunction, null)),
          loop.range
        );
      }
      case NodeKind.Do: {
        let loop = <DoStatement>statement;
        return Node.createDoStatement(
          assert(this.rewriteStatement(loop.body, scope, currentFunction, null)),
          this.rewriteExpression(loop.condition, scope, currentFunction),
          loop.range
        );
      }
      case NodeKind.For: {
        let loop = <ForStatement>statement;
        let loopScope = this.scopeOfLoop.get(loop);
        let inner = loopScope != null ? loopScope : scope;
        let ownsEnv = loopScope != null && loopScope.localName != null && loopScope.isLoopHeader;
        if (!ownsEnv) {
          let initializer = loop.initializer;
          return Node.createForStatement(
            initializer != null ? this.rewriteStatement(initializer, inner, currentFunction) : null,
            loop.condition != null ? this.rewriteExpression(loop.condition, inner, currentFunction) : null,
            loop.incrementor != null ? this.rewriteExpression(loop.incrementor, inner, currentFunction) : null,
            assert(this.rewriteStatement(loop.body, inner, currentFunction, null)),
            loop.range
          );
        }
        return this.rewriteHeaderLoop(loop, assert(loopScope), currentFunction);
      }
      case NodeKind.ForOf: {
        let loop = <ForOfStatement>statement;
        let variable = this.rewriteStatement(loop.variable, scope, currentFunction);
        return Node.createForOfStatement(
          assert(variable),
          this.rewriteExpression(loop.iterable, scope, currentFunction),
          assert(this.rewriteStatement(loop.body, scope, currentFunction)),
          loop.range
        );
      }
      case NodeKind.Switch: {
        let switchStatement = <SwitchStatement>statement;
        let cases = new Array<SwitchCase>();
        let outer = switchStatement.cases;
        for (let i = 0, k = outer.length; i < k; ++i) {
          let switchCase = outer[i];
          let caseScope = scope;
          // The case scope is recovered by finding the case's statements' scope:
          // each case was given its own Scope in the walk, in source order.
          let rewritten = new Array<Statement>();
          for (let j = 0, l = switchCase.statements.length; j < l; ++j) {
            let rewrittenStatement = this.rewriteStatement(switchCase.statements[j], caseScope, currentFunction);
            if (rewrittenStatement != null) rewritten.push(rewrittenStatement);
          }
          cases.push(Node.createSwitchCase(
            switchCase.label != null ? this.rewriteExpression(switchCase.label, scope, currentFunction) : null,
            rewritten,
            switchCase.range
          ));
        }
        return Node.createSwitchStatement(
          this.rewriteExpression(switchStatement.condition, scope, currentFunction),
          cases,
          switchStatement.range
        );
      }
      case NodeKind.Try: {
        let tryStatement = <TryStatement>statement;
        let body = new Array<Statement>();
        for (let i = 0, k = tryStatement.bodyStatements.length; i < k; ++i) {
          let rewritten = this.rewriteStatement(tryStatement.bodyStatements[i], scope, currentFunction);
          if (rewritten != null) body.push(rewritten);
        }
        let catchStatements: Array<Statement> | null = null;
        if (tryStatement.catchStatements != null) {
          catchStatements = new Array();
          for (let i = 0, k = tryStatement.catchStatements.length; i < k; ++i) {
            let rewritten = this.rewriteStatement(tryStatement.catchStatements[i], scope, currentFunction);
            if (rewritten != null) catchStatements.push(rewritten);
          }
        }
        let finallyStatements: Array<Statement> | null = null;
        if (tryStatement.finallyStatements != null) {
          finallyStatements = new Array();
          for (let i = 0, k = tryStatement.finallyStatements.length; i < k; ++i) {
            let rewritten = this.rewriteStatement(tryStatement.finallyStatements[i], scope, currentFunction);
            if (rewritten != null) finallyStatements.push(rewritten);
          }
        }
        return Node.createTryStatement(
          body,
          tryStatement.catchVariable,
          catchStatements,
          finallyStatements,
          tryStatement.range
        );
      }
      case NodeKind.Continue: {
        // A `continue` in a `for`-header-capturing loop must run the clone that
        // the loop body's last statement performs, because `continue` skips the
        // rest of the body and goes straight to the incrementor (§2.3).
        if (continueHook == null) return statement;
        return Node.createBlockStatement([
          continueHook,
          Node.createContinueStatement(
            (<ContinueStatement>statement).label,
            statement.range
          )
        ], statement.range);
      }
      case NodeKind.Throw: {
        let thrown = <ThrowStatement>statement;
        return Node.createThrowStatement(
          this.rewriteExpression(thrown.value, scope, currentFunction),
          thrown.range
        );
      }
      default: {
        return statement;
      }
    }
  }

  /**
   * Rewrites a `for` loop whose header declares captured bindings (§2.3, §5.4).
   *
   * The environment is allocated once, before the loop, and the header
   * declarations become field assignments in a prelude. The body's last
   * statement — and every `continue` that targets this loop — replaces the
   * environment with a fresh copy of itself, so iteration *k*'s closures keep
   * the values iteration *k* saw. The incrementor stays in the `for` header and
   * therefore runs on the *fresh* environment, which is what makes
   * `for (let i = 0; …; i++)` yield 0, 1, 2 rather than 0, 0, 0 or 3, 3, 3.
   *
   * ```
   * let $closureEnv$1 = new f$Env$1();
   * $closureEnv$1.i = 0;
   * for (; $closureEnv$1.i < 3; $closureEnv$1.i++) {
   *   …body…
   *   $closureEnv$1 = new f$Env$1($closureEnv$1);   // clone, before the incrementor
   * }
   * ```
   */
  private rewriteHeaderLoop(
    loop: ForStatement,
    loopScope: Scope,
    currentFunction: FunctionDeclaration
  ): Statement {
    let prelude = new Array<Statement>();
    prelude.push(this.makeEnvAllocation(loopScope));
    if (loopScope.needsThis) {
      prelude.push(Node.createExpressionStatement(
        this.assign(
          this.fieldOn(assert(loopScope.localName), THIS_FIELD, loop.range),
          Node.createThisExpression(loop.range),
          loop.range
        )
      ));
    }

    // The initializer runs once: the captured declarations become assignments in
    // the prelude, and the rest stays a `let` in the header.
    let keptInitializer: Statement | null = null;
    let initializer = loop.initializer;
    if (initializer != null) {
      if (initializer.kind == NodeKind.Variable) {
        let variable = <VariableStatement>initializer;
        let kept = new Array<VariableDeclaration>();
        let declarations = variable.declarations;
        for (let i = 0, k = declarations.length; i < k; ++i) {
          let declaration = declarations[i];
          let binding = this.bindingOf.get(declaration);
          if (binding != null && binding.captured) {
            if (declaration.initializer != null) {
              prelude.push(Node.createExpressionStatement(
                this.assign(
                  this.fieldOf(loopScope, binding, declaration.name.range),
                  this.rewriteExpression(declaration.initializer, loopScope, currentFunction),
                  declaration.range
                )
              ));
            }
          } else {
            if (declaration.initializer != null) {
              declaration.initializer = this.rewriteExpression(declaration.initializer, loopScope, currentFunction);
            }
            kept.push(declaration);
          }
        }
        if (kept.length > 0) {
          keptInitializer = Node.createVariableStatement(variable.decorators, kept, variable.range);
        }
      } else {
        keptInitializer = this.rewriteStatement(initializer, loopScope, currentFunction, null);
      }
    }

    // The clone is a fresh statement in each position: the AST is a tree, and
    // the same node cannot be shared between the body's tail and a `continue`.
    let body = this.rewriteStatement(
      loop.body, loopScope, currentFunction, this.makeCloneStatement(loopScope)
    );
    let rewrittenBody = assert(body);
    let bodyStatements = rewrittenBody.kind == NodeKind.Block
      ? (<BlockStatement>rewrittenBody).statements
      : [ rewrittenBody ];
    bodyStatements.push(this.makeCloneStatement(loopScope));

    let rewritten = Node.createForStatement(
      keptInitializer,
      loop.condition != null ? this.rewriteExpression(loop.condition, loopScope, currentFunction) : null,
      loop.incrementor != null ? this.rewriteExpression(loop.incrementor, loopScope, currentFunction) : null,
      Node.createBlockStatement(bodyStatements, loop.body.range),
      loop.range
    );
    prelude.push(rewritten);
    return Node.createBlockStatement(prelude, loop.range);
  }

  /** `$closureEnv$N = new X$Env$N($closureEnv$N);` */
  private makeCloneStatement(scope: Scope): Statement {
    let localName = assert(scope.localName);
    let className = assert(scope.className);
    return Node.createExpressionStatement(
      this.assign(
        Node.createIdentifierExpression(localName, scope.range),
        Node.createNewExpression(
          Node.createSimpleTypeName(className, scope.range),
          null,
          [ Node.createIdentifierExpression(localName, scope.range) ],
          scope.range
        ),
        scope.range
      )
    );
  }

  private rewriteExpression(
    expression: Expression,
    scope: Scope,
    currentFunction: FunctionDeclaration
  ): Expression {
    switch (expression.kind) {
      case NodeKind.This: {
        let env = this.thisRefs.get(<ThisExpression>expression);
        if (env == null) return expression; // Receiver path: leave it alone
        let localName = env.ownerFunction === currentFunction
          ? assert(env.localName)
          : ENV_IN_LOCAL;
        return this.fieldOn(localName, THIS_FIELD, expression.range);
      }
      case NodeKind.Identifier: {
        let identifier = <IdentifierExpression>expression;
        let binding = this.refs.get(identifier);
        if (binding == null) return expression;
        let field = this.fieldOfFor(binding, currentFunction, identifier.range);
        if (binding.hasInitFlag) {
          return Node.createCommaExpression(
            [ this.guard(binding, field, currentFunction, identifier.range), field ],
            identifier.range
          );
        }
        return field;
      }
      case NodeKind.Binary: {
        let binary = <BinaryExpression>expression;
        if (isAssignmentOperator(binary.operator) && binary.left.kind == NodeKind.Identifier) {
          let identifier = <IdentifierExpression>binary.left;
          let binding = this.refs.get(identifier);
          if (binding != null) {
            let target = this.fieldOfFor(binding, currentFunction, binary.left.range);
            let value = this.rewriteExpression(binary.right, scope, currentFunction);
            if (binary.operator == Token.Equals) {
              if (binding.hasInitFlag) {
                return Node.createCommaExpression([
                  this.assign(this.flagField(binding, currentFunction, binary.range), Node.createTrueExpression(binary.range), binary.range),
                  this.assign(target, value, binary.range)
                ], binary.range);
              }
              return this.assign(target, value, binary.range);
            }
            // Compound assignment reads the old value first.
            let parts = new Array<Expression>();
            if (binding.hasInitFlag) {
              parts.push(this.guard(binding, target, currentFunction, binary.range));
              parts.push(this.assign(this.flagField(binding, currentFunction, binary.range), Node.createTrueExpression(binary.range), binary.range));
            }
            parts.push(Node.createBinaryExpression(binary.operator, target, value, binary.range));
            return parts.length == 1
              ? parts[0]
              : Node.createCommaExpression(parts, binary.range);
          }
        }
        return Node.createBinaryExpression(
          binary.operator,
          this.rewriteExpression(binary.left, scope, currentFunction),
          this.rewriteExpression(binary.right, scope, currentFunction),
          binary.range
        );
      }
      case NodeKind.UnaryPrefix: {
        let prefix = <UnaryPrefixExpression>expression;
        let binding = prefix.operand.kind == NodeKind.Identifier
          ? this.refs.get(<IdentifierExpression>prefix.operand)
          : null;
        if (binding != null) {
          let target = this.fieldOfFor(binding, currentFunction, prefix.range);
          let parts = new Array<Expression>();
          if (binding.hasInitFlag) {
            parts.push(this.guard(binding, target, currentFunction, prefix.range));
            parts.push(this.assign(this.flagField(binding, currentFunction, prefix.range), Node.createTrueExpression(prefix.range), prefix.range));
          }
          parts.push(Node.createUnaryPrefixExpression(prefix.operator, target, prefix.range));
          return parts.length == 1 ? parts[0] : Node.createCommaExpression(parts, prefix.range);
        }
        return Node.createUnaryPrefixExpression(
          prefix.operator,
          this.rewriteExpression(prefix.operand, scope, currentFunction),
          prefix.range
        );
      }
      case NodeKind.UnaryPostfix: {
        let postfix = <UnaryPostfixExpression>expression;
        let binding = postfix.operand.kind == NodeKind.Identifier
          ? this.refs.get(<IdentifierExpression>postfix.operand)
          : null;
        if (binding != null) {
          let target = this.fieldOfFor(binding, currentFunction, postfix.range);
          let parts = new Array<Expression>();
          if (binding.hasInitFlag) {
            parts.push(this.guard(binding, target, currentFunction, postfix.range));
            parts.push(this.assign(this.flagField(binding, currentFunction, postfix.range), Node.createTrueExpression(postfix.range), postfix.range));
          }
          parts.push(Node.createUnaryPostfixExpression(postfix.operator, target, postfix.range));
          return parts.length == 1 ? parts[0] : Node.createCommaExpression(parts, postfix.range);
        }
        return Node.createUnaryPostfixExpression(
          postfix.operator,
          this.rewriteExpression(postfix.operand, scope, currentFunction),
          postfix.range
        );
      }
      case NodeKind.Call: {
        let call = <CallExpression>expression;
        let args = new Array<Expression>();
        for (let i = 0, k = call.args.length; i < k; ++i) {
          args.push(this.rewriteExpression(call.args[i], scope, currentFunction));
        }
        return Node.createCallExpression(
          this.rewriteExpression(call.expression, scope, currentFunction),
          call.typeArguments,
          args,
          call.range
        );
      }
      case NodeKind.Function: {
        let functionExpression = <FunctionExpression>expression;
        let info = this.infos.get(functionExpression.declaration);
        if (info != null) {
          this.rewriteFunctionBody(info);
          if (info.needed != null) {
            let className = assert(info.needed.className);
            envInfoOf.set(functionExpression, new EnvInfo(EnvKind.Struct, className));
            let created = this.creationScope.get(functionExpression);
            creationEnvOf.set(
              functionExpression,
              created != null ? assert(created.localName) : ENV_IN_LOCAL
            );
          }
        }
        return expression;
      }
      case NodeKind.Literal: {
        let literal = <LiteralExpression>expression;
        switch (literal.literalKind) {
          case LiteralKind.Template: {
            let parts = (<TemplateLiteralExpression>literal).expressions;
            for (let i = 0, k = parts.length; i < k; ++i) {
              parts[i] = this.rewriteExpression(parts[i], scope, currentFunction);
            }
            break;
          }
          case LiteralKind.Array: {
            let elements = (<ArrayLiteralExpression>literal).elementExpressions;
            for (let i = 0, k = elements.length; i < k; ++i) {
              elements[i] = this.rewriteExpression(elements[i], scope, currentFunction);
            }
            break;
          }
          case LiteralKind.Object: {
            let values = (<ObjectLiteralExpression>literal).values;
            for (let i = 0, k = values.length; i < k; ++i) {
              values[i] = this.rewriteExpression(values[i], scope, currentFunction);
            }
            break;
          }
          default: break;
        }
        return literal;
      }
      case NodeKind.Comma: {
        let comma = <CommaExpression>expression;
        let expressions = new Array<Expression>();
        for (let i = 0, k = comma.expressions.length; i < k; ++i) {
          expressions.push(this.rewriteExpression(comma.expressions[i], scope, currentFunction));
        }
        return Node.createCommaExpression(expressions, comma.range);
      }
      case NodeKind.ElementAccess: {
        let elementAccess = <ElementAccessExpression>expression;
        return Node.createElementAccessExpression(
          this.rewriteExpression(elementAccess.expression, scope, currentFunction),
          this.rewriteExpression(elementAccess.elementExpression, scope, currentFunction),
          elementAccess.range
        );
      }
      case NodeKind.InstanceOf: {
        let instanceOf = <InstanceOfExpression>expression;
        return Node.createInstanceOfExpression(
          this.rewriteExpression(instanceOf.expression, scope, currentFunction),
          instanceOf.isType,
          instanceOf.range
        );
      }
      case NodeKind.New: {
        let newExpression = <NewExpression>expression;
        let args = new Array<Expression>();
        for (let i = 0, k = newExpression.args.length; i < k; ++i) {
          args.push(this.rewriteExpression(newExpression.args[i], scope, currentFunction));
        }
        return Node.createNewExpression(
          newExpression.typeName,
          newExpression.typeArguments,
          args,
          newExpression.range
        );
      }
      case NodeKind.Parenthesized: {
        let parenthesized = <ParenthesizedExpression>expression;
        return Node.createParenthesizedExpression(
          this.rewriteExpression(parenthesized.expression, scope, currentFunction),
          parenthesized.range
        );
      }
      case NodeKind.PropertyAccess: {
        let access = <PropertyAccessExpression>expression;
        return Node.createPropertyAccessExpression(
          this.rewriteExpression(access.expression, scope, currentFunction),
          access.property,
          access.range
        );
      }
      case NodeKind.Ternary: {
        let ternary = <TernaryExpression>expression;
        return Node.createTernaryExpression(
          this.rewriteExpression(ternary.condition, scope, currentFunction),
          this.rewriteExpression(ternary.ifThen, scope, currentFunction),
          this.rewriteExpression(ternary.ifElse, scope, currentFunction),
          ternary.range
        );
      }
      case NodeKind.Assertion: {
        let assertion = <AssertionExpression>expression;
        assertion.expression = this.rewriteExpression(assertion.expression, scope, currentFunction);
        return assertion;
      }
      case NodeKind.Await: {
        let awaitExpression = <AwaitExpression>expression;
        awaitExpression.operand = this.rewriteExpression(awaitExpression.operand, scope, currentFunction);
        return awaitExpression;
      }
      default: {
        return expression;
      }
    }
  }

  // --- field access helpers -------------------------------------------------

  /** The env expression for a binding, inside `currentFunction`. */
  private fieldOfFor(binding: Binding, currentFunction: FunctionDeclaration, range: Range): Expression {
    if (binding.scope.ownerFunction === currentFunction) {
      return this.fieldOf(binding.scope, binding, range);
    }
    return this.fieldOn(ENV_IN_LOCAL, binding.name, range);
  }

  private fieldOf(scope: Scope, binding: Binding, range: Range): Expression {
    return this.fieldOn(assert(scope.localName), binding.name, range);
  }

  private fieldOn(localName: string, fieldName: string, range: Range): PropertyAccessExpression {
    return Node.createPropertyAccessExpression(
      Node.createIdentifierExpression(localName, range),
      Node.createIdentifierExpression(fieldName, range),
      range
    );
  }

  private flagField(binding: Binding, currentFunction: FunctionDeclaration, range: Range): Expression {
    return this.fieldOn(
      binding.scope.ownerFunction === currentFunction ? assert(binding.scope.localName) : ENV_IN_LOCAL,
      INIT_PREFIX + binding.name,
      range
    );
  }

  private guard(
    binding: Binding,
    field: Expression,
    currentFunction: FunctionDeclaration,
    range: Range
  ): Expression {
    return Node.createCallExpression(
      Node.createIdentifierExpression(INIT_HELPER, range),
      [ assert(binding.type) ],
      [
        field,
        this.flagField(binding, currentFunction, range),
        Node.createStringLiteralExpression(binding.name, range)
      ],
      range
    );
  }

  private assign(target: Expression, value: Expression, range: Range): Expression {
    return Node.createBinaryExpression(Token.Equals, target, value, range);
  }
}

// --- helpers ----------------------------------------------------------------

function typeNode(name: string, range: Range): NamedTypeNode {
  return Node.createNamedType(Node.createSimpleTypeName(name, range), null, false, range);
}

/**
 * Whether this call registers a host callback.
 *
 * The compiled guest calls `makeCallbacks(onBatch, onEvent)` from the framework
 * (`tension-framework/assembly/runtime/callbacks.ts:56`), and the host has no
 * indirect-call site at which to restore a closure's environment (§9.1). The
 * transform runs before resolution, so it recognises the registration by name —
 * the one place it names a framework symbol rather than a std one, and the
 * reason the refusal is a compile-time message instead of the runtime assert.
 */
function isHostCallbackRegistration(call: CallExpression): bool {
  let callee = call.expression;
  let name = callee.kind == NodeKind.Identifier
    ? (<IdentifierExpression>callee).text
    : callee.kind == NodeKind.PropertyAccess
      ? (<PropertyAccessExpression>callee).property.text
      : "";
  return name == "makeCallbacks";
}


/** `true` for the simple and compound assignment operators. */
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
    case Token.Bar_Equals:
    case Token.Caret_Equals:
      return true;
    default:
      return false;
  }
}

/** Whether a type node names one of `names`, recursively (D11's check). */
function mentionsTypeParameter(type: TypeNode, names: Set<string>): bool {
  if (names.size == 0) return false;
  if (type.kind == NodeKind.NamedType) {
    let named = <NamedTypeNode>type;
    if (names.has(named.name.identifier.text)) return true;
    let args = named.typeArguments;
    if (args != null) {
      for (let i = 0, k = args.length; i < k; ++i) {
        if (mentionsTypeParameter(args[i], names)) return true;
      }
    }
  }
  return false;
}
