// Micro-benchmarks for the Task path and the pool. **Not a gate.**
//
// What is measured:
//   1. tasks/second on a pool of 1, 2 and 4 workers, same body, one warm-up,
//      five rounds, the median reported;
//   2. post-to-completion latency on one worker: median and p95 over 1000
//      single-post rounds;
//   3. tasks/second for a main-only await chain (no threads), the number the
//      async-main showcase implies.
//
// **Caveats, stated once:** one machine, Node's JIT, no CPU pinning, no
// isolation from the rest of the process. The numbers move between runs and
// between machines. They exist to compare configurations *on one machine*,
// not to be published as an absolute rate. Nothing here asserts a threshold:
// a threshold on a shared CI runner is a flaky test.
//
// Run: npm run test:bench.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

const here = dirname(fileURLToPath(import.meta.url));
const CLI = join(here, "..", "..", "bin", "tensionscript.js");

const CAPACITY = 1024;
const WAVE = 64;
const TASKS = 2048;
const ROUNDS = 5;

function compile(name, source, flags) {
  const dir = mkdtempSync(join(tmpdir(), `bench-${name}-`));
  writeFileSync(join(dir, "probe.ts"), source);
  execFileSync(process.execPath, [
    CLI, "probe.ts", "-o", "probe.wasm", "--noColors", ...flags,
  ], { stdio: "pipe", cwd: dir });
  const bytes = readFileSync(join(dir, "probe.wasm"));
  rmSync(dir, { recursive: true, force: true });
  return bytes;
}

const POOL_PROGRAM = `
import {
  ThreadPool, PoolPolicy, SlotRing, __serveArg, mainExecutor,
} from "~lib/thread";
import { atomicAdd } from "~lib/atomics";

let pool: ThreadPool = new ThreadPool();
let policy: PoolPolicy = pool.policy();
let nextItem: i32 = 0;

async function leaf(): i32 { return 0; }

async function work(): i32 {
  let ring = SlotRing.fromBase(__serveArg());
  let item = ring.pop();
  await leaf();
  let done = ring.after + <usize>((ring.capacity + 1) << 2);
  atomicAdd<i32>(done, 1);
  return 0;
}

export function setup(workers: i32, capacity: i32): i32 {
  pool = ThreadPool.create(workers, null, capacity);
  policy = pool.policy();
  nextItem = 0;
  return pool.size;
}

export function runWave(n: i32): i32 {
  for (let i = 0; i < n; ++i) {
    if (!pool.submit(nextItem)) return -2;
    nextItem++;
  }
  let failures: i32 = 0;
  for (let i = 0; i < n; ++i) {
    work() on policy;
    if (policy.lastStatus != 0) {
      failures++;
      if (failures == 1) lastFailure = policy.lastStatus;
    }
  }
  return failures;
}

export let lastFailure: i32 = 0;

export function completed(): i32 { return pool.completed(); }
export function reset(): void { pool.reset(); nextItem = 0; }
export function clearCounter(): void { pool.clearResults(); }

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
`;

const MAIN_PROGRAM = (n) => `
async function leaf(): i32 { return 0; }
async function step(): i32 { await leaf(); return 0; }

export async function main(): i32 {
  for (let i = 0; i < ${n}; ++i) {
    let t = step();
    await t;
  }
  return ${n};
}
`;

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values, p) {
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

/** Starts one main instance over fresh shared memory and a fresh control block. */
function bootPool(bytes, workers) {
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 256, shared: true });
  const module = new WebAssembly.Module(bytes);
  const threads = [];
  const env = {
    memory,
    abort: (a, b, c, d) => { throw new Error(`abort ${a} ${b} ${c} ${d}`); },
    __executorCount: () => workers + 1,
    __startThread: (id) => {
      const worker = new Worker(new URL("./bench-worker.mjs", import.meta.url), {
        workerData: { bytes, memory, id, total: workers + 1 },
      });
      threads.push(new Promise((resolve, reject) => {
        worker.on("message", resolve);
        worker.on("error", reject);
      }));
      return 0;
    },
  };
  const e = new WebAssembly.Instance(module, { env }).exports;
  e.__threadInit(CAPACITY);
  e.__arenaInit(e.__mainArenaBase(), e.__mainArenaSize());
  e.__start();
  const size = e.setup(workers, CAPACITY);
  if (size !== workers) throw new Error(`pool started ${size} of ${workers}`);
  return { e, threads };
}

function waitFor(e, target, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (e.completed() < target) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${target}`);
    if (target > 0) continue;
  }
}

async function runRound(bytes, workers) {
  const { e, threads } = bootPool(bytes, workers);
  e.reset();
  // One probe completes before the clock starts, so worker startup is not
  // charged to the configuration's rate.
  e.runWave(1);
  waitFor(e, 1);
  e.clearCounter();
  const start = process.hrtime.bigint();
  for (let w = 0; w < Math.ceil(TASKS / WAVE); ++w) {
    const status = e.runWave(WAVE);
    if (status !== 0) throw new Error(`wave ${w} refused: ${status}`);
    waitFor(e, (w + 1) * WAVE);
  }
  const nanos = Number(process.hrtime.bigint() - start);
  for (let id = 1; id <= workers; ++id) e.__executorExit(id);
  await Promise.all(threads);
  return TASKS / (nanos / 1e9);
}

async function benchPool(bytes, workers) {
  // One untimed round warms the JIT; every round gets fresh arenas and fresh
  // workers, so a long measurement never runs into an exhausted 1 MiB worker
  // arena (records are not freed between rounds).
  await runRound(bytes, workers);
  const rates = [];
  for (let round = 0; round < ROUNDS; ++round) {
    rates.push(await runRound(bytes, workers));
  }
  return { rate: median(rates) };
}

async function benchLatency(bytes) {
  const { e, threads } = bootPool(bytes, 1);
  e.reset();
  const latencies = [];
  for (let i = 0; i < 1000; ++i) {
    const start = process.hrtime.bigint();
    e.runWave(1);
    waitFor(e, 1);
    latencies.push(Number(process.hrtime.bigint() - start) / 1000);
    e.clearCounter();
  }
  for (let id = 1; id <= 1; ++id) e.__executorExit(id);
  await Promise.all(threads);
  return latencies;
}

async function main() {
  const poolBytes = compile("pool", POOL_PROGRAM, [
    "--runtime", "incremental", "--enable", "threads", "--sharedMemory",
    "--importMemory", "--maximumMemory", "256", "--enable", "stack-switching", "--stackful-backend", "continuation",
  ]);
  const mainN = 20000;
  const mainBytes = compile("main", MAIN_PROGRAM(mainN), [
    "--runtime", "incremental", "--enable", "stack-switching", "--stackful-backend", "continuation",
  ]);
  const mainModule = new WebAssembly.Module(mainBytes);

  const rows = [];
  for (const workers of [1, 2, 4]) {
    const { rate } = await benchPool(poolBytes, workers);
    rows.push({ name: `pool ${workers}`, rate, medianLatency: null, p95: null });
  }
  const latencies = await benchLatency(poolBytes);
  rows[0].medianLatency = median(latencies);
  rows[0].p95 = percentile(latencies, 95);

  // Main-only chain: no threads at all. A fresh instance per round.
  const mainRates = [];
  for (let round = 0; round < ROUNDS; ++round) {
    const start = process.hrtime.bigint();
    const e = new WebAssembly.Instance(mainModule, {
      env: { abort: (a, b, c, d) => { throw new Error(`abort ${a} ${b} ${c} ${d}`); } },
    }).exports;
    const nanos = Number(process.hrtime.bigint() - start);
    if (e.__asyncStatus.value !== mainN) throw new Error("main did not complete");
    mainRates.push(mainN / (nanos / 1e9));
  }
  rows.push({
    name: "main-only chain",
    rate: median(mainRates),
    medianLatency: null,
    p95: null,
  });

  console.log("\nconfiguration      tasks/sec     median latency    p95");
  for (const row of rows) {
    console.log(
      `${row.name.padEnd(18)} ${row.rate.toFixed(0).padStart(10)}     ` +
      `${row.medianLatency == null ? "-" : row.medianLatency.toFixed(1) + " us"}`.padEnd(17) +
      `${row.p95 == null ? "-" : row.p95.toFixed(1) + " us"}`
    );
  }
  console.log("\nmedians over 5 rounds; latency over 1000 single posts on one worker.");
  console.log("one machine, Node's JIT, no pinning: compare configurations, do not publish.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
