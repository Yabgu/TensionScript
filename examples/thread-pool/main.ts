// thread-pool — three workers, twelve tasks, every value accounted for.
//
// `ThreadPool.create(3)` starts workers 1..3 over the carved control block.
// `pool.policy()` is a placement policy: `work() on policy` posts the task's
// spawn entry to whichever executor the dispatcher picks and runs nothing here.
// The pool carries one shared block — a work ring, one result word per item,
// and a completion counter — and hands its address to each task as `arg`.
//
// A task pops its own item, computes `item * 1000 + item`, and publishes the
// answer together with its executor id. Main polls the completion counter and
// prints the table, so the transcript shows both that the work was distributed
// and that every item came back exactly once.

import {
  ThreadPool, PoolPolicy, SlotRing, __serveArg, __selfExecutor, mainExecutor,
} from "~lib/thread";
import { TaskBase, TaskPolicy } from "~lib/task";
import { __parkOn, __suspendParked } from "~lib/task-stack";
import { atomicAdd, atomicStore } from "~lib/atomics";

@external("env", "emit")
declare function emit(tag: i32, value: i32): void;

const POOL_SIZE: i32 = 1;
const RESULTS: i32 = 2;
const SUM: i32 = 3;
const EXECUTORS: i32 = 4;
const POST_FAILED: i32 = 5;

const TASKS: i32 = 12;

let pool: ThreadPool = new ThreadPool();
let policy: PoolPolicy = pool.policy();
let results: i32 = 0;
let sum: i32 = 0;
let executorBits: i32 = 0;
let finished: bool = false;

/** Served in a worker store: take one item and publish its answer. */
async function work(): i32 {
  // The pool's block, by address. Every request carries the same word, so the
  // late read of `__serveArg()` is harmless.
  let ring = SlotRing.fromBase(__serveArg());
  let item = ring.pop();
  if (item < 0) return 0;

  await 1;                                  // a real suspension on the ready path

  let value = item * 1000 + item;
  let exec = __selfExecutor();
  let packed = (exec << 24) | (value & 0xffffff);
  let table = ring.after;                   // result words start past the ring
  let done = table + <usize>((ring.capacity + 1) << 2);
  atomicStore<i32>(table + <usize>(item << 2), packed);
  atomicAdd<i32>(done, 1);
  return 0;
}

/**
 * One cooperative yield. `await 0` suspends this task, so main gives the core
 * loop a turn while it waits for the workers' counter to reach TASKS.
 */
async function yieldOnce(): i32 {
  await 1;
  return 0;
}

export async function main(): i32 {
  pool = ThreadPool.create(3);
  emit(POOL_SIZE, pool.size);
  policy = pool.policy();

  for (let i = 0; i < TASKS; ++i) {
    if (!pool.submit(i)) emit(POST_FAILED, -4);
  }
  for (let i = 0; i < TASKS; ++i) {
    let t = work() on policy;
    if (policy.lastStatus != 0) emit(POST_FAILED, policy.lastStatus);
  }

  // Poll: the workers publish from their own stores, and the counter is the
  // shared fact. Each turn through `yieldOnce` lets the core loop drain.
  while (pool.completed() < TASKS) {
    await yieldOnce();
  }

  for (let i = 0; i < TASKS; ++i) {
    let packed = pool.resultAt(i);
    let exec = (packed >>> 24) & 0xff;
    let value = packed & 0xffffff;
    results++;
    sum += value;
    executorBits |= 1 << exec;
    emit(6, exec);      // result-executor
    emit(7, value);     // result-value
  }

  emit(RESULTS, results);
  emit(SUM, sum);
  emit(EXECUTORS, executorBits);
  pool.join();
  finished = true;
  return 0;
}

/** One iteration of main's executor, for a host whose core loop went idle. */
export function pump(): void {
  let e = mainExecutor();
  let guard = 0;
  while ((e.inbox.depth > 0 || e.ready.depth > 0) && guard++ < 1000000) {
    if (e.step(e)) break;
  }
}

/** Whether main finished (the transcript's last observation is `executors`). */
export function done(): bool {
  return finished;
}
