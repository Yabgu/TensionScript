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
//   (e)–(i) are the identity and mask round: a cross-store await, the thread
//       identifier, admission, a masked policy, and a park on a forbidden store.
//
//   (j)–(l) are the round the mask became a template: the width arithmetic for
//       both instantiations (and the record's offsets, which must not move),
//       an admission refusal that can only be the mask's width, and a mask the
//       std does not provide — a program-written `MaskBase`.
//
//   (m)–(n) are the round the serve context moved onto the task: three requests
//       queued before any is served (each body must read its **own** argument,
//       not the drain's last one), and a served body that serves again from
//       inside itself (the outer context must survive the nested drain).
//
// Node is required, with `--experimental-wasm-wasmfx` (measured: without it,
// `core stack switching not enabled`), because `wasmtime wast` cannot
// instantiate a shared-memory module.
//
// Run: node --experimental-wasm-wasmfx tests/rt/gate4.js

import { execFileSync } from "node:child_process";

/**
 * **The `scheduler` namespace, stubbed, and loud** (DL43).
 *
 * A stackful build imports `scheduler::park` whether or not it parks, because
 * `~lib/task-stack`'s `__parkRemote` is an *exported* std entry and so a
 * dead-code-elimination root — the compiler cannot tell from the root set whether a
 * program will call it. The host's worker linker documents the same situation for
 * `parkState` (`thread.rs`, `link_worker`).
 *
 * **What it must do, and the two cases are not the same** (DL44, I106).
 *
 * A **keyless** park — `(class, key) = (0, 0)` — is the contract's "nothing external
 * will complete this": the waiter is a task in this store, and the store's own
 * `settle` pushes it onto the ready ring. The host's job is to record it and return,
 * which is exactly what the real linker does (`thread.rs`: "the park is recorded and
 * the call returns"). So the stub records and returns; it does **not** throw. It used
 * to throw, on the belief that no fixture here parks — true until DL43 taught the
 * continuation policy await to register, at which point the cross-store fixture
 * reaches this call for the first time and the throw became a false failure.
 *
 * A **keyed** park names a `(class, key)` producer, and no fixture in this file has
 * one. That case stays loud: swallowing it would turn "this program now depends on a
 * producer the harness does not have" into a silent strand.
 */
const parks = [];
const schedulerImports = {
  scheduler: {
    park: (taskId, class_, key) => {
      parks.push({ taskId, class_, key });
      if (class_ !== 0 || key !== 0) {
        throw new Error(
          `scheduler::park named a producer (class ${class_}, key ${key}) that no Gate 4 ` +
            "fixture has — a keyed park here would strand silently, so it is refused",
        );
      }
    },
  },
};

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
    // **The worker's own `scheduler` stub** (DL44, I106). A worker instance imports
    // exactly what main's does, and a stackful module imports `scheduler::park`
    // whether or not it parks. Keyless parks are recorded and returned; a keyed one
    // would name a producer this harness does not have, so it is refused loudly —
    // the same rule the main-thread stub applies.
    scheduler: {
      park: (taskId, class_, key) => {
        if (class_ !== 0 || key !== 0) {
          throw new Error(
            `worker: scheduler::park named a producer (class ${class_}, key ${key}) that ` +
              "no Gate 4 fixture has",
          );
        }
      },
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

  // Wasmfx availability, asked of the engine rather than of the argv. Only the
  // engine's own "core stack switching not enabled" is a skip; every other
  // error is a real failure and must not be hidden.
  {
    const probe = compile(`
async function leaf(): i32 { await 1; return 0; }
export async function main(): i32 { await leaf(); return 0; }
`, ["--runtime", "stub", "--enable", "stack-switching"]);
    if (probe.ok) {
      try {
        new WebAssembly.Module(probe.bytes);
      } catch (error) {
        const message = String(error && error.message || error);
        if (/core stack switching not enabled/.test(message)) {
          console.log("SKIP: Node was not started with --experimental-wasm-wasmfx (core stack switching not enabled)");
          process.exit(0);
        }
        throw error;
      }
    }
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
      const consumer = new WebAssembly.Instance(module, { env, ...schedulerImports }).exports;
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
      const e = new WebAssembly.Instance(module, { env, ...schedulerImports }).exports;

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
      const e = new WebAssembly.Instance(module, { env, ...schedulerImports }).exports;
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
  // (f) the thread identifier, and the mask over the template.
  //
  // `__selfExecutor()` is the identifier: 0 on main, the id `__workerMain` was
  // given in a worker. A worker's globals are store-local, so main cannot read
  // the worker's copy; the served body posts it back and main asserts on what
  // arrived. Absent the feature, `__selfExecutor` would answer 0 in both stores
  // and `Mask` would not exist (the fixture would not compile), so
  // `reported == 1` is the row that protects the identity and the mask rows
  // protect the surface the template exposes through `~lib/thread` — which is
  // the re-export, not a second arithmetic.
  // ---------------------------------------------------------------------------

  console.log("\n# (f) the thread identifier and the mask");
  {
    const built = compile(`
import {
  __spawnOn, __spawnThread, __serveArg, __serveOrigin, __serveKey,
  __executorExit, __selfExecutor, mainExecutor, Mask,
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
// {0}: executor 0 is allowed, 1 is not.
export function allowsMain(): bool { return new Mask<u32>(1).allows(0); }
export function forbidsWorker(): bool { return new Mask<u32>(1).allows(1); }
// {1}: the other way round.
export function allowsWorker(): bool { return new Mask<u32>(2).allows(1); }
// {0} | {1} = {0,1}, and an unconstrained mask absorbs the union.
export function unionBits(): i32 { return new Mask<u32>(1).union(new Mask<u32>(2)).bits; }
export function unionZero(): i32 { return new Mask<u32>(0).union(new Mask<u32>(2)).bits; }

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
      const e = new WebAssembly.Instance(module, { env, ...schedulerImports }).exports;
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
      check("(f2) {0} allows main", e.allowsMain(), 1);
      check("(f2) {0} forbids worker 1", e.forbidsWorker(), 0);
      check("(f3) {1} allows worker 1", e.allowsWorker(), 1);
      check("(f4) {0} | {1} is 3", e.unionBits(), 3);
      check("(f5) unconstrained absorbs the union", e.unionZero(), 0);
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
  __executorExit, __selfExecutor, __maskRefusals, mainExecutor, Mask,
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
  refused = __spawnOnMasked(workerId, new Mask<u32>(1), workStart, 0, deliverStart);
  return status;
}

export function postAllowed(workStart: i32, deliverStart: i32): i32 {
  // mask {1}: worker 1 is allowed, so the same call must return 0.
  allowed = __spawnOnMasked(1, new Mask<u32>(2), workStart, 0, deliverStart);
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
      const e = new WebAssembly.Instance(module, { env, ...schedulerImports }).exports;
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
  //
  // The mask is a **reference**: `sameMask` asserts the task carries the very
  // object the policy holds, not a copy of its bits.
  // ---------------------------------------------------------------------------

  console.log("\n# (h) a masked policy places work");
  {
    const built = compile(`
import { MaskedPolicy, Mask, MaskBase } from "~lib/thread";
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
export let sameMask: i32 = 0;

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
  let policy = new MaskedPolicy(1, new Mask<u32>(2), 21, replyEntry); // {1}: the worker
  let t = work() on policy;
  pending = t;
  // The task's mask is the policy's mask object, not a copy of its bits.
  let carried = t.mask;
  if (carried != null && changetype<MaskBase>(carried) == policy.mask) sameMask = 1;
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
      const e = new WebAssembly.Instance(module, { env, ...schedulerImports }).exports;
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
      check("(h4) the task holds the policy's mask object, not a copy",
        e.sameMask.value, 1);
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
  __executorExit, __selfExecutor, __maskViolations, mainExecutor, Mask,
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
  create(task: TaskBase): void { task.mask = new Mask<u32>(1); } // {0}
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
      const e = new WebAssembly.Instance(module, { env, ...schedulerImports }).exports;
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

  // ---------------------------------------------------------------------------
  // (j) the template's arithmetic, at both widths.
  //
  // The mask is `Mask<T>`, not an `i32`: `T` decides how many executor ids it
  // can name, so `Mask<u64>` is a 64-executor mask with no runtime change — the
  // ABI asks the mask, it does not count bits. `bits == 0` is unconstrained, so
  // `allows` answers `true` for an id no bit names.
  //
  // The shifts are computed **in `T`** (`<u64>1 << <u64>40`), which is the
  // whole reason the template exists: the old `i32` arithmetic wrapped 40 to 8
  // (wasm's shift count is mod the operand width), so a 32-bit mask could not
  // even be asked about bit 40 without lying.
  //
  // The last two rows are the record. `mask` became a reference and, on wasm32,
  // a reference is four bytes — the same as the `i32` it replaced — so the field
  // stayed at 28: `offsetof("mask")` is the row that would move if the mask had
  // cost the record anything. The base record is 44 bytes now, not the 32 of
  // that round: the three serve words (`serveArg`/`serveKey`/`serveOrigin`) are
  // appended after `mask`, so nothing earlier moves and `_record` shifts by the
  // twelve bytes they add. The `tests/compiler` fixture diff is that shift —
  // field accessors plus offsets, nothing semantic.
  // ---------------------------------------------------------------------------

  console.log("\n# (j) the mask template's arithmetic at both widths");
  {
    const built = compile(`
import { Mask } from "~lib/mask";
import { Task } from "~lib/task";

export function u32Bit31(): bool { return new Mask<u32>(<u32>1 << <u32>31).allows(31); }
export function u32One31(): bool { return new Mask<u32>(1).allows(31); }
export function u64Bit40(): bool { return new Mask<u64>(<u64>1 << <u64>40).allows(40); }
export function u64Bit40On8(): bool { return new Mask<u64>(<u64>1 << <u64>40).allows(8); }
export function u64Zero40(): bool { return new Mask<u64>(0).allows(40); }
export function u64Bit63(): bool { return new Mask<u64>(<u64>1 << <u64>63).allows(63); }
export function width32(): i32 { return new Mask<u32>(1).width; }
export function width64(): i32 { return new Mask<u64>(1).width; }
export function with40(): u64 { return new Mask<u64>(1).with(40).bits; }
export function unionBits(): u32 { return new Mask<u32>(1).union(new Mask<u32>(2)).bits; }
export function unnameable(): bool { return new Mask<u32>(1).allows(40); }
export function offsetMask(): i32 { return offsetof<Task<i32>>("mask"); }
export function offsetServeArg(): i32 { return offsetof<Task<i32>>("serveArg"); }
export function offsetServeKey(): i32 { return offsetof<Task<i32>>("serveKey"); }
export function offsetServeOrigin(): i32 { return offsetof<Task<i32>>("serveOrigin"); }
// recordValue, not _record (DL44): the record is an accessor pair over a nullable
// store now (a non-null field could not stay non-null without trapping a stackful
// park inside its own getter), so the field a subclass's members start after is the
// store. Same word, same offset: this row is what would move if it were not.
export function offsetAfterBase(): i32 { return offsetof<Task<i32>>("recordValue"); }
`, ["--runtime", "incremental"]);
    check("the width fixture compiles", built.ok, true);
    if (!built.ok) {
      console.log(built.output);
    } else {
      const module = new WebAssembly.Module(built.bytes);
      const e = new WebAssembly.Instance(module, {
        env: { abort: (a, b, c, d) => { throw new Error(`abort ${a} ${b} ${c} ${d}`); } },
      }).exports;
      check("(j1) u32: <u32>1 << <u32>31 allows 31", e.u32Bit31(), 1);
      check("(j2) u32: 1 does not allow 31", e.u32One31(), 0);
      check("(j3) u64: <u64>1 << <u64>40 allows 40", e.u64Bit40(), 1);
      check("(j4) u64: <u64>1 << <u64>40 does not allow 8", e.u64Bit40On8(), 0);
      check("(j5) u64: 0 bits is unconstrained", e.u64Zero40(), 1);
      check("(j6) u64: <u64>1 << <u64>63 allows 63", e.u64Bit63(), 1);
      check("(j7) width of Mask<u32>", e.width32(), 32);
      check("(j7) width of Mask<u64>", e.width64(), 64);
      // 2^40 + 1, exactly: the shift is 64-bit, so bit 40 survives.
      check("(j8) with(40) on {0} sets bit 40", Number(e.with40()), 1099511627777);
      check("(j9) {0} | {1} is 3", e.unionBits(), 3);
      // The mask has no opinion about an id it cannot name; the seams decide.
      check("(j10) u32 mask has no opinion about id 40", e.unnameable(), 1);
      check("(j11) TaskBase.mask is still at offset 28", e.offsetMask(), 28);
      // The serve context is appended **after** `mask`, so every field the
      // earlier rounds observed keeps its offset and only the record's size
      // changes: the first subclass field moves from 32 to 44.
      check("(j11) the serve context starts at 32",
        [e.offsetServeArg(), e.offsetServeKey(), e.offsetServeOrigin()], [32, 36, 40]);
      check("(j11) the base record is 44 bytes (was 32 before the serve context)",
        e.offsetAfterBase(), 44);
    }
  }

  // ---------------------------------------------------------------------------
  // (k) admission refuses a target past the old ceiling.
  //
  // The harness fixes `__executorCount()` at 2, so a 33-executor process is not
  // available; the *rule* is testable anyway because the two refusal reasons are
  // distinguishable. The width check answers `-1` and counts a refusal; a
  // missing executor answers `-2` and counts nothing. `narrow()` posts to target
  // 40 with `Mask<u32>` — a mask that names only 0..31 — and gets `-1` plus one
  // refusal. `wide()` posts to the **same** target with `Mask<u64>` whose bit 40
  // is set: the mask names it and allows it, the width check passes, the post is
  // attempted, and there is no executor 40 → `-2`, count unchanged. Had the
  // width check been absent, `narrow()` would be `-2` with the count at 0,
  // because `Mask<u32>.allows(40)` answers `true` (row (j10)) — so nothing else
  // in the path can produce `-1`, which is what makes the width the only reason.
  // ---------------------------------------------------------------------------

  console.log("\n# (k) admission refuses a target past the mask's width");
  {
    const built = compile(`
import { Mask, __spawnOnMasked, __maskRefusals } from "~lib/thread";

async function leaf(): i32 { return 0; }

const TARGET: i32 = 40; // no executor 40 exists here, and no Mask<u32> can name it

export function narrow(): i32 {
  return __spawnOnMasked(TARGET, new Mask<u32>(0x80000000), 0, 0, 0);
}

export function wide(): i32 {
  return __spawnOnMasked(TARGET, new Mask<u64>(<u64>1 << <u64>40), 0, 0, 0);
}

export function unconstrained(): i32 {
  return __spawnOnMasked(TARGET, null, 0, 0, 0);
}

export function refusals(): i32 { return __maskRefusals(); }

export async function main(): i32 { await leaf(); return 0; }
`, ["--runtime", "incremental", "--enable", "threads",
      "--enable", "stack-switching"]);
    check("the ceiling fixture compiles", built.ok, true);
    if (!built.ok) {
      console.log(built.output);
    } else {
      const module = new WebAssembly.Module(built.bytes);
      const e = new WebAssembly.Instance(module, {
        env: {
          abort: (a, b, c, d) => { throw new Error(`abort ${a} ${b} ${c} ${d}`); },
          __executorCount: () => 2,
          __startThread: () => -1,
        },
      }).exports;
      check("(k1) a Mask<u32> cannot admit target 40: -1", e.narrow(), -1);
      check("(k2) and the refusal is counted", e.refusals(), 1);
      check("(k3) a Mask<u64> names 40, so the post is attempted (no executor 40 → -2)",
        e.wide(), -2);
      check("(k4) a null mask posts unchecked (→ -2 as well)", e.unconstrained(), -2);
      check("(k5) neither attempted post counted a refusal", e.refusals(), 1);
    }
  }

  // ---------------------------------------------------------------------------
  // (l) a `MaskBase` the std does not provide.
  //
  // The reason `TaskBase.mask` is a **reference** is that the ABI has no width:
  // it asks `allows` and `width` and nothing else. So a program can ship its own
  // representation — here two `u32` words, 64 bits, with a hand-rolled `allows`
  // — and `MaskedPolicy` places work under it exactly as it does under
  // `Mask<u32>`. `work() on new MaskedPolicy(1, new TwoWordMask(2, 0), 21, reply)`
  // must answer 42 with the body in the worker: the placement decided by a mask
  // no std file ever saw.
  // ---------------------------------------------------------------------------

  console.log("\n# (l) a program-written MaskBase places work");
  {
    const built = compile(`
import { MaskBase, MaskedPolicy } from "~lib/thread";
import {
  __spawnOn, __spawnThread, __serveArg, __serveOrigin, __serveKey,
  __executorExit, __selfExecutor, mainExecutor,
} from "~lib/thread";

let pending: Task<i32> | null = null;
let replyEntry: i32 = -1;
export let answer: i32 = -1;
export let workerId: i32 = -1;
export let bodyRanAtHome: i32 = 0;

/** 64 bits in two 32-bit words: the std has no such mask, and does not need one. */
@final class TwoWordMask extends MaskBase {
  lo: u32;
  hi: u32;
  constructor(lo: u32, hi: u32) {
    super();
    this.lo = lo;
    this.hi = hi;
  }
  get width(): i32 { return 64; }
  allows(id: i32): bool {
    if (id < 0 || id >= 64) return true; // no opinion about what it cannot name
    if (id < 32) return (this.lo & (1 << id)) != 0;
    return (this.hi & (1 << (id - 32))) != 0;
  }
}

async function leaf(): i32 { return 0; }

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

async function caller(): i32 {
  // {1} in the low word: executor 1 allowed, in a mask with no std type.
  let policy = new MaskedPolicy(1, new TwoWordMask(2, 0), 21, replyEntry);
  let t = work() on policy;
  pending = t;
  let v = await t;
  answer = v;
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
    check("the program-mask fixture compiles", built.ok, true);
    if (!built.ok) {
      console.log(built.output);
    } else {
      const names = startsOf(built.wat);
      const callerStart = names.indexOf("$probe/caller$spawnStart");
      const replyStart = names.indexOf("$probe/deliver$spawnStart");
      check("the program-mask fixture has the caller and reply entries",
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
      const e = new WebAssembly.Instance(module, { env, ...schedulerImports }).exports;
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
      check("(l1) the caller received the worker's value", answer, 42);
      check("(l2) the body ran in the worker, not in main", e.bodyRanAtHome.value, 0);
      check("(l3) the worker's own id came back as 1", e.workerId.value, 1);
      const result = await workerDone;
      check("(l4) the worker exited with the shell's status", result.status, 0);
      check("(l4) `__threadJoin` observes the exit", e.__threadJoin(1), 0);
    }
  }

  // ---------------------------------------------------------------------------
  // (m) three requests queued before any is served: each body reads its own.
  //
  // `__drainInbox` serves the **whole** queue before any ready slot runs, and
  // `$starts[funcIndex]` is `f$spawnStart` — which creates a task and parks the
  // served continuation on it without running the body. So a request word kept
  // only in module state names the *last* request by the time a body reads it,
  // and three posts of 11, 22, 33 answered 33, 33, 33 (measured: sum 99). The
  // context lives on the task, so identity of the three replies — not their
  // order — is what this row asserts.
  // ---------------------------------------------------------------------------

  console.log("\n# (m) queued requests: every body reads its own argument");
  {
    const built = compile(`
import {
  __spawnOn, __spawnThread, __serveArg, __serveOrigin, __serveKey,
  __executorExit, __selfExecutor, mainExecutor,
} from "~lib/thread";

const N: i32 = 3;
let seen: i32 = 0;
let sum: i32 = 0;
// Bit (value / 11 - 1): a reply of 11 sets 0x1, 22 sets 0x2, 33 sets 0x4.
let multiset: i32 = 0;

export function seenCount(): i32 { return seen; }
export function sumValue(): i32 { return sum; }
export function multisetBits(): i32 { return multiset; }

export let replyOrigin: i32 = -1;

async function leaf(): i32 { return 0; }

// Served in the worker: read the argument **first**, echo it to the poster.
async function work(): i32 {
  let value = __serveArg();
  let reply = __serveKey();
  let origin = __serveOrigin();
  await leaf();
  __spawnOn(origin, reply, value, 0);
  return 0;
}

// Served in main: collect one reply; the third one ends main's loop.
async function collect(): i32 {
  let value = __serveArg();
  let from = __serveOrigin();
  await leaf();
  ++seen;
  sum += value;
  let index = value / 11 - 1;
  if (index >= 0 && index < 8) multiset |= 1 << index;
  replyOrigin = from;
  if (seen == N) __executorExit(__selfExecutor());
  return 0;
}

// Three posts, back to back, with no pump between them: all three are in the
// worker's inbox before the first one is served.
export function boot(workerId: i32, workStart: i32, collectStart: i32): i32 {
  let r = __spawnThread(workerId, -1, 0);
  for (let i = 1; i <= N; ++i) __spawnOn(workerId, workStart, i * 11, collectStart);
  return r;
}

export function pump(): i32 {
  let e = mainExecutor();
  let guard = 0;
  while (e.inbox.depth > 0 || e.ready.depth > 0) {
    if (e.step(e)) break;
    if (++guard > 1000000) break;
  }
  return seen;
}

export async function main(): i32 { await leaf(); return 0; }
`, ["--runtime", "incremental", "--enable", "threads", "--sharedMemory",
      "--importMemory", "--maximumMemory", "128", "--enable", "stack-switching"]);
    check("the queued-request fixture compiles", built.ok, true);
    if (!built.ok) {
      console.log(built.output);
    } else {
      const names = startsOf(built.wat);
      const workStart = names.indexOf("$probe/work$spawnStart");
      const collectStart = names.indexOf("$probe/collect$spawnStart");
      check("the queued-request fixture has both spawn entries",
        workStart > 0 && collectStart > 0, true);

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
      const e = new WebAssembly.Instance(module, { env, ...schedulerImports }).exports;
      check("`__threadInit` carves the block", e.__threadInit(64), 0);
      e.__arenaInit(e.__mainArenaBase(), e.__mainArenaSize());
      check("`__start` runs the boot body", e.__start(), 0);
      check("the worker is spawned and all three requests posted",
        e.boot(1, workStart, collectStart), 0);

      const deadline = Date.now() + 10000;
      let seen = -1;
      while (Date.now() < deadline) {
        seen = e.pump();
        if (seen >= 3) break;
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
      check("(m1) all three requests were served", e.seenCount(), 3);
      // The multiset, not the order: 0x7 is exactly {11, 22, 33}. Before the
      // context moved onto the task this row was 0x4 — all three replies 33.
      check("(m2) the three replies are exactly {11, 22, 33}", e.multisetBits(), 7);
      check("(m3) …and their sum is 66, not 99", e.sumValue(), 66);
      // Main's collector is served by a request the **worker** posted, so the
      // origin word is the worker's executor id — the third request word
      // travelling as the served task's own.
      check("(m4) every reply names the posting executor as its origin",
        e.replyOrigin.value, 1);
      check("(m5) the worker is told to exit", e.__executorExit(1), 0);
      const result = await workerDone;
      check("(m5) the worker exited with the shell's status", result.status, 0);
      check("(m5) `__threadJoin` observes the exit", e.__threadJoin(1), 0);
    }
  }

  // ---------------------------------------------------------------------------
  // (n) a served body that serves again, from inside itself.
  //
  // With the request's words on the task, the outer body's context is its task's
  // and a nested drain cannot overwrite it — but only if the **current slot** is
  // restored when a resume returns, because `__currentTask()` reads it. Without
  // that restore the outer body answered 22 after the nested serve (measured),
  // which is the inner request's argument: the two words had the same lifetime
  // in the slot table that they used to have in the globals.
  // ---------------------------------------------------------------------------

  console.log("\n# (n) a served body that serves its own inbox is reentrant");
  {
    const built = compile(`
import {
  __spawnOn, __drainInbox, __serveArg, __serveKey, __serveOrigin,
  mainExecutor, __selfExecutor,
} from "~lib/thread";

export let outerBefore: i32 = -1;
export let outerAfter: i32 = -1;
export let afterAwait: i32 = -1;
export let innerSaw: i32 = -1;
export let innerKey: i32 = -1;
let innerStart: i32 = -1;

async function leaf(): i32 { return 0; }

async function inner(): i32 {
  innerSaw = __serveArg();
  innerKey = __serveKey();
  await leaf();
  return 0;
}

// Served in this store. Posts a second request at itself and serves it from
// inside its own body — a resume within a resume.
async function outer(): i32 {
  let before = __serveArg();
  let e = mainExecutor();
  __spawnOn(__selfExecutor(), innerStart, 22, 7);
  __drainInbox(e);
  while (e.ready.depth > 0) e.step(e);
  outerBefore = before;
  outerAfter = __serveArg();
  await leaf();
  afterAwait = __serveArg();
  return 0;
}

export function boot(outerStart: i32, innerIndex: i32): i32 {
  innerStart = innerIndex;
  __spawnOn(__selfExecutor(), outerStart, 11, 0);
  return 0;
}

export function pump(): i32 {
  let e = mainExecutor();
  let guard = 0;
  while (e.inbox.depth > 0 || e.ready.depth > 0) {
    if (e.step(e)) break;
    if (++guard > 1000000) break;
  }
  return outerAfter;
}

export async function main(): i32 { await leaf(); return 0; }
`, ["--runtime", "incremental", "--enable", "threads", "--sharedMemory",
      "--importMemory", "--maximumMemory", "128", "--enable", "stack-switching"]);
    check("the nested-serve fixture compiles", built.ok, true);
    if (!built.ok) {
      console.log(built.output);
    } else {
      const names = startsOf(built.wat);
      const outerStart = names.indexOf("$probe/outer$spawnStart");
      const innerIndex = names.indexOf("$probe/inner$spawnStart");
      check("the nested-serve fixture has both spawn entries",
        outerStart > 0 && innerIndex > 0, true);

      const module = new WebAssembly.Module(built.bytes);
      const memory = new WebAssembly.Memory({ initial: 1, maximum: 128, shared: true });
      const e = new WebAssembly.Instance(module, {
        env: {
          memory,
          abort: (a, b, c, d) => { throw new Error(`abort ${a} ${b} ${c} ${d}`); },
          __executorCount: () => 1,
          __startThread: () => -1,
        },
      }).exports;
      check("`__threadInit` carves the block", e.__threadInit(64), 0);
      e.__arenaInit(e.__mainArenaBase(), e.__mainArenaSize());
      check("`__start` runs the boot body", e.__start(), 0);
      check("the outer request is posted to this executor", e.boot(outerStart, innerIndex), 0);
      check("(n0) the outer body ran to completion", e.pump(), 11);
      check("(n1) the outer body read its own argument first", e.outerBefore.value, 11);
      check("(n2) …and its own again after the nested drain", e.outerAfter.value, 11);
      check("(n3) …and its own again after its own suspension", e.afterAwait.value, 11);
      check("(n4) the nested body read its own argument", e.innerSaw.value, 22);
      check("(n5) …and its own key", e.innerKey.value, 7);
    }
  }

  if (failures) {
    console.error(`\ngate4: ${failures} of ${checks} checks failed`);
    process.exit(1);
  }
  console.log(`\n[ SUCCESS ] ${checks} checks`);
  process.exit(0);

}
