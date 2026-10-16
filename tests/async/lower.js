// The `afterParse` lowering transform's skeleton (Phase 3, commit 2).
//
// What is under test: that the transform is registered, that it finds async
// functions, that it emits the three artifacts of the state-machine shape
// (`docs/async-await-plan-v2.md` §4.1), and that it *refuses* — with a named
// diagnostic, never a crash and never silent garbage — every shape this
// revision does not lower yet. Not under test, and not implemented: `await`
// transitions (commit 3), liveness-based lifting (commit 4), the runtime and
// the resume dispatch (Phase 4).
//
// Run: npm run test:async
//
// Why the compiler is driven directly rather than through the CLI: the parser
// still carries Phase 1's `AS100` guard for every `async` construct, and the
// CLI stops at the first parse error before the `afterParse` hook runs
// (`cli/index.js:634-638` returns from `parseBacklog`). The guard is deleted in
// commit 7. Until then this test drives the same sequence the CLI does —
// `afterParse` on `program.parser`, then `initialize()`, then `compile()` —
// with the diagnostic gate removed, which is what makes the emitted *shape*
// observable at all.

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
// naming the gap (Phase 1's guard uses the same code for the same reason).
const NOT_IMPLEMENTED = 100;

/** Builds a program holding `source`, exactly as the CLI would. */
function programFor(source) {
  return buildProgram([ [ "probe.ts", source ] ]);
}

/** Runs the transform the way the CLI does, and answers the parse tree's source. */
function lower(program) {
  const Transform = asc.AsyncLowerTransform;
  // The CLI assigns these onto the transform's prototype before instantiating
  // it (`cli/index.js:455-462`) — this is that assignment, not a re-implementation.
  Object.assign(Transform.prototype, { program });
  new Transform().afterParse(program.parser);
  return program.sources.find(source => source.internalPath === "probe");
}

/** The text of each refusal the parser reported, in order. */
function notImplementedTexts(program) {
  return program.parser.diagnostics
    .filter(diagnostic => diagnostic.code === NOT_IMPLEMENTED)
    .map(diagnostic => diagnostic.message);
}

/** Compiles `program` and answers the module's text. */
function compileToWat(program) {
  program.initialize();
  return asc.compile(program).toText(true);
}

const SOURCE = `
async function f(a: i32): i32 {
  const b: i32 = a + 1;
  return b;
}
export function probe(): Task<i32> { return f(1); }
`;

// 1. The shape (§4.1's three artifacts).

{
  const program = programFor(SOURCE);
  const source = lower(program);
  const statements = source.statements;

  check("three artifacts are emitted for `f`", statements.length, 4);
  check("the state class comes first", statements[0].name.text, "f$State");
  check("the entry keeps the function's name", statements[1].name.text, "f");
  check("the resume function follows the entry", statements[2].name.text, "f$resume");

  const state = statements[0];
  check("the state class is a class", state.kind, asc.NodeKind.ClassDeclaration);
  check(
    "the state class carries one field per parameter, plus resumePoint, result and handle",
    state.members.filter(member => member.kind === asc.NodeKind.FieldDeclaration).map(member => member.name.text),
    [ "a", "resumePoint", "result", "handle" ]
  );
  check(
    "the state class has a constructor",
    state.members.filter(member => member.kind === asc.NodeKind.MethodDeclaration).length,
    1
  );

  const entry = statements[1];
  check("the entry is no longer marked async", entry.isAsync, false);
  check(
    "the entry's declared return type is the handle, not the value type",
    entry.signature.returnType.name.identifier.text,
    "Task"
  );
  check(
    "  ...and the handle's type argument is the declared value type",
    entry.signature.returnType.typeArguments.map(node => node.name.identifier.text),
    [ "i32" ]
  );
  check(
    "the entry allocates the state, resumes it, and returns the handle",
    entry.body.statements.map(statement => statement.kind),
    [ asc.NodeKind.Variable, asc.NodeKind.Expression, asc.NodeKind.Return ]
  );
  const entryCall = entry.body.statements[1].expression;
  check("the entry calls the resume function", entryCall.expression.text, "f$resume");
  check(
    "  ...with the state as its only argument",
    entryCall.args.map(argument => argument.text),
    [ "state" ]
  );

  const resume = statements[2];
  check(
    "the resume function's parameter list is the state alone (§4.3)",
    resume.signature.parameters.map(parameter => parameter.name.text),
    [ "state" ]
  );
  check(
    "  ...typed by the state class",
    resume.signature.parameters[0].type.name.identifier.text,
    "f$State"
  );
  check("the resume function returns nothing", resume.signature.returnType.name.identifier.text, "void");
  check("the resume function is not async", resume.isAsync, false);
  check(
    "the resume body copies the parameter in from the state struct (§4.3)",
    resume.body.statements[0].declarations[0].name.text,
    "a"
  );
  const resumeKinds = resume.body.statements.map(statement => statement.kind);
  check(
    "the terminal return writes the value, the terminal resume point, then returns",
    resumeKinds.slice(-3),
    [ asc.NodeKind.Expression, asc.NodeKind.Expression, asc.NodeKind.Return ]
  );
  check(
    "  ...and the rewritten return is the last statement (no dead transition after it)",
    resumeKinds[resumeKinds.length - 1],
    asc.NodeKind.Return
  );
  const resultWrite = resume.body.statements[resumeKinds.length - 3].expression;
  check(
    "the value write targets `result` on the state struct",
    [ resultWrite.left.expression.text, resultWrite.left.property.text ],
    [ "state", "result" ]
  );
  check(
    "  ...and the store is an assignment",
    resultWrite.operator,
    asc.Token.Equals
  );
}

// 2. The emitted shape survives real codegen: read it out of the module.

{
  const program = programFor(SOURCE);
  lower(program);
  const wat = compileToWat(program);
  // Names are namespaced by the declaring source (`probe/f$resume`), which is
  // also worth asserting: the artifacts are ordinary members of the file.
  check("codegen emits the state class's constructor", wat.includes("(func $probe/f$State#constructor"), true);
  check("codegen emits the entry function", /\(func \$probe\/f \(param \$0 i32\) \(result i32\)/.test(wat), true);
  check("codegen emits the resume function", /\(func \$probe\/f\$resume \(param \$0 i32\)/.test(wat), true);
  check("the entry calls the resume function", wat.includes("call $probe/f$resume"), true);
  check("the entry constructs the state struct", wat.includes("call $probe/f$State#constructor"), true);
  check("the entry reads the handle back off it", wat.includes("call $probe/f$State#get:handle"), true);
  check(
    "the state struct is a managed class the collector visits",
    wat.includes("call $probe/f$State~visit"),
    true
  );
  check(
    "  ...and its visitor traces its managed fields",
    /\$probe\/f\$State~visit[\s\S]{0,600}?call \$~lib\/rt\/itcms\/__visit/.test(wat),
    true
  );
}

// 3. Refusals: every shape this revision does not lower is named, not missed.

const REFUSALS = [
  [ "await in the body", `async function f(): i32 { return await g(); }`, "await (async lowering)" ],
  [ "await in the body, nested in an expression", `async function f(h: Task<i32>): i32 { return 1 + await h; }`,
    "await (async lowering)" ],
  [ "a conditional", `async function f(a: i32): i32 { if (a > 0) return 1; return 0; }`,
    "if in an async function body (async lowering)" ],
  [ "a loop", `async function f(a: i32): i32 { while (a > 0) a -= 1; return a; }`,
    "while in an async function body (async lowering)" ],
  [ "a nested function", `async function f(): void { const g = (): void => {}; g(); }`,
    "a nested function in an async function body (async lowering)" ],
  [ "a generic async function", `async function f<T>(a: T): void {}`,
    "async generic functions (async lowering)" ],
  [ "an optional parameter", `async function f(a: i32 = 1): i32 { return a; }`,
    "optional or rest parameters in an async function (async lowering)" ],
  [ "an async arrow", `const f = async (): void => {};`,
    "async arrow functions (async lowering)" ],
  [ "an async method", `class C { async m(): void {} }`,
    "async methods (async lowering)" ]
];

for (const [ label, source, expected ] of REFUSALS) {
  const program = programFor(source);
  let outcome;
  let statements = [];
  try {
    statements = lower(program).statements;
    outcome = notImplementedTexts(program).some(message => message.includes(expected));
  } catch (error) {
    outcome = `aborted: ${error.message}`;
  }
  check(`${label} is refused by name`, outcome, true);
  // And nothing was emitted for it: a refused function leaves the statement
  // list exactly as parsed, with no synthesized `$`-named artifact in it.
  check(
    `  ...and no artifact was emitted for it`,
    statements.some(statement => typeof statement.name?.text === "string" && statement.name.text.includes("$")),
    false
  );
}

// 4. A program that declares no async function is untouched.

{
  const program = programFor(`export function probe(): i32 { return 7; }`);
  const before = program.sources.find(source => source.internalPath === "probe").statements.length;
  const source = lower(program);
  check("a program without async emits nothing", source.statements.length, before);
  check("  ...and reports nothing", program.parser.diagnostics.length, 0);
}

console.log();
if (failures) {
  console.log(`FAILURE: ${failures} of ${checks} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`[ SUCCESS ] ${checks} checks`);
}
