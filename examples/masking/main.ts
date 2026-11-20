// masking — the three things a mask does, side by side.
//
// 1. **Admission** refuses a task placed on an executor the mask forbids. The
//    post answers `-1`, the refusal is counted, and nothing is queued.
// 2. The **same task** with a mask that allows the worker runs, exactly once.
// 3. A task that reaches a worker under a main-only mask still runs; the park
//    notices the mask disagrees and counts a **violation** in that store, but
//    the continuation protocol is never broken — the task settles anyway.
//
// All three counts are printed. The pool is only the transport here: its shared
// block gives the worker tasks a place to publish and main a counter to poll.

import {
  ThreadPool, SlotRing, Mask, __maskRefusals, __maskViolations,
  __spawnOn, __serveArg, mainExecutor,
} from "~lib/thread";
import { TaskBase, TaskPolicy } from "~lib/task";
import { atomicAdd, atomicStore } from "~lib/atomics";

@external("env", "emit")
declare function emit(tag: i32, value: i32): void;

const POOL_SIZE: i32 = 1;
const REFUSALS: i32 = 2;
const ALLOWED: i32 = 3;
const VIOLATIONS: i32 = 4;
const POST_FAILED: i32 = 5;

let pool: ThreadPool = new ThreadPool();
let finished: bool = false;

/** Served in the worker: publish "I ran" in result slot `item`. */
async function work(): i32 {
  let ring = SlotRing.fromBase(__serveArg());
  let item = ring.pop();
  await 1;
  let table = ring.after;
  let done = table + <usize>((ring.capacity + 1) << 2);
  atomicStore<i32>(table + <usize>(item << 2), 1);
  atomicAdd<i32>(done, 1);
  return 0;
}

/** A main-only policy, applied to a task that is driven in a worker anyway. */
@final class MainOnly extends TaskPolicy {
  create(task: TaskBase): void { task.mask = new Mask<u32>(1); } // {0}
  await(task: TaskBase): void { task.drive(); }
}

/** A real suspension, so `inner` is a task and its park is observable. */
async function yieldPoint(): i32 {
  await 1;
  return 0;
}

async function inner(): i32 {
  await yieldPoint();
  return __maskViolations();
}

/** Served in the worker by the unmasked __spawnOn: park under a forbidden mask. */
async function misplaced(): i32 {
  let ring = SlotRing.fromBase(__serveArg());
  let policy = new MainOnly();
  let t = inner() on policy;
  let v = await t;
  let table = ring.after;
  let done = table + <usize>((ring.capacity + 1) << 2);
  atomicStore<i32>(table + 4, v);        // result slot 1
  atomicAdd<i32>(done, 1);
  return v;
}

/** One cooperative yield while main waits for the shared counter. */
async function yieldOnce(): i32 {
  await 1;
  return 0;
}

export async function main(): i32 {
  pool = ThreadPool.create(1);
  emit(POOL_SIZE, pool.size);

  // (1) main-only mask, posted to worker 1: refused, counted, not queued.
  let refusedPolicy = pool.policy(new Mask<u32>(1));
  work() on refusedPolicy;
  emit(REFUSALS, __maskRefusals());

  // (2) the same task with the worker allowed: it runs.
  let allowedPolicy = pool.policy(new Mask<u32>(2));
  pool.submit(0);
  work() on allowedPolicy;
  if (allowedPolicy.lastStatus != 0) emit(POST_FAILED, allowedPolicy.lastStatus);

  // (3) a masked task that reaches the worker anyway. Its spawn entry is the
  // module constant carried by a local task; the block address is the arg.
  let template = misplaced();
  __spawnOn(1, template.entry, <i32>pool.workBase, 0);

  while (pool.completed() < 2) {
    await yieldOnce();
  }

  emit(ALLOWED, pool.resultAt(0));
  emit(VIOLATIONS, pool.resultAt(1));
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
