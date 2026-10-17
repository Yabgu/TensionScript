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
  // C2b: a method body is a valid owner. Its `this` is a parameter, so a
  // combined `this` + local capture has a receiver to store at field 0.
  const r = run(`
class C {
  y: i32 = 10;
  combined(): i32 {
    let x: i32 = 2;
    const g = (): i32 => this.y + x;
    return g();
  }
}
export function main(): i32 { return new C().combined(); }
`);
  check("C2b: a combined `this` + local capture is lowered, not refused", refusals(r), []);
  const envClass = r.file.statements.find(statement => statement.name && statement.name.text === "combined$Env");
  check("C2b: `$this` is field 0, then the captured locals in declaration order",
    envClass.members.map(member => member.name.text), [ "$this", "x" ]);
  const wat = r.wat();
  check("C2b: the receiver is stored from the owner's `this`",
    /combined\$Env#set:\$this/.test(wat), true);
  check("C2b: the arrow reads both fields through the delivered env",
    [ /combined\$Env#get:\$this/.test(wat), /combined\$Env#get:x/.test(wat) ], [ true, true ]);
  check("C2b: the env's visitor traces `$this`",
    /combined\$Env~visit[\s\S]{0,400}?__visit/.test(wat), true);
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


// — C2a: escaped closures —————————————————————————————————————————————————————

{
  // The returned value carries `_env`; the environment is a heap object, so
  // the frame returning does not affect it (§5.5).
  const r = run(`
function outer(): () => i32 {
  let x: i32 = 1;
  function next(): i32 { return x; }
  return next;
}
export function main(): i32 { return outer()(); }
`);
  check("C2a: a returned closure is a heap value carrying the env", refusals(r), []);
  const wat = r.wat();
  const outer = funcBody(wat, "probe/outer");
  check("C2a: the returned value is the heap Function<T> with _env stored",
    /i32\.store offset=4/.test(outer), true);
  check("C2a: the environment outlives the frame (heap allocation, managed)",
    /probe\/outer\$Env#constructor/.test(outer), true);
}
{
  const out = await execute(`
function outer(): () => i32 {
  let x: i32 = 1;
  function next(): i32 { return x; }
  return next;
}
export function main(): i32 { return outer()(); }
`);
  check("C2a: an escaped closure runs", out, { value: 1 });
}
{
  // Two closures created in one scope share the environment (per-scope-instance
  // granularity, §2.2), so a mutation through one is visible through the other.
  const out = await execute(`
class Pair { inc: () => i32 = (): i32 => 0; get: () => i32 = (): i32 => 0; }
function pair(): Pair {
  let n: i32 = 0;
  function inc(): i32 { return ++n; }
  function get(): i32 { return n; }
  const p = new Pair();
  p.inc = inc;
  p.get = get;
  return p;
}
export function main(): i32 {
  const p = pair();
  p.inc(); p.inc();
  return p.get() * 10 + p.inc();
}
`);
  check("C2a: two closures from one scope share one environment", out, { value: 23 });
}
{
  // The frame is long gone by the time the closure is called.
  const out = await execute(`
function makeCounter(): () => i32 {
  let n: i32 = 0;
  function inc(): i32 { return ++n; }
  return inc;
}
function burn(depth: i32): i32 {
  if (depth <= 0) return 0;
  let scratch: i32 = depth * 2;
  return burn(depth - 1) + scratch;
}
export function main(): i32 {
  const c = makeCounter();
  burn(200);
  return c() * 100 + c();
}
`);
  check("C2a: the environment survives 200 intervening frames", out, { value: 102 });
}
{
  // Two independent creators must not share an environment.
  const out = await execute(`
function makePair(): () => i32 {
  let n: i32 = 0;
  function inc(): i32 { return ++n; }
  return inc;
}
export function main(): i32 {
  const a = makePair();
  const b = makePair();
  a(); a();
  return b() * 10 + a();
}
`);
  check("C2a: each creator gets its own environment", out, { value: 13 });
}

// — C2b: combined `this` + local, runtime ————————————————————————————————————

{
  const out = await execute(`
class C {
  y: i32 = 10;
  combined(): i32 {
    let x: i32 = 2;
    const g = (): i32 => this.y + x;
    return g();
  }
}
export function main(): i32 { return new C().combined(); }
`);
  check("C2b: a combined capture reads `this` and the local", out, { value: 12 });
}
{
  // The arrow escapes the method; the env must carry the receiver with it.
  const out = await execute(`
class C {
  y: i32 = 10;
  escape(): () => i32 {
    let x: i32 = 2;
    const g = (): i32 => this.y + x;
    return g;
  }
}
export function main(): i32 { return new C().escape()(); }
`);
  check("C2b: an escaped combined capture keeps both `this` and the local", out, { value: 12 });
}
{
  // A mutation through the environment is visible to the method afterwards.
  const out = await execute(`
class C {
  total: i32 = 0;
  bump(): () => void {
    let step: i32 = 5;
    const g = (): void => { this.total += step; };
    return g;
  }
}
export function main(): i32 {
  const c = new C();
  const b = c.bump();
  b(); b();
  return c.total;
}
`);
  check("C2b: an escaped arrow mutates the receiver through the env", out, { value: 10 });
}

// — C2c: method unbound semantics ————————————————————————————————————————————

{
  // Measured: a detached method value is unbound, exactly as in TypeScript.
  // It does not compile — `TS2685` — which is the correct outcome; `call` is the
  // explicit-receiver path (there is no `bind` in std or builtins).
  const r = run(`
class C {
  x: i32 = 7;
  m(): i32 { return this.x; }
}
export function main(): i32 {
  const c = new C();
  const f = c.m;
  return f();
}
`);
  // `TS2685` is a *resolver* diagnostic, so the program must be initialized
  // before it is reported; `wat()` is what does that.
  r.wat();
  check("C2c: a detached method call is still refused as unbound",
    r.program.parser.diagnostics.some(diagnostic => diagnostic.code === 2685), true);
}
{
  const out = await execute(`
class C {
  x: i32 = 7;
  m(): i32 { return this.x; }
}
export function main(): i32 {
  const c = new C();
  const f = c.m;
  return f.call(c);
}
`);
  check("C2c: `call` is the explicit-receiver path", out, { value: 7 });
}

// — C2d: `super` in a capturing arrow ————————————————————————————————————————

{
  const r = run(`
class Base { m(): i32 { return 1; } }
class C extends Base {
  m(): i32 {
    let x: i32 = 1;
    const f = (): i32 => super.m() + x;
    return f();
  }
}
export function main(): i32 { return new C().m(); }
`);
  check("C2d: `super` in a capturing arrow is refused by name",
    refusals(r), [ "super in a capturing arrow (closures lowering)" ]);
}

console.log(`\n${failures === 0 ? "[ SUCCESS ]" : "FAILURE"}: ${checks - failures} of ${checks} checks passed`);
if (failures !== 0) process.exitCode = 1;
