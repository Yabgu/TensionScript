// The `afterParse` lowering transform (Phase 3, commit 3).
//
// What is under test: the three artifacts of the state-machine shape
// (`docs/async-await-plan-v2.md` §4.1) — the state struct, the entry, and the
// resume function with its guarded regions — including `await` as a state
// transition, the settled guard (§1.2 rule 4), the per-await resume-point
// discriminators (§4.1 artifact 1), the handle and its register call (§4.7.3),
// and the typed read codegen emits at the await site (§4.7.4). Also under test:
// every shape this revision does not lower is *refused by name*, never emitted
// as wrong code.
//
// Not under test, and not implemented: lifting (commit 4), the six correctness
// cases — loops, conditionals, nesting, closures (commit 5), the runtime, the
// resume dispatch and Phase 4's machine behind `~lib/task-rt`.
//
// Run: npm run test:async
//
// Why the compiler is driven directly rather than through the CLI: the parser
// still carries Phase 1's `AS100` guard for every `async` construct, and the CLI
// stops at the first parse error before the `afterParse` hook runs
// (`cli/index.js:634-638` returns from `parseBacklog`). The guard is deleted in
// commit 7b. Until then this test drives the same sequence the CLI does —
// `afterParse` on `program.parser`, then `initialize()`, then `compile()` —
// with the diagnostic gate removed, which is what makes the emitted *shape*
// observable at all.
//
// One compiler property the helpers respect: a `Program` may be compiled once.
// A second `compile()` on the same program throws (measured), so `wat` is
// memoized per program.

import { readFileSync } from "node:fs";
import {
  buildProgram,
  assemblyscript as asc
} from "./harness.js";

let failures = 0;
let checks = 0;

function check(name, actual, expected) {
  ++checks;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok  ${name}`);
  } else {
    ++failures;
    console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
  }
}

// AS100 "Not implemented: {0}" — the code every refusal uses, with the `{0}`
// naming the gap.
const NOT_IMPLEMENTED = 100;

/** Compiles `source` through the lowering transform, exactly as the CLI would. */
function run(source) {
  const program = buildProgram([ [ "probe.ts", source ] ]);
  const Transform = asc.AsyncLowerTransform;
  // The CLI assigns these onto the transform's prototype before instantiating
  // it (`cli/index.js:455-462`) — this is that assignment, not a re-implementation.
  Object.assign(Transform.prototype, { program });
  new Transform().afterParse(program.parser);
  const file = program.sources.find(source => source.internalPath === "probe");
  return {
    program,
    file,
    /** Top-level names, for a quick "what was emitted" read. */
    names: () => file.statements.map(statement => statement.name ? statement.name.text : String(statement.kind)),
    /** Compiles once, and answers the module's text. */
    wat: () => {
      if (program.__wat) return program.__wat;
      program.initialize();
      return (program.__wat = asc.compile(program).toText(true));
    },
    /** Compiles once and answers whether the module validates. */
    validate: () => asc.validate(asc.compile(program))
  };
}

/**
 * Compiles `source` through **both** `afterParse` transforms, in the order the
 * CLI applies them (`cli/index.js:697-701`): closures first, then async. The
 * §8.3(a) shapes need it — the closure transform is what records that a nested
 * async function is a `Struct` closure (`envInfoOf`), and without that record
 * the async transform has nothing to carry into `state.$env`.
 */
function runBoth(source) {
  const program = buildProgram([ [ "probe.ts", source ] ]);
  for (const Transform of [ asc.ClosureLowerTransform, asc.AsyncLowerTransform ]) {
    Object.assign(Transform.prototype, { program });
    new Transform().afterParse(program.parser);
  }
  const file = program.sources.find(source => source.internalPath === "probe");
  return {
    program,
    file,
    names: () => file.statements.map(statement => statement.name ? statement.name.text : String(statement.kind)),
    wat: () => {
      if (program.__wat) return program.__wat;
      program.initialize();
      return (program.__wat = asc.compile(program).toText(true));
    }
  };
}

/**
 * The run's refusals, by the *gap* they name. The parser reports no `async`
 * diagnostic at all since commit 7b deleted its guard, so everything here comes
 * from a transform — and a guard that came back would show up as an extra entry
 * and fail the tests that expect an exact list.
 */
function refusals(run) {
  return run.program.parser.diagnostics
    .filter(diagnostic => diagnostic.code === NOT_IMPLEMENTED)
    .map(diagnostic => diagnostic.message.replace("Not implemented: ", ""));
}

/**
 * Compiles the run and answers every diagnostic that is not a named refusal.
 * This is the "actually compiles" check: a synthesized construction site can be
 * well-formed as an AST and still draw a resolver error (measured: TS2554 for
 * `new m$ThisEnv(this)` against a class with no constructor), and the parser's
 * `AS100` guard would otherwise mask it.
 */
function compileErrors(run) {
  run.wat(); // compiles once, memoized
  return run.program.parser.diagnostics
    .filter(diagnostic => diagnostic.code !== NOT_IMPLEMENTED)
    .map(diagnostic => `${diagnostic.code}: ${diagnostic.message}`);
}

/** The text of one function in a module, params and body, for scoped matching. */
function funcBody(wat, name) {
  const lines = wat.split("\n");
  const start = lines.findIndex(line => line.includes(`(func $${name} `) || line.includes(`(func $${name}(`));
  if (start < 0) return "";
  let depth = 0;
  const out = [];
  for (let i = start; i < lines.length; ++i) {
    out.push(lines[i]);
    for (const ch of lines[i]) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
    }
    if (depth === 0 && i > start) break;
  }
  return out.join("\n");
}

/** Every statement in a tree, depth-first. */
function walkStatements(statement, visit) {
  visit(statement);
  switch (statement.kind) {
    case asc.NodeKind.Block:
      for (const inner of statement.statements) walkStatements(inner, visit);
      break;
    case asc.NodeKind.If:
      walkStatements(statement.ifTrue, visit);
      if (statement.ifFalse) walkStatements(statement.ifFalse, visit);
      break;
    case asc.NodeKind.While:
      walkStatements(statement.body, visit);
      break;
    case asc.NodeKind.For:
      if (statement.initializer) walkStatements(statement.initializer, visit);
      walkStatements(statement.body, visit);
      break;
  }
}

/** The condition temporaries of an emitted `if` dispatch, by name. */
function condTemps(resumeNode) {
  const names = new Set();
  walkStatements(resumeNode, (statement) => {
    if (
      statement.kind === asc.NodeKind.Variable &&
      statement.declarations[0].name.text.startsWith("$cond")
    ) names.add(statement.declarations[0].name.text);
  });
  return [ ...names ];
}

/** The typed read of an `await` in `wat`, as `[offset, count]`. */
function readOffsets(wat) {
  const offsets = [];
  for (const match of wat.matchAll(/i32\.load offset=(\d+)/g)) offsets.push(Number(match[1]));
  return offsets;
}

const HANDLE_SOURCE = `
async function f(h: Task<i32>): i32 {
  let x: i32 = await h;
  return x + 1;
}
export function probe(): Task<i32> { return f(make()); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`;

// 1. The shape (§4.1's three artifacts).

{
  const r = run(HANDLE_SOURCE);
  const statements = r.file.statements;

  check("three artifacts are emitted for `f`", r.names(), [ "f$State", "f", "f$resume", "probe", "make" ]);
  check("the state class comes first", statements[0].name.text, "f$State");
  check("the entry keeps the function's name", statements[1].name.text, "f");
  check("the resume function follows the entry", statements[2].name.text, "f$resume");

  const state = statements[0];
  check("the state class extends TaskState (§4.7.3)", state.extendsType.name.identifier.text, "TaskState");
  check(
    "the state class carries the parameter, resumePoint, the awaited record, result and handle",
    state.members.filter(member => member.kind === asc.NodeKind.FieldDeclaration).map(member => member.name.text),
    [ "h", "$env", "x", "resumePoint", "result", "$awaited1", "handle" ]
  );
  const ctor = state.members.find(member => member.kind === asc.NodeKind.MethodDeclaration);
  check("the constructor calls super() first (AS2377)", ctor.body.statements[0].expression.kind, asc.NodeKind.Call);
  check("  ...on `super`", ctor.body.statements[0].expression.expression.kind, asc.NodeKind.Super);

  const entry = statements[1];
  check("the entry is no longer marked async", entry.isAsync, false);
  check(
    "the entry's declared return type is the handle, not the value type",
    entry.signature.returnType.name.identifier.text,
    "Task"
  );
  check(
    "the entry allocates the state, builds the handle, registers, resumes, and returns",
    entry.body.statements.map(statement => statement.kind),
    [ asc.NodeKind.Variable, asc.NodeKind.Expression, asc.NodeKind.Expression, asc.NodeKind.Expression, asc.NodeKind.Return ]
  );
  const registerStatement = entry.body.statements[2].expression;
  check("the register call assigns the handle's record", registerStatement.left.property.text, "_record");
  check("  ...from __taskRegister", registerStatement.right.expression.text, "__taskRegister");
  check(
    "  ...and the entry returns the handle",
    entry.body.statements[4].value.property.text,
    "handle"
  );

  const resume = statements[2];
  check(
    "the resume function takes the state alone (§4.3)",
    resume.signature.parameters.map(parameter => parameter.name.text),
    [ "state" ]
  );
  check(
    "the resume body copies the parameter and the lifted local in, then guards the regions",
    resume.body.statements.map(statement => statement.kind),
    [ asc.NodeKind.Variable, asc.NodeKind.Variable, asc.NodeKind.If, asc.NodeKind.If, asc.NodeKind.If ]
  );
}

// 2. The same shape, in the emitted module.

{
  const r = run(HANDLE_SOURCE);
  const wat = r.wat();
  check("codegen emits the state class's constructor", wat.includes("(func $probe/f$State#constructor"), true);
  check("codegen emits the entry function", /\(func \$probe\/f \(param \$0 i32\) \(result i32\)/.test(wat), true);
  check("codegen emits the resume function", /\(func \$probe\/f\$resume \(param \$0 i32\)/.test(wat), true);
  check("the entry constructs the state struct", wat.includes("call $probe/f$State#constructor"), true);
  check("the entry builds the handle", /call \$~lib\/task\/Task<i32>#constructor/.test(wat), true);
  check("the entry registers the task", wat.includes("call $~lib/task-rt/__taskRegister"), true);
  check("the entry calls the resume function", wat.includes("call $probe/f$resume"), true);
  check("the state struct is a managed class the collector visits", wat.includes("call $probe/f$State~visit"), true);
  check(
    "  ...and its visitor traces its managed fields",
    /\$probe\/f\$State~visit[\s\S]{0,700}?call \$~lib\/rt\/itcms\/__visit/.test(wat),
    true
  );
}

// 3. `await` as a state transition: suspend, settle, park, resume, read.

{
  const r = run(HANDLE_SOURCE);
  const wat = r.wat();
  // Scoped to the resume function: the constructor's own zero-init pass writes
  // `resumePoint` too, and it is not a discriminator.
  const points = [ ...funcBody(wat, "probe/f$resume")
    .matchAll(/i32\.const (\d+)\n *call \$probe\/f\$State#set:resumePoint/g) ]
    .map(match => Number(match[1]));
  // The entry's point is 0, but it is the *constructor's* write (the transform
  // initializes `resumePoint` there, `lowResumePoint = 0`); the resume function
  // itself writes the await's discriminator and the terminal.
  check("the resume points written are the await's, the continuation's clear, and the terminal", points, [ 1, 0, 2 ]);
  check("the operand's record is stored in the state struct", wat.includes("call $probe/f$State#set:$awaited1"), true);
  check("the settled check runs before the park (§1.2 rule 4)", wat.includes("call $~lib/task-rt/__taskSettled"), true);
  check("the parked path calls __taskPark", wat.includes("call $~lib/task-rt/__taskPark"), true);
  check(
    "  ...and returns (§4.1: a suspension is a return)",
    /call \$~lib\/task-rt\/__taskPark\n *return/.test(wat),
    true
  );
  check("the typed read happens at the await site (§4.7.4)", readOffsets(wat).includes(8), true);
}

// 4. Distinct discriminators, in textual order.

{
  const r = run(`
async function two(h: Task<i32>, g: Task<i32>): i32 {
  await h;
  let y: i32 = await g;
  return y;
}
export function probe(): Task<i32> { return two(make(), make()); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`);
  const wat = r.wat();
  const points = [ ...funcBody(wat, "probe/two$resume")
    .matchAll(/i32\.const (\d+)\n *call \$probe\/two\$State#set:resumePoint/g) ]
    .map(match => Number(match[1]));
  check("two awaits get distinct, ordered discriminators", points, [ 1, 0, 2, 0, 3 ]);
  check("  ...and two separate record fields", r.file.statements[0].members
    .filter(member => member.kind === asc.NodeKind.FieldDeclaration && member.name.text.startsWith("$awaited"))
    .map(member => member.name.text), [ "$awaited1", "$awaited2" ]);
  check("two settled guards are emitted", [ ...wat.matchAll(/call \$~lib\/task-rt\/__taskSettled/g) ].length, 2);
  check("two parks are emitted", [ ...wat.matchAll(/call \$~lib\/task-rt\/__taskPark/g) ].length, 2);
}

// 5. The value types §3.2 knows, and the two it does not.

{
  const r = run(`
async function f(h: Task<f64>, g: Task<i32>): f64 {
  let a: f64 = await h;
  return a;
}
export function probe(): Task<f64> { return f(changetype<Task<f64>>(0), changetype<Task<i32>>(0)); }
`);
  const wat = r.wat();
  check("f64 reads f0/f1 at offset 16", /f64\.load offset=16/.test(wat), true);
}
{
  const r = run(`
async function g(h: Task<void>): void { await h; }
export function probe(): Task<void> { return g(changetype<Task<void>>(0)); }
`);
  check("a void result still suspends", r.wat().includes("call $~lib/task-rt/__taskPark"), true);
  check("  ...and carries no `result` field", r.file.statements[0].members
    .some(member => member.name.text === "result"), false);
}
{
  const r = run(`
async function s(h: Task<string>): string { let v: string = await h; return v; }
export function probe(): Task<string> { return s(changetype<Task<string>>(0)); }
`);
  // §3.3: reference-typed await results are out of v2, and codegen is where `T`
  // is known — so this is refused there, with the program otherwise lowered.
  r.wat();
  check("a reference-typed result is refused", refusals(r).includes("a reference-typed await result"), true);
}

// 6. The positions this revision lowers.

{
  const r = run(`
async function p(h: Task<i32>, out: i32): i32 { out = await h; return out + 1; }
export function probe(): Task<i32> { return p(make(), 0); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`);
  check("the assignment position lowers", r.names()[0], "p$State");
  check("  ...with no refusal", refusals(r), []);
}
{
  const r = run(`
async function r(h: Task<i32>): i32 { return await h; }
export function probe(): Task<i32> { return r(make()); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`);
  check("the return position lowers", r.names()[0], "r$State");
  const wat = r.wat();
  const resume = funcBody(wat, "probe/r$resume");
  check(
    "  ...writing the result before the terminal resume point",
    /set:result[\s\S]{0,400}?i32\.const 2\n *call \$probe\/r\$State#set:resumePoint/.test(resume),
    true
  );
  check("  ...and the terminal resume point is 2 for one await", /i32\.const 2/.test(resume), true);
}
{
  const r = run(`
async function e(h: Task<i32>): i32 { await h; return 9; }
export function probe(): Task<i32> { return e(make()); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`);
  check("a local used only before the await lowers", r.names()[0], "e$State");
}
{
  const r = run(`
async function d(h: Task<i32>): i32 { await h; let v: i32 = 2; return v; }
export function probe(): Task<i32> { return d(make()); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`);
  check("a local declared after the await lowers", r.names()[0], "d$State");
}
{
  const r = run(`
namespace N { export async function f(h: Task<i32>): i32 { let v: i32 = await h; return v; } }
export function probe(): Task<i32> { return N.f(make()); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`);
  const namespace = r.file.statements.find(statement => statement.name && statement.name.text === "N");
  check(
    "a namespace member is lowered in place",
    namespace.members.map(member => member.name ? member.name.text : String(member.kind)),
    [ "f$State", "f", "f$resume" ]
  );
}

// 7. Lifting (§4.3): a binding crosses a suspension iff it is live across one.

{
  // A local declared before the await and read after it: it lives in the state
  // struct, is copied out before the park, and copied in at resume.
  const r = run(`
async function f(h: Task<i32>): i32 { let v: i32 = 1; await h; return v; }
export function probe(): Task<i32> { return f(make()); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`);
  const fields = r.file.statements[0].members
    .filter(member => member.kind === asc.NodeKind.FieldDeclaration)
    .map(member => member.name.text);
  check("a local that crosses an await gets a state field", fields.includes("v"), true);
  const wat = r.wat();
  const resume = funcBody(wat, "probe/f$resume");
  check("  ...copied in at resume entry", /call \$probe\/f\$State#get:v\n *local\.set/.test(resume), true);
  check("  ...copied out before the park", /set:v[\s\S]{0,200}?call \$~lib\/task-rt\/__taskPark/.test(resume), true);
  check("  ...and its declaration became an assignment", /i32\.const 1\n *local\.set/.test(resume), true);
  check("  ...and the untouched parameter is not copied out", /#set:h/.test(resume), false);
  check("  ...with no refusal", refusals(r), []);
}
{
  // A local that does not cross: no field, and it stays an ordinary local.
  const r = run(`
async function f(h: Task<i32>): i32 { let v: i32 = 1; await h; return 9; }
export function probe(): Task<i32> { return f(make()); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`);
  const fields = r.file.statements[0].members
    .filter(member => member.kind === asc.NodeKind.FieldDeclaration)
    .map(member => member.name.text);
  check("a local that does not cross gets no state field", fields.includes("v"), false);
  check("  ...and the state has no extra fields at all", fields, [ "h", "$env", "resumePoint", "result", "$awaited1", "handle" ]);
  check("  ...and no `set:v` is emitted", /#set:v/.test(r.wat()), false);
}
{
  // A parameter written before the await and read after it: the field already
  // exists; lifting it costs the copy-out.
  const r = run(`
async function f(h: Task<i32>, out: i32): i32 { out = 2; await h; return out + 1; }
export function probe(): Task<i32> { return f(make(), 0); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`);
  check("a parameter written before an await and read after it lowers", refusals(r), []);
  const resume = funcBody(r.wat(), "probe/f$resume");
  check("  ...with a copy-out of the parameter before the park",
    /set:out[\s\S]{0,200}?call \$~lib\/task-rt\/__taskPark/.test(resume), true);
}
{
  // Assignment to a local target that crosses an await: the local is a field-
  // backed local now, so the assignment lands in the region that resumes.
  const r = run(`
async function f(h: Task<i32>): i32 { let v: i32 = 0; v = await h; return v + 1; }
export function probe(): Task<i32> { return f(make()); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`);
  check("assignment to a local that crosses an await lowers", refusals(r), []);
  const wat = r.wat();
  check("  ...reading the value into the lifted local", /i32\.load offset=8\n *local\.set/.test(wat), true);
  const fields = r.file.statements[0].members
    .filter(member => member.kind === asc.NodeKind.FieldDeclaration)
    .map(member => member.name.text);
  check("  ...which is a state field", fields.includes("v"), true);
}
{
  // Several lifted bindings, and a lifted local declared between two awaits:
  // each gets its own field, and every park copies out everything lifted.
  const r = run(`
async function f(h: Task<i32>, g: Task<i32>, out: i32): i32 {
  let a: i32 = 1;
  await h;
  let c: i32 = a + out;
  await g;
  return c + a;
}
export function probe(): Task<i32> { return f(make(), make(), 2); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`);
  const fields = r.file.statements[0].members
    .filter(member => member.kind === asc.NodeKind.FieldDeclaration)
    .map(member => member.name.text);
  check("each crossing local gets its own field", [ fields.includes("a"), fields.includes("c") ], [ true, true ]);
  const resume = funcBody(r.wat(), "probe/f$resume");
  check("there are two parks", [ ...resume.matchAll(/call \$~lib\/task-rt\/__taskPark/g) ].length, 2);
  check("both copy out `a`", [ ...resume.matchAll(/set:a\n/g) ].length, 2);
  check("the second park also copies out `c`", /set:c[\s\S]{0,200}?call \$~lib\/task-rt\/__taskPark/.test(resume), true);
  check("  ...with no refusal", refusals(r), []);
}
{
  // A lifted local needs a type the state field can carry.
  const r = run(`
async function f(h: Task<i32>): i32 { let v = 1; await h; return v; }
export function probe(): Task<i32> { return f(make()); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`);
  check("an untyped local that crosses an await is refused by name",
    refusals(r).includes("a local without a declared type that crosses an await (async lowering)"), true);
}

// 8. The six correctness cases (§4.1, §4.3) — shape only; values are Phase 4.

// Case 1: an await inside a loop. The body is resumable: the loop re-enters on a
// resumed pass without re-evaluating its condition, the continuation clears the
// resume point, and the next iteration evaluates the condition again.
{
  const r = run(`
async function f(h: Task<i32>): i32 {
  let sum: i32 = 0;
  let i: i32 = 0;
  while (i < 3) {
    await h;
    sum = sum + i;
    i = i + 1;
  }
  return sum;
}
export function probe(): Task<i32> { return f(make()); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`);
  check("case 1 (loop): the loop's live locals are lifted", [ "sum", "i" ].every(name =>
    r.file.statements[0].members.some(member =>
      member.kind === asc.NodeKind.FieldDeclaration && member.name.text === name)), true);
  const resume = funcBody(r.wat(), "probe/f$resume");
  check("  ...one park, inside the loop", [ ...resume.matchAll(/call \$~lib\/task-rt\/__taskPark/g) ].length, 1);
  check("  ...the park is preceded by the copy-out of both locals",
    /set:sum[\s\S]{0,200}?set:i[\s\S]{0,200}?__taskPark/.test(resume), true);
  check("  ...the loop condition is resume-aware", /resumePoint[\s\S]{0,80}?i32\.ne/.test(resume), true);
  check("  ...and the continuation clears the point inside the body",
    /set:resumePoint[\s\S]{0,600}?set:sum/.test(resume), true);
  check("  ...with no refusal", refusals(r), []);
}
// A local declared *inside* a loop body that awaits is lifted too (its
// declaration would otherwise sit inside a guard block).
{
  const r = run(`
async function f(h: Task<i32>): i32 {
  let n: i32 = 0;
  while (n < 2) {
    let t: i32 = 5;
    await h;
    n = n + t;
  }
  return n;
}
export function probe(): Task<i32> { return f(make()); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`);
  check("case 1b (loop-body local): it is lifted", r.file.statements[0].members.some(member =>
    member.kind === asc.NodeKind.FieldDeclaration && member.name.text === "t"), true);
  check("  ...with no refusal", refusals(r), []);
}

// Case 2: an await inside an `if`. The condition is evaluated only on the normal
// pass; a resume dispatches on which branch the resume point belongs to, so an
// await in a branch that did not run is never resumed.
{
  const r = run(`
async function f(h: Task<i32>, c: bool): i32 {
  let v: i32 = 0;
  if (c) { await h; v = 1; } else { v = 2; }
  return v;
}
export function probe(): Task<i32> { return f(make(), true); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`);
  const resume = funcBody(r.wat(), "probe/f$resume");
  const resumeNode = r.file.statements.find(statement => statement.name.text === "f$resume");
  check("case 2 (conditional): one condition temporary is allocated",
    condTemps(resumeNode.body).length, 1);
  check("  ...the condition is evaluated under `resumePoint == 0`",
    /resumePoint[\s\S]{0,120}?i32\.eq[\s\S]{0,240}?local\.set/.test(resume), true);
  check("  ...a resume dispatches on the branch's range",
    /i32\.ge_s[\s\S]{0,200}?i32\.le_s/.test(resume), true);
  check("  ...the await parks inside the then-branch", /__taskPark/.test(resume), true);
  check("  ...with no refusal", refusals(r), []);
}
// Nested conditionals: each await gets its own range.
{
  const r = run(`
async function f(h: Task<i32>, a: bool, b: bool): i32 {
  let v: i32 = 0;
  if (a) { if (b) { await h; v = 1; } }
  return v;
}
export function probe(): Task<i32> { return f(make(), true, true); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`);
  check("case 2b (nested conditionals): lowered", refusals(r), []);
  const resumeNode = r.file.statements.find(statement => statement.name.text === "f$resume");
  check("  ...with two condition temporaries", condTemps(resumeNode.body).length, 2);
}

// Case 3: several awaits at different nesting depths, each with its own
// discriminator and its own record field.
{
  const r = run(`
async function f(h: Task<i32>, g: Task<i32>, k: Task<i32>, c: bool): i32 {
  let n: i32 = 0;
  await h;
  if (c) { await g; n = 1; }
  while (n < 2) { await k; n = n + 1; }
  return n;
}
export function probe(): Task<i32> { return f(make(), make(), make(), true); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`);
  const resume = funcBody(r.wat(), "probe/f$resume");
  const parks = [ ...resume.matchAll(/call \$~lib\/task-rt\/__taskPark/g) ].length;
  const awaited = [ ...resume.matchAll(/get:\$awaited(\d+)/g) ].map(m => m[1]);
  check("case 3 (multiple awaits): three parks", parks, 3);
  check("  ...three distinct record fields", [ ...new Set(awaited) ].sort(), [ "1", "2", "3" ]);
  check("  ...three distinct discriminators", [ ...new Set(
    [ ...resume.matchAll(/i32\.const (\d+)\n *call \$probe\/f\$State#set:resumePoint/g) ].map(m => m[1])
  ) ].sort(), [ "0", "1", "2", "3", "4" ]);
  check("  ...with no refusal", refusals(r), []);
}

// Case 4: an async function nested inside an async function is its own machine,
// with its own discriminator numbering.
{
  const r = run(`
async function outer(h: Task<i32>): i32 {
  async function inner(g: Task<i32>): i32 { let v: i32 = await g; return v + 1; }
  let r: i32 = await h;
  return r + 1;
}
export function probe(): Task<i32> { return outer(make()); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`);
  check("case 4 (nested): two state machines are emitted", r.names(), [
    "outer$State", "outer", "outer$resume", "inner$State", "inner", "inner$resume", "probe", "make"
  ]);
  const outerResume = funcBody(r.wat(), "probe/outer$resume");
  const innerResume = funcBody(r.wat(), "probe/inner$resume");
  check("  ...the outer machine numbers its own await 1",
    [ ...outerResume.matchAll(/i32\.const 1\n *call \$probe\/outer\$State#set:resumePoint/g) ].length, 1);
  check("  ...the inner machine numbers its own await 1",
    [ ...innerResume.matchAll(/i32\.const 1\n *call \$probe\/inner\$State#set:resumePoint/g) ].length, 1);
  check("  ...their terminals are both 2, independently",
    [ /i32\.const 2\n *call \$probe\/outer\$State#set:resumePoint/.test(outerResume),
      /i32\.const 2\n *call \$probe\/inner\$State#set:resumePoint/.test(innerResume) ], [ true, true ]);
  check("  ...and each has its own await field", [ /outer\$State#get:\$awaited1/.test(outerResume),
    /inner\$State#get:\$awaited1/.test(innerResume) ], [ true, true ]);
}

// Case 5: an early return before an await returns directly; a return after an
// await runs the terminal region. Both write `state.result`.
{
  const r = run(`
async function f(h: Task<i32>, c: bool): i32 {
  if (c) { return 7; }
  await h;
  return 9;
}
export function probe(): Task<i32> { return f(make(), true); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`);
  const resume = funcBody(r.wat(), "probe/f$resume");
  check("case 5 (early return): the return before the await writes result then returns",
    /i32\.const 7[\s\S]{0,120}?set:result[\s\S]{0,120}?return/.test(resume), true);
  check("  ...and it happens before any park",
    resume.indexOf("i32.const 7") < resume.indexOf("__taskPark"), true);
  check("  ...the return after the await writes result 9 in the terminal region",
    /i32\.const 9[\s\S]{0,120}?set:result/.test(resume), true);
  check("  ...with no refusal", refusals(r), []);
}

// Case 6 (closures × async): C4 un-refused the three shapes that used to make
// this case unexercisable. What remains refused is `this` in a *free* async
// function, which has no receiver to capture at all.
{
  const asyncMethod = run(`class C { async m(): void {} } export function probe(): i32 { return 1; }`);
  check("case 6 (closures): an async method is lowered, not refused",
    refusals(asyncMethod), []);
  const thisBody = run(`
async function f(): i32 { return this.x; }
export function probe(): i32 { return 1; }
`);
  check("  ...`this` in a free async function is still refused by name",
    refusals(thisBody).includes("this in an async function body (async lowering)"), true);
  const closure = run(`
async function f(): i32 { const g = (): i32 => 1; return g(); }
export function probe(): i32 { return 1; }
`);
  check("  ...a non-async closure inside an async body is lowered, not refused",
    refusals(closure), []);
}

// 8b. The environment reference (§4.4): emitted, initialized to null, and
// unreachable — nothing in this fork can put a capture into an async body.
{
  const r = run(`
async function f(h: Task<i32>): i32 { let v: i32 = 1; await h; return v; }
export function probe(): Task<i32> { return f(make()); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`);
  const state = r.file.statements[0];
  const env = state.members.find(member =>
    member.kind === asc.NodeKind.FieldDeclaration && member.name.text === "$env");
  check("the state struct carries an environment reference field", env !== undefined, true);
  check("  ...typed TaskEnv", env.type.name.identifier.text, "TaskEnv");
  check("  ...nullable", env.type.isNullable, true);
  check("  ...initialized to null", env.initializer.kind, asc.NodeKind.Null);
  check("  ...and traced by the state's visitor", /\$probe\/f\$State~visit[\s\S]{0,500}?__visit/.test(r.wat()), true);
}

// 8c. The receiver is constructed with the method's receiver, and the invoked
// shapes compile — not merely "are not refused".
//
// C4's tests asserted refusal-absence for async methods and never compiled a
// *called* one. That is how a synthesized `new m$ThisEnv(this)` against a class
// with no constructor survived: it is a resolver error (TS2554), the error points
// at the method because the synthesized node carries the method's range, and the
// parser's `AS100` guard kept the CLI from ever reaching it. The lesson is in the
// async plan §4.8: a feature that synthesizes a construction site must test the
// *called* form, not only the declared one.
{
  const calledMethod = run(`
class C {
  x: i32 = 7;
  async m(h: Task<i32>): i32 { let a: i32 = this.x; await h; return a + this.x; }
}
export function probe(): Task<i32> { return new C().m(changetype<Task<i32>>(0)); }
`);
  check("a called async method compiles", compileErrors(calledMethod), []);
  check("  ...and is not refused", refusals(calledMethod), []);
  const wat = calledMethod.wat();
  const entry = funcBody(wat, "probe/C#m");
  const thisEnvCtor = funcBody(wat, "probe/m$ThisEnv#constructor");
  check("the this-env constructor takes the receiver",
    /local\.get \$1\n *call \$probe\/m\$ThisEnv#set:\$this/.test(thisEnvCtor), true);
  // AS emits the field initializer (`$this = changetype<C>(0)`) before the base
  // constructor call, so "after super()" is asserted on the *receiver
  // assignment*, which is the one that reads param 1.
  check("  ...and assigns the receiver after the base constructor runs",
    /call \$~lib\/task-rt\/TaskEnv#constructor[\s\S]{0,160}?local\.get \$1\n *call \$probe\/m\$ThisEnv#set:\$this/.test(thisEnvCtor), true);
  check("the entry constructs the env from the method's receiver",
    /local\.get \$0\n *call \$probe\/m\$ThisEnv#constructor/.test(entry), true);
  check("  ...assigns it to $env", /call \$probe\/m\$State#set:\$env/.test(entry), true);
  check("  ...before the synchronous prefix runs",
    entry.indexOf("$State#set:$env") < entry.indexOf("call $probe/m$resume"), true);
  const resume = funcBody(wat, "probe/m$resume");
  const thisReads = [...resume.matchAll(/call \$probe\/m\$ThisEnv#get:\$this/g)].length;
  check("the resume function reads `this` before and after the await", thisReads, 2);
  check("  ...once before the park",
    resume.indexOf("m$ThisEnv#get:$this") < resume.indexOf("__taskPark"), true);
  check("  ...and once after it",
    resume.lastIndexOf("m$ThisEnv#get:$this") > resume.indexOf("__taskPark"), true);

  const calledExplicitThis = run(`
class C { x: i32 = 7; }
async function f(this: C, h: Task<i32>): i32 { let a: i32 = this.x; await h; return a; }
export function probe(): Task<i32> { return f.call(new C(), changetype<Task<i32>>(0)); }
`);
  check("a called explicit-this async function compiles", compileErrors(calledExplicitThis), []);
  check("  ...and its entry constructs the this-env from param 0",
    /local\.get \$0\n *call \$probe\/f\$ThisEnv#constructor/.test(funcBody(calledExplicitThis.wat(), "probe/f")), true);

  const calledStatic = run(`
class C { static async m(): i32 { return 1; } }
export function probe(): i32 { return 1; }
`);
  check("a static async method is still refused by name (no change)",
    refusals(calledStatic), [ "async static methods (async lowering)" ]);
}

// 8d. §8.3(a): the async function *is* a closure value.
//
// A bare `async function inner() {}` written in a function body parses as an
// expression statement wrapping a `FunctionExpression` (measured), the only
// async shape that can itself capture. The environment it captured arrives
// through `~env` at the entry, but the body runs in `f$resume`, a synthesized
// free function with no `_env` of its own — so the entry stores the received
// local in `state.$env` and the resume re-declares it from there. Before this
// landed, the shape did not compile at all (`TS2304` on `$closureEnvIn`).
{
  const captured = runBoth(`
async function outer(h: Task<i32>): i32 {
  let x: i32 = 1;
  async function inner(g: Task<i32>): i32 { await g; return x; }
  await h;
  inner(changetype<Task<i32>>(0));
  return x;
}
let sink: Task<i32> | null = null;
export function main(): i32 { sink = outer(changetype<Task<i32>>(0)); return 1; }
`);
  check("§8.3(a): an async closure value compiles", compileErrors(captured), []);
  check("  ...with no refusal", refusals(captured), []);
  const wat = captured.wat();
  const entry = funcBody(wat, "probe/outer$resume~inner");
  check("  ...the entry reads the received environment from ~env",
    entry.includes("global.get $~env"), true);
  check("  ...and stores it in the state struct's $env",
    /global\.get \$~env[\s\S]{0,200}?inner\$State#set:\$env/.test(entry), true);
  check("  ...before the resume function runs",
    entry.indexOf("inner$State#set:$env") < entry.indexOf("call $probe/inner$resume"), true);
  const resume = funcBody(wat, "probe/inner$resume");
  check("  ...the resume re-declares it from $env first",
    /func \$probe\/inner\$resume[\s\S]{0,160}?inner\$State#get:\$env/.test(wat), true);
  const park = resume.indexOf("__taskPark");
  check("  ...reads the captured binding through the environment", /outer\$Env#get:x/.test(resume), true);
  check("  ...after the suspension, not before it",
    resume.indexOf("outer$Env#get:x", park) > 0, true);
  check("  ...and the binding has no copy on the state struct",
    /inner\$State#(get|set):x/.test(wat), false);

  // §8.3(b) is the contrast and must be untouched: an async function that
  // *contains* a closure owns the env, lifts it as `$closureEnv`, and leaves
  // `$env` null.
  const containing = runBoth(`
async function outer(h: Task<i32>): i32 {
  let x: i32 = 1;
  function inner(): i32 { return x; }
  await h;
  return inner();
}
export function probe(): Task<i32> { return outer(make()); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`);
  check("§8.3(b): an async function containing a closure still lowers", refusals(containing), []);
  const containingWat = containing.wat();
  check("  ...with the env lifted as a state field",
    /outer\$State#get:\$closureEnv/.test(containingWat), true);
  check("  ...and `$env` never populated for it",
    /outer\$State#set:\$env[\s\S]{0,40}?local\.get \$\$closureEnv/.test(containingWat), false);

  // The collision: `$env` holds one reference, so a capturing function with an
  // explicit `this:` cannot carry both the this-struct and the captured env.
  // Refused by name — two-environment captures are C5's design (plan §4.8).
  const collision = runBoth(`
class C { y: i32 = 7; }
async function outer(h: Task<i32>): i32 {
  let x: i32 = 1;
  async function f(this: C): i32 { return x + this.y; }
  await h;
  f.call(new C());
  return x;
}
export function main(): i32 { return 1; }
`);
  check("a capturing function with an explicit `this:` is refused by name",
    refusals(collision),
    [ "a capturing function with an explicit `this:` parameter (async lowering)" ]);
}

// 9. Refusals: every shape this revision does not lower is named, not missed.

const REFUSALS = [
  [ "await in a sub-expression", `async function f(h: Task<i32>): i32 { return 1 + await h; }`,
    "await in an unsupported position (async lowering)" ],
  [ "two awaits in one statement", `async function f(h: Task<i32>, g: Task<i32>): i32 { h(g(await h, await g)); return 1; }`,
    "more than one await in one statement (async lowering)" ],
  [ "an await whose operand is another await", `async function f(h: Task<i32>): i32 { return await (await h); }`,
    "await in an unsupported position (async lowering)" ],
  [ "await in a call argument", `async function f(h: Task<i32>): i32 { g(await h); return 1; }`,
    "await in an unsupported position (async lowering)" ],
  [ "switch", `async function f(a: i32): i32 { switch (a) { default: return 1; } }`,
    "switch in an async function body (async lowering)" ],
  [ "try/catch", `async function f(): i32 { try { return 1; } catch (e) { return 0; } }`,
    "try/catch in an async function body (async lowering)" ],
  [ "do/while", `async function f(a: i32): i32 { do { a -= 1; } while (a > 0); return a; }`,
    "do in an async function body (async lowering)" ],
  [ "for-of", `async function f(a: i32[]): i32 { for (let v of a) return v; return 0; }`,
    "for-of in an async function body (async lowering)" ],
  [ "break", `async function f(a: i32): i32 { while (a > 0) { break; } return a; }`,
    "break in an async function body (async lowering)" ],
  [ "a generic async function", `async function f<T>(a: T): void {}`,
    "async generic functions (async lowering)" ],
  [ "an optional parameter", `async function f(a: i32 = 1): i32 { return a; }`,
    "optional or rest parameters in an async function (async lowering)" ],
  [ "no declared return type", `async function f() { return 1; }`,
    "an async function without a declared return type (async lowering)" ],
  [ "an async arrow", `const f = async (): void => {};`,
    "async arrow functions (async lowering)" ],
  [ "an async static method", `class C { static async m(): void {} }`,
    "async static methods (async lowering)" ],
  [ "an async function expression", `const f = async function (): void {};`,
    "async function expressions (async lowering)" ]
];

for (const [ label, source, expected ] of REFUSALS) {
  const r = run(source);
  let outcome;
  try {
    outcome = refusals(r).some(message => message.includes(expected));
  } catch (error) {
    outcome = `threw: ${error.message}`;
  }
  check(`${label} is refused by name`, outcome, true);
  check(
    `  ...and no artifact was emitted for it`,
    r.names().some(name => name.includes("$")),
    false
  );
}

// 10. A `this` body is refused by name.

{
  const r = run(`
class C { x: i32 = 7; m(): i32 { return this.x; } }
async function f(c: C): i32 { let v: i32 = await c.m(); return v; }
export function probe(): Task<i32> { return f(new C()); }
`);
  // No `this` in the async body here — but the operand is a *method call*, which
  // is fine. The refusal this checks is the `this` *expression*:
  const t = run(`
class C { x: i32 = 7; }
async function f(h: Task<i32>): i32 { let v: i32 = await h; return this.x; }
export function probe(): Task<i32> { return f(make()); }
function make(): Task<i32> { return changetype<Task<i32>>(0); }
`);
  check("a method call as the operand lowers", refusals(r), []);
  check("`this` in an async body is refused by name", refusals(t).includes("this in an async function body (async lowering)"), true);
}

// 11. A program that declares no async function is untouched.

{
  const program = buildProgram([ [ "probe.ts", `export function probe(): i32 { return 7; }` ] ]);
  const before = program.sources.find(source => source.internalPath === "probe").statements.length;
  const Transform = asc.AsyncLowerTransform;
  Object.assign(Transform.prototype, { program });
  new Transform().afterParse(program.parser);
  const after = program.sources.find(source => source.internalPath === "probe").statements.length;
  check("a program without async emits nothing", after, before);
  check("  ...and reports nothing", program.parser.diagnostics.length, 0);
  check(
    "  ...and the side table stays empty for it",
    (program.initialize(), asc.compile(program).toText(true).includes("$awaited")),
    false
  );
}

// 12. The validation walk (Phase 3, commit 7): every `async` construct the
// lowering pass never reaches is refused by name. The parser reports nothing
// for `async` since commit 7b deleted its `AS100` guard, so a message here is
// the only thing standing between the user and a silently mis-compiled shape.
//
// The shapes below are the ones measured as *invisible* to the lowering pass:
// the inside of a non-async function body, a top-level `if`/`while`/`do`/`for`
// body, an object literal, a class-field initializer beyond its root
// expression, a top-level `try`/`catch`, a top-level `switch`, and an
// `export default` declaration.

{
  const NESTED = "an async function nested in a non-async body (async lowering)";
  const cases = [
    ["a function declaration in a non-async body",
      `function g(): i32 { async function f(): i32 { return 1; } return 1; } export function main(): i32 { return 1; }`,
      NESTED],
    ["an arrow in a non-async body",
      `function g(): i32 { const f = async (): i32 => 1; return 1; } export function main(): i32 { return 1; }`,
      "async arrow functions (async lowering)"],
    ["a function declaration in a top-level if",
      `if (true) { async function f(): i32 { return 1; } } export function main(): i32 { return 1; }`,
      NESTED],
    ["a function declaration in a top-level while",
      `let i: i32 = 0; while (i < 1) { async function f(): i32 { return 1; } i = 1; } export function main(): i32 { return 1; }`,
      NESTED],
    ["a function declaration in a top-level do",
      `let i: i32 = 0; do { async function f(): i32 { return 1; } } while (i < 1); export function main(): i32 { return 1; }`,
      NESTED],
    ["a function declaration in a top-level for",
      `for (let i: i32 = 0; i < 1; i++) { async function f(): i32 { return 1; } } export function main(): i32 { return 1; }`,
      NESTED],
    ["an arrow in a top-level object literal",
      `const o = { f: async (): i32 => 1 }; export function main(): i32 { return 1; }`,
      "async arrow functions (async lowering)"],
    ["an arrow nested in a class-field initializer",
      `class C { o = { f: async (): i32 => 1 }; } export function main(): i32 { return 1; }`,
      "async arrow functions (async lowering)"],
    ["a function declaration in a top-level try",
      `try { async function f(): i32 { return 1; } } catch (e) {} export function main(): i32 { return 1; }`,
      NESTED],
    ["a function declaration in a top-level catch",
      `try {} catch (e) { async function f(): i32 { return 1; } } export function main(): i32 { return 1; }`,
      NESTED],
    ["a function declaration in a top-level switch case",
      `const x: i32 = 1; switch (x) { case 1: { async function f(): i32 { return 1; } break; } } export function main(): i32 { return 1; }`,
      NESTED],
    ["an export-default async function",
      `export default async function f(): i32 { return 1; } export function main(): i32 { return 1; }`,
      "an async export default function (async lowering)"],
    ["an arrow in a decorator argument",
      `function dec(a: () => i32): void {} @dec(async (): i32 => 1) class C {} export function main(): i32 { return 1; }`,
      "async arrow functions (async lowering)"]
  ];
  for (const [name, source, message] of cases) {
    check(`${name} is refused by name, not by the parser guard`, refusals(run(source)), [ message ]);
  }
}

// 12a-bis. The export-default message names its own shape (commit 7b, ruling A),
// and the two messages are disjoint by grammar rather than by precedence:
// `export default` is only legal at the top level (measured: a nested one is
// `TS1109: Expression expected.`), and an export-default arrow or function
// expression is a parse error (`TS1005`/`TS1003`). So no shape can produce both.

{
  const atTop = run(`export default async function f(): i32 { return 1; } export function main(): i32 { return 1; }`);
  check("an export-default async function names the export-default shape", refusals(atTop), [ "an async export default function (async lowering)" ]);
  check("  ...and not the nested-body message", refusals(atTop).includes("an async function nested in a non-async body (async lowering)"), false);

  const nested = run(`function g(): i32 { export default async function f(): i32 { return 1; } return 1; } export function main(): i32 { return 1; }`);
  check("a nested `export default` is a parse error, so the messages cannot overlap", nested.program.parser.diagnostics.some(d => d.code === 1109), true);
  check("  ...and the walk reports nothing for it", refusals(nested), []);
}

// 12a-ter. The single-identifier arrow is a separate parser production
// (`ArrowKind.Single`, `parser.ts:3940`) from the parenthesized arrow, so it
// gets its own coverage: the parser guard protected it separately, and the
// transform's message is the replacement once that guard is deleted.

{
  const atTop = run(`const f = async x => x; export function main(): i32 { return 1; }`);
  check("an async single-identifier arrow is refused by name", refusals(atTop), [ "async arrow functions (async lowering)" ]);
  check("  ...and emits no artifact", atTop.names().some(name => name.includes("$")), false);

  const nested = run(`function g(): i32 { const f = async x => x; return 1; } export function main(): i32 { return 1; }`);
  check("  ...and in a non-async body it is refused by the walk, same message", refusals(nested), [ "async arrow functions (async lowering)" ]);
}

// 12b. The shapes the lowering pass does reach still lower, with no refusal.
// (These are re-checks of what earlier sections cover, from the walk's angle: a
// walk that fired too eagerly would add a message here.)

{
  const cases = [
    ["a top-level async function",
      `async function f(): i32 { return 1; } export function main(): i32 { return 1; }`],
    ["a namespace member",
      `namespace N { export async function f(): i32 { return 1; } } export function main(): i32 { return 1; }`],
    ["an async method",
      `class C { x: i32 = 7; async m(): i32 { return this.x; } } export function main(): i32 { return 1; }`],
    ["a nested async function in an async body",
      `async function f(): i32 { async function g(): i32 { return 1; } return 1; } export function main(): i32 { return 1; }`],
    ["a lowered function with an await",
      `async function f(h: Task<i32>): i32 { let v: i32 = await h; return v; } export function probe(): Task<i32> { return f(make()); } function make(): Task<i32> { return changetype<Task<i32>>(0); }`]
  ];
  for (const [name, source] of cases) {
    check(`${name} still lowers with no refusal`, refusals(run(source)), []);
  }
}

// 12c. The overlap rule: one message per construct. The lowering pass records
// the construct it refused (not the diagnostic's position), so the walk skips
// it — including refusals that report at a parameter or declarator name, and
// refusals that abort an enclosing function from a nested one.

{
  const generic = run(`async function f<T>(a: T): i32 { return 1; } export function main(): i32 { return 1; }`);
  check("a generic async function is refused once", refusals(generic), [ "async generic functions (async lowering)" ]);

  const thisBody = run(`async function f(h: Task<i32>): i32 { let v: i32 = await h; return this.x; } export function main(): i32 { return 1; }`);
  check("a `this` refusal inside the body is not doubled by the walk", refusals(thisBody), [ "this in an async function body (async lowering)" ]);

  const optional = run(`async function f(a: i32 = 1): i32 { return a; } export function main(): i32 { return 1; }`);
  check("a refusal reported at a parameter name is keyed to its construct, not doubled", refusals(optional), [ "optional or rest parameters in an async function (async lowering)" ]);

  const noReturnType = run(`async function f() { return 1; } export function main(): i32 { return 1; }`);
  check("a refusal reported at the declaration name is keyed to its construct, not doubled", refusals(noReturnType), [ "an async function without a declared return type (async lowering)" ]);

  const untyped = run(`async function f(h: Task<i32>): i32 { let v = await h; return 1; } export function main(): i32 { return 1; }`);
  check("a declarator refusal is not doubled by the walk", refusals(untyped), [ "a local without a declared type that crosses an await (async lowering)" ]);

  const nested = run(`async function f(): i32 { async function g(): i32 { return this.x; } return 1; } export function main(): i32 { return 1; }`);
  check("a refused nested function does not make the walk report its enclosing function", refusals(nested), [ "this in an async function body (async lowering)" ]);

  const two = run(`function a(): i32 { const x = async (): i32 => 1; return 1; } function b(): i32 { const y = async (): i32 => 2; return 2; } export function main(): i32 { return 1; }`);
  check("two unreached constructs yield two messages, one each", refusals(two), [ "async arrow functions (async lowering)", "async arrow functions (async lowering)" ]);
}

// 12d. The allocation invariant, at source level.
//
// This guards the common allocation paths; new traversal code that uses a
// different allocation pattern must be caught by review, not by this test.
// Comments are stripped first: the invariant is about code, and prose that
// names a forbidden construct does not allocate.

{
  const walkSource = readFileSync(new URL("../../src/async/validate.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  check("the guard reads the walk's source", walkSource.includes("function validateStatements"), true);
  for (const pattern of [ "Node.create", "new ", ".clone(", ".push(" ]) {
    check(`the walk allocates nothing: no \`${pattern.trim()}\``, walkSource.includes(pattern), false);
  }
}

console.log();
if (failures) {
  console.log(`FAILURE: ${failures} of ${checks} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`[ SUCCESS ] ${checks} checks`);
}
