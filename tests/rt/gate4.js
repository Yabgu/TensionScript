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
    } else if (role === "await" || role === "plain") {
      // (e)/(f)–(i) have no `report()`: the worker's only output is what it
      // posts back as requests.
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


  // ---------------------------------------------------------------------------
  // (f) the thread identifier, and the mask arithmetic.
  //
  // `__selfExecutor()` is the identifier: 0 on main, the id `__workerMain` was
  // given in a worker. A worker's globals are store-local, so main cannot read
  // the worker's copy; the served body posts it back and main asserts on what
  // arrived. Absent the feature, `__selfExecutor` would answer 0 in both stores
  // and `maskAllows`/`executorMask` would not exist (the fixture would not
  // compile), so `reported == 1` is the row that protects the identity and the
  // six arithmetic rows protect the encoding.
  // ---------------------------------------------------------------------------

  console.log("\n# (f) the thread identifier and the mask arithmetic");
  {
    const built = compile(`
import {
  __spawnOn, __spawnThread, __serveArg, __serveOrigin, __serveKey,
  __executorExit, __selfExecutor, mainExecutor,
  executorMask, maskAllows, maskUnion,
} from "~lib/thread";

export let reported: i32 = -1;

async function leaf(): i32 { return 0; }

// Served in the worker: its only output is the id it posts back.
async function identify(): i32 {
  let reply = __serveKey();
  let origin = __serveOrigin();
  let id = __selfExecutor();
  await leaf();
  __spawnOn(origin, reply, id, 0);
  __executorExit(__selfExecutor());
  return 0;
}

// Served in main: record the id that arrived.
async function receive(): i32 {
  let value = __serveArg();
  await leaf();
  reported = value;
  return 0;
}

export function boot(workerId: i32, identifyStart: i32, receiveStart: i32): i32 {
  let r = __spawnThread(workerId, -1, 0);
  __spawnOn(workerId, identifyStart, 0, receiveStart);
  return r;
}

export function pump(): i32 {
  let e = mainExecutor();
  let guard = 0;
  while (e.inbox.depth > 0 || e.ready.depth > 0) {
    if (e.step(e)) break;
    if (++guard > 1000000) break;
  }
  return reported;
}

export function selfId(): i32 { return __selfExecutor(); }
export function maskOf(id: i32): i32 { return executorMask(id); }
export function allows(mask: i32, id: i32): bool { return maskAllows(mask, id); }
export function union(a: i32, b: i32): i32 { return maskUnion(a, b); }

export async function main(): i32 { await leaf(); return 0; }
`, ["--runtime", "incremental", "--enable", "threads", "--sharedMemory",
      "--importMemory", "--maximumMemory", "128", "--enable", "stack-switching"]);
    check("the identity fixture compiles", built.ok, true);
    if (!built.ok) {
      console.log(built.output);
    } else {
      const names = startsOf(built.wat);
      const identifyStart = names.indexOf("$probe/identify$spawnStart");
      const receiveStart = names.indexOf("$probe/receive$spawnStart");
      check("the identity fixture has both spawn entries",
        identifyStart > 0 && receiveStart > 0, true);

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
              workerData: { role: "plain", module, memory, id, total: 2 },
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
      check("main is executor 0", e.selfId(), 0);
      check("the worker is spawned and the request posted",
        e.boot(1, identifyStart, receiveStart), 0);

      const deadline = Date.now() + 10000;
      let reported = -1;
      while (Date.now() < deadline) {
        reported = e.pump();
        if (reported >= 0) break;
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
      check("(f1) main received the worker's own executor id", reported, 1);
      check("(f2) executorMask(0) is {0}", e.maskOf(0), 1);
      check("(f2) executorMask(1) is {1}", e.maskOf(1), 2);
      check("(f2) executorMask(32) is out of range", e.maskOf(32), 0);
      check("(f3) mask 0 is unconstrained", e.allows(0, 7), 1);
      check("(f4) {0} forbids worker 1", e.allows(1, 1), 0);
      check("(f4) {1} allows worker 1", e.allows(2, 1), 1);
      check("(f5) maskUnion(1, 2) is 3", e.union(1, 2), 3);
      const result = await workerDone;
      check("(f6) the worker exited with the shell's status", result.status, 0);
      check("(f6) `__threadJoin` observes the exit", e.__threadJoin(1), 0);
    }
  }

  // ---------------------------------------------------------------------------
  // (g) admission refuses, and stays refused.
  //
  // `__spawnOnMasked(1, {0}, …)` names a target the mask forbids. The runtime
  // must answer -1, count one refusal, and post **nothing** — no silent drop
  // (the worker's copy of `received` stays 0) and no redirection. The second,
  // allowed post is the control: the channel is not broken, the mask was the
  // reason. Without admission there would be no -1 and no counter, and the
  // worker's body would run on the first post.
  // ---------------------------------------------------------------------------

  console.log("\n# (g) admission refuses a disallowed target");
  {
    const built = compile(`
import {
  __spawnOnMasked, __spawnThread, __serveArg, __serveOrigin, __serveKey,
  __executorExit, __selfExecutor, __maskRefusals, mainExecutor,
} from "~lib/thread";

export let refused: i32 = 0;
export let allowed: i32 = -1;
export let received: i32 = 0;

async function leaf(): i32 { return 0; }

// Served in the worker: the flag 1 is the proof the body ran.
async function work(): i32 {
  let reply = __serveKey();
  let origin = __serveOrigin();
  await leaf();
  __spawnOn(origin, reply, 1, 0);
  __executorExit(__selfExecutor());
  return 0;
}

async function deliver(): i32 {
  let value = __serveArg();
  await leaf();
  received = value;
  return 0;
}

export function boot(workerId: i32, workStart: i32, deliverStart: i32): i32 {
  let status = __spawnThread(workerId, -1, 0);
  // mask {0} onto worker 1: refused, counted, and not posted.
  refused = __spawnOnMasked(workerId, 1, workStart, 0, deliverStart);
  return status;
}

export function postAllowed(workStart: i32, deliverStart: i32): i32 {
  // mask {1}: worker 1 is allowed, so the same call must return 0.
  allowed = __spawnOnMasked(1, 2, workStart, 0, deliverStart);
  return allowed;
}

export function refusals(): i32 { return __maskRefusals(); }

export function pump(): i32 {
  let e = mainExecutor();
  let guard = 0;
  while (e.inbox.depth > 0 || e.ready.depth > 0) {
    if (e.step(e)) break;
    if (++guard > 1000000) break;
  }
  return received;
}

export async function main(): i32 { await leaf(); return 0; }
`, ["--runtime", "incremental", "--enable", "threads", "--sharedMemory",
      "--importMemory", "--maximumMemory", "128", "--enable", "stack-switching"]);
    check("the admission fixture compiles", built.ok, true);
    if (!built.ok) {
      console.log(built.output);
    } else {
      const names = startsOf(built.wat);
      const workStart = names.indexOf("$probe/work$spawnStart");
      const deliverStart = names.indexOf("$probe/deliver$spawnStart");
      check("the admission fixture has both spawn entries",
        workStart > 0 && deliverStart > 0, true);

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
              workerData: { role: "plain", module, memory, id, total: 2 },
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
      check("the worker is spawned", e.boot(1, workStart, deliverStart), 0);
      check("(g1) the disallowed post is refused with -1", e.refused.value, -1);
      check("(g2) the refusal is counted, once", e.refusals(), 1);

      // Give the worker time to misbehave if it could: it must not.
      await new Promise((resolve) => setTimeout(resolve, 150));
      e.pump();
      check("(g3) the refused body never ran (nothing was posted)", e.received.value, 0);

      check("(g4) the same channel posts when the mask allows it",
        e.postAllowed(workStart, deliverStart), 0);
      const deadline = Date.now() + 10000;
      let received = 0;
      while (Date.now() < deadline) {
        received = e.pump();
        if (received > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
      check("(g5) the allowed body ran and reported back", received, 1);
      check("(g6) no second refusal was counted", e.refusals(), 1);
      const result = await workerDone;
      check("(g7) the worker exited with the shell's status", result.status, 0);
      check("(g7) `__threadJoin` observes the exit", e.__threadJoin(1), 0);
    }
  }

  // ---------------------------------------------------------------------------
  // (h) a masked policy places work — (e) with the mask present and satisfied.
  //
  // The caller runs in main and creates `work() on new MaskedPolicy(1, {1}, …)`:
  // the mask allows the worker, so `create` posts and the reply settles the
  // task. The body's store-local flag cannot be read from main, so the body
  // posts one more request to a continuation whose index it reads from a
  // locally created task (`TaskBase.entry` is a module constant), and main
  // asserts on the 1 it received. Without the mask, the post is unchecked and
  // the same answer arrives — the row that distinguishes this from (e) is that
  // the policy's mask is {1} and the placement is the one it permits.
  // ---------------------------------------------------------------------------

  console.log("\n# (h) a masked policy places work");
  {
    const built = compile(`
import { MaskedPolicy } from "~lib/thread";
import {
  __spawnOn, __spawnThread, __serveArg, __serveOrigin, __serveKey,
  __executorExit, __selfExecutor, mainExecutor,
} from "~lib/thread";

let pending: Task<i32> | null = null;
let replyEntry: i32 = -1;
export let answer: i32 = -1;
export let workerId: i32 = -1;
export let bodyRanAtHome: i32 = 0;
export let resumed: i32 = 0;

async function leaf(): i32 { return 0; }

// Served in the worker: answer 42 and prove the store it ran in by posting
// **its own executor id** in the request's key word (a store-local fact can
// cross only as a request argument).
async function work(): i32 {
  bodyRanAtHome = 1;
  let value = __serveArg();
  let reply = __serveKey();
  let origin = __serveOrigin();
  await leaf();
  __spawnOn(origin, reply, value * 2, __selfExecutor());
  __executorExit(__selfExecutor());
  return 0;
}

// Served in main: settle the waiting task, and record the poster's id.
async function deliver(): i32 {
  let value = __serveArg();
  let from = __serveKey();
  await leaf();
  workerId = from;
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
  let policy = new MaskedPolicy(1, 2, 21, replyEntry); // mask {1}: the worker
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
    check("the masked-policy fixture compiles", built.ok, true);
    if (!built.ok) {
      console.log(built.output);
    } else {
      const names = startsOf(built.wat);
      const callerStart = names.indexOf("$probe/caller$spawnStart");
      const replyStart = names.indexOf("$probe/deliver$spawnStart");
      check("the masked-policy fixture has the caller and reply entries",
        callerStart > 0 && replyStart > 0, true);

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
              workerData: { role: "plain", module, memory, id, total: 2 },
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
      check("(h1) the caller received the worker's value", answer, 42);
      check("(h2) the body ran in the worker, not in main", e.bodyRanAtHome.value, 0);
      check("(h3) the worker's own id came back as 1", e.workerId.value, 1);
      check("(h4) the caller resumed exactly once", e.resumed.value, 1);
      const result = await workerDone;
      check("(h5) the worker exited with the shell's status", result.status, 0);
      check("(h5) `__threadJoin` observes the exit", e.__threadJoin(1), 0);
    }
  }

  // ---------------------------------------------------------------------------
  // (i) a park on a disallowed executor is counted, and not fatal.
  //
  // The outer request is posted with the **unmasked** `__spawnOn`, so nothing
  // checked it; inside the worker's store a task is created under a policy that
  // sets mask {0}, and it is driven here anyway. When it suspends, `__parkOn`
  // sees the current task's mask forbids this executor and counts a violation —
  // and the task still settles, so the answer arrives. The count must be the
  // worker's (store-local), so the worker posts it back in the request's key
  // word. Without the park check the worker would report 0; without the park
  // proceeding the answer would never arrive.
  // ---------------------------------------------------------------------------

  console.log("\n# (i) a violation at park is counted, not silent");
  {
    const built = compile(`
import { TaskBase, TaskPolicy } from "~lib/task";
import {
  __spawnOn, __spawnThread, __serveArg, __serveOrigin, __serveKey,
  __executorExit, __selfExecutor, __maskViolations, executorMask, mainExecutor,
} from "~lib/thread";

export let answer: i32 = -1;
export let violations: i32 = -1;

async function leaf(): i32 { return 0; }

// A **real** suspension: await 1 is not a task, but its presence makes this
// function a task, so awaiting it parks the caller in f$Rec#drive. (leaf above
// has no await and is therefore an ordinary function — await leaf() is a no-op.)
async function yieldPoint(): i32 { await 1; return 0; }

// The task that parks in a store its mask forbids.
async function inner(): i32 {
  await yieldPoint();
  return 3;
}

@final class MainOnly extends TaskPolicy {
  create(task: TaskBase): void { task.mask = executorMask(0); } // {0}
  await(task: TaskBase): void { task.drive(); }
}

// Served in the worker by the unmasked __spawnOn. The task it creates here
// carries {0} and is driven here regardless: the mask is observable at the
// park, not enforced at the request.
async function misplaced(): i32 {
  let origin = __serveOrigin();
  let reply = __serveKey();
  let policy = new MainOnly();
  let t = inner() on policy;
  let v = await t;
  __spawnOn(origin, reply, v, __maskViolations());
  __executorExit(__selfExecutor());
  return 0;
}

// Served in main: the value in the argument word, the worker's count in the key.
async function receive(): i32 {
  let value = __serveArg();
  let count = __serveKey();
  await leaf();
  answer = value;
  violations = count;
  return 0;
}

export function boot(workerId: i32, misplacedStart: i32, receiveStart: i32): i32 {
  let r = __spawnThread(workerId, -1, 0);
  __spawnOn(workerId, misplacedStart, 0, receiveStart);
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
    check("the violation fixture compiles", built.ok, true);
    if (!built.ok) {
      console.log(built.output);
    } else {
      const names = startsOf(built.wat);
      const misplacedStart = names.indexOf("$probe/misplaced$spawnStart");
      const receiveStart = names.indexOf("$probe/receive$spawnStart");
      check("the violation fixture has both spawn entries",
        misplacedStart > 0 && receiveStart > 0, true);

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
              workerData: { role: "plain", module, memory, id, total: 2 },
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
      check("the worker is spawned and the unmasked post sent",
        e.boot(1, misplacedStart, receiveStart), 0);

      const deadline = Date.now() + 10000;
      let answer = -1;
      while (Date.now() < deadline) {
        answer = e.pump();
        if (answer >= 0) break;
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
      check("(i1) the task settled normally: the answer arrived", answer, 3);
      check("(i2) the worker counted the park as a violation (not main)",
        e.violations.value, 1);
      const result = await workerDone;
      check("(i3) the worker exited with the shell's status", result.status, 0);
      check("(i3) `__threadJoin` observes the exit", e.__threadJoin(1), 0);
    }
  }

  if (failures) {
    console.error(`\ngate4: ${failures} of ${checks} checks failed`);
    process.exit(1);
  }
  console.log(`\n[ SUCCESS ] ${checks} checks`);
  process.exit(0);

}
