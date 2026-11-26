// Stress: correctness under load, not a benchmark.
//
// Four workers, four hundred tasks, three passes in one process. The failure
// this exists to catch is the one a small test cannot: a ring whose sequence
// stamp is wrong loses or duplicates an entry only after the ring wraps, and a
// ready queue that drops a slot does the same. Capacity 64, 400 items, four
// workers: every inbox ring wraps, and the request table is reused many times.
//
// Two cases per pass:
//   kind 0 — the body does not suspend (the inbox path);
//   kind 1 — the body awaits a real suspension (the ready-queue path).
//
// The guest publishes one result word per item: `(executor << 16) | index`.
// The host reads the table and asserts: 400 distinct indices, no duplicates,
// no loss, at least two executors served, and the same totals in all three
// passes.
//
// Run: npm run test:stress (Node must have --experimental-wasm-wasmfx).

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

const here = dirname(fileURLToPath(import.meta.url));
const CLI = join(here, "..", "..", "bin", "tensionscript.js");

const WORKERS = 4;
const TASKS = 400;
const CAPACITY = 64;
const WAVE = 32;
const TIMEOUT = 60000;

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
 * **The `scheduler` namespace** (DL44). A shared stackful build imports
 * `scheduler::park` whether or not it parks — the continuation policy await registers
 * its pair there (DL43) — so neither instance loads without it. Keyless parks are the
 * store's own business (its `settle` resumes them); a keyed one names a producer this
 * stress fixture does not have, so it is refused loudly rather than stranding.
 */
const schedulerImports = {
  scheduler: {
    park: (taskId, class_, key) => {
      if (class_ !== 0 || key !== 0) {
        throw new Error(
          `scheduler::park named a producer (class ${class_}, key ${key}) that this ` +
            "fixture has no producer for",
        );
      }
    },
  },
};

if (!isMainThread) {
  const { bytes, memory, id, total } = workerData;
  try {
    const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes), {
      env: {
        memory,
        abort: (a, b, c, d) => { throw new Error(`worker abort ${a} ${b} ${c} ${d}`); },
        __executorCount: () => total,
        __startThread: () => -1,
      },
      ...schedulerImports,
    });
    const e = instance.exports;
    e.__arenaInit(e.__workerArenaBase(id), e.__workerArenaSize(id));
    parentPort.postMessage({ status: e.__workerMain(id) });
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
  const dir = mkdtempSync(join(tmpdir(), "stress-"));
  writeFileSync(join(dir, "probe.ts"), `
import {
  ThreadPool, PoolPolicy, SlotRing, __serveArg, __selfExecutor, mainExecutor,
} from "~lib/thread";
import { atomicAdd, atomicStore } from "~lib/atomics";

const TASKS: i32 = 400;
const CAPACITY: i32 = 64;

let pool: ThreadPool = new ThreadPool();
let policy: PoolPolicy = pool.policy();
let nextItem: i32 = 0;
let seen: Array<i32> = new Array<i32>(TASKS);
let distinct: i32 = 0;
let duplicates: i32 = 0;
let maxSeen: i32 = 0;
let execBits: i32 = 0;

async function leaf(): i32 { return 0; }

/// A real suspension, used by the ready-queue case.
async function yieldPoint(): i32 {
  await 1;
  return 0;
}

/// kind 0: no suspension. kind 1: a suspension before the result.
async function workInbox(): i32 {
  let ring = SlotRing.fromBase(__serveArg());
  let item = ring.pop();
  await leaf();
  publish(ring, item);
  return 0;
}

async function workSuspend(): i32 {
  let ring = SlotRing.fromBase(__serveArg());
  let item = ring.pop();
  await yieldPoint();
  publish(ring, item);
  return 0;
}

/// One result per publication slot: the slot counter is allocated first,
/// the result is written, and only then is the completion counter raised.
function publish(ring: SlotRing, item: i32): void {
  let table = ring.after;
  let next = table + <usize>(ring.capacity << 2);
  let done = next + 4;
  let slot = atomicAdd<i32>(next, 1);
  atomicStore<i32>(table + <usize>(slot << 2),
                   (__selfExecutor() << 16) | (item & 0xffff));
  atomicAdd<i32>(done, 1);
}

export function setup(): i32 {
  pool = ThreadPool.create(4, null, CAPACITY);
  policy = pool.policy();
  return pool.size;
}

export function beginRun(): void {
  pool.reset();
  nextItem = 0;
  distinct = 0;
  duplicates = 0;
  maxSeen = 0;
  execBits = 0;
  for (let i = 0; i < TASKS; ++i) seen[i] = 0;
}

export function postWave(n: i32, kind: i32): i32 {
  for (let i = 0; i < n; ++i) {
    if (!pool.submit(nextItem)) return -2;
    nextItem++;
  }
  for (let i = 0; i < n; ++i) {
    if (kind == 0) {
      workInbox() on policy;
    } else {
      workSuspend() on policy;
    }
    if (policy.lastStatus != 0) return policy.lastStatus;
  }
  return 0;
}

export function completed(): i32 { return pool.completed(); }

/// Reads n published result words, folds them into seen, then clears the
/// result table. The work ring is untouched, so its head/tail keep wrapping.
export function consume(n: i32): void {
  for (let slot = 0; slot < n; ++slot) {
    let packed = pool.resultAt(slot);
    if (packed < 0) continue;
    let index = packed & 0xffff;
    let exec = (packed >>> 16) & 0xff;
    execBits |= 1 << exec;
    if (index >= 0 && index < TASKS) {
      seen[index]++;
      if (seen[index] == 1) ++distinct;
      else ++duplicates;
      if (seen[index] > maxSeen) maxSeen = seen[index];
    }
  }
  pool.clearResults();
}

export function summary(): i32 {
  return (distinct & 0x3ff)
    | ((duplicates & 0x3ff) << 10)
    | ((maxSeen & 0x3ff) << 20);
}

export function executorBits(): i32 {
  return execBits;
}

export function pump(): void {
  let e = mainExecutor();
  let guard = 0;
  while ((e.inbox.depth > 0 || e.ready.depth > 0) && guard++ < 1000000) {
    if (e.step(e)) break;
  }
}

export async function main(): i32 {
  await leaf();
  return 0;
}
`);

  const wasmPath = join(dir, "probe.wasm");
  let compiled = true;
  try {
    execFileSync(process.execPath, [
      CLI, "probe.ts", "-o", "probe.wasm", "--noColors",
      "--runtime", "incremental", "--enable", "threads", "--sharedMemory",
      "--importMemory", "--maximumMemory", "256", "--enable", "stack-switching", "--stackful-backend", "continuation",
    ], { stdio: "pipe", cwd: dir });
  } catch (error) {
    compiled = false;
    console.log(`${error.stderr ?? ""}${error.stdout ?? ""}`);
  }
  check("the stress fixture compiles", compiled, true);
  if (!compiled) {
    rmSync(dir, { recursive: true, force: true });
    process.exit(1);
  }

  const bytes = readFileSync(wasmPath);
  const module = new WebAssembly.Module(bytes);
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 256, shared: true });
  const workers = [];
  const env = {
    memory,
    abort: (a, b, c, d) => { throw new Error(`abort ${a} ${b} ${c} ${d}`); },
    __executorCount: () => WORKERS + 1,
    __startThread: (id) => {
      const worker = new Worker(new URL(import.meta.url), {
        workerData: { bytes, memory, id, total: WORKERS + 1 },
      });
      workers.push(new Promise((resolve, reject) => {
        worker.on("message", resolve);
        worker.on("error", reject);
      }));
      return 0;
    },
  };
  const e = new WebAssembly.Instance(module, { env, ...schedulerImports }).exports;

  check("`__threadInit` carves the block", e.__threadInit(CAPACITY), 0);
  e.__arenaInit(e.__mainArenaBase(), e.__mainArenaSize());
  e.__start();
  check("the pool started four workers", e.setup(), WORKERS);

  const deadline = Date.now() + TIMEOUT;
  const waitFor = async (target) => {
    while (e.completed() < target) {
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${target} results`);
      e.pump();
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  };

  const totals = [];
  for (let run = 0; run < 3; ++run) {
    for (const kind of [0, 1]) {
      e.beginRun();
      let posted = 0;
      while (posted < TASKS) {
        const n = Math.min(WAVE, TASKS - posted);
        const status = e.postWave(n, kind);
        check(`run ${run + 1} kind ${kind}: wave at ${posted} posts`, status, 0);
        await waitFor(n);
        e.consume(n);
        posted += n;
      }
      const summary = e.summary();
      const distinct = summary & 0x3ff;
      const duplicates = (summary >>> 10) & 0x3ff;
      const maxSeen = (summary >>> 20) & 0x3ff;
      check(`run ${run + 1} kind ${kind}: 400 distinct indices`, distinct, TASKS);
      check(`run ${run + 1} kind ${kind}: no duplicates`, duplicates, 0);
      check(`run ${run + 1} kind ${kind}: no index seen twice`, maxSeen, 1);
      check(`run ${run + 1} kind ${kind}: at least two executors served`,
        popcount(e.executorBits()) >= 2, true);
      totals.push(`${distinct}/${duplicates}/${TASKS}`);
    }
  }

  check("all three passes produced the same totals", new Set(totals).size, 1);

  for (let id = 1; id <= WORKERS; ++id) e.__executorExit(id);
  const results = await Promise.all(workers);
  const bad = results.find((r) => r.error || r.status !== 0);
  check("every worker exited with the shell's status", bad === undefined, true);
  for (let id = 1; id <= WORKERS; ++id) {
    check(`__threadJoin observes worker ${id}'s exit`, e.__threadJoin(id), 0);
  }

  rmSync(dir, { recursive: true, force: true });
  if (failures) {
    console.error(`\nstress: ${failures} of ${checks} checks failed`);
    process.exit(1);
  }
  console.log(`\n[ SUCCESS ] ${checks} checks`);
}

function popcount(value) {
  let n = 0;
  while (value) {
    value &= value - 1;
    ++n;
  }
  return n;
}
