// Round TH3, Gate 4: cross-thread queues, spawn, and the two directions of a
// real task.
//
// The boot contract this file assumes (`docs/thread-abi.md`):
//
//   * a `--sharedMemory` module runs nothing at instantiation;
//   * the host carves with `__threadInit(capacity)`, configures main's arena
//     with `__arenaInit(__mainArenaBase(), __mainArenaSize())`, then calls
//     `__start()`;
//   * a worker's host configures its arena with
//     `__arenaInit(__workerArenaBase(id), __workerArenaSize(id))`, then calls
//     `__workerMain(id)`.
//
// Two tests, in the order the arc needs them:
//
//   (c) rings only — producers on several threads push into one carved ring,
//       one consumer drains it, every value observed exactly once. No tasks and
//       no stack switching: this is the test that fails if `SlotRing`'s
//       addressing or ordering is wrong.
//
//   (d) one real task in both directions — main posts to a worker and the
//       worker posts back to main; the value returns and settles a task created
//       in main's store. Needs stack switching.
//
// Node is required, with `--experimental-wasm-wasmfx` (measured: without it,
// `core stack switching not enabled`), because `wasmtime wast` cannot
// instantiate a shared-memory module.
//
// Run: node --experimental-wasm-wasmfx tests/rt/gate4.js

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

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

// ---------------------------------------------------------------------------
// The worker's side. `workerData.role` says which test it belongs to.
// ---------------------------------------------------------------------------

if (!isMainThread) {
  const { role, module, memory, id, total } = workerData;
  const instance = new WebAssembly.Instance(module, {
    env: {
      memory,
      abort: (a, b, c, d) => { throw new Error(`worker abort ${a} ${b} ${c} ${d}`); },
      __executorCount: () => total,
      __startThread: () => -1,
    },
  });
  const e = instance.exports;
  let spins = 0;
  try {
    if (role === "rings") {
      // Each producer gets its own arena: `SlotRing.at` allocates a handle, and
      // two instances allocating from one heap would overwrite each other.
      e.__arenaInit(workerData.arenaBase, workerData.arenaSize);
      const { ringBase, capacity, count, producer } = workerData;
      let posted = 0;
      for (let i = 0; i < count; ++i) {
        const value = producer * 1000000 + i;
        // The ring is bounded; a full ring refuses the push, and the producer
        // tries again. Nothing is buffered outside the ring.
        while (!e.pushValue(ringBase, capacity, value)) {
          if (++spins > 100000000) throw new Error("producer starved");
        }
        ++posted;
      }
      parentPort.postMessage({ posted });
    } else if (role === "await") {
      // (e) has no `report()`: the worker's only output is the reply it posts.
      e.__arenaInit(e.__workerArenaBase(id), e.__workerArenaSize(id));
      parentPort.postMessage({ status: e.__workerMain(id) });
    } else {
      e.__arenaInit(e.__workerArenaBase(id), e.__workerArenaSize(id));
      const status = e.__workerMain(id);
      parentPort.postMessage({ status, saw: e.report() });
    }
  } catch (error) {
    parentPort.postMessage({ error: String(error && error.stack || error) });
  }
} else {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

async function main() {

  /** Compiles `source` and returns its bytes and text. */
  function compile(source, flags) {
    const dir = mkdtempSync(join(tmpdir(), "th3-gate4-"));
    writeFileSync(join(dir, "probe.ts"), source);
    let ok = true;
    let output = "";
    try {
      execFileSync(process.execPath, [
        CLI, "probe.ts", "-o", "probe.wasm", "--textFile", "probe.wat", "--noColors", ...flags,
      ], { stdio: "pipe", cwd: dir });
    } catch (error) {
      ok = false;
      output = `${error.stderr ?? ""}${error.stdout ?? ""}`;
    }
    let bytes = null;
    let wat = null;
    if (ok) {
      bytes = readFileSync(join(dir, "probe.wasm"));
      wat = readFileSync(join(dir, "probe.wat"), "utf8");
    }
    rmSync(dir, { recursive: true, force: true });
    return { ok, output, bytes, wat };
  }

  /** The `$starts` table's function names, in index order. */
  function startsOf(wat) {
    const line = wat.split("\n").find((l) => l.includes("(elem $$starts$elem"));
    if (!line) return [];
    return (line.split(" func ")[1] ?? "").match(/\$[^\s)]+/g) ?? [];
  }

  // ---------------------------------------------------------------------------
  // (c) rings only: many producers, one consumer, nothing lost, nothing doubled.
  // ---------------------------------------------------------------------------

  console.log("\n# (c) a carved ring across threads");
  {
    const PRODUCERS = 3;
    const COUNT = 2000;
    const RING = 0x20000;
    const CAPACITY = 256;
    const ARENA = 0x30000;
    const ARENA_SIZE = 0x20000;

    const built = compile(`
import { SlotRing } from "~lib/thread";

export function carve(base: usize, capacity: i32): void { SlotRing.carve(base, capacity); }
export function pushValue(base: usize, capacity: i32, value: i32): bool {
  return SlotRing.at(base, capacity).push(value);
}
export function popValue(base: usize, capacity: i32): i32 {
  return SlotRing.at(base, capacity).pop();
}
`, ["--runtime", "incremental", "--enable", "threads", "--sharedMemory",
      "--importMemory", "--maximumMemory", "64"]);
    check("the rings fixture compiles", built.ok, true);
    if (built.ok) {
      const module = new WebAssembly.Module(built.bytes);
      const memory = new WebAssembly.Memory({ initial: 16, maximum: 64, shared: true });
      const env = {
        memory,
        abort: (a, b, c, d) => { throw new Error(`abort ${a} ${b} ${c} ${d}`); },
        __executorCount: () => 1,
        __startThread: () => -1,
      };
      const consumer = new WebAssembly.Instance(module, { env }).exports;
      consumer.__arenaInit(ARENA + PRODUCERS * ARENA_SIZE, ARENA_SIZE);
      consumer.carve(RING, CAPACITY);

      const workers = [];
      for (let p = 0; p < PRODUCERS; ++p) {
        workers.push(new Promise((resolve, reject) => {
          const worker = new Worker(new URL(import.meta.url), {
            workerData: {
              role: "rings", module, memory, id: p + 1, total: 1,
              ringBase: RING, capacity: CAPACITY, count: COUNT, producer: p,
              arenaBase: ARENA + p * ARENA_SIZE, arenaSize: ARENA_SIZE,
            },
          });
          worker.on("message", resolve);
          worker.on("error", reject);
        }));
      }

      // The consumer: one pop per iteration, `-1` when nothing is published yet.
      const seen = new Set();
      let pops = 0;
      let empty = 0;
      const expected = PRODUCERS * COUNT;
      const deadline = Date.now() + 30000;
      while (seen.size < expected && Date.now() < deadline) {
        const value = consumer.popValue(RING, CAPACITY);
        if (value < 0) { ++empty; continue; }
        ++pops;
        seen.add(value);
      }
      const results = await Promise.all(workers);
      check("every producer posted all of its values",
        results.map((r) => r.posted), [COUNT, COUNT, COUNT]);
      check("every value was observed", seen.size, expected);
      check("…and observed exactly once", pops, expected);
      check("the consumer did see an empty ring (the producers were not pre-loaded)",
        empty > 0, true);
      // Every value is in its producer's range: a torn or misaddressed cell would
      // land outside the three bands.
      let outOfBand = 0;
      for (const value of seen) {
        const producer = Math.floor(value / 1000000);
        const index = value % 1000000;
        if (producer < 0 || producer >= PRODUCERS || index < 0 || index >= COUNT) ++outOfBand;
      }
      check("every value is in a producer's own band", outOfBand, 0);
    }
  }

  // ---------------------------------------------------------------------------
  // (d) one task in each direction: main -> worker -> main, and main -> worker
  //     again for the acknowledgement.
  // ---------------------------------------------------------------------------

  console.log("\n# (d) a task served in another store, and its answer back");
  {
    const built = compile(`
import {
  __spawnOn, __spawnThread, __serveArg, __serveOrigin, __serveKey,
  __executorExit, __selfExecutor, mainExecutor,
} from "~lib/thread";

let gateTask: Task<i32> | null = null;
let ackStart: i32 = -1;
export let answer: i32 = -1;
export let delivered: bool = false;
export let workerSawMain: i32 = -1;

async function leaf(): i32 { return 0; }

// A task created in **main's** store. Nothing here drives it: it is settled by
// the continuation below, which main serves after the worker's reply arrives.
async function gate(): i32 { await leaf(); return -1; }

// Served in main's store: take the value the worker computed, settle the task,
// then post the acknowledgement back to the worker.
async function deliver(): i32 {
  let value = __serveArg();
  let ack = ackStart;
  let origin = __serveOrigin();
  await leaf();
  answer = value;
  let task = gateTask;
  if (task) { changetype<Task<i32>>(task).value = value; task.settle(0); }

  delivered = true;
  __spawnOn(origin, ack, 7, 0);
  return 0;
}

// Served in the worker's store: the request carries the value (21) and, as its
// origin key, the index of the continuation to reply to.
async function work(): i32 {
  let value = __serveArg();
  let reply = __serveKey();
  let origin = __serveOrigin();
  await leaf();
  __spawnOn(origin, reply, value * 2, 0);
  return 0;
}

// Served in the worker's store: main's acknowledgement, then end the loop.
async function acknowledge(): i32 {
  let value = __serveArg();
  await leaf();
  workerSawMain = value;
  __executorExit(__selfExecutor());
  return 0;
}

export function boot(workerId: i32, workStart: i32, deliverStart: i32, ackIndex: i32): i32 {
  gateTask = gate();
  answer = -1;
  ackStart = ackIndex;
  __spawnOn(workerId, workStart, 21, deliverStart);
  return __spawnThread(workerId, -1, 0);
}

export function pump(): i32 {
  let e = mainExecutor();
  let guard = 0;
  while (e.inbox.depth > 0 || e.ready.depth > 0) {
    if (e.step(e)) break;
    if (++guard > 1000000) break;
  }
  return answer;
}

export function gateSettled(): bool { let t = gateTask; return t ? changetype<Task<i32>>(t).settled : false; }
export function report(): i32 { return workerSawMain; }

export async function main(): i32 { await leaf(); return 0; }
`, ["--runtime", "incremental", "--enable", "threads", "--sharedMemory",
      "--importMemory", "--maximumMemory", "128", "--enable", "stack-switching"]);
    check("the task fixture compiles", built.ok, true);
    if (!built.ok) {
      console.log(built.output);
    } else {
      const names = startsOf(built.wat);
      const workStart = names.indexOf("$probe/work$spawnStart");
      const deliverStart = names.indexOf("$probe/deliver$spawnStart");
      const ackStart = names.indexOf("$probe/acknowledge$spawnStart");
      check("the transform synthesized all three spawn entries",
        workStart > 0 && deliverStart > 0 && ackStart > 0, true);

      const module = new WebAssembly.Module(built.bytes);
      const memory = new WebAssembly.Memory({ initial: 1, maximum: 128, shared: true });
      let workerDone = null;
      let spawned = -1;
      const env = {
        memory,
        abort: (a, b, c, d) => { throw new Error(`abort ${a} ${b} ${c} ${d}`); },
        __executorCount: () => 2,
        __startThread: (id) => {
          spawned = id;
          workerDone = new Promise((resolve, reject) => {
            const worker = new Worker(new URL(import.meta.url), {
              workerData: { role: "task", module, memory, id, total: 2 },
            });
            worker.on("message", resolve);
            worker.on("error", reject);
          });
          return 0;
        },
      };
      const e = new WebAssembly.Instance(module, { env }).exports;

      check("`__threadInit` carves the block", e.__threadInit(64), 0);
      check("the layout is published", {
        base: e.__controlBase.value,
        stride: e.__controlStride.value,
        capacity: e.__ringCapacity.value,
        total: e.__executorTotal.value,
      }, { base: 65536, stride: 1072, capacity: 64, total: 2 });

      e.__arenaInit(e.__mainArenaBase(), e.__mainArenaSize());
      check("main's arena is configured", e.__arenaHeapBase() > e.__mainArenaBase(), true);
      check("`__start` runs the boot body", e.__start(), 0);

      check("the worker is spawned through `env.__startThread`", e.boot(1, workStart, deliverStart, ackStart), 0);
      check("…with the id the guest published", spawned, 1);

      // The worker is another OS thread; pump main until the reply lands. Each
      // `pump` serves whatever is queued — a no-op until the worker posts.
      const deadline = Date.now() + 10000;
      let answer = -1;
      while (Date.now() < deadline) {
        answer = e.pump();
        if (answer >= 0) break;
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
      check("the value computed in the worker arrived in main's store", answer, 42);
      check("main served the delivery continuation", e.delivered.value, 1);
      check("…and settled the task main created", e.gateSettled(), 1);
      check("main's own copy of the worker's observation is untouched",
        e.workerSawMain.value, -1);

      const result = await workerDone;
      check("the worker saw main's acknowledgement (direction 2)", result.saw, 7);
      check("the worker exited with the shell's status", result.status, 0);
      check("`__threadJoin` observes the exit", e.__threadJoin(1), 0);
    }
  }

  // ---------------------------------------------------------------------------
  // (e) cross-store await: a caller awaits a task whose body belongs to a worker.
  //
  // The caller is posted to main's own executor, because a task nobody drives
  // never runs. It creates `work()` `on` a `RemotePolicy`, which posts the
  // task's `$starts` entry (`TaskBase.entry`) to executor 1 instead of running
  // it here, and `await`s it: the policy parks and suspends with
  // `__suspendParked()`, the third payload. The worker serves `work`, replies
  // with `21 * 2` to the origin executor; main serves the reply, writes
  // `task.value` and settles the task, and the caller resumes.
  //
  // The row that separates "it worked" from "it worked by accident" is (e2):
  // the body must not have run in main's store at all.
  // ---------------------------------------------------------------------------

  console.log("\n# (e) a caller awaiting a task served in another store");
  {
    const built = compile(`
import { RemotePolicy } from "~lib/thread";
import {
  __spawnOn, __spawnThread, __serveArg, __serveOrigin, __serveKey,
  __executorExit, __selfExecutor, mainExecutor,
} from "~lib/thread";

let pending: Task<i32> | null = null;
let replyEntry: i32 = -1;
export let answer: i32 = -1;
export let bodyRanAtHome: i32 = 0;
export let resumed: i32 = 0;

async function leaf(): i32 { return 0; }

// The body the caller posts. It must run in the **worker's** store only.
async function work(): i32 {
  bodyRanAtHome = 1;
  let value = __serveArg();
  let reply = __serveKey();
  let origin = __serveOrigin();
  await leaf();
  __spawnOn(origin, reply, value * 2, 0);
  __executorExit(__selfExecutor());
  return 0;
}

// Served in main's store when the reply lands: settle the waiting task.
async function deliver(): i32 {
  let value = __serveArg();
  await leaf();
  let t = pending;
  if (t) {
    let task = changetype<Task<i32>>(t);
    task.value = value;
    task.settle(0);
  }
  return 0;
}

// Posted to main's own executor, so the caller really executes.
async function caller(): i32 {
  let policy = new RemotePolicy(1, 21, replyEntry);
  let t = work() on policy;
  pending = t;
  let v = await t;
  answer = v;
  resumed = resumed + 1;
  return 0;
}

export function boot(workerId: i32, callerStart: i32, replyStart: i32): i32 {
  replyEntry = replyStart;
  let r = __spawnThread(workerId, -1, 0);
  __spawnOn(0, callerStart, 0, 0);
  return r;
}

export function pump(): i32 {
  let e = mainExecutor();
  let guard = 0;
  while (e.inbox.depth > 0 || e.ready.depth > 0) {
    if (e.step(e)) break;
    if (++guard > 1000000) break;
  }
  return answer;
}

export async function main(): i32 { await leaf(); return 0; }
`, ["--runtime", "incremental", "--enable", "threads", "--sharedMemory",
      "--importMemory", "--maximumMemory", "128", "--enable", "stack-switching"]);
    check("the cross-store fixture compiles", built.ok, true);
    if (!built.ok) {
      console.log(built.output);
    } else {
      const names = startsOf(built.wat);
      const callerStart = names.indexOf("$probe/caller$spawnStart");
      const replyStart = names.indexOf("$probe/deliver$spawnStart");
      check("the transform synthesized the caller and reply entries",
        callerStart > 0 && replyStart > 0, true);
      check("the task carries its spawn entry as a constant (not a store lookup)",
        /spawnIndex\//.test(built.wat), true);

      const module = new WebAssembly.Module(built.bytes);
      const memory = new WebAssembly.Memory({ initial: 1, maximum: 128, shared: true });
      let workerDone = null;
      const env = {
        memory,
        abort: (a, b, c, d) => { throw new Error(`abort ${a} ${b} ${c} ${d}`); },
        __executorCount: () => 2,
        __startThread: (id) => {
          workerDone = new Promise((resolve, reject) => {
            const worker = new Worker(new URL(import.meta.url), {
              workerData: { role: "await", module, memory, id, total: 2 },
            });
            worker.on("message", resolve);
            worker.on("error", reject);
          });
          return 0;
        },
      };
      const e = new WebAssembly.Instance(module, { env }).exports;
      check("`__threadInit` carves the block", e.__threadInit(64), 0);
      e.__arenaInit(e.__mainArenaBase(), e.__mainArenaSize());
      check("`__start` runs the boot body", e.__start(), 0);
      check("the worker is spawned and the caller posted to main",
        e.boot(1, callerStart, replyStart), 0);

      const deadline = Date.now() + 10000;
      let answer = -1;
      while (Date.now() < deadline) {
        answer = e.pump();
        if (answer >= 0) break;
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
      check("(e1) the caller received the worker's value", answer, 42);
      check("(e2) the task's body did not run in main's store", e.bodyRanAtHome.value, 0);
      const result = await workerDone;
      check("(e3) the worker exited with the shell's status", result.status, 0);
      check("(e3) `__threadJoin` observes the worker's exit", e.__threadJoin(1), 0);
      check("(e4) the caller's continuation resumed exactly once", e.resumed.value, 1);
    }
  }

  if (failures) {
    console.error(`\ngate4: ${failures} of ${checks} checks failed`);
    process.exit(1);
  }
  console.log(`\n[ SUCCESS ] ${checks} checks`);
  process.exit(0);

}
