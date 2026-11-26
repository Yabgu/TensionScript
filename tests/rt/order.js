// Round PR1: the order a program chooses — a submitted task, and a step that
// ranks the ready set before it resumes anything.
//
// `docs/task-model.md` §"Writing a step" is the contract this file exercises.
// Three things are under test, and the third is the one the owner has been
// explicit about — **order, not just final values**:
//
//   1. a policy whose `create` **submits** (`__submitTask`) rather than drives:
//      the body runs later, when the step says, exactly once;
//   2. a `mainStep` that pops the whole ready set, sorts it by the task's own
//      rank (`__taskAt(slot).policy`), and resumes the highest rank first;
//   3. the transcript is the schedule: a line on entry, on suspend and on
//      resume of every async body, asserted as an **ordered** list.
//
// Plus the parameterized-async case (the record now initializes its captured
// fields in its own constructor): a function called twice with different
// arguments, both values reaching the transcript.
//
// Why this file and not `tests/rt/gate4.js`: gate4's subject is the cross-store
// ABI — `__threadInit`, carved rings, Node workers, one memory shared by several
// instances. Everything here is one store, one executor and one linear memory,
// and the assertion is a transcript rather than a status word. Putting it in
// gate4 would mean running the shared-memory boot sequence to test a step, and
// gate4's own header would have to grow a case that does not cross a thread at
// all.
//
// Run: npm run test:order (Node needs --experimental-wasm-wasmfx).

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

/** Compiles `source` with the stackful backend and returns the artefacts. */
function compile(source, extraArgs = []) {
  const dir = mkdtempSync(join(tmpdir(), "pr1-order-"));
  const tsPath = join(dir, "probe.ts");
  const wasmPath = join(dir, "probe.wasm");
  const watPath = join(dir, "probe.wat");
  writeFileSync(tsPath, source);
  try {
    execFileSync(process.execPath, [
      CLI, "probe.ts", "-o", "probe.wasm", "--textFile", "probe.wat",
      "--runtime", "stub", "--noColors", "--enable", "stack-switching", "--stackful-backend", "continuation",
      ...extraArgs,
    ], { stdio: "pipe", cwd: dir });
  } catch (error) {
    const output = `${error.stderr ?? ""}${error.stdout ?? ""}`;
    rmSync(dir, { recursive: true, force: true });
    return { error: output };
  }
  return {
    wat: readFileSync(watPath, "utf8"),
    bytes: readFileSync(wasmPath),
    dispose() { rmSync(dir, { recursive: true, force: true }); },
  };
}

/**
 * Instantiates the module with an `emit` that **records the transcript**, then
 * runs the shell.
 *
 * The guest has no strings and no formatter, so every observation is a
 * `(tag, value)` pair — the tag names come from the source constants, and the
 * host reads them back positionally. `lines` is the ordered transcript; that is
 * the assertion surface.
 */
function runTranscript(bytes, globals = []) {
  const lines = [];
  const module = new WebAssembly.Module(bytes);
  const instance = new WebAssembly.Instance(module, {
    env: {
      emit: (tag, value) => { lines.push([tag, value]); },
      abort: (a, b, c, d) => { throw new Error(`abort ${a} ${b} ${c} ${d}`); },
    },
  });
  let threw = null;
  try {
    instance.exports.__asyncPump();
  } catch (error) {
    threw = String(error && error.message || error);
  }
  const read = {};
  for (const name of globals) {
    const exported = instance.exports[name];
    read[name] = exported && typeof exported === "object" ? exported.value : exported;
  }
  return { lines, threw, status: instance.exports.__asyncStatus.value, globals: read };
}

// Wasmfx availability, asked of the **engine** rather than of the argv.
//
// This file is in `npm test`, and that chain runs on a Node started without the
// flag as well (the Coverage job does), where the first `new WebAssembly.Module`
// on a stack-switching module is a hard `CompileError`. The flag's spelling has
// moved across Node versions and its absence has announced itself two ways —
// `core stack switching not enabled` (gate4's message) and
// `Compiling function #N failed: Invalid opcode 0xe0` (`cont.new`/`suspend` are
// the 0xe0 prefix) — so both are recognised as "this engine cannot run it".
//
// **Every other error is a failure.** A skip that also swallowed a validation
// error would hide exactly the bug this round could introduce.
{
  const probe = compile(`
async function leaf(): i32 { await 1; return 0; }
export async function main(): i32 { await leaf(); return 0; }
`);
  if (probe.error === undefined) {
    try {
      new WebAssembly.Module(probe.bytes);
    } catch (error) {
      const message = String(error && error.message || error);
      probe.dispose();
      if (/core stack switching not enabled|Invalid opcode 0xe0/.test(message)) {
        console.log("SKIP: this Node cannot run stack switching (start it with --experimental-wasm-wasmfx)");
        process.exit(0);
      }
      throw error;
    }
    probe.dispose();
  }
}

// ---------------------------------------------------------------------------
// 1. A submitted task, and a step that ranks the ready set.
// ---------------------------------------------------------------------------

console.log("\n# 1  a ranked step choosing the order of submitted tasks");

// The tags. The host names them; the guest only emits numbers.
const ENTER = 1;
const SUSPEND = 2;
const RESUME = 3;
const VALUE = 4;

const schedule = `
import {
  Executor, __drainInbox, __submitTask, __taskAt, __resumeTask, __lastStatus,
} from "~lib/thread";
import { TaskBase, TaskPolicy, __inlineAwait } from "~lib/task";

@external("env", "emit")
declare function emit(tag: i32, value: i32): void;

const ENTER: i32 = 1;
const SUSPEND: i32 = 2;
const RESUME: i32 = 3;
const VALUE: i32 = 4;

/** The status the last resume answered, as the step saw it. */
export let lastSeen: i32 = -99;
/** Bodies that ran, per rank — one per rank proves "exactly once". */
export let ranLow: i32 = 0;
export let ranMid: i32 = 0;
export let ranHigh: i32 = 0;

/**
 * Eager: the prefix runs at the call site, because \`create\` drives the task.
 *
 * This row is the one that already worked, and it stays in the transcript so
 * the two ways of making a task run are visible side by side: \`drive\` inside
 * \`create\` for work that must start now, \`__submitTask\` for work whose turn
 * the step decides.
 */
@final class Eager extends TaskPolicy {
  create(task: TaskBase): void { task.drive(); }
  await(task: TaskBase): void { if (!task.settled) __inlineAwait(task); }
}

/**
 * Ranked: \`create\` **submits** and runs nothing.
 *
 * The rank is the policy's own field, because the rank is the caller's
 * decision, not the runtime's. The step reads it back through the task
 * (\`__taskAt(slot).policy\`), which is why a task's policy is readable after
 * the fact rather than hidden inside the scheduler.
 */
@final class Ranked extends TaskPolicy {
  rank: i32;
  constructor(rank: i32) { super(); this.rank = rank; }
  create(task: TaskBase): void { __submitTask(task); }
  await(task: TaskBase): void { if (!task.settled) __inlineAwait(task); }
}

/** A slot's rank, or \`-1\` for a slot that is not a ranked task (main, a leaf). */
function rankOf(slot: i32): i32 {
  let taskOrNull = __taskAt(slot);
  if (!taskOrNull) return -1;
  let policy = changetype<TaskBase>(taskOrNull).policy;
  if (!policy) return -1;
  return changetype<Ranked>(policy).rank;
}

/**
 * Main's step, written by the program.
 *
 * \`__mainStep__\` is drain-then-one-slot. This one is drain-then-**all**-slots,
 * highest rank first: the ready set is drained into an array, insertion-sorted
 * by the task's own rank (stable, so equal ranks keep the ring's order and an
 * unknown rank — main, a leaf — goes last), and then resumed in that order.
 *
 * Nothing here is decoration: with creation order 1, 5, 9 the transcript's
 * ENTER lines are 9, 5, 1, which no FIFO step can produce.
 */
export function mainStep(e: Executor): bool {
  __drainInbox(e);
  let slots = new Array<i32>();
  let slot = e.ready.pop();
  while (slot >= 0) {
    slots.push(slot);
    slot = e.ready.pop();
  }
  for (let i = 1, k = slots.length; i < k; ++i) {
    let value = unchecked(slots[i]);
    let valueRank = rankOf(value);
    let j = i - 1;
    while (j >= 0 && rankOf(unchecked(slots[j])) < valueRank) {
      unchecked(slots[j + 1] = slots[j]);
      --j;
    }
    unchecked(slots[j + 1] = value);
  }
  for (let i = 0, k = slots.length; i < k; ++i) {
    let queued = unchecked(slots[i]);
    let taskOrNull = __taskAt(queued);
    // A settled task must not be resumed: \`driveReady\` guards the same way,
    // and the ready ring can outlive a settlement (two waiters, one task).
    if (taskOrNull && changetype<TaskBase>(taskOrNull).settled) continue;
    let awaited = __resumeTask(queued);
    if (awaited >= 0) e.ready.push(awaited);
  }
  lastSeen = __lastStatus();
  return false;
}

/**
 * A real suspension point: the caller parks on this task, so control returns to
 * the step and the *step* decides what runs next.
 *
 * It takes a parameter and uses it, which is the parameterized-record case as
 * well: the value a body hands over is captured in the record's constructor and
 * read back after the suspension.
 */
async function yieldPoint(rank: i32): i32 {
  await 1;
  return rank;
}

/**
 * The body under test: named by its arguments, so the record carries a
 * \`string\` and an \`i32\` and the value it returns is only right if both
 * survived the suspension.
 */
async function named(name: string, rank: i32): i32 {
  emit(ENTER, rank);
  emit(SUSPEND, rank);
  await yieldPoint(rank);
  emit(RESUME, rank);
  if (rank == 1) ranLow++;
  else if (rank == 5) ranMid++;
  else if (rank == 9) ranHigh++;
  return rank * 100 + name.length;
}

export async function main(): i32 {
  emit(ENTER, 0);                       // main itself, so the transcript opens
  // Eager first: its prefix runs here, at the call site, before the ranked
  // tasks exist at all.
  let eager = named("eager", 7) on new Eager();
  // Creation order 1, 5, 9. Nothing runs: \`create\` only submits.
  let low = named("low", 1) on new Ranked(1);
  let mid = named("mid", 5) on new Ranked(5);
  let high = named("high", 9) on new Ranked(9);
  // Awaiting in creation order: the step's choice is what the transcript shows,
  // and the values arrive regardless of which order they were resumed in.
  let a = await low;
  let b = await mid;
  let c = await high;
  let d = await eager;
  emit(VALUE, a);
  emit(VALUE, b);
  emit(VALUE, c);
  emit(VALUE, d);
  return 0;
}
`;

{
  const built = compile(schedule);
  check("the schedule fixture compiles", built.error === undefined, true);
  if (built.error) console.log(built.error);
  if (!built.error) {
    try {
      const ran = runTranscript(built.bytes, ["lastSeen", "ranLow", "ranMid", "ranHigh"]);
      const transcript = ran.lines;
      console.log("        transcript:");
      for (const [tag, value] of transcript) {
        const name = tag === ENTER ? "enter" : tag === SUSPEND ? "suspend" : tag === RESUME ? "resume" : "value";
        console.log(`          ${name} ${value}`);
      }
      check("the program ran without trapping", ran.threw, null);
      check("the shell finished cleanly", ran.status, 0);

      // --- the order, which is the whole point -----------------------------
      //
      // Ranks 1, 5, 9 were created in that order; the step resumes 9, 5, 1.
      const entersOfRanked = transcript
        .filter(([tag, value]) => tag === ENTER && (value === 1 || value === 5 || value === 9))
        .map(([, value]) => value);
      check("the ranked bodies enter in the step's order, not creation order",
        entersOfRanked, [9, 5, 1]);
      const resumesOfRanked = transcript
        .filter(([tag, value]) => tag === RESUME && (value === 1 || value === 5 || value === 9))
        .map(([, value]) => value);
      check("…and they resume in the same order", resumesOfRanked, [9, 5, 1]);

      // Each body ran exactly once: the ranks are distinct, so a second run
      // would add a second ENTER line for that rank.
      check("each ranked body ran exactly once",
        [ran.globals.ranLow, ran.globals.ranMid, ran.globals.ranHigh], [1, 1, 1]);
      check("every ranked body entered once",
        entersOfRanked.length, 3);

      // The eager body's prefix ran **before** any ranked creation, which is
      // what makes `Eager` eager and `Ranked` not.
      const eagerEnter = transcript.findIndex(([tag, value]) => tag === ENTER && value === 7);
      const firstRankedEnter = transcript.findIndex(
        ([tag, value]) => tag === ENTER && (value === 1 || value === 5 || value === 9));
      check("the eager prefix ran at the call site, before any ranked body",
        eagerEnter >= 0 && eagerEnter < firstRankedEnter, true);

      // The values: `rank * 100 + name.length`, so both the captured i32 and
      // the captured string survived the suspension and the crossing.
      const values = transcript.filter(([tag]) => tag === VALUE).map(([, value]) => value);
      check("both captured arguments reached every value", values, [103, 503, 904, 705]);

      // `__lastStatus` is readable from a step (it is the one async intrinsic a
      // program may call — a read, not a protocol payload).
      check("the step could read the last resume status",
        ran.globals.lastSeen >= 0, true);

      // --- the exact transcript -------------------------------------------
      //
      // Asserted as a whole, in order, because "order is the thing under test"
      // and a subsequence check alone would pass on a transcript that ran the
      // same bodies in a different interleaving. The two rules that produce
      // this list:
      //
      //   * a slot is resumed only after the thing it parks on has settled, so
      //     `resume r` always follows the `suspend r` that parked it;
      //   * within one step iteration the ready set is sorted by rank, so the
      //     three ranked bodies start highest-rank-first (9, 5, 1) even though
      //     they were created 1, 5, 9;
      //   * the `yieldPoint` tasks they then park on carry no rank, so the step
      //     resumes them in the ring's order — which is the order the bodies
      //     entered, and that is why the three `resume` lines come out 9, 5, 1
      //     as well.
      const expected = [
        [ENTER, 0],      // main, on the first resume
        [ENTER, 7],      // the eager prefix, at the call site
        [SUSPEND, 7],
        [RESUME, 7],
        [ENTER, 9],
        [SUSPEND, 9],
        [ENTER, 5],
        [SUSPEND, 5],
        [ENTER, 1],
        [SUSPEND, 1],
        [RESUME, 9],
        [RESUME, 5],
        [RESUME, 1],
        [VALUE, 103],    // low  = 1 * 100 + "low".length
        [VALUE, 503],    // mid  = 5 * 100 + "mid".length
        [VALUE, 904],    // high = 9 * 100 + "high".length
        [VALUE, 705],    // eager= 7 * 100 + "eager".length
      ];
      check("the whole transcript, in order", transcript, expected);
    } finally {
      built.dispose();
    }
  }
}

// ---------------------------------------------------------------------------
// 2. A parameterized async function: the record initializes its own fields.
// ---------------------------------------------------------------------------

console.log("\n# 2  a parameterized async function, called twice");

{
  // Before this round this did not compile at all: `TS2564: Property
  // 'work$Rec#$p0' has no initializer…`, because the synthesized record
  // declared its captured parameters as fields and no constructor assigned
  // them. The values below are only right if the constructor captured both
  // arguments, and they are printed *after* a suspension, so a zeroed field
  // would show up as a wrong number rather than as a compile error.
  const built = compile(`
import { TaskBase, TaskPolicy, __inlineAwait } from "~lib/task";

@external("env", "emit")
declare function emit(tag: i32, value: i32): void;

const VALUE: i32 = 4;

/**
 * Eager, so \`create\` runs each body at its own call site and the two values
 * cannot be confused by interleaving: whatever the second call prints is the
 * second call's arguments and nothing else.
 */
@final class Eager extends TaskPolicy {
  create(task: TaskBase): void { task.drive(); }
  await(task: TaskBase): void { if (!task.settled) __inlineAwait(task); }
}

async function yieldPoint(): i32 { await 1; return 0; }

async function work(name: string, weight: i32): i32 {
  let before = name.length * 1000 + weight;
  await yieldPoint();
  // A second read after the suspension: the field has to still be there.
  return before + name.length * 1000 + weight;
}

export async function main(): i32 {
  let first = await work("low", 3) on new Eager();
  let second = await work("high!", 4) on new Eager();
  emit(VALUE, first);
  emit(VALUE, second);
  return first * 100000 + second;
}
`);
  check("a parameterized async function compiles", built.error === undefined, true);
  if (built.error) console.log(built.error);
  if (!built.error) {
    try {
      const ran = runTranscript(built.bytes);
      check("…and runs", ran.threw, null);
      // work("low", 3): (3*1000+3) * 2 = 6006; work("high!", 4): (5*1000+4)*2 = 10008.
      check("both calls' captured arguments reached their values",
        ran.lines, [[VALUE, 6006], [VALUE, 10008]]);
      // Packed, not summed: 6006 * 100000 + 10008, which stays inside i32.
      check("the two values are distinct and in call order",
        ran.status, 6006 * 100000 + 10008);
    } finally {
      built.dispose();
    }
  }
}

// ---------------------------------------------------------------------------
// 3. `__submitTask`'s own contract, at the edges.
// ---------------------------------------------------------------------------

console.log("\n# 3  the submit primitive's refusals");

{
  const built = compile(`
import { __submitTask, __taskAt } from "~lib/thread";
import { TaskBase, TaskPolicy, __inlineAwait } from "~lib/task";

export let first: i32 = -1;
export let duplicate: i32 = -1;
export let settled: i32 = -1;
export let submittedBeforeAwait: i32 = -1;

@final class Submit extends TaskPolicy {
  create(task: TaskBase): void {
    first = __submitTask(task) ? 1 : 0;
    duplicate = __submitTask(task) ? 1 : 0;
    // Nothing ran: submitting does not drive the body, so the task is still
    // unsettled when the second call is made.
    submittedBeforeAwait = task.settled ? 1 : 0;
  }
  await(task: TaskBase): void { if (!task.settled) __inlineAwait(task); }
}

async function yieldPoint(): i32 { await 1; return 0; }
async function work(): i32 { await yieldPoint(); return 21; }

export async function main(): i32 {
  let t = work() on new Submit();
  let value = await t;
  settled = __submitTask(t) ? 1 : 0;
  return value;
}
`);
  check("the edges fixture compiles", built.error === undefined, true);
  if (built.error) console.log(built.error);
  if (!built.error) {
    try {
      const ran = runTranscript(built.bytes, ["first", "duplicate", "settled", "submittedBeforeAwait"]);
      check("the first submit is accepted", ran.globals.first, 1);
      check("a second submit of the same task is refused", ran.globals.duplicate, 0);
      check("…and the task was still unsettled, so nothing ran", ran.globals.submittedBeforeAwait, 0);
      check("a settled task is refused", ran.globals.settled, 0);
      check("the submitted task ran exactly once and its value arrived", ran.status, 21);
    } finally {
      built.dispose();
    }
  }
}

if (failures) {
  console.error(`\norder: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\n[ SUCCESS ] ${checks} checks`);
