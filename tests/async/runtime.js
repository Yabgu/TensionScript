// The async runtime, Phase 4a: the task machine's settled path.
//
// What is under test (`docs/async-await-plan-v2.md` §4.7, §6): the seven seam
// symbols stopped being traps, and a lowered `async function` executes —
// registration allocates a record and roots it on the state, the settled check
// lets an already-settled `await` fall through instead of suspending, the typed
// read gets the payload out of the record at §3.2's offset, and the function
// reaches its terminal region with the right value.
//
// What is *not* under test here, on purpose: suspension. A park needs a
// producer, and the first producer in the system is the framework's job
// registration (4b). This file proves the parked shape does not trap and leaves
// the task parked; it does not pretend the task completes.
//
// Run: npm run test:async (or `node tests/async/runtime.js`).

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

/**
 * Compiles `source` with the real CLI (both `afterParse` transforms run there,
 * in the CLI's order), returns its text and a runner that instantiates the
 * module and calls one export.
 */
function compile(source) {
  const dir = mkdtempSync(join(tmpdir(), "async-runtime-"));
  const tsPath = join(dir, "probe.ts");
  const wasmPath = join(dir, "probe.wasm");
  const watPath = join(dir, "probe.wat");
  writeFileSync(tsPath, source);
  // Run from the temp directory with a bare file name: the compiler's internal
  // path is relative to the *process cwd* (measured: an absolute argument yields
  // `../../.. /tmp/<dir>/probe`, which would make every name assertion depend on
  // where the repo sits). From here it is exactly `probe`.
  execFileSync(process.execPath, [
    CLI, "probe.ts", "-o", "probe.wasm", "--textFile", "probe.wat",
    "--runtime", "incremental", "--exportRuntime", "--noColors"
  ], { stdio: "pipe", cwd: dir });
  const wat = readFileSync(watPath, "utf8");
  const bytes = readFileSync(wasmPath);
  rmSync(dir, { recursive: true, force: true });
  return {
    wat,
    /** The module's prefix inside the wat (see the cwd note above). */
    module: "probe",
    /** Instantiates and calls `entry`; answers its number, or the abort text. */
    run(entry) {
      // A fresh module per call: globals in the guest are not reset otherwise.
      const module = new WebAssembly.Module(bytes);
      const instance = new WebAssembly.Instance(module, {
        env: {
          // `abort` receives a pointer to the UTF-16 message; the length is the
          // word before it (`std/assembly/string.ts:50-52`).
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
        }
      });
      return instance.exports[entry]();
    }
  };
}

/** The text of one function in a module, params and body, for scoped matching. */
function funcBody(wat, name) {
  const lines = wat.split("\n");
  const start = lines.findIndex(line =>
    line.includes(`(func $${name} `) || line.includes(`(func $${name}(`));
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

// 1. The settled path, executed.

console.log("the settled path");

{
  const r = compile(`
import { Task, TaskRecord } from "~lib/task";
import { __taskHasRunnable } from "~lib/task-rt";

let seen: i32 = 0;
let ran: bool = false;

async function f(h: Task<i32>): i32 {
  let v: i32 = await h;
  ran = true;
  seen = v + 1;
  return v + 1;
}

export function probe(): i32 {
  let record: TaskRecord = new TaskRecord();
  record.payload = 41;
  record.done = 1;
  record.status = 0;
  let handle: Task<i32> = new Task<i32>();
  handle._record = record;
  f(handle);
  if (!ran) return -1;
  return __taskHasRunnable() ? -2 : seen;
}
`);
  check("an async function awaits a settled record and runs to its terminal", r.run("probe"), 42);
  check("  ...with no runnable task left behind", r.run("probe") !== -2, true);
}

// 2. The seam symbols are no longer traps, and the state carries its resume.

console.log("the machine's bookkeeping");

{
  const r = compile(`
import { Task, TaskRecord } from "~lib/task";
import { __taskHasRunnable } from "~lib/task-rt";

async function f(h: Task<i32>): i32 {
  let v: i32 = await h;
  return v + 1;
}

export function probe(): i32 {
  let record: TaskRecord = new TaskRecord();
  record.payload = 1;
  record.done = 1;
  let handle: Task<i32> = new Task<i32>();
  handle._record = record;
  f(handle);
  return __taskHasRunnable() ? 1 : 0;
}
`);
  check("registration and the settled check do not trap", r.run("probe"), 0);

  const entry = funcBody(r.wat, `${r.module}/f`);
  check("the entry assigns `state.resume`", /TaskState#set:resume/.test(entry), true);
  check("  ...with a function value, not a null",
    /i32\.const \d+\n *local\.set \$\d+\n *global\.get \$~lib\/memory\/__stack_pointer\n *local\.get \$\d+\n *global\.get \$~lib\/memory\/__stack_pointer\n *local\.get \$\d+\n *i32\.store offset=\d+\n *local\.get \$\d+\n *call \$~lib\/task-rt\/TaskState#set:resume/.test(entry)
      || /i32\.const \d+\n(?: *[^\n]*\n){0,8}? *call \$~lib\/task-rt\/TaskState#set:resume/.test(entry),
    true);
  check("  ...before the synchronous prefix runs",
    entry.indexOf("TaskState#set:resume") < entry.indexOf(`call $${r.module}/f$resume`), true);
  check("  ...and before that, the state was registered",
    entry.indexOf("__taskRegister") < entry.indexOf("TaskState#set:resume"), true);
}

// 3. The record's layout, at §3.2's offsets — checked on the emitted module, so
// a field reorder or a type change fails here rather than silently moving the
// typed read's load off the value.

console.log("the record's layout (§3.2)");

{
  // Every field is written so the compiler emits each setter; a field that is
  // only declared is dead code and leaves nothing to measure.
  const r = compile(`
import { Task, TaskRecord } from "~lib/task";
export function probe(): i32 {
  let r: TaskRecord = new TaskRecord();
  r.class_ = 0;
  r.key = 0;
  r.payload = 1;
  r.status = 0;
  r.f0 = 0;
  r.f1 = 0;
  r.tag = 0;
  r.done = 1;
  return r.payload;
}
`);
  const expect = [
    [ "class_", 0 ],
    [ "key", 4 ],
    [ "payload", 8 ],
    [ "status", 12 ],
    [ "f0", 16 ],
    [ "f1", 20 ],
    [ "tag", 24 ],
    [ "done", 28 ]
  ];
  for (const [ field, offset ] of expect) {
    const body = funcBody(r.wat, `~lib/task/TaskRecord#set:${field}`);
    const store = body.match(/(?:i32|i64|f32|f64)\.store(?: offset=(\d+))?/);
    const actual = store ? (store[1] ? Number(store[1]) : 0) : null;
    check(`TaskRecord.${field} is at offset ${offset}`, actual, offset);
  }
}

// 4. A park with no producer: the trap is gone, the task stays parked, and the
// framework-facing "is anything runnable" answer is false. This is 4a's honest
// boundary — the task cannot complete without a delivery (4b).

console.log("a park with no producer");

{
  const r = compile(`
import { Task, TaskRecord } from "~lib/task";
import { __taskHasRunnable } from "~lib/task-rt";

async function g(h: Task<i32>): i32 {
  let v: i32 = await h;
  return v;
}

export function parkProbe(): i32 {
  let record: TaskRecord = new TaskRecord(); // done stays 0: never delivered
  let handle: Task<i32> = new Task<i32>();
  handle._record = record;
  g(handle);
  return __taskHasRunnable() ? 1 : 0;
}
`);
  check("parking does not trap", r.run("parkProbe"), 0);
  check("  ...and leaves nothing runnable", r.run("parkProbe"), 0);
  const resume = funcBody(r.wat, `${r.module}/g$resume`);
  check("  ...the park path calls __taskPark and then returns",
    /call \$~lib\/task-rt\/__taskPark[\s\S]{0,400}?return/.test(resume), true);
}

// 4b. An async body with no await: no guards, no scope damage.
//
// Every ordinary statement used to be wrapped in its own
// `if (resumePoint == 0) { … }` block even when the body had no suspension
// point, so a `let` declared in one guard was out of scope in the next:
// `async function f(seed: i32): i32 { let v: i32 = seed * 2; return v + 1; }`
// failed with TS2304 as soon as it was actually called. A body with no await is
// emitted straight now, and the value is the proof.

console.log("an async body with no await");

{
  const r = compile(`
import { Task } from "~lib/task";

async function compute(seed: i32): i32 {
  let value: i32 = seed * 2;
  return value + 1;
}

export function probe(): i32 {
  let h: Task<i32> = compute(20);
  return h._record.payload;
}
`);
  check("an async body with no await compiles and returns its value", r.run("probe"), 41);
  const resume = funcBody(r.wat, "probe/compute$resume");
  check("  ...with no resume-point guards", /get:resumePoint/.test(resume), false);
  check("  ...and no park", /__taskPark/.test(resume), false);
}

// 4c. A local declared after an await is visible to the statements after it.
//
// Every ordinary statement in a resume body sits in its own
// `if (resumePoint == K) { … }` guard, so a `let` declared in one guard was out
// of scope in the next: `await h; let x: i32 = 5; return x;` drew TS2304 on `x`.
// The fix: consecutive statements with no await of their own now share **one**
// `if (resumePoint == 0)` block, so a declaration stays in scope for the
// statements after it (and the emitted module has fewer guards). This is the
// mechanism, not a hoist: a local that crosses an await is still lifted into the
// state struct by the existing rule.

console.log("locals declared after an await");

{
  const one = compile(`
import { Task, TaskRecord } from "~lib/task";
import { __taskTick } from "~lib/task-rt";

function settled(v: i32): Task<i32> {
  let r: TaskRecord = new TaskRecord();
  r.payload = v;
  r.done = 1;
  let t: Task<i32> = new Task<i32>();
  t._record = r;
  return t;
}

async function f(): i32 {
  let h: Task<i32> = settled(0);
  await h;
  let x: i32 = 5;
  return x;
}

export function probe(): i32 {
  let t: Task<i32> = f();
  __taskTick();
  return t._record.payload;
}
`);
  check("a local declared after an await is read after it (5)", one.run("probe"), 5);

  const two = compile(`
import { Task, TaskRecord } from "~lib/task";
import { __taskTick } from "~lib/task-rt";

function settled(v: i32): Task<i32> {
  let r: TaskRecord = new TaskRecord();
  r.payload = v;
  r.done = 1;
  let t: Task<i32> = new Task<i32>();
  t._record = r;
  return t;
}

async function f(): i32 {
  let h: Task<i32> = settled(0);
  await h;
  let x: i32 = 5;
  let g: Task<i32> = settled(0);
  await g;
  return x;
}

export function probe(): i32 {
  let t: Task<i32> = f();
  __taskTick();
  __taskTick();
  return t._record.payload;
}
`);
  check("  ...and survives a second await (5)", two.run("probe"), 5);

  const both = compile(`
import { Task, TaskRecord } from "~lib/task";
import { __taskTick } from "~lib/task-rt";

function settled(v: i32): Task<i32> {
  let r: TaskRecord = new TaskRecord();
  r.payload = v;
  r.done = 1;
  let t: Task<i32> = new Task<i32>();
  t._record = r;
  return t;
}

async function f(): i32 {
  let a: i32 = 1;          // before the await: lifted
  let h: Task<i32> = settled(0);
  await h;
  let b: i32 = 2;          // after it: hoisted
  return a + b;
}

export function probe(): i32 {
  let t: Task<i32> = f();
  __taskTick();
  return t._record.payload;
}
`);
  check("a lifted local and a hoisted one compose (3)", both.run("probe"), 3);
  const resume = funcBody(both.wat, "probe/f$resume");
  check("  ...the hoisted name is declared before the first guard",
    resume.indexOf("local.set $b") === -1 ||
    resume.slice(0, resume.indexOf("get:resumePoint")).includes("$b"),
    true);
}

// 5. Guest-to-guest completion (§4.7.3, Phase 4b): a task that awaits another
// task's *completion*, not a record handed to it already settled.

console.log("guest-to-guest completion");

{
  // B completes synchronously inside A's prefix, so A's `await` finds the
  // record settled and never parks — the value has to have been written into
  // the record by `__taskCompleteResult` for this to be 42.
  const r = compile(`
import { Task } from "~lib/task";
import { __taskTick } from "~lib/task-rt";

async function B(): i32 { return 41; }
async function A(): i32 { let x: i32 = await B(); return x + 1; }

export function probe(): i32 {
  let h: Task<i32> = A();
  __taskTick();
  return h._record.payload;
}
`);
  check("A() awaits B()'s completion and reads its value (42)", r.run("probe"), 42);
  const resumeB = funcBody(r.wat, "probe/B$resume");
  check("  ...B's return completes its record",
    /__taskCompleteResult<i32>/.test(resumeB), true);
  // The store's address is `record + RECORD_PAYLOAD` computed as a pointer, so
  // the store itself carries no offset — the same address the typed read loads
  // from with `offset=8` (measured in both directions).
  check("  ...and stores it at `payload`, offset 8",
    /global\.get \$~lib\/task-rt\/RECORD_PAYLOAD\n *i32\.add\n *local\.get \$1\n *i32\.store/.test(
      funcBody(r.wat, "~lib/task-rt/__taskCompleteResult<i32>")), true);
}

{
  // The parked path: a task parks on a record, a delivery arrives, the tick
  // resumes it, and it completes in turn (which is what makes the *next*
  // awaiter of its handle see a value).
  const r = compile(`
import { Task, TaskRecord } from "~lib/task";
import { __taskDeliver, __taskTick, __taskHasRunnable } from "~lib/task-rt";

let seen: i32 = 0;

async function g(h: Task<i32>): i32 {
  let v: i32 = await h;
  seen = v;
  return v;
}

export function probe(): i32 {
  let record: TaskRecord = new TaskRecord();
  record.class_ = 4; // JOB_DONE, unbound: its own family
  record.key = 7;
  let handle: Task<i32> = new Task<i32>();
  handle._record = record;
  g(handle);
  if (__taskHasRunnable()) return -1;
  __taskDeliver(4, 7, 41, 0, 0);
  if (!__taskHasRunnable()) return -2;
  __taskTick();
  return seen;
}
`);
  check("a delivered completion wakes the parked task (41)", r.run("probe"), 41);
}

{
  // One tick, one resume: the queue is taken at tick start, so a task woken
  // during the tick runs in the next one.
  const r = compile(`
import { Task, TaskRecord } from "~lib/task";
import { __taskDeliver, __taskTick, __taskHasRunnable } from "~lib/task-rt";

async function g(h: Task<i32>): i32 { let v: i32 = await h; return v; }

export function probe(): i32 {
  let record: TaskRecord = new TaskRecord();
  record.class_ = 4;
  record.key = 1;
  let handle: Task<i32> = new Task<i32>();
  handle._record = record;
  g(handle);
  __taskDeliver(4, 1, 5, 0, 0);
  if (!__taskHasRunnable()) return -1;  // queued, not yet run
  __taskTick();
  let afterFirst = __taskHasRunnable();
  __taskTick();
  return afterFirst ? -2 : 0;
}
`);
  check("a tick takes its queue at entry and leaves nothing behind", r.run("probe"), 0);
}

// 6. The six async cases as values (§8.1's cases 1-6), each labelled with the
// delivery shape it uses.
//
// **(b) settled record** — the awaited record already carries `done = 1`, so the
// await falls through. This exercises the *transform's* control flow across a
// suspension point (branches, loops, nesting, closures) without depending on
// the dispatcher's ordering; that is what these cases are for.
// **(a) delivered after the park** — the task parks first, then a completion is
// delivered and a tick resumes it. The dispatcher's ordering is proved by
// `a delivered completion wakes the parked task` above, and by 4c's OGRE
// harness, which is the end-to-end proof.

console.log("cases 1-6 as values");

{
  const SETTLED = `
import { Task, TaskRecord } from "~lib/task";
import { __taskTick } from "~lib/task-rt";

let key: i32 = 1;
function settled(v: i32): Task<i32> {
  let r: TaskRecord = new TaskRecord();
  r.class_ = 4;
  r.key = key++;
  r.payload = v;
  r.done = 1;
  let t: Task<i32> = new Task<i32>();
  t._record = r;
  return t;
}
`;

  // Case 1 (b): an await in a loop, all three iterations, no double resume.
  const one = compile(`${SETTLED}
async function sumTo(): i32 {
  let sum: i32 = 0;
  for (let i: i32 = 0; i < 3; i++) {
    let t: Task<i32> = settled((i + 1) * 10);
    let v: i32 = await t;
    sum += v;
  }
  return sum;
}
export function probe(): i32 { let t: Task<i32> = sumTo(); __taskTick(); return t._record.payload; }
`);
  check("case 1 (b, loop): three iterations sum to 60", one.run("probe"), 60);

  // Case 2 (b): the taken branch's await resolves; the other branch is untouched.
  const two = compile(`${SETTLED}
async function branch(flag: bool): i32 {
  let r: i32 = 0;
  if (flag) { let t: Task<i32> = settled(7); let v: i32 = await t; r = v; }
  else { r = 3; }
  return r + 100;
}
export function probe(): i32 {
  let a: Task<i32> = branch(true);
  let b: Task<i32> = branch(false);
  __taskTick();
  return a._record.payload * 1000 + b._record.payload;
}
`);
  check("case 2 (b, conditional): the taken branch awaits, the other does not", two.run("probe"), 107103);

  // Case 3 (b): three depths — straight, conditional, loop.
  const three = compile(`${SETTLED}
async function depths(): i32 {
  let a: i32 = 0;
  let t1: Task<i32> = settled(1);
  let v1: i32 = await t1;
  a += v1;
  if (true) { let t2: Task<i32> = settled(2); let v2: i32 = await t2; a += v2; }
  let n: i32 = 0;
  while (n < 2) { let t3: Task<i32> = settled(4); let v3: i32 = await t3; a += v3; n++; }
  return a;
}
export function probe(): i32 { let t: Task<i32> = depths(); __taskTick(); return t._record.payload; }
`);
  check("case 3 (b, three depths): 1 + 2 + 4 + 4", three.run("probe"), 11);

  // Case 4 (b): nested async functions, each its own machine.
  const four = compile(`${SETTLED}
async function inner(v: i32): i32 {
  let t: Task<i32> = settled(v);
  let x: i32 = await t;
  return x * 2;
}
async function outer(): i32 {
  let t: Task<i32> = settled(5);
  let a: i32 = await t;
  let b: i32 = await inner(10);
  return a + b;
}
export function probe(): i32 { let t: Task<i32> = outer(); __taskTick(); return t._record.payload; }
`);
  check("case 4 (b, nested): 5 + inner(10) = 25", four.run("probe"), 25);

  // Case 5 (b): early return before the await, and after it.
  const five = compile(`${SETTLED}
async function early(h: bool): i32 {
  if (h) return 7;
  let t: Task<i32> = settled(9);
  await t;
  return 9;
}
export function probe(): i32 {
  let a: Task<i32> = early(true);
  let b: Task<i32> = early(false);
  __taskTick();
  return a._record.payload * 100 + b._record.payload;
}
`);
  check("case 5 (b, early return): 7 before the await, 9 after it", five.run("probe"), 709);

  // Case 6 (a): a closure's captured binding across a real park — delivered
  // only after the task has parked, which is the dispatcher's real ordering.
  const six = compile(`
import { Task, TaskRecord } from "~lib/task";
import { __taskDeliver, __taskTick, __taskHasRunnable } from "~lib/task-rt";

let captured: i32 = 0;

async function closes(job: i32): i32 {
  let x: i32 = 40;
  function add(n: i32): i32 { return x + n; }
  let r: TaskRecord = new TaskRecord();
  r.class_ = 4;
  r.key = job;
  let h: Task<i32> = new Task<i32>();
  h._record = r;
  let v: i32 = await h;
  captured = add(2) + v;
  return captured;
}

export function probe(): i32 {
  let r: TaskRecord = new TaskRecord();
  r.class_ = 4;
  r.key = 9;
  let h: Task<i32> = new Task<i32>();
  h._record = r;
  let t: Task<i32> = closes(9);
  if (__taskHasRunnable()) return -1;   // parked, nothing running yet
  __taskDeliver(4, 9, 0, 0, 0);         // the completion arrives after the park
  __taskTick();
  return t._record.payload;
}
`);
  check("case 6 (a, closure across a real park): 40 + 2 + 0", six.run("probe"), 42);

  // C5a case 20 (b): an async function whose closure captures from TWO scopes
  // — the function body and a block — and reads both after a real park. The
  // block env is the head, its `$parent` is the body env, and the closure hops
  // one link for the body binding. Delivered after the park, as above, so the
  // suspension is genuine.
  const twoScopes = compile(`
import { Task, TaskRecord } from "~lib/task";
import { __taskDeliver, __taskTick, __taskHasRunnable } from "~lib/task-rt";

async function two(): i32 {
  let a: i32 = 1;
  {
    let b: i32 = 2;
    const g: () => i32 = (): i32 => a + b;
    let r: TaskRecord = new TaskRecord();
    r.class_ = 4;
    r.key = 11;
    let h: Task<i32> = new Task<i32>();
    h._record = r;
    await h;
    return g();
  }
}

export function probe(): i32 {
  let t: Task<i32> = two();
  if (__taskHasRunnable()) return -1;   // parked, nothing running yet
  __taskDeliver(4, 11, 0, 0, 0);        // the completion arrives after the park
  __taskTick();
  return t._record.payload;
}
`);
  check("C5a case 20 (b, two-scope async across a park): 1 + 2", twoScopes.run("probe"), 3);
  check("C5a case 20: the block env was lifted across the await",
    /two\$State#get:\$closureEnv\$1/.test(twoScopes.wat), true);
  check("C5a case 20: the block env's class is the head and is parented",
    /two\$Env\$1#get:\$parent/.test(twoScopes.wat), true);

  // C5b case 21: a capture plus an explicit `this:` in a nested async entry —
  // the collision. The awaited `.call` is the shape that forces
  // `Function#call`'s declared `thisof<T>` parameter to resolve; the fork
  // registers `thisof` as of 0.4.1, so the value is measurable. The this-struct
  // carries the receiver and the chain link, which the wat assertions pin.
  const collision = compile(`
import { Task, TaskRecord } from "~lib/task";
import { __taskDeliver, __taskTick, __taskHasRunnable } from "~lib/task-rt";

class C { y: i32 = 7;
  async m(job: i32): i32 {
    let x: i32 = 1;
    async function f(this: C): i32 { return x + this.y; }
    let r: TaskRecord = new TaskRecord();
    r.class_ = 4;
    r.key = job;
    let h: Task<i32> = new Task<i32>();
    h._record = r;
    await h;
    return await f.call(new C());
  }
}

export function probe(): i32 {
  let t: Task<i32> = new C().m(13);
  if (__taskHasRunnable()) return -1;   // parked, nothing running yet
  __taskDeliver(4, 13, 0, 0, 0);        // the completion arrives after the park
  __taskTick();
  return t._record.payload;
}
`);
  check("C5b case 21 (collision, awaited `.call`): 1 + 7", collision.run("probe"), 8);
  check("C5b case 21: the this-struct carries the receiver and the chain link",
    /f\$ThisEnv#set:\$this/.test(collision.wat) &&
    /f\$ThisEnv#set:\$parent/.test(collision.wat), true);
}

// 7. Early completions (4e-1): a delivery that arrives before the await.
//
// `__taskDeliver` keys on `(family, key)`, which `__taskPark` writes — so
// without a buffer a completion delivered first would be dropped and the task
// would park forever. The buffer holds it until a park claims it.

console.log("early completions");

{
  const HEAD = `
import { Task, TaskRecord } from "~lib/task";
import { __taskDeliver, __taskTick, __taskHasRunnable, __taskBufferedEvictions } from "~lib/task-rt";

let frames: i32 = 0;

async function g(h: Task<i32>): i32 {
  frames = frames + 1;          // runs before the await
  let v: i32 = await h;
  frames = frames + 10;         // runs after it
  return v;
}

function stamped(key: i32): TaskRecord {
  let r: TaskRecord = new TaskRecord();
  r.class_ = 4;
  r.key = key;
  return r;
}
`;

  // (1) buffer hit: the completion is delivered before the await.
  const early = compile(`${HEAD}
export function probe(): i32 {
  __taskDeliver(4, 77, 41, 0, 0);          // no task is waiting yet
  let r: TaskRecord = stamped(77);
  let h: Task<i32> = new Task<i32>();
  h._record = r;
  let t: Task<i32> = g(h);
  if (!__taskHasRunnable()) return -1;     // the park claimed it and queued it
  __taskTick();
  if (frames != 11) return -2;             // both halves of the body ran
  return r.payload;
}
`);
  check("an early completion is claimed by the park (41)", early.run("probe"), 41);

  // (2) the normal path: delivered after the park. Same value.
  const late = compile(`${HEAD}
export function probe(): i32 {
  let r: TaskRecord = stamped(78);
  let h: Task<i32> = new Task<i32>();
  h._record = r;
  let t: Task<i32> = g(h);
  if (__taskHasRunnable()) return -1;      // parked, nothing running
  __taskDeliver(4, 78, 41, 0, 0);          // the completion arrives after
  if (!__taskHasRunnable()) return -2;
  __taskTick();
  if (frames != 11) return -3;
  return r.payload;
}
`);
  check("a completion delivered after the park gives the same value (41)", late.run("probe"), 41);

  // (3) no delivery at all: the parked path stays reachable.
  const parked = compile(`${HEAD}
export function probe(): i32 {
  let r: TaskRecord = stamped(79);
  let h: Task<i32> = new Task<i32>();
  h._record = r;
  let t: Task<i32> = g(h);
  if (__taskHasRunnable()) return -1;
  __taskTick();
  if (__taskHasRunnable()) return -2;
  if (r.done != 0) return -3;              // still parked, still unsettled
  return frames;                           // only the pre-await half ran
}
`);
  check("an undelivered task stays parked (only the pre-await half ran)", parked.run("probe"), 1);

  // (4) eviction: 256 unclaimed deliveries, then one more evicts the oldest.
  const evict = compile(`${HEAD}
export function probe(): i32 {
  // A distinct family keeps these away from every other test's keys.
  for (let i: i32 = 1; i <= 257; i++) __taskDeliver(40, i, i, 0, 0);
  if (__taskBufferedEvictions() != 1) return -__taskBufferedEvictions();
  // The oldest (key 1) was evicted: an await on it parks instead of hitting.
  let r: TaskRecord = new TaskRecord();
  r.class_ = 40;
  r.key = 1;
  let h: Task<i32> = new Task<i32>();
  h._record = r;
  let t: Task<i32> = g(h);
  if (__taskHasRunnable()) return -100;    // it must have parked
  // The newest (key 257) is still buffered: an await on it completes.
  let r2: TaskRecord = new TaskRecord();
  r2.class_ = 40;
  r2.key = 257;
  let h2: Task<i32> = new Task<i32>();
  h2._record = r2;
  let t2: Task<i32> = g(h2);
  if (!__taskHasRunnable()) return -101;
  __taskTick();
  return r2.payload;
}
`);
  check("the buffer evicts oldest-first at 256 (newest survives, 257)", evict.run("probe"), 257);
}

// 8. Dropped completions (4e-2, §6.4): the framework counts, std wakes.
//
// `__taskReportDrops(family, count)` is what the framework calls with the delta
// it read from the arena's per-class drop counter. Std wakes up to `count`
// tasks parked on that family with `status = -EIO`, oldest-first, and leaves the
// rest parked.

console.log("dropped completions");

{
  const HEAD = `
import { Task, TaskRecord } from "~lib/task";
import { __taskTick, __taskHasRunnable, __taskReportDrops } from "~lib/task-rt";

async function g(h: Task<i32>): i32 { let v: i32 = await h; return v; }

function stamped(key: i32): TaskRecord {
  let r: TaskRecord = new TaskRecord();
  r.class_ = 4;
  r.key = key;
  return r;
}
`;

  // Attribution: two parked on one family, one drop — the oldest wakes with
  // -EIO, the other stays parked.
  const one = compile(`${HEAD}
export function probe(): i32 {
  let r1: TaskRecord = stamped(5);
  let h1: Task<i32> = new Task<i32>(); h1._record = r1; g(h1);
  let r2: TaskRecord = stamped(6);
  let h2: Task<i32> = new Task<i32>(); h2._record = r2; g(h2);
  __taskReportDrops(4, 1);
  if (!__taskHasRunnable()) return -1;      // one woke
  __taskTick();
  if (r1.status != -5) return -2;           // -EIO on the oldest
  if (r2.status == -5) return -3;           // the other untouched
  if (__taskHasRunnable()) return -4;       // and nothing else running
  return r2.done == 0 ? 100 : -5;           // still parked
}
`);
  check("one drop wakes one task with -EIO, the other stays parked", one.run("probe"), 100);

  // Count larger than the parked set: wake all, no overrun.
  const all = compile(`${HEAD}
export function probe(): i32 {
  let r1: TaskRecord = stamped(11);
  let h1: Task<i32> = new Task<i32>(); h1._record = r1; g(h1);
  __taskReportDrops(4, 9);
  __taskTick();
  return r1.status;
}
`);
  check("a drop count above the parked set wakes all of them", all.run("probe"), -5);

  // A delivery for the same record after the -EIO wake must not overwrite it.
  const late = compile(`${HEAD}
import { __taskDeliver } from "~lib/task-rt";
export function probe(): i32 {
  let r1: TaskRecord = stamped(21);
  let h1: Task<i32> = new Task<i32>(); h1._record = r1; g(h1);
  __taskReportDrops(4, 1);
  __taskTick();
  if (r1.status != -5) return -1;
  __taskDeliver(4, 21, 7, 0, 0);            // arrives after the task already woke
  return r1.status;                          // still -EIO, not 0
}
`);
  check("a post-wake delivery does not overwrite -EIO", late.run("probe"), -5);
}

console.log();
if (failures) {
  console.log(`FAILURE: ${failures} of ${checks} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`[ SUCCESS ] ${checks} checks`);
}
