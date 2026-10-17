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

console.log(`\n${failures === 0 ? "[ SUCCESS ]" : "FAILURE"}: ${checks - failures} of ${checks} checks passed`);
if (failures !== 0) process.exitCode = 1;
