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
  let closure = null;
  for (const Transform of [ asc.ClosureLowerTransform, asc.AsyncLowerTransform ]) {
    Object.assign(Transform.prototype, { program });
    const transform = new Transform();
    if (Transform === asc.ClosureLowerTransform) closure = transform;
    transform.afterParse(program.parser);
  }
  const file = program.sources.find(source => source.internalPath === "probe");
  return {
    program,
    file,
    /** The closure transform's chain analysis (C5a phase 1's test hook). */
    analysis: () => closure.dumpEnvAnalysis(),
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
    .map(diagnostic => diagnostic.message.replace("Not implemented: ", ""));
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
  // C3a replaces the C1 refusal: a for-header binding is captured by cloning the
  // environment once per iteration, before the incrementor.
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
  check("C3a: a captured for-header binding is lowered, not refused", refusals(r), []);
}
{
  // C4 removed the async-body refusal: the environment becomes an ordinary
  // local of the async body, and the async transform's lifting rule carries it
  // across the await (`docs/closures-plan.md` §8.3(b)).
  const r = run(`
async function outer(h: Task<i32>): i32 {
  let x: i32 = 1;
  function inner(): i32 { return x; }
  await h;
  return inner();
}
let sink: Task<i32> | null = null;
export function main(): i32 { sink = outer(changetype<Task<i32>>(0)); return 1; }
`);
  check("async: a capture in an async body is lowered, not refused", refusals(r), []);
  check("async: the env class is emitted and the closure reads it",
    [ r.file.statements.some(statement => statement.name && statement.name.text === "outer$Env"),
      /outer\$Env#get:x/.test(r.wat()) ],
    [ true, true ]);
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

{
  // The receiver can also come from an explicit `this` parameter on a free
  // function (`outerThisType` reads `signature.explicitThisType`). The call has
  // to be `outer.call(c)`: a function with an explicit `this` is not callable as
  // a plain function (pre-existing AS behaviour, measured on the ccf888c6
  // baseline as TS2685 — not a closure regression).
  const out = await execute(`
class C { y: i32 = 5; }
function outer(this: C): i32 {
  let x: i32 = 2;
  const g = (): i32 => this.y + x;
  return g();
}
export function main(): i32 { return outer.call(new C()); }
`);
  check("C2b: an explicit `this:` parameter is also a capture source", out, { value: 7 });
}
{
  // `$this` lives in the environment of the scope that owns the captured local,
  // and the owner's `this` is in scope at that scope's entry, so a block-scoped
  // local plus `this` needs no parent chain (§7.2).
  const r = run(`
class C {
  y: i32 = 100;
  m(c: bool): i32 {
    let r: i32 = 0;
    if (c) {
      let x: i32 = 2;
      const g = (): i32 => this.y + x;
      r = g();
    }
    return r;
  }
}
export function main(): i32 { return new C().m(true); }
`);
  check("C2b: `this` plus a block-scoped local is lowered", refusals(r), []);
  check("C2b: the block env carries `$this` at field 0",
    r.file.statements
      .filter(statement => statement.name && statement.name.text.startsWith("m$Env"))
      .map(statement => statement.members.map(member => member.name.text)),
    [ [ "$this", "x" ] ]);
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


// — C3a: for-header captures (per-iteration clone, F7) ————————————————————————

const LOOP_A = `
class Fns { a: () => i32 = (): i32 => 0; b: () => i32 = (): i32 => 0; c: () => i32 = (): i32 => 0; }
function make(): Fns {
  const fns = new Fns();
  let n: i32 = 0;
  for (let i: i32 = 0; i < 3; i++) {
    function get(): i32 { return i; }
    if (n == 0) fns.a = get; else if (n == 1) fns.b = get; else fns.c = get;
    n++;
  }
  return fns;
}
export function main(): i32 { const f = make(); return f.a() * 100 + f.b() * 10 + f.c(); }
`;

{
  // Case (a): three closures capture 0, 1, 2 — not one aliased binding.
  const out = await execute(LOOP_A);
  check("C3a (a): three closures capture 0, 1, 2", out, { value: 12 });
}
{
  // The emitted shape: the env is allocated before the loop, and the body's
  // last statement replaces it with a copy — before the incrementor runs.
  const r = run(LOOP_A);
  const wat = r.wat();
  const make = funcBody(wat, "probe/make");
  const envClass = r.file.statements.find(statement => statement.name && statement.name.text === "make$Env$1");
  check("C3a (a): the loop env class has a copy constructor",
    envClass.members.map(member => member.name.text), [ "i", "constructor" ]);
  check("C3a (a): the loop reads and writes the field",
    [ /make\$Env\$1#get:i/.test(make), /make\$Env\$1#set:i/.test(make) ], [ true, true ]);
  // The clone is the *last* constructor call in the body: `new X$Env$1($closureEnv$1)`.
  let lastClone = make.lastIndexOf("make$Env$1#constructor");
  let lastBodyWork = make.lastIndexOf("Fns#set:");
  let lastIncrement = make.lastIndexOf("make$Env$1#set:i");
  check("C3a (a): the clone runs after the body's work and before the incrementor",
    [ lastClone > lastBodyWork, lastClone < lastIncrement ], [ true, true ]);
}
{
  // Case (b): `continue` runs the clone, so the skipped iteration's value is
  // never overwritten by the increment.
  const out = await execute(`
class Fns { a: () => i32 = (): i32 => 0; b: () => i32 = (): i32 => 0; c: () => i32 = (): i32 => 0; }
function make(): Fns {
  const fns = new Fns();
  let n: i32 = 0;
  for (let i: i32 = 0; i < 3; i++) {
    if (i == 1) continue;
    function get(): i32 { return i; }
    if (n == 0) fns.a = get; else fns.b = get;
    n++;
  }
  return fns;
}
export function main(): i32 { const f = make(); return f.a() * 10 + f.b(); }
`);
  check("C3a (b): `continue` still yields 0 and 2", out, { value: 2 });
}
{
  // Case (c): `break` leaves the loop without cloning, and the closures made so
  // far keep 0 and 1.
  const out = await execute(`
class Fns { a: () => i32 = (): i32 => 0; b: () => i32 = (): i32 => 0; c: () => i32 = (): i32 => 0; }
function make(): Fns {
  const fns = new Fns();
  let n: i32 = 0;
  for (let i: i32 = 0; i < 3; i++) {
    function get(): i32 { return i; }
    if (n == 0) fns.a = get; else fns.b = get;
    n++;
    if (i == 1) break;
  }
  return fns;
}
export function main(): i32 { const f = make(); return f.a() * 10 + f.b(); }
`);
  check("C3a (c): `break` still yields 0 and 1", out, { value: 1 });
}
{
  // Case (d): a binding declared *inside* the body is per-iteration by
  // construction — its block owns the environment, and each iteration is a new
  // block instance. No clone is involved.
  const r = run(`
class Fns { a: () => i32 = (): i32 => 0; b: () => i32 = (): i32 => 0; c: () => i32 = (): i32 => 0; }
function make(): Fns {
  const fns = new Fns();
  let n: i32 = 0;
  for (let i: i32 = 0; i < 3; i++) {
    let t: i32 = i * 10;
    function get(): i32 { return t; }
    if (n == 0) fns.a = get; else if (n == 1) fns.b = get; else fns.c = get;
    n++;
  }
  return fns;
}
export function main(): i32 { const f = make(); return f.a() + f.b() + f.c(); }
`);
  check("C3a (d): a body binding needs no loop clone", refusals(r), []);
  check("C3a (d): no copy constructor is synthesized for the loop",
    r.file.statements
      .filter(statement => statement.name && statement.name.text.startsWith("make$Env"))
      .map(statement => statement.members.map(member => member.name.text)),
    [ [ "t" ] ]);
}
{
  const out = await execute(`
class Fns { a: () => i32 = (): i32 => 0; b: () => i32 = (): i32 => 0; c: () => i32 = (): i32 => 0; }
function make(): Fns {
  const fns = new Fns();
  let n: i32 = 0;
  for (let i: i32 = 0; i < 3; i++) {
    let t: i32 = i * 10;
    function get(): i32 { return t; }
    if (n == 0) fns.a = get; else if (n == 1) fns.b = get; else fns.c = get;
    n++;
  }
  return fns;
}
export function main(): i32 { const f = make(); return f.a() + f.b() + f.c(); }
`);
  check("C3a (d): a body binding yields 0, 10, 20", out, { value: 30 });
}
{
  // Case (e): a closure called inside the iteration sees its own binding, and
  // the value it captured survives the next iteration's clone.
  const out = await execute(`
class Fns { a: () => i32 = (): i32 => 0; b: () => i32 = (): i32 => 0; c: () => i32 = (): i32 => 0; }
function make(): Fns {
  const fns = new Fns();
  let n: i32 = 0;
  for (let i: i32 = 0; i < 3; i++) {
    let f = (): i32 => i;
    let now: i32 = f();
    function get(): i32 { return i; }
    if (now != i) return fns;
    if (n == 0) fns.a = get; else if (n == 1) fns.b = get; else fns.c = get;
    n++;
  }
  return fns;
}
export function main(): i32 { const f = make(); return f.a() * 100 + f.b() * 10 + f.c(); }
`);
  check("C3a (e): a closure called in its own iteration sees its own value", out, { value: 12 });
}
{
  // A nested loop owns its own `continue` and its own clone: the inner loop's
  // hook must not fire on an outer loop's `continue` (or the reverse).
  const out = await execute(`
class Fns { a: () => i32 = (): i32 => 0; b: () => i32 = (): i32 => 0; }
function make(): Fns {
  const fns = new Fns();
  let n: i32 = 0;
  for (let i: i32 = 0; i < 2; i++) {
    for (let j: i32 = 0; j < 2; j++) {
      if (j == 0) continue;
      function get(): i32 { return j; }
      if (n == 0) fns.a = get; else fns.b = get;
      n++;
    }
  }
  return fns;
}
export function main(): i32 { const f = make(); return f.a() * 10 + f.b(); }
`);
  check("C3a: a nested loop's `continue` uses the inner loop's clone", out, { value: 11 });
}

// — C3b: a closure cannot be a host callback (§9.1) ——————————————————————————

const HOST_CALLBACK_CAPTURE = `
declare function makeCallbacks(onBatch: (c: u32, p: u32, n: u32) => i32): void;
function outer(): i32 {
  let x: i32 = 1;
  function onBatch(c: u32, p: u32, n: u32): i32 { return x; }
  makeCallbacks(onBatch);
  return 0;
}
export function main(): i32 { return outer(); }
`;

{
  const r = run(HOST_CALLBACK_CAPTURE);
  check("C3b: a capturing closure registered as a host callback is refused by name",
    refusals(r), [ "a closure captured by a host callback (closures lowering)" ]);
}
{
  // An inline capturing closure is the same case, without the named local.
  const r = run(`
declare function makeCallbacks(onBatch: (c: u32, p: u32, n: u32) => i32): void;
function outer(): i32 {
  let x: i32 = 1;
  makeCallbacks((c: u32, p: u32, n: u32): i32 => x);
  return 0;
}
export function main(): i32 { return outer(); }
`);
  check("C3b: an inline capturing closure is refused by name",
    refusals(r), [ "a closure captured by a host callback (closures lowering)" ]);
}
{
  // A non-capturing handler is unaffected: its `_env` is zero, which is what
  // the shipped `makeCallbacks` guard requires.
  const r = run(`
declare function makeCallbacks(onBatch: (c: u32, p: u32, n: u32) => i32): void;
function onBatch(c: u32, p: u32, n: u32): i32 { return 1; }
export function main(): i32 { makeCallbacks(onBatch); return 0; }
`);
  check("C3b: a non-capturing handler is not refused", refusals(r), []);
}
{
  // A this-only arrow keeps its shipped path: the transform does not name it,
  // and the runtime `makeCallbacks` guard refuses it (`_env` is the receiver).
  const r = run(`
declare function makeCallbacks(onBatch: (c: u32, p: u32, n: u32) => i32): void;
class C {
  y: i32 = 1;
  m(): i32 {
    const h = (c: u32, p: u32, n: u32): i32 => this.y;
    makeCallbacks(h);
    return 0;
  }
}
export function main(): i32 { return new C().m(); }
`);
  check("C3b: a this-only arrow is left to the runtime guard", refusals(r), []);
}


// — C4: the async interaction ————————————————————————————————————————————————

/** The state struct's field names, in declaration order. */
function stateFields(r, name) {
  const state = r.file.statements.find(statement => statement.name && statement.name.text === name);
  return state.members
    .filter(member => member.kind === asc.NodeKind.FieldDeclaration)
    .map(member => member.name.text);
}

{
  // C4a: an async method reads `this` before and after an await, through the
  // state struct's this-struct.
  const r = run(`
class C {
  x: i32 = 7;
  async m(h: Task<i32>): i32 {
    let before: i32 = this.x;
    let v: i32 = await h;
    return before + this.x + v;
  }
}
let sink: Task<i32> | null = null;
export function main(): i32 { sink = new C().m(changetype<Task<i32>>(0)); return 1; }
`);
  check("C4a: an async method is lowered", refusals(r), []);
  const thisEnvClasses = r.file.statements
    .filter(statement => statement.name && statement.name.text === "m$ThisEnv");
  check("C4a: the this-struct is synthesized, with the receiver at field 0",
    thisEnvClasses.map(statement => [
      statement.extendsType.name.identifier.text,
      statement.members
        .filter(member => member.kind === asc.NodeKind.FieldDeclaration)
        .map(member => member.name.text)
    ]),
    [ [ "TaskEnv", [ "$this" ] ] ]);
  // The entry writes `state.$env = new m$ThisEnv(this)`, so the class must take
  // the receiver. Without this constructor the synthesized `new` draws TS2554
  // and a *called* async method does not compile at all.
  check("C4a: ...and its constructor takes the receiver",
    thisEnvClasses.map(statement => statement.members
      .filter(member => member.kind === asc.NodeKind.MethodDeclaration && member.name.text === "constructor")
      .map(member => member.signature.parameters.length)),
    [ [ 1 ] ]);
  const wat = r.wat();
  const resume = funcBody(wat, "probe/m$resume");
  check("C4a: the resume function reads `this` through $env — before the await",
    /get:\$env[\s\S]{0,80}?m\$ThisEnv#get:\$this[\s\S]{0,60}?C#get:x/.test(resume), true);
  check("C4a: ...and again after the await",
    (resume.match(/m\$ThisEnv#get:\$this/g) || []).length, 2);
  check("C4a: the resume function takes only the state",
    /\(func \$probe\/m\$resume \(param \$0 i32\)\n/.test(wat), true);
}
{
  // C4a, AST: the entry populates `state.$env` before the resume call.
  const r = run(`
class C {
  x: i32 = 7;
  async m(): i32 { return this.x; }
}
let sink: Task<i32> | null = null;
export function main(): i32 { sink = new C().m(); return 1; }
`);
  const method = r.file.statements
    .find(statement => statement.name && statement.name.text === "C")
    .members.find(member => member.name && member.name.text === "m");
  const entry = method.body.statements.map(statement =>
    statement.kind === asc.NodeKind.Expression && statement.expression.kind === asc.NodeKind.Binary
      ? statement.expression.left.kind === asc.NodeKind.PropertyAccess
        ? statement.expression.left.property.text
        : String(statement.expression.kind)
      : String(statement.kind));
  check("C4a: the entry stores the receiver into $env",
    entry.includes("$env"), true);
  check("C4a: ...before it calls the resume function",
    entry.indexOf("$env") < entry.indexOf(String(asc.NodeKind.Expression) , entry.indexOf("$env")) + 1, true);
}
{
  // C4b: a free async function with an explicit `this:` parameter.
  const r = run(`
class C { x: i32 = 5; }
async function f(this: C, h: Task<i32>): i32 {
  let before: i32 = this.x;
  let v: i32 = await h;
  return before + this.x + v;
}
let sink: Task<i32> | null = null;
export function main(): i32 { sink = f.call(new C(), changetype<Task<i32>>(0)); return 1; }
`);
  check("C4b: an explicit `this:` parameter is lowered", refusals(r), []);
  const wat = r.wat();
  check("C4b: the this-struct is synthesized",
    r.file.statements.some(statement => statement.name && statement.name.text === "f$ThisEnv"), true);
  check("C4b: the resume function reads `this` through $env, before and after",
    (funcBody(wat, "probe/f$resume").match(/f\$ThisEnv#get:\$this/g) || []).length, 2);
}
{
  // C4c: a nested function that captures an async body's local.
  const r = run(`
async function outer(h: Task<i32>): i32 {
  let x: i32 = 1;
  function inner(): i32 { return x + 1; }
  await h;
  return inner();
}
let sink: Task<i32> | null = null;
export function main(): i32 { sink = outer(changetype<Task<i32>>(0)); return 1; }
`);
  check("C4c: a nested capturing function is lowered", refusals(r), []);
  const wat = r.wat();
  const resume = funcBody(wat, "probe/outer$resume");
  check("C4c: the environment is a state field", /outer\$State#get:\$closureEnv/.test(resume), true);
  check("C4c: ...copied in at resume entry", /outer\$State#get:\$closureEnv/.test(resume), true);
  // The creation site stores the copy-in into the heap Function<T>'s `_env`.
  check("C4c: the closure creation stores the env in _env",
    /State#get:\$closureEnv[\s\S]{0,600}?i32\.store offset=4/.test(resume), true);
  check("C4c: the closure reads the captured binding through its environment",
    /outer\$Env#get:x/.test(wat), true);
  check("C4c: the captured binding is NOT a state field", stateFields(r, "outer$State").includes("x"), false);
}
{
  // C4d — case 6: a closure captures, the body awaits, and the captured
  // binding is read (through the closure) after the resume.
  const r = run(`
async function outer(h: Task<i32>): i32 {
  let x: i32 = 1;
  function bump(): i32 { return ++x; }
  let before: i32 = bump();
  await h;
  return bump() + before;
}
let sink: Task<i32> | null = null;
export function main(): i32 { sink = outer(changetype<Task<i32>>(0)); return 1; }
`);
  check("C4d: case 6 lowers", refusals(r), []);
  const fields = stateFields(r, "outer$State");
  check("C4d: the state struct references the environment, and does not copy `x`",
    [ fields.includes("$closureEnv"), fields.includes("x") ], [ true, false ]);
  const resume = funcBody(r.wat(), "probe/outer$resume");
  check("C4d: the park copies the environment out",
    /State#set:\$closureEnv/.test(resume), true);
  check("C4d: the mutation happens through the environment",
    /outer\$Env#(get|set):x/.test(r.wat()), true);
  // No runtime exists yet (`__taskRegister` and `__taskPark` trap), so the
  // *value* half of case 6 is Phase 4's; what C4 can prove is the shape above.
}
{
  // C4e: a captured binding and a non-captured local that crosses the await.
  // The captured one is in the environment; the other is a state field. No
  // binding has two homes.
  const r = run(`
async function outer(h: Task<i32>): i32 {
  let x: i32 = 1;
  function bump(): i32 { return ++x; }
  let y: i32 = 10;
  let first: i32 = bump();
  await h;
  return bump() + y + first;
}
let sink: Task<i32> | null = null;
export function main(): i32 { sink = outer(changetype<Task<i32>>(0)); return 1; }
`);
  check("C4e: both mechanisms compose", refusals(r), []);
  const fields = stateFields(r, "outer$State");
  check("C4e: the non-captured locals are state fields",
    [ fields.includes("y"), fields.includes("first") ], [ true, true ]);
  check("C4e: the captured binding is not a state field", fields.includes("x"), false);
  check("C4e: the environment field is a managed reference",
    fields.includes("$closureEnv"), true);
  const env = r.file.statements.find(statement => statement.name && statement.name.text === "outer$Env");
  check("C4e: the captured binding has exactly one home — the environment",
    env.members.map(member => member.name.text).includes("x"), true);
}
{
  // A free async function has no receiver, so `this` stays refused — including
  // inside a nested function, where TS would bind it dynamically.
  const r = run(`
async function f(): i32 { return this.x; }
export function main(): i32 { return 1; }
`);
  check("C4: `this` in a free async function is still refused by name",
    refusals(r), [ "this in an async function body (async lowering)" ]);
}

// 9. The reserved-name guard (F14): a name the lowering synthesizes is not
//    a name a user keeps — but only in a program that synthesizes at all.
//
// Measured before the guard: `let $parent: i32 = 7; const f = () => $parent;`
// compiled into `main$Env.$parent`, the field C5a adds. A program with no
// capture and no async has no environment and no state struct, so its `$parent`
// is harmless and must keep compiling — that is the gate this section pins.
{
  const SYNTHESIZED = [
    "$parent", "$this", "$env", "$closureEnv", "$closureEnvIn", "$closureEnv$1",
    "$init$x", "$awaited1", "$awaited99"
  ];
  for (const name of SYNTHESIZED) {
    const r = run(`
export function main(): i32 {
  let ${name}: i32 = 1;
  const g = (): i32 => ${name};
  return g();
}
`);
    check(`F14: a captured local named '${name}' is refused`,
      refusals(r), [ `a user identifier named '${name}' (closures lowering)` ]);
  }
}

{
  // The gate: with neither a capture nor an async function, nothing is
  // synthesized, so the name is the user's.
  const r = run(`
export function main(): i32 {
  let $parent: i32 = 1;
  let $this: i32 = 2;
  let $closureEnv: i32 = 3;
  return $parent + $this + $closureEnv;
}
`);
  check("F14: a program with no closure and no async keeps its `$` names", refusals(r), []);
  check("F14: ...and it still compiles to a value", r.wat().includes("(func $probe/main") || r.wat().includes("(func $main"), true);
}

{
  // An async function is enough to arm the guard: the async transform
  // synthesizes the state struct's names in the same reserved namespace.
  const r = run(`
async function f(h: Task<i32>): i32 {
  let $parent: i32 = 1;
  await h;
  return $parent;
}
export function main(): i32 { return 0; }
`);
  check("F14: an async-only program arms the guard",
    refusals(r), [ "a user identifier named '$parent' (closures lowering)" ]);
}

{
  // `$awaitedX` is not a name the transform can produce, so a user keeps it.
  const r = run(`
export function main(): i32 {
  let $awaitedX: i32 = 1;
  const g = (): i32 => $awaitedX;
  return g();
}
`);
  check("F14: `$awaitedX` (not digits) is not reserved", refusals(r), []);
}

{
  // Ordinary words are not refused by the flat scan. `handle` collides only
  // when it is lifted into the state struct, where the async transform's own
  // guard reports it — and `result` is not a state field at all any more.
  const plain = run(`
export function main(): i32 {
  let result: i32 = 1;
  let handle: i32 = 2;
  let record: i32 = 3;
  let resumePoint: i32 = 4;
  const g = (): i32 => result;
  return g() + handle + record + resumePoint;
}
`);
  check("F14: `result`/`handle`/`record`/`resumePoint` are not reserved flatly",
    refusals(plain), []);
  const lifted = run(`
async function f(h: Task<i32>): i32 {
  let handle: i32 = 1;
  await h;
  return handle;
}
export function main(): i32 { return 0; }
`);
  check("F14: a lifted `handle` is still refused, by the async guard",
    refusals(lifted), [ "a local whose name is reserved by the state struct (async lowering)" ]);
}

{
  // Every declaration position is scanned: parameter, function, class, field,
  // method, for-header, catch variable, and a local inside a nested function.
  const positions = [
    [ "a parameter", `export function main($parent: i32): i32 { let m: i32 = 1; const g = (): i32 => m; return g(); }` ],
    [ "a function name", `export function $parent(): i32 { return 1; }\nexport function main(): i32 { let m: i32 = 1; const g = (): i32 => m; return g(); }` ],
    [ "a class name", `class $parent { x: i32 = 1; }\nexport function main(): i32 { let m: i32 = 1; const g = (): i32 => m; return g(); }` ],
    [ "a field name", `class C { $parent: i32 = 1; }\nexport function main(): i32 { let m: i32 = 1; const g = (): i32 => m; return g(); }` ],
    [ "a method name", `class C { $parent(): i32 { return 1; } }\nexport function main(): i32 { let m: i32 = 1; const g = (): i32 => m; return g(); }` ],
    [ "a for-header", `export function main(): i32 { let s: i32 = 0; for (let $parent: i32 = 0; $parent < 2; $parent++) { let m: i32 = 1; const g = (): i32 => m; s += g(); } return s; }` ],
    [ "a catch variable", `export function main(): i32 { try { } catch ($parent) { } let m: i32 = 1; const g = (): i32 => m; return g(); }` ],
    [ "a nested function's local", `export function main(): i32 { const h = (): i32 => { let $parent: i32 = 1; return $parent; }; let m: i32 = 1; const g = (): i32 => m; return g(); }` ]
  ];
  for (const [ where, source ] of positions) {
    const r = run(source);
    check(`F14: ${where} named '$parent' is refused`,
      refusals(r), [ "a user identifier named '$parent' (closures lowering)" ]);
  }
}

{
  // The transform's own names are untouched: this program synthesizes
  // `$closureEnv`, `$closureEnvIn` and `$this`, and the guard must not see them.
  const r = run(`
class C { x: i32 = 7; m(): i32 { let n: i32 = 1; const f = (): i32 => this.x + n; return f(); } }
export function main(): i32 { return new C().m(); }
`);
  check("F14: the transform's own synthesized names are not refused", refusals(r), []);
  check("F14: ...and the environment is emitted as before",
    r.names().includes("m$Env") || r.wat().includes("m$Env#get:n"), true);
}

// 10. C5a: the chain — analysis (§4.7.2) and emission (§4.7.3).
//
// The analysis records every environment a closure must reach, innermost
// first, and `needed` is the head. Emission then builds the chain: a `$parent`
// field on every env with an owning ancestor, a parented constructor, and one
// `$parent!` per hop at a reference that crosses scopes. These checks assert
// the analysis (`dumpEnvAnalysis`), the emitted shape, and the value — a shape
// assertion alone would not catch a wrong hop count that lands on a plausible
// object.
{
  // One scope: unchanged from C1-C4, and now observable. The owner allocates
  // the env; the closure receives it; nothing is parented.
  const r = run(`
export function main(): i32 {
  let n: i32 = 1;
  const f = (): i32 => n;
  return f();
}
`);
  check("C5a-1: a one-scope capture is not refused", refusals(r), []);
  const records = r.analysis();
  const owner = records.find(record => record.name === "main");
  const closure = records.find(record => record.kind === "struct");
  check("C5a-1: the owner's env is recorded", [ owner.ownEnv, owner.receivesEnv, owner.parentClass ], [ true, false, null ]);
  check("C5a-1: the closure is Struct and receives", [ closure.kind, closure.receivesEnv, closure.ownEnv ], [ "struct", true, false ]);
  check("C5a-1: the closure's head is the owner's env", [ closure.envClass, closure.parentClass ], [ "main$Env", null ]);
  check("C5a-1: the chain is one env deep", closure.needed, [ "main$body:1" ]);
  check("C5a-1: no env class carries `$parent` at one scope deep",
    /#get:\$parent/.test(r.wat()), false);
}

{
  // The canonical two-scope shape: a loop header and the body block.
  const source = `
export function main(): i32 {
  let sum: i32 = 0;
  const fns = new Array<() => i32>();
  for (let i: i32 = 0; i < 3; i++) {
    let now: i32 = i * 10;
    fns.push((): i32 => i + now);
  }
  for (let k: i32 = 0; k < fns.length; k++) sum += fns[k]();
  return sum;
}
`;
  const r = run(source);
  check("C5a-2: the canonical two-scope loop is lowered", refusals(r), []);
  const closure = r.analysis().find(record => record.kind === "struct");
  check("C5a-2: the analysis recorded two envs, innermost first", closure.needed,
    [ "main$block:3", "main$block:2" ]);
  check("C5a-2: the head is the innermost env", closure.envClass, "main$Env$2");
  const wat = r.wat();
  // The body env is parented to the loop-header env: the class has the link,
  // and its constructor takes the header local.
  check("C5a-2: the body env class carries `$parent`",
    [ /main\$Env\$2#get:\$parent/.test(wat), /main\$Env\$2#set:\$parent/.test(wat) ], [ true, true ]);
  check("C5a-2: the header env class is the root",
    /main\$Env\$1#get:\$parent/.test(wat), false);
  // Arity, not parameter names: the harness compiles without debug names, so
  // the constructor is asserted on the AST. `main$Env$1` is a loop header (a
  // `source` parameter for the clone); `main$Env$2` is parented (a `parent`
  // parameter) and is not a loop header, so it has exactly one.
  const envClasses = r.file.statements.filter(statement =>
    statement.name && statement.name.text.startsWith("main$Env"));
  const ctorParams = className => {
    const cls = envClasses.find(statement => statement.name.text === className);
    const ctor = cls.members.find(member => member.name.text === "constructor");
    return ctor.signature.parameters.length;
  };
  check("C5a-2: the body env's constructor takes one parent parameter",
    [ ctorParams("main$Env$1"), ctorParams("main$Env$2") ], [ 1, 1 ]);
  // The hop: `i` is one link out, `now` is direct.
  check("C5a-2: the header binding is read through `$parent!`",
    /main~anonymous\|0\)[\s\S]*?main\$Env\$2#get:\$parent[\s\S]*?main\$Env\$1#get:i/.test(wat), true);
  check("C5a-2: the body binding is a direct field read",
    /main~anonymous\|0\)[\s\S]*?main\$Env\$2#get:now/.test(wat), true);
  check("C5a-2: value 0 + 11 + 22", (await execute(source)).value, 33);
}

{
  // Two owning blocks, no loop: the same chain without the clone machinery.
  const source = `
export function main(): i32 {
  let out: i32 = 0;
  { let a: i32 = 1; { let b: i32 = 2; const g = (): i32 => a + b; out = g(); } }
  return out;
}
`;
  const r = run(source);
  check("C5a-3: two nested blocks are lowered", refusals(r), []);
  check("C5a-3: both block envs are recorded",
    r.analysis().find(record => record.kind === "struct").needed.length, 2);
  check("C5a-3: value 1 + 2", (await execute(source)).value, 3);
}

{
  // A nested owner: the closure's own body allocates an env, and the inner
  // arrow receives it. The class is named after the owning function (F3).
  const source = `
export function main(): i32 {
  const f = (): i32 => {
    let b: i32 = 1;
    const h = (): i32 => b;
    return h();
  };
  return f();
}
`;
  const r = run(source);
  check("C5a-4: a nested owner is lowered", refusals(r), []);
  const records = r.analysis();
  const owner = records.find(record => record.name === "main");
  const nested = records.find(record => record.ownEnv === true && record.name !== "main");
  check("C5a-4: the owner allocates nothing", owner.ownEnv, false);
  check("C5a-4: the nested owner allocates its own env", nested.ownEnv, true);
  check("C5a-4: the class is named after the owning function (F3)",
    r.names(), [ "main$f$Env", "main" ]);
  check("C5a-4: value 1", (await execute(source)).value, 1);
}

{
  // Three scopes: outer's body, mid's body, g's body, captured by one arrow.
  const source = `
export function main(): i32 {
  let a: i32 = 1;
  const mid = (): i32 => {
    let b: i32 = 2;
    const g = (): i32 => { let c: i32 = 3; const h = (): i32 => a + b + c; return h(); };
    return g();
  };
  return mid();
}
`;
  const r = run(source);
  check("C5a-5: the three-scope shape is lowered", refusals(r), []);
  const chain = r.analysis().find(record => record.needed.length === 3);
  check("C5a-5: the arrow's chain has three envs", chain.needed.length, 3);
  check("C5a-5: the outermost env is the owner's body", chain.needed[2], "main$body:1");
  check("C5a-5: value 1 + 2 + 3", (await execute(source)).value, 6);
}

{
  // Mutation through the link: the write and the outer read touch one field.
  const source = `
export function main(): i32 {
  let a: i32 = 1;
  {
    let b: i32 = 2;
    const f = (): i32 => { a += 10; return b; };
    f();
  }
  return a;
}
`;
  check("C5a-6: two-scope mutation is lowered", refusals(run(source)), []);
  check("C5a-6: value 11", (await execute(source)).value, 11);
}

{
  // Escaped: the closures outlive the loop and their frame.
  const source = `
function make(): Array<() => i32> {
  const out = new Array<() => i32>();
  for (let i: i32 = 0; i < 3; i++) {
    let now: i32 = i * 10;
    out.push((): i32 => i + now);
  }
  return out;
}
export function main(): i32 {
  const fns = make();
  let sum: i32 = 0;
  for (let k: i32 = 0; k < fns.length; k++) sum += fns[k]();
  return sum;
}
`;
  check("C5a-7: an escaped two-scope chain is lowered", refusals(run(source)), []);
  check("C5a-7: value 0 + 11 + 22 after the frame is gone", (await execute(source)).value, 33);
}

{
  // `this` plus one local: the receiver lives in the same env (C2b), unchanged.
  const r = run(`
class C { x: i32 = 7; m(): i32 { let n: i32 = 1; const f = (): i32 => this.x + n; return f(); } }
export function main(): i32 { return new C().m(); }
`);
  check("C5a-8: `this` plus one local is still one env", refusals(r), []);
}

{
  // `this` plus two scopes: the receiver is a field of the innermost env, and
  // the header binding hops over it. The value proves both.
  const source = `
class C {
  x: i32 = 7;
  m(): i32 {
    let out: i32 = 0;
    for (let i: i32 = 0; i < 2; i++) {
      let n: i32 = 1;
      const f = (): i32 => this.x + i + n;
      out += f();
    }
    return out;
  }
}
export function main(): i32 { return new C().m(); }
`;
  check("C5a-9: `this` plus two scopes is lowered", refusals(run(source)), []);
  check("C5a-9: value (7+0+1) + (7+1+1)", (await execute(source)).value, 17);
}

{
  // Transitive capture through a non-owning intermediate (case 10) is a
  // one-env shape and stays one env deep.
  const r = run(`
function outer(): i32 {
  let a: i32 = 1;
  const mid = (): i32 => {
    const inner = (): i32 => a;
    return inner();
  };
  return mid();
}
export function main(): i32 { return outer(); }
`);
  check("C5a-10: a non-owning intermediate forwards the one env", refusals(r), []);
  const mid = r.analysis().find(record => record.name === "mid");
  check("C5a-10: the intermediate receives the one env it forwards", mid.needed, [ "outer$body:1" ]);
}

{
  // C5b, case 23: a receiver whose env belongs to a *nested owner*. The
  // receiver is attributed to its own lexical scope (the method's body), that
  // scope owns an env, and the arrow hops to it — so the shape lowers and the
  // value proves the hop.
  const source = `
class C {
  x: i32 = 7;
  m(): i32 {
    const f = (): i32 => { let b: i32 = 1; const g = (): i32 => this.x + b; return g(); };
    return f();
  }
}
export function main(): i32 { return new C().m(); }
`;
  const r = run(source);
  check("C5b-23: a receiver in a nested owner's env is lowered", refusals(r), []);
  check("C5b-23: the receiver's scope owns an env of its own",
    r.analysis().filter(record => record.ownEnv === true).length >= 2, true);
  check("C5b-23: value 7 + 1", (await execute(source)).value, 8);
}

{
  // The `$init$` flag hops with the value (F7): a read-before-assignment in an
  // outer scope, read from an inner block's closure, aborts with its name.
  const out = await execute(`
export function main(): i32 {
  let x: i32;
  { let y: i32 = 1; const g = (): i32 => x + y; return g(); }
}
`);
  check("C5a-12: the `$init$` guard hops with the value", out, { error: "reading an uninitialized captured binding x" });
}

{
  // Mutation at three depths in one closure: each write lands in its own env,
  // and the outer scope reads the outermost write afterwards.
  const source = `
export function main(): i32 {
  let a: i32 = 1;
  const mid = (): i32 => {
    let b: i32 = 2;
    const g = (): i32 => { let c: i32 = 3; const h = (): i32 => { a += 100; b += 10; c += 1; return a + b + c; }; return h(); };
    return g();
  };
  return mid();
}
`;
  check("C5a-13: three-scope mutation is lowered", refusals(run(source)), []);
  check("C5a-13: value 101 + 12 + 4", (await execute(source)).value, 117);
}

{
  // A nested owner that owns an env but needs none is NOT a Struct closure: its
  // `_env` is 0, its env is allocated inside its own call, and it may be a host
  // callback. That is the post-finalise coverage answer for `structFunctions`.
  const r = run(`
function reg(a: () => void, b: (p: u32) => void): i32 { return 0; }
export function main(): i32 {
  const f = (): void => { let b: i32 = 1; const h = (): void => { b++; }; h(); };
  return reg(f, (p: u32): void => {});
}
`);
  check("C5a-14: a nested owner that needs no env is a valid host callback", refusals(r), []);
}

{
  // A loop-header env that is itself parented: the class is cloned per
  // iteration AND links to the enclosing block env, so its constructor has
  // both optional parameters — `(source, parent)` — and a fresh allocation
  // passes `null` for the source with the parent second. The value proves the
  // argument did not land in `source` (measured once: it did, and the loop's
  // own local was handed over as a `source` of the wrong type).
  const source = `
export function main(): i32 {
  let out: i32 = 0;
  {
    let b: i32 = 5;
    const g = (): i32 => b;
    for (let i: i32 = 0; i < 2; i++) {
      const f = (): i32 => i;
      out += f();
    }
    out += g();
  }
  return out;
}
`;
  const r = run(source);
  check("C5a-15: a parented loop header is lowered", refusals(r), []);
  const loopClass = r.file.statements.find(statement =>
    statement.name && statement.name.text === "main$Env$2");
  const ctor = loopClass.members.find(member => member.name.text === "constructor");
  check("C5a-15: the loop header's constructor takes (source, parent)",
    ctor.signature.parameters.length, 2);
  check("C5a-15: value 0 + 1 + 5", (await execute(source)).value, 6);
}

// 11. C5b: one env per scope instance, and the three shapes that needed it.
//
// The dual-class emission is gone: a scope with a captured binding *and* a
// receiver has one class carrying `$this` at field 0 and the bindings after it
// (§4.7.5). The receiver travels through `state.$env` into the resume function,
// so an async body's `this` and a this-only arrow's `this` are fields of that
// one object.
{
  // Case 23 shape: an async method owns a captured local and reads `this`.
  // Before C5b this emitted both `m$Env` and `m$ThisEnv` — one scope, two
  // objects. Now: one class, one `$env`.
  const r = run(`
import { Task } from "~lib/task";
class C { y: i32 = 7;
  async m(h: Task<i32>): i32 {
    let x: i32 = 1;
    const g: () => i32 = (): i32 => x;
    await h;
    return g() + this.y;
  }
}
export function main(): i32 { return 0; }
`);
  check("C5b-23: the unified shape is lowered", refusals(r), []);
  const envClasses = r.file.statements.filter(statement =>
    statement.name && /^m\$\w*Env$/.test(statement.name.text));
  check("C5b-23: exactly one env class for the method's scope",
    envClasses.map(statement => statement.name.text), [ "m$Env" ]);
  const fields = envClasses[0].members
    .filter(member => member.name && member.name.text !== "constructor")
    .map(member => member.name.text);
  check("C5b-23: `$this` is field 0, then the captured binding",
    fields, [ "$this", "x" ]);
  check("C5b-23: no separate this-struct is synthesized",
    /m\$ThisEnv/.test(r.wat()), false);
}

{
  // Case 22 shape: a this-only arrow in an async body. Before C5b the resolver
  // answered TS2332 (the arrow read `~env` as a receiver, and `f$resume` has no
  // `this`); now the arrow is Struct over the body env that carries `$this`.
  const r = run(`
import { Task } from "~lib/task";
class C { y: i32 = 7;
  async m(h: Task<i32>): i32 {
    const g: () => i32 = (): i32 => this.y;
    await h;
    return g();
  }
}
export function main(): i32 { return 0; }
`);
  check("C5b-22: a this-only arrow in an async body is lowered", refusals(r), []);
  const analysis = r.analysis();
  const arrow = analysis.find(record => record.receivesEnv === true);
  check("C5b-22: the arrow becomes Struct over the body env",
    [ arrow.kind, arrow.needed.length ], [ "struct", 1 ]);
  const bodyEnv = r.file.statements.find(statement =>
    statement.name && statement.name.text === "m$Env");
  check("C5b-22: the body env carries `$this` and nothing else",
    bodyEnv.members
      .filter(member => member.name && member.name.text !== "constructor")
      .map(member => member.name.text),
    [ "$this" ]);
}

{
  // Case 21 shape: capture + explicit `this:` — the collision. `$env` holds one
  // object: the this-struct, whose `$parent` is the received env, so the
  // captured binding is reached through the link (§8.3's second read-back
  // shape). The refusal is gone.
  //
  // **Value deferred, with the cause measured.** Calling a *hoisted nested*
  // async entry with `.call` fails in this fork with `TS2304: Cannot find name
  // 'thisof'` (`~lib/function.ts:24`) — reproduced on the ccf888c6 baseline
  // with a nested async function that captures nothing, so it predates C5b and
  // is not the carrier. The carrier itself is asserted below; the value test
  // lands when that call form compiles.
  const r = run(`
import { Task } from "~lib/task";
class C { y: i32 = 7;
  async m(h: Task<i32>): i32 {
    let x: i32 = 1;
    async function f(this: C): i32 { return x + this.y; }
    await h;
    return x;
  }
}
export function main(): i32 { return 0; }
`);
  check("C5b-21: the collision is no longer refused", refusals(r), []);
  const thisEnv = r.file.statements.find(statement =>
    statement.name && statement.name.text === "f$ThisEnv");
  const fields = thisEnv.members
    .filter(member => member.name && member.name.text !== "constructor")
    .map(member => member.name.text + ":" + (member.type && member.type.name
      ? member.type.name.identifier.text + (member.type.isNullable ? "|null" : "")
      : "?"));
  check("C5b-21: the this-struct carries the receiver and the chain link",
    fields, [ "$this:C", "$parent:m$Env|null" ]);
  const ctor = thisEnv.members.find(member => member.name.text === "constructor");
  check("C5b-21: its constructor takes (source, parent)",
    ctor.signature.parameters.map(parameter => parameter.name.text), [ "source", "parent" ]);
}

console.log(`\n${failures === 0 ? "[ SUCCESS ]" : "FAILURE"}: ${checks - failures} of ${checks} checks passed`);
if (failures !== 0) process.exitCode = 1;
