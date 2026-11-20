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

// @ts-ignore: decorator
@inline const SHARED: bool = isDefined(ASC_ARENA);

import {
  atomicLoad,
  atomicStore,
  atomicAdd,
  atomicCompareExchange,
  atomicWait,
  atomicNotify,
} from "./atomics";

// ── the slot ring ───────────────────────────────────────────────────────────

/** Word 0: the consumer's index (single consumer). */
const HEAD: i32 = 0;
/** Word 1: the producer index (reserved by CAS). */
const TAIL: i32 = 1;
/** Word 2: the capacity, repeated in memory so a raw reader can find it. */
const CAPACITY_WORD: i32 = 2;
/** Word 3 onward: the ring's cells. */
const SLOTS: i32 = 3;
/** A cell reserved by a producer that has not yet stored its value. */
const UNWRITTEN: i32 = -2;

const HEAD_OFF: usize = <usize>HEAD << 2;
const TAIL_OFF: usize = <usize>TAIL << 2;
const CAPACITY_OFF: usize = <usize>CAPACITY_WORD << 2;
const SLOTS_OFF: usize = <usize>SLOTS << 2;


/**
 * A bounded ring of `i32` words, **addressed by an integer**.
 *
 * **One type for both queues** (`docs/task-design.md` §8.5): `Executor.ready`
 * — owned by its executor, single consumer — and `Executor.inbox` — written by
 * anyone, drained by its owner. They differ in who writes, not in shape.
 *
 * **Why an address and not an `Array`.** An `Array`, an `Int32Array`, any heap
 * object belongs to the store that made it (F1), so a second thread cannot see
 * it. The ring's *contents* are four-plus words of plain linear memory, and
 * what another thread needs to operate them is one number: `base`. Every
 * operation below is a raw-address atomic on `base + word*4`, which is why a
 * ring can be shared without a shared allocator: nothing is allocated to share
 * it, the address is.
 *
 * **A `class`, not a struct.** The handle carries `capacity` and `signal` for
 * the hot path and the class is what a program names in its own code (§8.5's
 * sketch is `export class SlotRing`); the words it points at are a plain span
 * of memory, which is the part that has to be shareable.
 *
 * **Ordering.** `push` reserves the tail with a CAS and only then publishes the
 * cell, so several producers may push concurrently; `pop` advances the head
 * with a plain atomic store, because exactly one executor drains a given ring
 * (`STRIDE` gives each executor its own words — `docs/thread-abi.md` §5). A
 * consumer that sees a reserved-but-unwritten cell answers "empty" and leaves
 * the head where it is, so a value is never read before it is published.
 *
 * **A push with a signal wakes the owner.** After the cell is published, a ring
 * with `signal != 0` bumps the signal word and notifies one waiter. That order
 * — publish, bump, notify — is what makes the wake unloseable; a consumer reads
 * the signal *before* it looks at the ring, so a producer that ran in between
 * changes the value the consumer would wait on and the wait returns instead of
 * sleeping (`docs/thread-abi.md` §4).
 */
export class SlotRing {
  /** The ring's words: `[head, tail, capacity, cells…]`. */
  base: usize = 0;
  /** The ring's bound, mirrored for the hot path. */
  capacity: i32 = 0;
  /** Wake address (`i32` word), or 0 for a ring whose owner never sleeps. */
  signal: usize = 0;
  /**
   * The allocation that owns the words when *this handle* made them, or an
   * empty view when the words were carved by someone else.
   *
   * **Ownership, not access.** Nothing below reads or writes through it, and
   * `at()` never has one: it exists because a `--sharedMemory` build's ring may
   * still be created by `new SlotRing(cap)`, and under a tracing collector the
   * payload has to stay referenced or the ring's own words would be swept. The
   * hot path uses `base` alone, which is the property a second thread needs.
   */
  private anchor: Int32Array | null = null;

  /** Allocates the ring's words in this store's heap. */
  constructor(capacity: i32) {
    this.capacity = capacity;
    if (capacity > 0) {
      let words = new Int32Array(capacity + SLOTS);
      for (let i = 0; i < capacity; ++i) unchecked(words[SLOTS + i] = UNWRITTEN);
      unchecked(words[HEAD] = 0);
      unchecked(words[TAIL] = 0);
      unchecked(words[CAPACITY_WORD] = capacity);
      this.anchor = words;
      this.base = changetype<usize>(words.buffer);
    }
  }

  /**
   * A handle over words that already exist at `base`.
   *
   * **Allocates the handle and nothing else.** The caller has carved the words
   * (`__threadInit` does, once, before any thread exists), and they must be
   * initialised already: head 0, tail 0, capacity, every cell `UNWRITTEN`.
   */
  static at(base: usize, capacity: i32): SlotRing {
    let ring = new SlotRing(0);
    ring.base = base;
    ring.capacity = capacity;
    return ring;
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
    let base = this.base;
    let tailNow = atomicLoad<i32>(base + <usize>4);
    let headNow = atomicLoad<i32>(base);
    for (let i = headNow; i < tailNow; ++i) {
      if (atomicLoad<i32>(base + SLOTS_OFF + <usize>(i % capacity << 2)) == slot) return false;
    }
    while (true) {
      let tail = atomicLoad<i32>(base + TAIL_OFF);
      let head = atomicLoad<i32>(base + HEAD_OFF);
      if (tail - head >= capacity) return false;
      if (atomicCompareExchange<i32>(base + TAIL_OFF, tail, tail + 1) == tail) {
        atomicStore<i32>(base + SLOTS_OFF + <usize>(tail % capacity << 2), slot);
        return true;
      }
      // Another producer took this index; read the new tail and try again.
    }
  }

  /** Removes the oldest slot, or `-1` when there is nothing published yet. */
  pop(): i32 {
    let capacity = this.capacity;
    if (capacity <= 0) return -1;
    let base = this.base;
    let head = atomicLoad<i32>(base + HEAD_OFF);
    let tail = atomicLoad<i32>(base + TAIL_OFF);
    if (head >= tail) return -1;
    let value = atomicLoad<i32>(base + SLOTS_OFF + <usize>(head % capacity << 2));
    if (value == UNWRITTEN) return -1;
    atomicStore<i32>(base + HEAD_OFF, head + 1);
    return value;
  }

  /** How many entries are published and not yet consumed. */
  get depth(): i32 {
    let capacity = this.capacity;
    if (capacity <= 0) return 0;
    let base = this.base;
    let depth = atomicLoad<i32>(base + TAIL_OFF) - atomicLoad<i32>(base + HEAD_OFF);
    return depth > 0 ? depth : 0;
  }

  /**
   * Whether `pop` would answer `-1` right now.
   *
   * A reserved-but-unwritten head cell counts as empty: the producer that
   * reserved it bumps the signal after publishing, which is what wakes the
   * owner, so treating it as "nothing to do yet" cannot park past a wake.
   */
  get isEmpty(): bool {
    let capacity = this.capacity;
    if (capacity <= 0) return true;
    let base = this.base;
    let head = atomicLoad<i32>(base + HEAD_OFF);
    let tail = atomicLoad<i32>(base + TAIL_OFF);
    if (head >= tail) return true;
    return atomicLoad<i32>(base + SLOTS_OFF + <usize>(head % capacity << 2)) == UNWRITTEN;
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
 * Whether the program installed its own step, and that step.
 *
 * **Two globals and a bool, not one nullable function.** Both hazards are
 * measured: a global *initializer* that names a function pulls the executor's
 * whole chain (rings, atomics) into every program that parses this file — an
 * await-free async program then fails with `AS103: Feature 'threads' is not
 * enabled`; and `if (nullableFn)` under `--wasmGc` does not produce an i32
 * condition (an assertion in `evaluateCondition`). Constant `null` here costs
 * nothing, and the bool carries the decision.
 */
let hasCustomStep: bool = false;
let customStep: ((e: Executor) => bool) | null = null;

/** Installs the program's own step as the default (`__mainStep__` otherwise). */
/** Installs the program's own step as the default (`__mainStep__` otherwise). */
/** Installs the program's own step as the default (`__mainStep__` otherwise). */
export function __setDefaultMainStep(step: (e: Executor) => bool): void {
  customStep = step;
  hasCustomStep = true;
  let main = mainExecutorInstance;
  if (main) changetype<Executor>(main).step = step;
}

export function __executorInit(): void {
  let table = executors;
  if (!table) {
    table = new Array<Executor | null>();
    table.push(null); // id 0 is filled below; the index is the id
    executors = table;
  }
  if (!mainExecutorInstance) {
    let step: (e: Executor) => bool = __mainStep__;
    // `changetype`, not `!`: a nullable function value's non-null assertion
    // does not lower to valid IR here (`if condition must be valid`, measured),
    // while the two types are one wasm type and the cast is the identity.
    if (hasCustomStep) step = changetype<(e: Executor) => bool>(customStep);
    let main = new Executor(0, step);
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
 *
 * **`__mainStep__`, not `mainStep`.** `docs/policy-and-threads.md` §6 gives a
 * program the right to declare its own `mainStep`, and a program-level
 * declaration cannot share a name with a std export: this one is the default,
 * and the shell installs whichever of the two exists (`__setDefaultMainStep`).
 */
export function __mainStep__(e: Executor): bool {
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
