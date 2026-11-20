// policies — four policies, side by side, each printing what it did.
//
// A `TaskPolicy` has exactly two moments: `create` (once, at the call site,
// before any body runs) and `await` (when the caller actually waits). The four
// rows below differ only in those two methods:
//
//   1. the default — lazy: `create` does nothing, `await` drives the task;
//   2. eager — `create` drives the prefix immediately;
//   3. counting — `create`/`await` are counted, proving one of each per call;
//   4. remote — `create` posts the body to worker 1, `await` parks until the
//      reply continuation settles the task in main.
//
// The numbers are the transcript. There is no prose the guest could print.

import {
  ThreadPool, RemotePolicy, mainExecutor, __serveArg, __serveKey,
  __serveOrigin, __selfExecutor,
} from "~lib/thread";
import { TaskBase, TaskPolicy, __inlineAwait } from "~lib/task";

@external("env", "emit")
declare function emit(tag: i32, value: i32): void;

const POOL_SIZE: i32 = 1;
const LAZY_BEFORE: i32 = 2;
const LAZY_VALUE: i32 = 3;
const EAGER_BEFORE: i32 = 4;
const EAGER_VALUE: i32 = 5;
const COUNT_CREATED: i32 = 6;
const COUNT_AWAITED: i32 = 7;
const COUNT_SAW_BODY: i32 = 8;
const COUNT_SUM: i32 = 9;
const REMOTE_VALUE: i32 = 10;
const REMOTE_WORKER: i32 = 11;

let pool: ThreadPool = new ThreadPool();
let finished: bool = false;
let bodyRuns: i32 = 0;

async function leaf(): i32 { return 0; }

/** A local task with a prefix: `bodyRuns++` happens before its await. */
async function f(x: i32): i32 {
  bodyRuns++;
  await leaf();
  return x;
}

/** Counting: one `create` and one `await` per `on` call. */
@final class CountingPolicy extends TaskPolicy {
  created: i32 = 0;
  awaitedCount: i32 = 0;
  sawBody: i32 = 0;
  create(task: TaskBase): void {
    this.created++;
    if (bodyRuns != 0) this.sawBody = 1;    // create must precede the body
  }
  await(task: TaskBase): void {
    this.awaitedCount++;
    __inlineAwait(task);
  }
}

/** Eager: the prefix runs at the call site. */
@final class EagerPolicy extends TaskPolicy {
  create(task: TaskBase): void { task.drive(); }
  await(task: TaskBase): void { if (!task.settled) __inlineAwait(task); }
}

/** A real suspension, so both remote continuations are actual tasks. */
async function yieldPoint(): i32 {
  await 1;
  return 0;
}

let remoteTask: Task<i32> | null = null;
let remoteAnswer: i32 = -1;
let remoteWorker: i32 = -1;

/** Served in worker 1: compute, then post the answer and this store's id. */
async function work(): i32 {
  let value = __serveArg();
  await yieldPoint();
  let packed = (__selfExecutor() << 16) | (value * 2 & 0xffff);
  __spawnOn(__serveOrigin(), __serveKey(), packed, 0);
  return 0;
}

/** Served in main: settle the waiting task and record where it came from. */
async function deliver(): i32 {
  let packed = __serveArg();
  await yieldPoint();
  remoteWorker = packed >>> 16;
  remoteAnswer = packed & 0xffff;
  let t = remoteTask;
  if (t) {
    let task = changetype<Task<i32>>(t);
    task.value = remoteAnswer;
    task.settle(0);
  }
  return 0;
}

export async function main(): i32 {
  pool = ThreadPool.create(1);
  emit(POOL_SIZE, pool.size);

  // 1. the default is lazy: the call runs nothing.
  let before = bodyRuns;
  let t0 = f(1);
  emit(LAZY_BEFORE, bodyRuns - before);
  emit(LAZY_VALUE, await t0);

  // 2. eager: create ran the prefix, so `bodyRuns` moved at the call site.
  before = bodyRuns;
  let t1 = f(2) on new EagerPolicy();
  emit(EAGER_BEFORE, bodyRuns - before);
  emit(EAGER_VALUE, await t1);

  // 3. counting: two calls, two creates, two awaits, no body at create.
  bodyRuns = 0;
  let counting = new CountingPolicy();
  let a = f(10) on counting;
  let b = f(20) on counting;
  let sum = (await a) + (await b);
  emit(COUNT_CREATED, counting.created);
  emit(COUNT_AWAITED, counting.awaitedCount);
  emit(COUNT_SAW_BODY, counting.sawBody);
  emit(COUNT_SUM, sum);

  // 4. remote: the body runs on worker 1; the reply settles the task in main.
  let reply = deliver().entry;             // a module constant, not a store fact
  remoteTask = work() on new RemotePolicy(1, 21, reply);
  let t = remoteTask;
  if (t) {
    let task = changetype<Task<i32>>(t);
    let value = await task;
    emit(REMOTE_VALUE, value);
  }
  emit(REMOTE_WORKER, remoteWorker);

  pool.join();
  finished = true;
  return 0;
}

export function pump(): void {
  let e = mainExecutor();
  let guard = 0;
  while ((e.inbox.depth > 0 || e.ready.depth > 0) && guard++ < 1000000) {
    if (e.step(e)) break;
  }
}

export function done(): bool {
  return finished;
}
