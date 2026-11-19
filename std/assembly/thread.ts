/// <reference path="./rt/index.d.ts" />

/**
 * The threading ABI and the structures it is built on.
 *
 * `docs/task-design.md` §2/§5/§8.5. Five primitives, no policy:
 *
 * | primitive | kind |
 * |---|---|
 * | `__startThread(entryIndex, argSlot) -> i32` | host import (Gate 4) |
 * | `__executorCount() -> i32` | host import (Gate 4) |
 * | `__spawnOn(target, funcIndex, argSlot, taskKey)` | guest |
 * | `__serveOne(e, funcIndex, argSlot, taskKey)` | guest |
 * | `__drainInbox(e) -> i32` | guest |
 *
 * Only the two host imports are gate 4's; everything here runs on bare
 * wasmtime, which is what makes Gate 3 testable without the Tension host.
 *
 * **Ring contents are slot indices, never task objects.** A continuation
 * reference cannot leave the store that made it (F1); an `i32` index can, and
 * that single fact is what lets a request cross a thread boundary. The same
 * index space is `$~asyncCont`'s.
 */

import { Atomics } from "./atomics";

// ── the slot ring ───────────────────────────────────────────────────────────

/** Word 0: the consumer's index (single consumer). */
const HEAD: i32 = 0;
/** Word 1: the producer index (reserved by CAS). */
const TAIL: i32 = 1;
/** Word 2: the capacity, repeated in memory so a shared reader can find it. */
const CAPACITY_WORD: i32 = 2;
/** Word 3 onward: the ring's cells. */
const SLOTS: i32 = 3;
/** A cell reserved by a producer that has not yet stored its value. */
const UNWRITTEN: i32 = -2;

/**
 * A bounded ring of `i32` slot indices, in linear memory, accessed atomically.
 *
 * **One type for both queues** (`docs/task-design.md` §8.5): `Executor.ready`
 * — owned by its executor, single consumer — and `Executor.inbox` — written by
 * anyone, drained by its owner. They differ in who writes, not in shape.
 *
 * **Why not an `Array<i32>`.** An `Array` is a heap object; a thread that did
 * not allocate it cannot read it (F1). The ring's words are an `Int32Array`
 * payload — plain linear memory with a stable address — so its *contents* are
 * addressable, which is the property F5 requires of anything crossing a thread.
 * The view object itself belongs to this store; handing another store the
 * ring's address is the shared-arena allocation `docs/task-design.md` §13
 * leaves open, and is not assumed here.
 *
 * **A `class`, not an `@managed struct`.** The design's own sketch (§8.5) is
 * `export class SlotRing`, and a struct cannot carry the constructor and the
 * three methods the ABI wants — measured: `@managed` on a class is refused
 * (`AS212`), and a struct has no method syntax in this fork. What `@managed`
 * was standing for here is the *storage*: the ring's words are linear, so their
 * address is a value any store could use once §13's arena exists.
 *
 * **Ordering.** `push` reserves the tail with a CAS and then writes the cell, so
 * several producers may push concurrently; `pop` advances the head with a plain
 * atomic store, because exactly one executor drains a given ring. A consumer
 * that sees a reserved-but-unwritten cell answers "empty" and leaves the head
 * where it is, so a value is never read before it is published.
 */
export class SlotRing {
  /** `[head, tail, capacity, cells…]`. */
  private data: Int32Array;
  /** The ring's bound, kept outside the buffer for the hot path. */
  readonly capacity: i32;

  constructor(capacity: i32) {
    this.capacity = capacity;
    let data = new Int32Array(capacity > 0 ? capacity + SLOTS : SLOTS);
    // A zero-filled buffer would make every empty cell look like slot 0, so the
    // cells start unwritten and `pop` can tell "reserved" from "holds 0".
    for (let i = 0; i < capacity; ++i) unchecked(data[SLOTS + i] = UNWRITTEN);
    unchecked(data[HEAD] = 0);
    unchecked(data[TAIL] = 0);
    unchecked(data[CAPACITY_WORD] = capacity);
    this.data = data;
  }

  /**
   * Appends `slot`; false when the ring is full **or already holds it**.
   *
   * **At most one entry per slot.** A task can be made ready twice — two tasks
   * both awaiting it, each returning the same awaited slot from a resume — and
   * resuming a continuation twice advances a suspended body twice. The ring is
   * as deep as the runnable set, so the membership scan is cheaper than a set
   * and needs no allocation. (Across threads the scan sees only published cells,
   * which is enough: duplicates come from one executor's own resumes.)
   */
  push(slot: i32): bool {
    let capacity = this.capacity;
    if (capacity <= 0) return false;
    let data = this.data;
    let tailNow = Atomics.load(data, TAIL);
    let headNow = Atomics.load(data, HEAD);
    for (let i = headNow; i < tailNow; ++i) {
      if (Atomics.load(data, SLOTS + (i % capacity)) == slot) return false;
    }
    while (true) {
      let tail = Atomics.load(data, TAIL);
      let head = Atomics.load(data, HEAD);
      if (tail - head >= capacity) return false;
      if (Atomics.compareExchange(data, TAIL, tail, tail + 1) == tail) {
        Atomics.store(data, SLOTS + (tail % capacity), slot);
        return true;
      }
      // Another producer took this index; read the new tail and try again.
    }
  }

  /** Removes the oldest slot, or `-1` when there is nothing published yet. */
  pop(): i32 {
    let capacity = this.capacity;
    if (capacity <= 0) return -1;
    let data = this.data;
    let head = Atomics.load(data, HEAD);
    let tail = Atomics.load(data, TAIL);
    if (head >= tail) return -1;
    let value = Atomics.load(data, SLOTS + (head % capacity));
    if (value == UNWRITTEN) return -1;
    Atomics.store(data, HEAD, head + 1);
    return value;
  }

  /** How many entries are published and not yet consumed. */
  get depth(): i32 {
    let data = this.data;
    let depth = Atomics.load(data, TAIL) - Atomics.load(data, HEAD);
    return depth > 0 ? depth : 0;
  }
}

// ── the executor ────────────────────────────────────────────────────────────

import { setWakeSink, TaskBase } from "./task";
import { __taskAt, __resumeTask, __serveCont, __lastStatus } from "./task-stack";

/** Default ring capacity. A pool sizes its own (§6.4); this is main's. */
const DEFAULT_CAPACITY: i32 = 1024;

/**
 * One executor: an identity, two queues, a stop flag, and the **step**.
 *
 * `docs/task-design.md` §5/§8.5. There is no `table` field: the continuation
 * table is the module's `$~asyncCont` plus `$~asyncNextSlot`, and a `slot` is an
 * index into it, so carrying an `Array<Continuation>` here would be a second
 * table that disagrees with the one `cont.new`/`resume` use.
 *
 * **`step` is a field, and that is the whole design.** One iteration of
 * whatever policy is installed. Assigning it — at creation, or later — is how a
 * worker is reprogrammed, and main is a worker like any other (§1.3). The entry
 * loop reads the field each iteration, so an assignment takes effect on the
 * next one.
 */
export class Executor {
  /** `0` is main. */
  id: i32;
  /** Slots owned by this thread, single consumer. */
  ready: SlotRing;
  /** Requests addressed here, drained by its owner. */
  inbox: SlotRing;
  /** One iteration; `true` means stop. Reprogrammable. */
  step: (e: Executor) => bool;
  /** Set to end the loop. */
  stop: bool = false;

  constructor(
    id: i32,
    step: (e: Executor) => bool,
    capacity: i32 = DEFAULT_CAPACITY
  ) {
    this.id = id;
    this.step = step;
    this.ready = new SlotRing(capacity);
    this.inbox = new SlotRing(capacity);
  }
}

/** `executors[id]`, or `null` when no such executor exists. */
let executors: Array<Executor | null> | null = null;
let mainExecutorInstance: Executor | null = null;

/**
 * Initialises the executor table with main at `0`, and installs the wake seam.
 *
 * Idempotent, and called by the executor loop before anything runs: `settle`
 * pushes a waiter's slot through `__wakeSink`, which only exists once there is
 * an executor table to push into.
 */
export function __executorInit(): void {
  let table = executors;
  if (!table) {
    table = new Array<Executor | null>();
    table.push(null); // id 0 is filled below; the index is the id
    executors = table;
  }
  if (!mainExecutorInstance) {
    let main = new Executor(0, mainStep);
    mainExecutorInstance = main;
    table[0] = main;
  }
  setWakeSink((exec: i32, slot: i32): void => {
    let e = __executorOf(exec);
    if (e) changetype<Executor>(e).ready.push(slot);
  });
}

/** The executor registered at `id`, or `null`. */
export function __executorOf(id: i32): Executor | null {
  let table = executors;
  if (!table || id < 0 || id >= table.length) return null;
  return table[id];
}

/** The executor registered at `id`; `mainExecutor()` for id 0. */
export function executor(id: i32): Executor | null {
  __executorInit();
  return __executorOf(id);
}

/** Main's executor (id 0), created on first use. */
export function mainExecutor(): Executor {
  __executorInit();
  return changetype<Executor>(mainExecutorInstance);
}

/**
 * Drive the oldest ready slot, if any: resume its continuation with the
 * executor's `$await` handler, and queue whatever it parks on.
 *
 * Exported because a step is *user-written* (`docs/task-design.md` §9.0): a
 * custom step composes this however it likes.
 */
export function driveReady(e: Executor): void {
  let slot = e.ready.pop();
  if (slot < 0) return;
  // A slot can be queued by several waiters; a settled task must not be
  // resumed again, and `main` (slot 0) has no task object at all.
  let taskOrNull = __taskAt(slot);
  if (taskOrNull) {
    // `changetype` after the check, not `!`: the pointer ABI's `!` and the GC
    // ABI's non-null refinement are different operators, and this is the one
    // both accept.
    if (changetype<TaskBase>(taskOrNull).settled) return;
  }
  let awaited = __resumeTask(slot);
  if (awaited >= 0) e.ready.push(awaited);
}

/**
 * Main's default step: directed work first, then one task, then return.
 *
 * `docs/task-design.md` §1.3 verbatim, with `__drainInbox` doing the serving
 * (§2). Never stops: main runs until the loop has nothing left.
 */
export function mainStep(e: Executor): bool {
  __drainInbox(e);
  driveReady(e);
  return false;
}

// ── requests: the inbox protocol ────────────────────────────────────────────

/**
 * One request: *run `funcIndex` from `$starts`, with `argSlot`, reporting to
 * `taskKey`*.
 *
 * It lives in a table and crosses as its **index** — the same rule as every
 * other queue (`docs/task-design.md` §8.5: ring contents are indices). Sharing
 * the table itself across threads is the shared-arena allocation §13 leaves
 * open; at Gate 3 one executor serves, so the table is one store's.
 */
export class Request {
  funcIndex: i32 = 0;
  argSlot: i32 = 0;
  taskKey: i32 = 0;
}

/** Free list + slots, so a request index is a small integer, not an address. */
let requests: Array<Request | null> | null = null;
let freeRequests: Array<i32> | null = null;

function allocRequest(): i32 {
  let free = freeRequests;
  if (free && free.length > 0) {
    let index = free.pop();
    return index;
  }
  let table = requests;
  if (!table) {
    table = new Array<Request | null>();
    requests = table;
  }
  table.push(new Request());
  return table.length - 1;
}

function requestAt(index: i32): Request | null {
  let table = requests;
  if (!table || index < 0 || index >= table.length) return null;
  return table[index];
}

/**
 * Post a request to executor `target` (0 = main). Never runs anything here.
 *
 * Guest function: it writes a ring in guest memory, which a step on the target
 * drains. The host is not involved, so a thread that has not been created yet
 * is still addressable — the request simply waits.
 */
export function __spawnOn(target: i32, funcIndex: i32, argSlot: i32, taskKey: i32): void {
  __executorInit();
  let e = __executorOf(target);
  if (!e) return;
  let index = allocRequest();
  let request = changetype<Request>(requestAt(index));
  request.funcIndex = funcIndex;
  request.argSlot = argSlot;
  request.taskKey = taskKey;
  e.inbox.push(index);
}

/**
 * Create the continuation for a request in **this** store and run it.
 *
 * The receiving half of `__spawnOn`. `$starts[funcIndex]` becomes a
 * continuation through `__serveCont`; resuming it with the shell's `$await`
 * handler means a served body that suspends parks normally, and its slot is
 * queued for this executor.
 */
export function __serveOne(e: Executor, funcIndex: i32, argSlot: i32, taskKey: i32): i32 {
  let slot = __serveCont(funcIndex);
  let awaited = __resumeTask(slot);
  if (awaited >= 0) e.ready.push(awaited);
  return __lastStatus();
}

/**
 * Run every request addressed to this executor, answering the last status a
 * served request produced (`-1` if there was none).
 *
 * A step calls this first (§1.3: directed work before queued work), so a
 * request posted from any thread is served at the target's own convenience.
 */
export function __drainInbox(e: Executor): i32 {
  let last: i32 = -1;
  while (true) {
    let index = e.inbox.pop();
    if (index < 0) break;
    let requestOrNull = requestAt(index);
    if (!requestOrNull) continue;
    let request = changetype<Request>(requestOrNull);
    let funcIndex = request.funcIndex;
    let argSlot = request.argSlot;
    let taskKey = request.taskKey;
    let free = freeRequests;
    if (!free) {
      free = new Array<i32>();
      freeRequests = free;
    }
    free.push(index);
    last = __serveOne(e, funcIndex, argSlot, taskKey);
  }
  return last;
}
