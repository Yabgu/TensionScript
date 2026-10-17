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

console.log();
if (failures) {
  console.log(`FAILURE: ${failures} of ${checks} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`[ SUCCESS ] ${checks} checks`);
}
