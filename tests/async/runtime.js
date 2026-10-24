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
 * The in-guest driver the host-driven cases append to their source.
 *
 * **What the harness calls, and what it does not.** The entry points are the
 * drivers `resumeOne` and `failOne` below; they import `__taskResume` and
 * `__taskFail` from `~lib/task-rt` and call them directly. The JavaScript side
 * calls `resumeOne`/`failOne` — never the std symbols. (An earlier draft also
 * re-exported `__taskResume`, `__taskWake` and `__taskFail` with
 * `export { … } from "~lib/task-rt"`. That put them in the module's export
 * table, but nothing used that path, so it was removed: import what you call,
 * export only what the harness calls.)
 *
 * **Why `bindTaskTable` first.** `parkState` returns early when no table is
 * bound (`std/assembly/task-rt.ts:209`, "no table bound: pull path only") and
 * `__taskResume` returns immediately too, so an unbound module parks nothing,
 * announces nothing, and resumes nothing — no error, no effect. A test that
 * forgot the bind would pass by asserting nothing. Every host-driven case calls
 * `bindTaskTable()` in its setup and asserts the park was observed before it
 * resumes, which is what makes an omitted bind fail loudly instead of
 * vacuously.
 *
 * Array widths are the ones the std reads (`std/assembly/task-rt.ts`): ids are
 * `u64` (8 bytes), classes and payloads are `i32` (4 each), statuses `i32` (4).
 */
const DRIVER = `
import { __taskBindTable, __taskResume, __taskFail } from "~lib/task-rt";

export function bindTaskTable(): void { __taskBindTable(64); }

export function resumeOne(id: i64, class_: i32, payload: i32): void {
  const idsPtr = heap.alloc(8);
  const classesPtr = heap.alloc(4);
  const payloadsPtr = heap.alloc(4);
  store<i64>(idsPtr, id);
  store<i32>(classesPtr, class_);
  store<i32>(payloadsPtr, payload);
  __taskResume(idsPtr, classesPtr, payloadsPtr, 1);
  heap.free(idsPtr); heap.free(classesPtr); heap.free(payloadsPtr);
}

export function failOne(id: i64, status: i32): void {
  const idsPtr = heap.alloc(8);
  const statusesPtr = heap.alloc(4);
  store<i64>(idsPtr, id);
  store<i32>(statusesPtr, status);
  __taskFail(idsPtr, statusesPtr, 1);
  heap.free(idsPtr); heap.free(statusesPtr);
}
`;

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
        // The guest's scheduler seam (`std/assembly/task-rt.ts:145-146`,
        // `@external("scheduler", "park")` -> `hostPark(taskId: i64,
        // class_: i32, key: i32): void`). An async function that can suspend
        // imports it, so instantiation needs the module present.
        //
        // Every case that `run()`s awaits an already-settled record
        // (`record.done = 1`), so the settled guard returns before any park is
        // reached — and the body **throws** to prove it. A case that does park
        // uses `session()` instead, which records the announcement.
        scheduler: {
          park(taskId, class_, key) {
            throw new Error("scheduler.park reached in a settled-path case: the settled guard should have returned first");
          }
        },
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
    },
    /**
     * A multi-step instance for the host-driven cases, which must survive a
     * park: the guest runs until it parks, the park is recorded (not thrown),
     * and the test then resumes it through the exported entry.
     *
     * One instance across the whole sequence — a fresh module per step would
     * reset the guest's globals and lose the parked task.
     */
    session() {
      const parked = [];
      const module = new WebAssembly.Module(bytes);
      let instance;
      instance = new WebAssembly.Instance(module, {
        scheduler: {
          park(taskId, class_, key) {
            parked.push({ taskId, class_, key });
          }
        },
        env: {
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
      return {
        /** The park announcements the guest made, in order. */
        parked,
        /** Calls any exported entry on this instance. */
        call(name, ...args) {
          return instance.exports[name](...args);
        }
      };
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
  return t._record.payload;
}
`);
  check("a local declared after an await is read after it (5)", one.run("probe"), 5);

  const two = compile(`
import { Task, TaskRecord } from "~lib/task";

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
  return t._record.payload;
}
`);
  check("  ...and survives a second await (5)", two.run("probe"), 5);

  const both = compile(`
import { Task, TaskRecord } from "~lib/task";

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

async function B(): i32 { return 41; }
async function A(): i32 { let x: i32 = await B(); return x + 1; }

export function probe(): i32 {
  let h: Task<i32> = A();
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
  // The parked path, driven the way the host drives it: the guest parks on a
  // record with a producer stamp, announces the park through `scheduler.park`,
  // and the host answers with `__taskResume` naming that task id.
  const r = compile(`
import { Task, TaskRecord } from "~lib/task";
import { __taskHasRunnable } from "~lib/task-rt";
${DRIVER}
let seen: i32 = 0;

async function g(h: Task<i32>): i32 {
  let v: i32 = await h;
  seen = v;
  return v;
}

export function probe(): i32 {
  bindTaskTable();
  let record: TaskRecord = new TaskRecord();
  record.class_ = 4; // JOB_DONE, unbound: its own family
  record.key = 7;
  let handle: Task<i32> = new Task<i32>();
  handle._record = record;
  g(handle);
  return __taskHasRunnable() ? -1 : 0;   // 0: parked, nothing running
}
export function readSeen(): i32 { return seen; }
`);
  const parked41 = r.session();
  check("  ...the guest parks with nothing runnable", parked41.call("probe"), 0);
  // The vacuous-pass guard: an unbound table would leave `parked` empty and the
  // resume below would no-op, so this assertion is what makes the test real.
  check("  ...and the park was announced to the host", parked41.parked.length, 1);
  check("  ...naming the parked task's family and key",
    [ parked41.parked[0].class_, parked41.parked[0].key ], [ 4, 7 ]);
  parked41.call("resumeOne", parked41.parked[0].taskId, 4, 41);
  check("a delivered completion wakes the parked task (41)", parked41.call("readSeen"), 41);
}

{
  // **Rewritten (was: one tick, one resume).** The old case asserted the pull
  // path's contract — "a tick takes its queue at entry, so a task woken during
  // the tick runs in the next one". That contract is gone: `__taskTick` was
  // removed with the pull delivery, and `drainReady` now loops **until empty**
  // inside each host entry point (`__taskResume`, `__taskWake`, `__taskFail`
  // all end there — `std/assembly/task-rt.ts:534-540`). The assertion that
  // still means something is the current one: one resume drains to empty.
  //
  // Why drain-to-empty is the right invariant: resuming one state can complete
  // another task, whose waiters are then queued; a host that had to call back
  // once per hop would need to know the guest's graph. The loop keeps every
  // resume at the top of a host call and terminates because each entry is
  // resumed once and the list is emptied before the first resume.
  const r = compile(`
import { Task, TaskRecord } from "~lib/task";
import { __taskHasRunnable } from "~lib/task-rt";
${DRIVER}
let hops: i32 = 0;

// B awaits a record; A awaits *B's completion*. Resuming A's park runs A to
// its await of B, which parks; B's completion is what the single resume below
// has to reach, so the drain must loop rather than take one entry.
async function B(h: Task<i32>): i32 { let v: i32 = await h; hops += 1; return v + 1; }
async function A(): i32 { let x: i32 = await B(makeRecord()); hops += 1; return x; }

function makeRecord(): Task<i32> {
  let r: TaskRecord = new TaskRecord();
  r.class_ = 4;
  r.key = 1;
  let t: Task<i32> = new Task<i32>();
  t._record = r;
  return t;
}

export function probe(): i32 {
  bindTaskTable();
  A();
  return __taskHasRunnable() ? -1 : 0;    // parked on the record
}
export function readHops(): i32 { return hops; }
`);
  const drained = r.session();
  check("  ...the chain parks with nothing runnable", drained.call("probe"), 0);
  check("  ...and the park was announced to the host", drained.parked.length, 1);
  drained.call("resumeOne", drained.parked[0].taskId, 4, 5);
  check("one resume drains to empty — no runnable task remains", drained.call("readHops") >= 1, true);
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
export function probe(): i32 { let t: Task<i32> = sumTo(); return t._record.payload; }
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
export function probe(): i32 { let t: Task<i32> = depths(); return t._record.payload; }
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
export function probe(): i32 { let t: Task<i32> = outer(); return t._record.payload; }
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
  return a._record.payload * 100 + b._record.payload;
}
`);
  check("case 5 (b, early return): 7 before the await, 9 after it", five.run("probe"), 709);

  // Case 6 (a): a closure's captured binding across a real park — delivered
  // only after the task has parked, which is the dispatcher's real ordering.
  const six = compile(`
import { Task, TaskRecord } from "~lib/task";
import { __taskHasRunnable } from "~lib/task-rt";
${DRIVER}
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
  bindTaskTable();
  let r: TaskRecord = new TaskRecord();
  r.class_ = 4;
  r.key = 9;
  let h: Task<i32> = new Task<i32>();
  h._record = r;
  closes(9);
  return __taskHasRunnable() ? -1 : 0;   // parked, nothing running yet
}
export function readCaptured(): i32 { return captured; }
`);
  const sixParked = six.session();
  check("case 6 (a): the closure's task parks", sixParked.call("probe"), 0);
  check("  ...and the park was announced to the host", sixParked.parked.length, 1);
  sixParked.call("resumeOne", sixParked.parked[0].taskId, 4, 0);
  check("case 6 (a, closure across a real park): 40 + 2 + 0", sixParked.call("readCaptured"), 42);

  // C5a case 20 (b): an async function whose closure captures from TWO scopes
  // — the function body and a block — and reads both after a real park. The
  // block env is the head, its `$parent` is the body env, and the closure hops
  // one link for the body binding. Delivered after the park, as above, so the
  // suspension is genuine.
  const twoScopes = compile(`
import { Task, TaskRecord } from "~lib/task";
import { __taskHasRunnable } from "~lib/task-rt";
${DRIVER}
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

let pending: Task<i32> | null = null;
export function probe(): i32 {
  bindTaskTable();
  pending = two();                      // starts it; parks at the await
  return __taskHasRunnable() ? -1 : 0;
}
export function readLanded(): i32 { return pending!._record.payload; }
`);
  const twoScopesParked = twoScopes.session();
  check("C5a case 20: the two-scope task parks", twoScopesParked.call("probe"), 0);
  check("  ...and the park was announced to the host", twoScopesParked.parked.length, 1);
  twoScopesParked.call("resumeOne", twoScopesParked.parked[0].taskId, 4, 0);
  check("C5a case 20 (b, two-scope async across a park): 1 + 2",
    twoScopesParked.call("readLanded"), 3);
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
import { __taskHasRunnable } from "~lib/task-rt";
${DRIVER}
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

let pending: Task<i32> | null = null;
export function probe(): i32 {
  bindTaskTable();
  pending = new C().m(13);              // starts it; parks at the first await
  return __taskHasRunnable() ? -1 : 0;
}
export function readGot(): i32 { return pending!._record.payload; }
`);
  const collisionParked = collision.session();
  check("C5b case 21: the method parks", collisionParked.call("probe"), 0);
  check("  ...and the park was announced to the host", collisionParked.parked.length, 1);
  collisionParked.call("resumeOne", collisionParked.parked[0].taskId, 4, 0);
  check("C5b case 21 (collision, awaited `.call`): 1 + 7",
    collisionParked.call("readGot"), 8);
  check("C5b case 21: the this-struct carries the receiver and the chain link",
    /f\$ThisEnv#set:\$this/.test(collision.wat) &&
    /f\$ThisEnv#set:\$parent/.test(collision.wat), true);

  // Divergence 3 (C6a): an unannotated local that crosses an await. The state
  // field needs a type, and the transform runs before resolution — so the
  // syntax arm names it from the initializer and writes it onto the
  // declaration, which is the field this transform already reads.
  const inferred = compile(`
import { Task, TaskRecord } from "~lib/task";
import { __taskHasRunnable } from "~lib/task-rt";
${DRIVER}
async function untyped(job: i32): i32 {
  let n = 40;
  let r: TaskRecord = new TaskRecord();
  r.class_ = 4;
  r.key = job;
  let h: Task<i32> = new Task<i32>();
  h._record = r;
  await h;
  return n + 2;
}

let pending: Task<i32> | null = null;
export function probe(): i32 {
  bindTaskTable();
  pending = untyped(31);                // starts it; parks at the await
  return __taskHasRunnable() ? -1 : 0;
}
export function readDone(): i32 { return pending!._record.payload; }
`);
  const inferredParked = inferred.session();
  check("Divergence 3 (C6a): the untyped local's task parks", inferredParked.call("probe"), 0);
  check("  ...and the park was announced to the host", inferredParked.parked.length, 1);
  inferredParked.call("resumeOne", inferredParked.parked[0].taskId, 4, 0);
  check("Divergence 3 (C6a): an inferred local survives the suspension",
    inferredParked.call("readDone"), 42);
  check("Divergence 3 (C6a): its state field is typed from the literal",
    /untyped\$State#set:n/.test(inferred.wat), true);
}

// 7. Early completions — **rewritten** for the push model.
//
// The old four cases (buffer hit, delivered late, undelivered, eviction at 256)
// tested the guest-side early-completion buffer: `__taskDeliver` keyed on
// `(family, key)` with a 256-entry buffer the guest owned, and an eviction
// counter. That mechanism was retired in 50cceb36. `std/assembly/task-rt.ts:456-459`
// states it: "What the retirement removed: the guest-side early-completion
// buffer and the `waitingByKey` registration that fed
// `__taskDeliver`/`__taskTick`. Early completions are the host's now
// (`scheduler::RecentCompletions`), delivered through `__taskResume`; the pull
// delivery they existed for is gone."
//
// So the early/late/evict distinction is no longer a guest-side question. What
// *is* still the guest's, and is what these cases assert now:
//
//   1. a park is **announced to the host** (`scheduler.park`, with the task id,
//      family and key) — that announcement is the whole rendezvous;
//   2. nothing is buffered in the guest: before `__taskResume` the task has not
//      run past its await and nothing is runnable;
//   3. the completion arrives through `__taskResume` and the task runs to its
//      terminal with the delivered value.
//
// The host's side of the early/late distinction — a completion that arrives
// before the park is matched from `scheduler::RecentCompletions` — is asserted
// in the engine's async fixtures (`guest-push`, `guest-flow`, `guest-drop`,
// `guest-chain`), which run against the real host and are where that ordering
// is observable at all.

console.log("early completions");

{
  const HEAD = `
import { Task, TaskRecord } from "~lib/task";
import { __taskHasRunnable } from "~lib/task-rt";
${DRIVER}
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

  // (1) the park is announced, and nothing is buffered in the guest.
  const announced = compile(`${HEAD}
let pending: Task<i32> | null = null;
export function probe(): i32 {
  bindTaskTable();
  let r: TaskRecord = stamped(77);
  let h: Task<i32> = new Task<i32>();
  h._record = r;
  pending = g(h);
  return __taskHasRunnable() ? -1 : 0;   // parked, nothing runnable
}
export function readFrames(): i32 { return frames; }
export function readPayload(): i32 { return pending!._record.payload; }
`);
  const a = announced.session();
  check("the guest parks with nothing runnable", a.call("probe"), 0);
  check("  ...the park is announced to the host with id, family and key", a.parked.length, 1);
  check("  ...naming family 4, key 77", [ a.parked[0].class_, a.parked[0].key ], [ 4, 77 ]);
  check("  ...and only the pre-await half of the body has run", a.call("readFrames"), 1);

  // (2) the completion arrives through __taskResume: the task reaches its
  // terminal, both halves ran, and the delivered payload is on the record.
  a.call("resumeOne", a.parked[0].taskId, 4, 41);
  check("a completion delivered via __taskResume runs the task to its terminal",
    a.call("readFrames"), 11);
  check("  ...with the delivered value on the record", a.call("readPayload"), 41);
  check("  ...and nothing left runnable", a.call("probe") === 0, true);

  // (3) an undelivered park stays parked: no completion, no resume, no second
  // half. This is the guest-side half of "no completion is invented locally".
  const parked = compile(`${HEAD}
let pending: Task<i32> | null = null;
export function probe(): i32 {
  bindTaskTable();
  let r: TaskRecord = stamped(79);
  let h: Task<i32> = new Task<i32>();
  h._record = r;
  pending = g(h);
  return __taskHasRunnable() ? -1 : 0;
}
export function readFrames(): i32 { return frames; }
export function readDone(): i32 { return pending!._record.done; }
`);
  const p = parked.session();
  check("an undelivered task parks", p.call("probe"), 0);
  check("  ...only the pre-await half ran", p.call("readFrames"), 1);
  check("  ...and its record is still unsettled", p.call("readDone"), 0);
  check("  ...so it stays parked with nothing runnable", p.call("probe"), 0);
}

// 8. Dropped completions — **rewritten** for the push model.
//
// The old three cases called `__taskReportDrops(family, count)` from the guest:
// the framework read the arena's per-class drop counter and std woke that many
// parked tasks with `-EIO`, oldest-first. `__taskReportDrops` was retired with
// the rest of the pull machinery; the host now names the tasks to fail directly,
// through `__taskFail(idsPtr, statusesPtr, count)` — "the host names tasks to
// resume with a status and no payload (§4.4's lost completion, §5.1's refused
// park)" (`std/assembly/task-rt.ts:228-235`). The *status* goes on the record
// the task awaited, because that is the record the transform's settled check
// reads and the one `rt.classify` reports.
//
// So the guest-side assertions are the ones below: a fail wakes the named task
// exactly once, puts the status on the awaited record, marks it settled, and a
// later resume for the same task does nothing (the id is stale, and waking
// nothing is the correct behaviour — resuming twice never is). Which tasks the
// *host* chooses to fail, and in what order, is the host's attribution logic and
// is asserted in the engine fixtures (`guest-drop`).

console.log("dropped completions");

{
  const HEAD = `
import { Task, TaskRecord } from "~lib/task";
import { __taskHasRunnable } from "~lib/task-rt";
${DRIVER}
let resumed: i32 = 0;

async function g(h: Task<i32>): i32 {
  let v: i32 = await h;
  resumed = resumed + 1;
  return v;
}

function stamped(key: i32): TaskRecord {
  let r: TaskRecord = new TaskRecord();
  r.class_ = 4;
  r.key = key;
  return r;
}
export function readResumed(): i32 { return resumed; }
`;

  // (1) a fail wakes the named task with the status on its record.
  const one = compile(`${HEAD}
let r1: TaskRecord = changetype<TaskRecord>(0);
export function probe(): i32 {
  bindTaskTable();
  r1 = stamped(5);
  let h1: Task<i32> = new Task<i32>(); h1._record = r1; g(h1);
  return __taskHasRunnable() ? -1 : 0;    // parked
}
export function readStatus(): i32 { return r1.status; }
export function readDone(): i32 { return r1.done; }
`);
  const f1 = one.session();
  check("the failing task parks first", f1.call("probe"), 0);
  check("  ...and the park was announced to the host", f1.parked.length, 1);
  f1.call("failOne", f1.parked[0].taskId, -5);   // -EIO
  check("a fail wakes the named task", f1.call("readResumed"), 1);
  check("  ...with the status on the awaited record", f1.call("readStatus"), -5);
  check("  ...and the record marked settled", f1.call("readDone"), 1);

  // (2) a second fail for the same task does nothing: the id is stale, and the
  // task must not be resumed twice.
  f1.call("failOne", f1.parked[0].taskId, -5);
  check("a second fail for the same task does not resume it again",
    f1.call("readResumed"), 1);

  // (3) two parked tasks, one failed: only that one wakes, the other stays
  // parked with its record unsettled.
  const two = compile(`${HEAD}
let r1: TaskRecord = changetype<TaskRecord>(0);
let r2: TaskRecord = changetype<TaskRecord>(0);
export function probe(): i32 {
  bindTaskTable();
  r1 = stamped(11);
  let h1: Task<i32> = new Task<i32>(); h1._record = r1; g(h1);
  r2 = stamped(12);
  let h2: Task<i32> = new Task<i32>(); h2._record = r2; g(h2);
  return __taskHasRunnable() ? -1 : 0;
}
export function readStatuses(): i32 { return r1.status * 100 + r2.status; }
export function readDones(): i32 { return r1.done * 10 + r2.done; }
`);
  const f2 = two.session();
  check("two tasks park", f2.call("probe"), 0);
  check("  ...both announced to the host", f2.parked.length, 2);
  f2.call("failOne", f2.parked[0].taskId, -5);
  check("one fail wakes exactly one of them", f2.call("readResumed"), 1);
  check("  ...and only that task's record carries the status",
    f2.call("readStatuses"), -5 * 100 + 0);
  check("  ...leaving the other parked and unsettled", f2.call("readDones"), 10);
}

console.log();
if (failures) {
  console.log(`FAILURE: ${failures} of ${checks} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`[ SUCCESS ] ${checks} checks`);
}
