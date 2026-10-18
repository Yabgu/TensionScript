// Resolver and type-system tests for async/await (Phase 2).
//
// What is under test: resolving an `await` expression and assigning types
// (`docs/async-await-plan-v2.md` §1.2 rules 1-2, §2.3, §2.4). Not under test,
// and not implemented: lowering, the runtime, codegen.
//
// Run: npm run test:async
//
// Every case drives the resolver through the public `Program` API (see
// `harness.js` for why the compiler suite cannot reach it yet), and each
// asserts both the resolved type and the *complete* diagnostic set, so an
// unintended diagnostic fails the test rather than hiding behind an expected
// one.

import {
  buildProgram,
  resolveTopLevel,
  typeOf,
  diagnosticCodes,
  diagnosticTexts,
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

// The parser reports no diagnostic for `async` since Phase 3 commit 7b deleted
// its guard: lowering and refusal both live in the `afterParse` transforms, and
// these cases drive the resolver without them. Every case that used to expect
// that guard now expects exactly what the resolver itself reports.
// 'await' outside an async function -- TypeScript's own code (AS1308).
const AWAIT_OUTSIDE_ASYNC = 1308;
// "'async' modifier cannot be used here." -- TypeScript's code for the
// positions it refuses with 1042.
const ASYNC_MODIFIER_REFUSED = 1042;

// ── the type of `await` ───────────────────────────────────────────────────

console.log("type of await");

{
  // The rule the whole phase exists for: `await` on a `Task<T>` is `T`.
  const program = buildProgram([[
    "probe.ts",
    `async function f(h: Task<i32>): i32 { return await h; }`
  ]]);
  program.initialize();
  const f = resolveTopLevel(program, "f");
  const expression = f.prototype.bodyNode.statements[0].value; // await h
  check("await h  (h: Task<i32>)  is i32", typeOf(program, expression, f.flow), "i32");
  check("  ...and reports nothing extra", diagnosticCodes(program), []);
}

{
  // A reference-typed payload: the await hands back the type argument itself.
  const program = buildProgram([[
    "probe.ts",
    `async function f(h: Task<string>): string { return await h; }`
  ]]);
  program.initialize();
  const f = resolveTopLevel(program, "f");
  const expression = f.prototype.bodyNode.statements[0].value;
  check(
    "await h  (h: Task<string>)  is string",
    typeOf(program, expression, f.flow),
    "~lib/string/String"
  );
}

{
  // Awaiting something that is not a task is TypeScript's identity: `await 1`
  // is `1`, with no diagnostic -- the operand type is the result type.
  const program = buildProgram([["probe.ts", `async function f(): i32 { return await 1; }`]]);
  program.initialize();
  const f = resolveTopLevel(program, "f");
  const expression = f.prototype.bodyNode.statements[0].value;
  check("await 1  is i32 (not a task)", typeOf(program, expression, f.flow), "i32");
  check("  ...and reports nothing extra", diagnosticCodes(program), []);
}

{
  // `await` composes with the rest of an expression.
  const program = buildProgram([[
    "probe.ts",
    `async function f(h: Task<i32>): i32 { return 1 + await h; }`
  ]]);
  program.initialize();
  const f = resolveTopLevel(program, "f");
  const expression = f.prototype.bodyNode.statements[0].value; // 1 + (await h)
  check("`1 + await h` is i32", typeOf(program, expression, f.flow), "i32");
}

// ── the type of an async function's call ──────────────────────────────────

console.log("type of a call to an async function");

{
  const program = buildProgram([[
    "probe.ts",
    `async function f(): i32 { return 1; }
     function use(): void { f(); }`
  ]]);
  program.initialize();
  const use = resolveTopLevel(program, "use");
  const call = use.prototype.bodyNode.statements[0].expression;
  check("f()  (async function f(): i32)  is Task<i32>", typeOf(program, call, use.flow), "~lib/task/Task<i32>");
  check("  ...and reports nothing extra", diagnosticCodes(program), []);
}

{
  // `void` as a type argument: `async function f(): void` is callable, and its
  // handle is a task like any other.
  const program = buildProgram([[
    "probe.ts",
    `async function v(): void {}
     function use(): void { v(); }`
  ]]);
  program.initialize();
  const use = resolveTopLevel(program, "use");
  const call = use.prototype.bodyNode.statements[0].expression;
  check("v()  (async function v(): void)  is Task<void>", typeOf(program, call, use.flow), "~lib/task/Task<void>");
}

{
  const program = buildProgram([[
    "probe.ts",
    `async function s(): string { return "x"; }
     function use(): void { s(); }`
  ]]);
  program.initialize();
  const use = resolveTopLevel(program, "use");
  const call = use.prototype.bodyNode.statements[0].expression;
  check(
    "s()  (async function s(): string)  is Task<string>",
    typeOf(program, call, use.flow),
    "~lib/task/Task<~lib/string/String>"
  );
}

{
  // Methods go through a bound prototype; the trait must survive that.
  const program = buildProgram([[
    "probe.ts",
    `class C { async m(): i32 { return 1; } }
     function use(c: C): void { c.m(); }`
  ]]);
  program.initialize();
  const use = resolveTopLevel(program, "use");
  const call = use.prototype.bodyNode.statements[0].expression;
  check("c.m()  (async m(): i32)  is Task<i32>", typeOf(program, call, use.flow), "~lib/task/Task<i32>");
}

{
  // Regression: a plain method is unaffected.
  const program = buildProgram([[
    "probe.ts",
    `class C { m(): i32 { return 1; } }
     function use(c: C): void { c.m(); }`
  ]]);
  program.initialize();
  const use = resolveTopLevel(program, "use");
  const call = use.prototype.bodyNode.statements[0].expression;
  check("c.m()  (plain m(): i32)  is i32", typeOf(program, call, use.flow), "i32");
  check("  ...and reports nothing", diagnosticCodes(program), []);
}

{
  // Regression: a plain function is unaffected.
  const program = buildProgram([[
    "probe.ts",
    `function g(): i32 { return 1; }
     function use(): void { g(); }`
  ]]);
  program.initialize();
  const use = resolveTopLevel(program, "use");
  const call = use.prototype.bodyNode.statements[0].expression;
  check("g()  (plain g(): i32)  is i32", typeOf(program, call, use.flow), "i32");
}

// ── await inside a nested function ────────────────────────────────────────

console.log("await inside a nested function");

{
  // An async arrow inside an async function, with an inferred return type: the
  // resolver resolves the body through a flow of its own, so the `await` runs
  // inside a nested function's context and the arrow's return type is `T`.
  const program = buildProgram([[
    "probe.ts",
    `async function outer(h: Task<i32>): i32 {
       const g = async () => await h;
       return 1;
     }`
  ]]);
  program.initialize();
  const outer = resolveTopLevel(program, "outer");
  const declaration = outer.prototype.bodyNode.statements[0].declarations[0];
  const arrow = declaration.initializer;
  check("the arrow's declaration carries async", arrow.declaration.isAsync, true);
  check(
    "`async () => await h`  is () => i32 (return type inferred from the await)",
    typeOf(program, arrow, outer.flow),
    "() => i32"
  );
  // The 1110 ("Type expected.") is *not* async-specific: an arrow with an
  // omitted return type resolved directly reports it whether or not it is
  // async, which the plain control below pins. `async` adds nothing.
  check(
    "  ...with the pre-existing arrow 1110 and no async diagnostic",
    diagnosticCodes(program),
    [1110]
  );
}

{
  // The control for the 1110 above: a *plain* arrow with an omitted return type,
  // resolved the same way, reports the same single diagnostic. Async adds
  // nothing.
  const program = buildProgram([[
    "probe.ts",
    `function outer(h: i32): i32 {
       const g = () => h;
       return 1;
     }`
  ]]);
  program.initialize();
  const outer = resolveTopLevel(program, "outer");
  const arrow = outer.prototype.bodyNode.statements[0].declarations[0].initializer;
  check("plain `() => h` is () => i32", typeOf(program, arrow, outer.flow), "() => i32");
  check("  ...and reports only the pre-existing 1110", diagnosticCodes(program), [1110]);
}

// ── error paths ───────────────────────────────────────────────────────────

console.log("error paths");

{
  // Module scope: no enclosing async function. `await` is a grammar error, and
  // the parser reports it once (TypeScript's code and text) -- the resolver
  // does not repeat it, and must not crash on it either.
  const program = buildProgram([["probe.ts", `await 1;`]]);
  program.initialize();
  const file = program.filesByName.get("probe");
  const expression = file.source.statements[0].expression;
  check("await at module scope is reported", diagnosticCodes(program), [AWAIT_OUTSIDE_ASYNC]);
  check(
    "  ...as TypeScript's 1308",
    diagnosticTexts(program)[0].includes("only allowed within async functions"),
    true
  );
  check(
    "  ...and still resolves (no abort)",
    typeOf(program, expression, file.startFunction.flow),
    "i32"
  );
}

{
  // A non-async function: same diagnostic.
  const program = buildProgram([["probe.ts", `function f(): i32 { return await 1; }`]]);
  program.initialize();
  const f = resolveTopLevel(program, "f");
  const expression = f.prototype.bodyNode.statements[0].value;
  check("await in a non-async function is reported", diagnosticCodes(program), [AWAIT_OUTSIDE_ASYNC]);
  check("  ...and resolves without aborting", typeOf(program, expression, f.flow), "i32");
}

{
  // A non-async function nested inside an async one: the context does not
  // inherit -- TypeScript's behaviour.
  const program = buildProgram([[
    "probe.ts",
    `async function f(): void { function g(): i32 { return await 1; } }`
  ]]);
  program.initialize();
  check(
    "await in a non-async function nested in an async one is reported",
    diagnosticCodes(program),
    [AWAIT_OUTSIDE_ASYNC]
  );
}

{
  // `async` on an accessor and on a constructor: refused by the parser, and the
  // element side never reports the trait.
  const program = buildProgram([[
    "probe.ts",
    `class C {
       async get g(): i32 { return 1; }
       async constructor() {}
     }`
  ]]);
  program.initialize();
  check(
    "async getter and async constructor are both refused",
    diagnosticCodes(program),
    [ASYNC_MODIFIER_REFUSED, ASYNC_MODIFIER_REFUSED]
  );
  const classPrototype = program.filesByName.get("probe").getMember("C");
  check(
    "  ...and the constructor's element does not carry async",
    classPrototype.constructorPrototype.isAsync,
    false
  );
}

{
  // The same guard, reachable only from a synthesized AST: a transform that
  // marks a constructor `isAsync` must not make one.
  const program = buildProgram([["probe.ts", `class C { constructor() {} }`]]);
  const source = program.parser.sources.find(source => source.text.startsWith("class C"));
  source.statements[0].members[0].isAsync = true; // what a transform could do
  program.initialize();
  const classPrototype = program.filesByName.get("probe").getMember("C");
  check(
    "a synthesized async constructor stays non-async",
    classPrototype.constructorPrototype.isAsync,
    false
  );
}

// ── the lookupExpression arm ──────────────────────────────────────────────

console.log("the lookupExpression arm (property access on an await)");

{
  // `(await h).value` reaches `lookupExpression` with an AwaitExpression. Before
  // Phase 2 that arm was `assert(false)` -- a compiler abort. It must now resolve
  // to the element of the *awaited* type, so the diagnostic names `i32`'s
  // wrapper rather than aborting or naming the task.
  const program = buildProgram([[
    "probe.ts",
    `async function f(h: Task<i32>): i32 { return (await h).value; }`
  ]]);
  program.initialize();
  const f = resolveTopLevel(program, "f");
  const expression = f.prototype.bodyNode.statements[0].value; // (await h).value
  let outcome;
  try {
    const type = typeOf(program, expression, f.flow);
    // The property does not exist on `i32`, so the access itself is refused and
    // the expression has no type -- which is the *correct* outcome, and the
    // point is that it is a refusal rather than a crash.
    outcome = type === null ? "refused, not aborted" : `resolved to ${type}`;
  } catch (error) {
    outcome = `aborted: ${error.message}`;
  }
  check("(await h).value does not abort the compiler", outcome, "refused, not aborted");
  check(
    "  ...and the property error names the awaited type",
    diagnosticTexts(program).some(text => text.includes("Property 'value' does not exist on type '~lib/number/I32'")),
    true
  );
}

console.log();
if (failures) {
  console.log(`FAILURE: ${failures} of ${checks} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`[ SUCCESS ] ${checks} checks`);
}
