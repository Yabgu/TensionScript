// The `afterParse` closure lowering (C1: capture analysis, environment-class
// synthesis, envKind wiring, the rewrite, and the `$init$` guard).
//
// What is under test: `docs/closures-plan.md` §3-§6 — a captured binding has one
// home (an environment field), the environment classes are synthesized at the
// top level, the closure value carries the environment in `_env`, the callee
// reads it from the hidden `~env` global, and a captured binding read before
// assignment aborts with its name. Also under test: the shapes C1 refuses are
// refused *by name*, and a program with no capture is left untouched.
//
// Why the compiler is driven directly for wat assertions, and through the CLI
// for runtime values: a `Program` may be compiled once (`asc.compile`), and the
// library entry does not register the transforms — the CLI does. The runtime
// cases therefore exercise the real CLI path (`bin/tensionscript.js`), which is
// also what makes a value a value.
//
// Run: npm run test:closure

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildProgram,
  assemblyscript as asc
} from "../async/harness.js";

const here = dirname(fileURLToPath(import.meta.url));
const CLI = join(here, "..", "..", "bin", "tensionscript.js");

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

const NOT_IMPLEMENTED = 100;

/** Compiles `source` through the closure transform, then async (the CLI order). */
function run(source) {
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

/** The `Not implemented: <gap>` messages, by gap. */
function refusals(r) {
  return r.program.parser.diagnostics
    .filter(diagnostic => diagnostic.code === NOT_IMPLEMENTED)
    .map(diagnostic => diagnostic.message.replace("Not implemented: ", ""))
    .filter(message => message !== "Async functions");
}

/** The text of one function in a module, params and body. */
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

/** Runs a program through the real CLI and calls `entry`, returning its value. */
function execute(source, entry = "main") {
  const dir = mkdtempSync(join(tmpdir(), "closure-"));
  try {
    const tsPath = join(dir, "probe.ts");
    const wasmPath = join(dir, "probe.wasm");
    writeFileSync(tsPath, source);
    execFileSync(process.execPath, [
      CLI, tsPath, "-o", wasmPath,
      "--runtime", "incremental", "--exportRuntime", "--noColors"
    ], { stdio: "pipe" });
    return runWasm(readFileSync(wasmPath), entry);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Instantiates a module and calls `entry`; returns its number or the abort text. */
async function runWasm(bytes, entry) {
  const module = await WebAssembly.compile(bytes);
  let instance = null;
  const env = {
    // The runtime's abort import receives string pointers; decode UTF-16LE with
    // the length in the object header (`std/assembly/string.ts:50-52`).
    abort: (message) => {
      const memory = instance.exports.memory;
      const data = new Uint8Array(memory.buffer);
      const view = new DataView(memory.buffer);
      const length = view.getUint32(message - 4, true) >> 1;
      let text = "";
      for (let i = 0; i < length; i++) {
        text += String.fromCharCode(data[message + i * 2] | (data[message + i * 2 + 1] << 8));
      }
      throw new Error(text);
    },
    seed: () => 0
  };
  instance = await WebAssembly.instantiate(module, { env });
  try {
    return { value: instance.exports[entry]() };
  } catch (error) {
    return { error: error.message };
  }
}

const TRIVIAL = `
function outer(): i32 {
  let x: i32 = 1;
  function inner(): i32 { return x; }
  return inner();
}
export function main(): i32 { return outer(); }
`;

// C1a — the analysis result, read off the rewritten AST.
{
  const r = run(TRIVIAL);
  check("C1a: the env class is emitted before the owner", r.names(), [ "outer$Env", "outer", "main" ]);
  const owner = r.file.statements.find(statement => statement.name && statement.name.text === "outer");
  const first = owner.body.statements[0];
  check("C1a: the owner's first statement allocates the env", [
    first.kind === asc.NodeKind.Variable,
    first.declarations[0].name.text,
  ], [ true, "$closureEnv" ]);
  const inner = owner.body.statements[2].expression.declaration;
  const returned = inner.body.statements[0].value;
  check("C1a: the captured reference is rewritten inside the closure", [
    returned.kind === asc.NodeKind.PropertyAccess,
    returned.expression.kind === asc.NodeKind.Identifier,
    returned.expression.text,
    returned.property.text,
  ], [ true, true, "$closureEnvIn", "x" ]);
}

// C1b — the environment class's shape.
{
  const r = run(TRIVIAL);
  const envClass = r.file.statements[0];
  check("C1b: env class name and base", [ envClass.name.text, envClass.extendsType.name.identifier.text ],
    [ "outer$Env", "TaskEnv" ]);
  check("C1b: one instance field, named after the binding",
    envClass.members.map(member => [ member.name.text, member.type.name.identifier.text ]),
    [ [ "x", "i32" ] ]);
}

// C1c — the shipped `Receiver` path is untouched: a this-only arrow emits no
// environment at all.
{
  const r = run(`
class C {
  x: i32 = 7;
  m(): i32 { const f = (): i32 => this.x; return f(); }
}
export function main(): i32 { return new C().m(); }
`);
  check("C1c: no environment for a this-only arrow", refusals(r), []);
  const wat = r.wat();
  check("C1c: no environment subclass and no env local",
    [ /\$Env/.test(wat), /closureEnv/.test(wat) ], [ false, false ]);
  check("C1c: the receiver still travels through ~env", /global\.set \$~env/.test(wat), true);
}

// C1d — the emitted shape: allocation, _env store, ~env delivery, prologue.
{
  const r = run(TRIVIAL);
  const wat = r.wat();
  const outer = funcBody(wat, "probe/outer");
  const inner = funcBody(wat, "probe/outer~inner");
  check("C1d: the owner allocates the environment", /outer\$Env#constructor/.test(outer), true);
  check("C1d: the closure value stores the env at _env (offset 4)",
    /i32\.store offset=4/.test(outer), true);
  check("C1d: the call site hands it over through ~env", /global\.set \$~env/.test(outer), true);
  check("C1d: the callee reads it back at entry", /global\.get \$~env/.test(inner), true);
  check("C1d: the callee reads the captured field", /outer\$Env#get:x/.test(inner), true);
}

// C1e — a captured binding read before assignment aborts with its name.
{
  const r = run(`
function outer(): i32 {
  let x: i32;
  function inner(): i32 { return x; }
  return inner();
}
export function main(): i32 { return outer(); }
`);
  check("C1e: the read is guarded", /__closureInit/.test(r.wat()), true);
  check("C1e: the flag field is emitted",
    r.file.statements[0].members.map(member => member.name.text),
    [ "x", "$init$x" ]);
}

// — runtime values ——————————————————————————————————————————————————————————

{
  const out = await execute(TRIVIAL);
  check("C1f: one captured binding, called indirectly", out, { value: 1 });
}
{
  const out = await execute(`
function outer(): i32 {
  let a: i32 = 1;
  let b: i32 = 2;
  function inner(): i32 { return a + b; }
  return inner();
}
export function main(): i32 { return outer(); }
`);
  check("C1f: two captured bindings", out, { value: 3 });
}
{
  const out = await execute(`
function outer(): i32 {
  let x: i32 = 1;
  function bump(): void { x = x + 1; }
  bump(); bump();
  return x;
}
export function main(): i32 { return outer(); }
`);
  check("C1f: a captured binding is shared, not copied", out, { value: 3 });
}
{
  const out = await execute(`
function outer(c: bool): i32 {
  let r: i32 = 0;
  if (c) {
    let y: i32 = 5;
    function inner(): i32 { return y; }
    r = inner();
  }
  return r;
}
export function main(): i32 { return outer(true); }
`);
  check("C1f: a block-scoped capture", out, { value: 5 });
}
{
  const out = await execute(`
function outer(): i32 {
  let x: i32;
  function inner(): i32 { return x; }
  return inner();
}
export function main(): i32 { return outer(); }
`);
  check("C1f: reading an uninitialized capture aborts with the binding's name", out,
    { error: "reading an uninitialized captured binding x" });
}
{
  const out = await execute(`
class C {
  x: i32 = 7;
  m(): i32 { const f = (): i32 => this.x; return f(); }
}
export function main(): i32 { return new C().m(); }
`);
  check("C1f: the this-only arrow still returns 7 (Receiver untouched)", out, { value: 7 });
}
{
  // Observed working; C2 owns the guarantee. Kept here so a regression in the
  // creation/hand-over path is visible.
  const out = await execute(`
function counter(): () => i32 {
  let n: i32 = 0;
  function next(): i32 { return ++n; }
  return next;
}
export function main(): i32 {
  const f = counter();
  f();
  const g = counter();
  return f() + g();
}
`);
  check("C1f: an escaped closure keeps its environment (C2 owns the guarantee)", out, { value: 3 });
}

// — refusals, each by name ——————————————————————————————————————————————————

{
  const r = run(`
function outer(): i32 {
  let x = 1;
  function inner(): i32 { return x; }
  return inner();
}
export function main(): i32 { return outer(); }
`);
  check("D10: a captured local without a declared type is refused by name",
    refusals(r), [ "a captured local without a declared type (closures lowering)" ]);
}
{
  const r = run(`
function outer<T>(v: T): T {
  let x: T = v;
  function inner(): T { return x; }
  return inner();
}
export function main(): i32 { return outer<i32>(1); }
`);
  check("D11: a captured local typed by a type parameter is refused by name",
    refusals(r), [ "a captured local typed by a type parameter (closures lowering)" ]);
}
{
  const r = run(`
function outer(): i32 {
  let r: i32 = 0;
  for (let i: i32 = 0; i < 1; i++) {
    function inner(): i32 { return i; }
    r = inner();
  }
  return r;
}
export function main(): i32 { return outer(); }
`);
  check("C3: a captured for-header binding is refused by name",
    refusals(r), [ "a captured for-header binding (closures lowering)" ]);
}
{
  const r = run(`
async function outer(h: Task<i32>): i32 {
  let x: i32 = 1;
  function inner(): i32 { return x; }
  return x;
}
export function main(): i32 { return 1; }
`);
  check("async: a capture in an async body is refused by name",
    refusals(r).includes("a capture in an async function (closures lowering)"), true);
}
{
  const r = run(`
class C {
  m(): i32 {
    let x: i32 = 1;
    function inner(): i32 { return x; }
    return inner();
  }
}
export function main(): i32 { return new C().m(); }
`);
  check("owners: a capture from a method body is refused by name",
    refusals(r), [ "a capture from a method body (closures lowering)" ]);
}

// A program with no capture is left untouched by the transform.
{
  const r = run(`
function outer(): i32 { return 1; }
export function main(): i32 { return outer(); }
`);
  const statements = r.file.statements;
  check("no-capture: no class is synthesized, no statement is rewritten",
    [ statements.length, statements.map(statement => statement.name.text) ],
    [ 2, [ "outer", "main" ] ]);
  check("no-capture: no refusal", refusals(r), []);
}

console.log(`\n${failures === 0 ? "[ SUCCESS ]" : "FAILURE"}: ${checks - failures} of ${checks} checks passed`);
if (failures !== 0) process.exitCode = 1;
