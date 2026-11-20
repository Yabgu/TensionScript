/// <reference path="./rt/index.d.ts" />

/**
 * The threading ABI and the structures it is built on.
 *
 * **`docs/thread-abi.md` is the contract**: the boot sequence, the carved
 * control-block layout, the two host imports, the exports, and the
 * slot-numbering rule. This file is the implementation of it.
 *
 * The host seam — two imports and, under `--sharedMemory`, these exports:
 *
 * | name | kind |
 * |---|---|
 * | `env.__startThread(execId) -> i32` | host import |
 * | `env.__executorCount() -> i32` | host import |
 * | `__threadInit(capacity) -> i32` | export: carve the control block |
 * | `__start() -> i32` | export (compiler-emitted): main's boot body |
 * | `__workerMain(id) -> i32` | export: a worker's whole life |
 * | `__spawnThread(id, entryIndex, argSlot) -> i32` | export: write the record, ask the host |
 * | `__executorExit(id) -> i32` / `__threadJoin(id) -> i32` | export: deterministic teardown |
 * | `__mainArenaBase/Size()`, `__workerArenaBase/Size(id)` | export: the spans the host configures |
 *
 * The guest primitives that do not need a host are `__spawnOn`,
 * `__serveOne` and `__drainInbox`; everything here runs on bare wasmtime for
 * them, which is what made Gate 3 testable without the Tension host.
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
/** Word 3 onward: the ring's cells, two words each. */
const SLOTS: i32 = 3;
/** A cell's value word, relative to the cell. */
const VALUE_WORD: i32 = 0;
/** A cell's sequence word, relative to the cell. */
const SEQ_WORD: i32 = 1;
/** Words per cell. */
const CELL_WORDS: i32 = 2;

const HEAD_OFF: usize = <usize>HEAD << 2;
const TAIL_OFF: usize = <usize>TAIL << 2;
const CAPACITY_OFF: usize = <usize>CAPACITY_WORD << 2;
const SLOTS_OFF: usize = <usize>SLOTS << 2;
/** Bytes from one cell to the next. */
const CELL_BYTES: usize = <usize>CELL_WORDS << 2;

/** Bytes of a ring word index. */
@inline function wordOffset(word: i32): usize {
  return <usize>word << 2;
}

/** Words a ring of `capacity` needs: `[head, tail, capacity, cells…]`. */
@inline function ringWords(capacity: i32): i32 {
  return 3 + capacity * CELL_WORDS;
}


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
 * **Ordering: a per-cell sequence stamp, not a sentinel.** `push` reserves the
 * tail with a CAS, writes the value, then writes the cell's stamp (`pos + 1`);
 * `pop` reads the stamp and takes a cell only when it says `pos + 1`.
 * A sentinel ("cell not written yet") cannot work across laps: after the first
 * lap the cell for a reserved-but-unpublished index still holds the *previous*
 * lap's value, so a consumer would read a stale entry and pass a live
 * reservation (measured: the cross-thread ring test lost entries). The stamp is
 * monotone, so every lap is distinguishable. `pop` advances the head with a
 * plain store — exactly one executor drains a given ring
 * (`docs/thread-abi.md` §3.2).
 *
 * **A push with a signal wakes the owner.** After the cell is published, a ring
 * with `signal != 0` bumps the signal word and notifies one waiter. That order
 * — publish, bump, notify — is what makes the wake unloseable; a consumer reads
 * the signal *before* it looks at the ring, so a producer that ran in between
 * changes the value the consumer would wait on and the wait returns instead of
 * sleeping (`docs/thread-abi.md` §5.3).
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
      let words = new Int32Array(ringWords(capacity));
      for (let i = 0; i < capacity; ++i) {
        unchecked(words[SLOTS + i * CELL_WORDS + VALUE_WORD] = 0);
        unchecked(words[SLOTS + i * CELL_WORDS + SEQ_WORD] = i);
      }
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
   * initialised already: head 0, tail 0, capacity, and each cell's stamp `c`.
   */
  static at(base: usize, capacity: i32): SlotRing {
    let ring = new SlotRing(0);
    ring.base = base;
    ring.capacity = capacity;
    return ring;
  }

  /**
   * Carves **and initialises** a ring's words at `base`.
   *
   * The host-facing half of `at`: `__threadInit` carves the whole control block
   * once, and a test or a program that carves its own span needs the same
   * initial state `new SlotRing` gives one — head 0, tail 0, the capacity word,
   * and cell `c` stamped `c`. Allocation-free, because the caller already owns
   * the memory.
   */
  static carve(base: usize, capacity: i32): SlotRing {
    let ring = new SlotRing(0);
    ring.base = base;
    ring.capacity = capacity;
    initRingWords(base, capacity);
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
    // The membership scan reads only **published** cells (`seq == index + 1`).
    let headNow = atomicLoad<i32>(base + HEAD_OFF);
    let tailNow = atomicLoad<i32>(base + TAIL_OFF);
    for (let i = headNow; i < tailNow; ++i) {
      let off = base + SLOTS_OFF + <usize>((i % capacity) << 3);
      if (atomicLoad<i32>(off + wordOffset(SEQ_WORD)) == i + 1
          && atomicLoad<i32>(off + wordOffset(VALUE_WORD)) == slot) return false;
    }
    while (true) {
      let pos = atomicLoad<i32>(base + TAIL_OFF);
      let head = atomicLoad<i32>(base + HEAD_OFF);
      if (pos - head >= capacity) return false;
      let off = base + SLOTS_OFF + <usize>((pos % capacity) << 3);
      let seq = atomicLoad<i32>(off + wordOffset(SEQ_WORD));
      if (seq == pos) {
        if (atomicCompareExchange<i32>(base + TAIL_OFF, pos, pos + 1) == pos) {
          atomicStore<i32>(off + wordOffset(VALUE_WORD), slot);
          // Publishing is the sequence stamp, written **after** the value: a
          // consumer that sees `pos + 1` sees the value.
          atomicStore<i32>(off + wordOffset(SEQ_WORD), pos + 1);
          // Publish, bump, notify — in that order, so a consumer that reads the
          // signal before it looks at the ring cannot miss this entry.
          let signal = this.signal;
          if (signal != 0) {
            atomicAdd<i32>(signal, 1);
            atomicNotify(signal, 1);
          }
          return true;
        }
      } else if (seq < pos) {
        // The cell still carries an older lap: the ring is full.
        return false;
      }
      // `seq > pos`: another producer took this index; read the new one.
    }
  }

  /** Removes the oldest slot, or `-1` when there is nothing published yet. */
  pop(): i32 {
    let capacity = this.capacity;
    if (capacity <= 0) return -1;
    let base = this.base;
    let pos = atomicLoad<i32>(base + HEAD_OFF);
    let tail = atomicLoad<i32>(base + TAIL_OFF);
    if (pos >= tail) return -1;
    let off = base + SLOTS_OFF + <usize>((pos % capacity) << 3);
    if (atomicLoad<i32>(off + wordOffset(SEQ_WORD)) != pos + 1) return -1; // reserved, not published
    let value = atomicLoad<i32>(off + wordOffset(VALUE_WORD));
    atomicStore<i32>(base + HEAD_OFF, pos + 1);
    // Free the cell for the lap after next. **After** the value is in hand and
    // the head has moved: a producer may only reserve this index again once
    // `pos + 1` is below the head, and it will see the stamp until then.
    atomicStore<i32>(off + wordOffset(SEQ_WORD), pos + capacity);
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
    let pos = atomicLoad<i32>(base + HEAD_OFF);
    let tail = atomicLoad<i32>(base + TAIL_OFF);
    if (pos >= tail) return true;
    return atomicLoad<i32>(base + SLOTS_OFF + <usize>((pos % capacity) << 3) + wordOffset(SEQ_WORD)) != pos + 1;
  }
}

// ── the executor ────────────────────────────────────────────────────────────

import { setWakeSink, TaskBase } from "./task";
import { __taskAt, __resumeTask, __serveSlot, __lastStatus } from "./task-stack";

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

  /**
   * An executor over **carved** queues — the Gate 4 shape.
   *
   * The object and its two handles live in this store's arena; the words they
   * point at belong to the control block, so another thread operates the same
   * queues by address. `signal` is the record's wake word (0 for a ring whose
   * owner never sleeps).
   */
  static at(
    id: i32,
    step: (e: Executor) => bool,
    readyBase: usize,
    inboxBase: usize,
    capacity: i32,
    signal: usize
  ): Executor {
    let e = new Executor(id, step, 0);
    let ready = SlotRing.at(readyBase, capacity);
    ready.signal = signal;
    let inbox = SlotRing.at(inboxBase, capacity);
    inbox.signal = signal;
    e.ready = ready;
    e.inbox = inbox;
    return e;
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
export function __setDefaultMainStep(step: (e: Executor) => bool): void {
  customStep = step;
  hasCustomStep = true;
  let main = mainExecutorInstance;
  if (main) changetype<Executor>(main).step = step;
}

export function __executorInit(): void {
  if (!sinkInstalled) {
    installWakeSink();
    sinkInstalled = true;
  }
  if (mainExecutorInstance) return;
  // **A shared build's main executor is bound by `__threadInit`, over the
  // carved rings**; a worker's by `__workerMain`, over its own. Creating one
  // here would place a second set of heap rings behind the same id.
  if (SHARED && __controlBase != 0) {
    if (selfExec == 0) bindExecutor(0);
    return;
  }
  let table = executors;
  if (!table) {
    table = new Array<Executor | null>();
    table.push(null); // id 0 is filled below; the index is the id
    executors = table;
  }
  let step: (e: Executor) => bool = __mainStep__;
  // `changetype`, not `!`: a nullable function value's non-null assertion
  // does not lower to valid IR here (`if condition must be valid`, measured),
  // while the two types are one wasm type and the cast is the identity.
  if (hasCustomStep) step = changetype<(e: Executor) => bool>(customStep);
  let main = new Executor(0, step);
  mainExecutorInstance = main;
  table[0] = main;
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
 * other queue (`docs/thread-abi.md` §3: ring contents are indices). Under
 * `--sharedMemory` that table is carved into the control block, so an index
 * means the same request in every store; a build without it keeps this per-store
 * array, which is all Gate 3 needs.
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
  // **Shared space: the request table is in the control block**, addressed by
  // index, so an index pushed by one store means the same request in another
  // (`docs/thread-abi.md` §3). A per-store `Array<Request>` cannot do that — the
  // second store's array is simply a different array.
  if (SHARED && __controlBase != 0) {
    let index = blockAllocRequest();
    if (index < 0) return; // the table is full; the request is refused, not lost
    atomicStore<i32>(requestWord(index, REQ_FUNC), funcIndex);
    atomicStore<i32>(requestWord(index, REQ_ARG), argSlot);
    atomicStore<i32>(requestWord(index, REQ_KEY), taskKey);
    atomicStore<i32>(requestWord(index, REQ_ORIGIN), selfExec);
    pushToExecutor(target, inboxBase(recordBase(target)), index);
    return;
  }
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
  let slot = __serveSlot(funcIndex);
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
    if (SHARED && __controlBase != 0) {
      // Read the request's words into store-local globals **before** serving and
      // before freeing the record: the served body reads them through
      // `__serveArg`/`__serveKey`/`__serveOrigin` and may suspend, after which
      // the record may already belong to another producer.
      let funcIndex = atomicLoad<i32>(requestWord(index, REQ_FUNC));
      let argSlot = atomicLoad<i32>(requestWord(index, REQ_ARG));
      let taskKey = atomicLoad<i32>(requestWord(index, REQ_KEY));
      let origin = atomicLoad<i32>(requestWord(index, REQ_ORIGIN));
      blockFreeRequest(index);
      servingArg = argSlot;
      servingKey = taskKey;
      servingOrigin = origin;
      last = __serveOne(e, funcIndex, argSlot, taskKey);
      continue;
    }
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

// ── the carved control block (Gate 4) ───────────────────────────────────────
//
// `docs/thread-abi.md` §3. One region, carved **once** by `__threadInit` before
// any worker exists. Nothing allocates in it afterwards: every structure below
// is plain words at a computed address, so a thread operates a queue because it
// knows a number, not because it allocated it. That is what lets the whole
// design skip a lock-free allocator.

/** Page size; the control block starts page-aligned past the static data. */
const PAGE_SIZE: usize = 65536;
/** `"THRD"` — proves the block was carved before a worker reads its header. */
const CONTROL_MAGIC: i32 = 0x54485244;
const HEADER_WORDS: i32 = 16;
const HEADER_BYTES: usize = <usize>HEADER_WORDS << 2;

const H_MAGIC: i32 = 0;
const H_TOTAL: i32 = 1;
const H_STRIDE: i32 = 2;
const H_CAPACITY: i32 = 3;
const H_REQUESTS: i32 = 4;

/** `funcIndex`, argument word, origin-defined key, origin executor id. */
const REQUEST_WORDS: i32 = 4;
const REQ_FUNC: i32 = 0;
const REQ_ARG: i32 = 1;
const REQ_KEY: i32 = 2;
const REQ_ORIGIN: i32 = 3;

/** Per-worker arena: its stack region plus its heap. */
const WORKER_ARENA_BYTES: usize = 1 << 20;
/** Main gets at least this much of the memory's tail. */
const MAIN_ARENA_BYTES: usize = 4 << 20;

/** The carved layout, exported so a host and the tests can read it back. */
export let __heapBase: i32 = 0;
export let __controlBase: i32 = 0;
export let __controlStride: i32 = 0;
export let __ringCapacity: i32 = 0;
export let __executorTotal: i32 = 0;

/** This store's executor id: `0` for main, set by `__workerMain` otherwise. */
let selfExec: i32 = 0;
/** The request table's address and the free-list ring's. */
let requestBase: usize = 0;
let freeRingBase: usize = 0;
let requestCount: i32 = 0;
/** The request currently being served by this store (see `__serveArg`). */
let servingArg: i32 = 0;
let servingKey: i32 = 0;
let servingOrigin: i32 = 0;
let sinkInstalled: bool = false;

/** The host imports. Emitted only under `--sharedMemory` (`SHARED`). */
// @ts-ignore: decorator
@external("env", "__startThread")
declare function __startThread(execId: i32): i32;

// @ts-ignore: decorator
@external("env", "__executorCount")
declare function __executorCount(): i32;

/** Initialises `[head, tail, capacity, cells…]`: empty, every cell unwritten. */
function initRingWords(base: usize, capacity: i32): void {
  atomicStore<i32>(base + HEAD_OFF, 0);
  atomicStore<i32>(base + TAIL_OFF, 0);
  atomicStore<i32>(base + CAPACITY_OFF, capacity);
  for (let i = 0; i < capacity; ++i) {
    let off = base + SLOTS_OFF + <usize>(i << 3);
    atomicStore<i32>(off + wordOffset(VALUE_WORD), 0);
    atomicStore<i32>(off + wordOffset(SEQ_WORD), i);
  }
}

/**
 * The control block's address **in this store**.
 *
 * `__controlBase` is a per-instance global, so a worker's copy is 0 (its
 * `$~start` never ran). The block's address is a function of `__heap_base`,
 * which is the same constant in every instance of this module, and the magic
 * word says it has been carved — so a worker finds it without being told.
 */
function controlBlockBase(): usize {
  let b = <usize>__controlBase;
  if (b != 0) return b;
  let here = (<usize>__heap_base + (PAGE_SIZE - 1)) & ~(PAGE_SIZE - 1);
  if (atomicLoad<i32>(here + (<usize>H_MAGIC << 2)) != CONTROL_MAGIC) return 0;
  return here;
}

@inline function recordBase(id: i32): usize {
  return <usize>__controlBase + HEADER_BYTES + <usize>id * <usize>__controlStride;
}

@inline function readyBase(rec: usize): usize {
  return rec;
}

@inline function inboxBase(rec: usize): usize {
  return rec + (<usize>ringWords(__ringCapacity) << 2);
}

/**
 * The record's `signal` word — the wake address for this executor's queues.
 *
 * `signal + 4` is the arena base, `+ 8` its size, `+ 12` the state
 * (0 unborn / 1 running / 2 exited), `+ 16` the spawn entry and `+ 20` its
 * argument.
 */
@inline function signalBase(rec: usize): usize {
  return inboxBase(rec) + (<usize>ringWords(__ringCapacity) << 2);
}

/**
 * Pushes `value` onto a carved ring addressed by `ring`.
 *
 * The same CAS-tail protocol as `SlotRing.push`, written once over an address so
 * the wake sink and `__spawnOn` do not need a `SlotRing` handle for an executor
 * that belongs to another store. Publishes the cell, then bumps and notifies
 * `signal` (`0` for a ring whose owner never sleeps).
 */
function blockPush(ring: usize, capacity: i32, value: i32, signal: usize): bool {
  while (true) {
    let pos = atomicLoad<i32>(ring + TAIL_OFF);
    let head = atomicLoad<i32>(ring + HEAD_OFF);
    if (pos - head >= capacity) return false;
    let off = ring + SLOTS_OFF + <usize>((pos % capacity) << 3);
    let seq = atomicLoad<i32>(off + wordOffset(SEQ_WORD));
    if (seq == pos) {
      if (atomicCompareExchange<i32>(ring + TAIL_OFF, pos, pos + 1) == pos) {
        atomicStore<i32>(off + wordOffset(VALUE_WORD), value);
        atomicStore<i32>(off + wordOffset(SEQ_WORD), pos + 1);
        if (signal != 0) {
          atomicAdd<i32>(signal, 1);
          atomicNotify(signal, 1);
        }
        return true;
      }
    } else if (seq < pos) {
      return false;
    }
  }
}

/** Pushes onto executor `id`'s ring — by number, from any store (`§4`). */
function pushToExecutor(id: i32, ring: usize, value: i32): bool {
  if (id < 0 || id >= __executorTotal) return false;
  let rec = recordBase(id);
  return blockPush(ring, __ringCapacity, value, signalBase(rec));
}

/**
 * The wake seam, **by executor number**.
 *
 * `TaskBase.settle` routes a waiter to `waiter.exec`; that executor may belong to
 * another store, in which case `__executorOf` answers `null` here and only the
 * carved ring can release it. This is the mechanism the whole arc is for: a
 * worker completing a task makes main runnable, and never runs main itself.
 */
function installWakeSink(): void {
  setWakeSink((exec: i32, slot: i32): void => {
    if (SHARED && __controlBase != 0) {
      let rec = recordBase(exec);
      blockPush(rec, __ringCapacity, slot, signalBase(rec));
      return;
    }
    let e = __executorOf(exec);
    if (e) changetype<Executor>(e).ready.push(slot);
  });
}

/** Registers executor `id` in this store's table, over its carved rings. */
function bindExecutor(id: i32): Executor {
  let table = executors;
  if (!table) {
    table = new Array<Executor | null>();
    executors = table;
  }
  while (table.length <= id) table.push(null);
  let rec = recordBase(id);
  let step: (e: Executor) => bool = __mainStep__;
  if (hasCustomStep) step = changetype<(e: Executor) => bool>(customStep);
  let e = Executor.at(id, step, readyBase(rec), inboxBase(rec), __ringCapacity, signalBase(rec));
  table[id] = e;
  if (id == 0) mainExecutorInstance = e;
  return e;
}

/** `__spawnOn`'s allocator: one index from the carved free-list ring. */
function blockAllocRequest(): i32 {
  let free = freeRingBase;
  let capacity = requestCount;
  if (free == 0 || capacity <= 0) return -1;
  while (true) {
    let head = atomicLoad<i32>(free + HEAD_OFF);
    let tail = atomicLoad<i32>(free + TAIL_OFF);
    if (head >= tail) return -1;
    if (atomicCompareExchange<i32>(free + HEAD_OFF, head, head + 1) == head) {
      return atomicLoad<i32>(free + SLOTS_OFF + <usize>(head % capacity << 2));
    }
  }
}

/** Returns an index to the free-list ring. Multi-producer, like the alloc. */
function blockFreeRequest(index: i32): void {
  let free = freeRingBase;
  let capacity = requestCount;
  if (free == 0 || capacity <= 0 || index < 0 || index >= capacity) return;
  while (true) {
    let tail = atomicLoad<i32>(free + TAIL_OFF);
    let head = atomicLoad<i32>(free + HEAD_OFF);
    if (tail - head >= capacity) return;
    if (atomicCompareExchange<i32>(free + TAIL_OFF, tail, tail + 1) == tail) {
      atomicStore<i32>(free + SLOTS_OFF + <usize>(tail % capacity << 2), index);
      return;
    }
  }
}

@inline function requestWord(index: i32, word: i32): usize {
  return requestBase + <usize>((index * REQUEST_WORDS + word) << 2);
}

/**
 * `__threadInit(capacity) -> i32` — carve the control block, once, on main.
 *
 * Called by the host **before `__start` and before the first `__spawnThread`**.
 * It carves and returns; it does **not** configure main's arena, because
 * `__arenaInit` moves `__stack_pointer` and must run with no live guest frame.
 * The host's sequence is:
 *
 * ```js
 * instance.exports.__threadInit(capacity);          // carve
 * instance.exports.__arenaInit(                      // main's slice
 *   instance.exports.__mainArenaBase(),
 *   instance.exports.__mainArenaSize()
 * );
 * instance.exports.__start();                        // boot, in that slice
 * ```
 *
 * Answers `0` on success, `-1` when the build is not shared or the host reports
 * no executors, `-2` when memory cannot be grown to hold the layout.
 *
 * The layout, in one contiguous region starting at the first page boundary after
 * the static data (`docs/thread-abi.md` §3):
 *
 * - **header** — magic, `executorTotal`, `controlStride`, `ringCapacity`,
 *   `requestCount`
 * - **per executor, `stride` bytes** — `ready` ring, `inbox` ring, `signal`,
 *   `arenaBase`, `arenaSize`, `state`, `entry`, `arg`
 * - **request table** — `requestCount` × 4 words, then its free-list ring
 * - **arenas** — one per worker, then main's, which is the memory's tail
 */
// @ts-ignore: decorator
@global @unsafe
export function __threadInit(capacity: i32): i32 {
  if (!SHARED) return -1;
  if (__controlBase != 0) return 0;
  if (capacity <= 0) capacity = DEFAULT_CAPACITY;
  let total = __executorCount();
  if (total <= 0) return -1;

  // Two rings of `ringWords(capacity)` plus six record words, 16-byte aligned.
  let stride: usize = (<usize>(2 * ringWords(capacity) + 6) * 4 + 15) & ~<usize>15;
  let requests = capacity;
  let recordBytes = <usize>total * stride;
  let requestBytes = <usize>(requests * REQUEST_WORDS) * 4;
  let freeBytes = <usize>(requests + 3) * 4;
  let controlBytes = HEADER_BYTES + recordBytes + requestBytes + freeBytes;

  let here = (<usize>__heap_base + (PAGE_SIZE - 1)) & ~(PAGE_SIZE - 1);
  let workers = <usize>(total - 1);
  let arenasBase = here + controlBytes;
  let needEnd = arenasBase + workers * WORKER_ARENA_BYTES + MAIN_ARENA_BYTES;
  let needPages = <i32>((needEnd + (PAGE_SIZE - 1)) >> 16);
  let have = memory.size();
  if (have < needPages && memory.grow(needPages - have) < 0) return -2;

  memory.fill(here, 0, controlBytes);

  __controlBase = <i32>here;
  __heapBase = <i32>here;
  __controlStride = <i32>stride;
  __ringCapacity = capacity;
  __executorTotal = total;
  requestBase = here + HEADER_BYTES + recordBytes;
  freeRingBase = requestBase + requestBytes;
  requestCount = requests;

  atomicStore<i32>(here + (<usize>H_MAGIC << 2), CONTROL_MAGIC);
  atomicStore<i32>(here + (<usize>H_TOTAL << 2), total);
  atomicStore<i32>(here + (<usize>H_STRIDE << 2), <i32>stride);
  atomicStore<i32>(here + (<usize>H_CAPACITY << 2), capacity);
  atomicStore<i32>(here + (<usize>H_REQUESTS << 2), requests);

  for (let id = 0; id < total; ++id) {
    let rec = here + HEADER_BYTES + <usize>id * stride;
    initRingWords(readyBase(rec), capacity);
    initRingWords(inboxBase(rec), capacity);
    let sig = signalBase(rec);
    atomicStore<i32>(sig, 0);
    atomicStore<i32>(sig + 4, id == 0 ? 0 : <i32>(arenasBase + <usize>(id - 1) * WORKER_ARENA_BYTES));
    atomicStore<i32>(sig + 8, id == 0 ? 0 : <i32>WORKER_ARENA_BYTES);
    atomicStore<i32>(sig + 12, id == 0 ? 1 : 0);
    atomicStore<i32>(sig + 16, -1);
    atomicStore<i32>(sig + 20, 0);
  }

  let free = freeRingBase;
  atomicStore<i32>(free + HEAD_OFF, 0);
  atomicStore<i32>(free + TAIL_OFF, requests);
  atomicStore<i32>(free + CAPACITY_OFF, requests);
  for (let i = 0; i < requests; ++i) {
    atomicStore<i32>(free + SLOTS_OFF + <usize>(i << 2), i);
  }

  // Main's arena is the memory's tail. It is configured last, because
  // `__arenaInit` discards everything allocated before it.
  let mainBase = arenasBase + workers * WORKER_ARENA_BYTES;
  let mainEnd = <usize>memory.size() << 16;
  let mainRec = here + HEADER_BYTES;
  atomicStore<i32>(signalBase(mainRec) + 4, <i32>mainBase);
  atomicStore<i32>(signalBase(mainRec) + 8, <i32>(mainEnd - mainBase));
  // **Not `__arenaInit` here.** It must be called with no live guest frame: it
  // moves `__stack_pointer`, and this frame's shadow-stack slots are addressed
  // as `__stack_pointer + k`, so calling it here would move the frame into the
  // arena's heap. The host configures main's arena next, then calls `__start`.
  return 0;
}

/**
 * `__workerMain(id) -> i32` — a worker's whole life.
 *
 * Called by the host on a **fresh instance over the same memory**, with the id
 * the guest published in `__spawnThread`. The host configures this store's
 * arena first — `__arenaInit(__workerArenaBase(id), __workerArenaSize(id))` —
 * because `__arenaInit` moves `__stack_pointer` and must run with no live guest
 * frame. Then this builds the store's `Executor` over the carved rings, serves
 * the recorded spawn entry if there is one, and loops — drain the inbox, drive
 * one ready slot, wait on the record's signal when both are empty. Exits on
 * `stop`, on `__executorExit(id)`, or when the record's state is `2`.
 *
 * An arena that is missing or does not cover the record answers `-3`: the
 * alternative is running on another instance's heap, which the collector would
 * only discover as a corruption.
 *
 * **A worker's globals are zero.** `$~start` never runs here, so nothing that
 * depends on a module initializer may be read before this function sets it; the
 * control block is found from `__heap_base`, which is the same constant in
 * every instance, and the magic word says it has been carved.
 */
// @ts-ignore: decorator
@global @unsafe
export function __workerMain(id: i32): i32 {
  if (!SHARED) return -1;
  let here = controlBlockBase();
  if (here == 0) return -2;
  let total = atomicLoad<i32>(here + (<usize>H_TOTAL << 2));
  if (id <= 0 || id >= total) return -1;

  __controlBase = <i32>here;
  __controlStride = atomicLoad<i32>(here + (<usize>H_STRIDE << 2));
  __ringCapacity = atomicLoad<i32>(here + (<usize>H_CAPACITY << 2));
  __executorTotal = total;
  requestCount = atomicLoad<i32>(here + (<usize>H_REQUESTS << 2));
  requestBase = here + HEADER_BYTES + <usize>total * <usize>__controlStride;
  freeRingBase = requestBase + <usize>(requestCount * REQUEST_WORDS) * 4;
  selfExec = id;

  let rec = recordBase(id);
  let sig = signalBase(rec);
  // The host called `__arenaInit` before this, exactly as for main: the arena
  // must exist before any guest frame, and this frame's slots are addressed off
  // `__stack_pointer`. Refuse rather than run on the wrong heap.
  let arenaBase = <usize>atomicLoad<i32>(sig + 4);
  let arenaSize = <usize>atomicLoad<i32>(sig + 8);
  let heapBase = __arenaHeapBase();
  if (heapBase <= arenaBase || heapBase >= arenaBase + arenaSize) return -3;
  let e = bindExecutor(id);
  if (!sinkInstalled) {
    installWakeSink();
    sinkInstalled = true;
  }

  let entry = atomicLoad<i32>(sig + 16);
  if (entry >= 0) {
    servingArg = atomicLoad<i32>(sig + 20);
    servingKey = 0;
    servingOrigin = 0;
    __serveOne(e, entry, servingArg, 0);
  }

  while (!e.stop && atomicLoad<i32>(sig + 12) != 2) {
    if (e.inbox.depth > 0) {
      __drainInbox(e);
      continue;
    }
    if (e.ready.depth > 0) {
      if (e.step(e)) break;
      continue;
    }
    // Read the signal **before** the final check: a push in between changes the
    // value this wait expects, so the wait returns instead of sleeping.
    let seen = atomicLoad<i32>(sig);
    if (e.inbox.depth > 0 || e.ready.depth > 0) continue;
    atomicWait<i32>(sig, seen, -1);
  }

  atomicStore<i32>(sig + 12, 2);
  atomicNotify(sig + 12, -1);
  atomicNotify(sig, -1);
  return __lastStatus();
}

/**
 * `__spawnThread(id, entryIndex, argSlot) -> i32` — write the record, then ask
 * the host for the machine.
 *
 * The guest fills everything the worker needs and the host reads only what the
 * guest published; the host writes no guest memory. `entryIndex` is a
 * `$starts` index (identical in every store) served once at startup, or `-1`
 * for a worker that only drains its inbox. Answers the host import's status, or
 * `-1`/`-2` when the id is out of range or already born.
 */
export function __spawnThread(id: i32, entryIndex: i32, argSlot: i32): i32 {
  if (!SHARED || __controlBase == 0) return -1;
  if (id <= 0 || id >= __executorTotal) return -1;
  let sig = signalBase(recordBase(id));
  if (atomicLoad<i32>(sig + 12) != 0) return -2;
  atomicStore<i32>(sig + 16, entryIndex);
  atomicStore<i32>(sig + 20, argSlot);
  let status = __startThread(id);
  if (status != 0) atomicStore<i32>(sig + 12, 2);
  return status;
}

/**
 * `__executorExit(id) -> i32` — end executor `id`'s loop, deterministically.
 *
 * The state word is the shared half (a worker's `stop` field is store-local, so
 * another store cannot set it); it is bumped and notified, which releases both
 * the worker's idle wait and any `__threadJoin`.
 */
export function __executorExit(id: i32): i32 {
  if (!SHARED || __controlBase == 0) return -1;
  if (id < 0 || id >= __executorTotal) return -1;
  let sig = signalBase(recordBase(id));
  let e = __executorOf(id);
  if (e) changetype<Executor>(e).stop = true;
  atomicStore<i32>(sig + 12, 2);
  atomicNotify(sig + 12, -1);
  atomicNotify(sig, -1);
  return 0;
}

/**
 * `__threadJoin(id) -> i32` — wait until executor `id` has exited.
 *
 * Parks on the record's state word with `atomicWait`, not a spin: the exiting
 * side notifies it. Answers `0` once the state is `2`.
 */
export function __threadJoin(id: i32): i32 {
  if (!SHARED || __controlBase == 0) return -1;
  if (id < 0 || id >= __executorTotal) return -1;
  let addr = signalBase(recordBase(id)) + 12;
  while (true) {
    let state = atomicLoad<i32>(addr);
    if (state == 2) return 0;
    atomicWait<i32>(addr, state, -1);
  }
}

/**
 * The argument word of the request being served.
 *
 * `$starts` entries are canonical `() -> i32`: a served continuation is handed
 * no operands, so the request record carries the one `i32` a served body takes.
 * Read it **before the body's first suspension** if the value has to survive
 * one; the runtime copies it into this store when it dequeues the request.
 */
export function __serveArg(): i32 {
  return servingArg;
}

/** The origin-defined key of the request being served (see `__spawnOn`). */
export function __serveKey(): i32 {
  return servingKey;
}

/** The executor that posted the request being served. */
export function __serveOrigin(): i32 {
  return servingOrigin;
}

/** This store's executor id (`0` on main). */
export function __selfExecutor(): i32 {
  return selfExec;
}

/**
 * The span the **host** configures before `__start()`:
 * `__arenaInit(__mainArenaBase(), __mainArenaSize())`.
 *
 * Split from `__threadInit` because `__arenaInit` must be called with no live
 * guest frame — see its own note. Answers `0` before `__threadInit`.
 */
export function __mainArenaBase(): i32 {
  if (__controlBase == 0) return 0;
  return atomicLoad<i32>(signalBase(<usize>__controlBase + HEADER_BYTES) + 4);
}

/** @see __mainArenaBase */
export function __mainArenaSize(): i32 {
  if (__controlBase == 0) return 0;
  return atomicLoad<i32>(signalBase(<usize>__controlBase + HEADER_BYTES) + 8);
}

/**
 * The span a worker's host configures before `__workerMain(id)`:
 * `__arenaInit(__workerArenaBase(id), __workerArenaSize(id))`.
 *
 * The worker's store reads the record itself too; these are for the host, which
 * should not have to duplicate the layout.
 */
export function __workerArenaBase(id: i32): i32 {
  let here = controlBlockBase();
  if (here == 0) return 0;
  let total = atomicLoad<i32>(here + (<usize>H_TOTAL << 2));
  if (id <= 0 || id >= total) return 0;
  let stride = atomicLoad<i32>(here + (<usize>H_STRIDE << 2));
  let capacity = atomicLoad<i32>(here + (<usize>H_CAPACITY << 2));
  let rec = here + HEADER_BYTES + <usize>id * <usize>stride;
  let sig = rec + (<usize>(2 * ringWords(capacity)) << 2);
  return atomicLoad<i32>(sig + 4);
}

/** @see __workerArenaBase */
export function __workerArenaSize(id: i32): i32 {
  let here = controlBlockBase();
  if (here == 0) return 0;
  let total = atomicLoad<i32>(here + (<usize>H_TOTAL << 2));
  if (id <= 0 || id >= total) return 0;
  let stride = atomicLoad<i32>(here + (<usize>H_STRIDE << 2));
  let capacity = atomicLoad<i32>(here + (<usize>H_CAPACITY << 2));
  let rec = here + HEADER_BYTES + <usize>id * <usize>stride;
  let sig = rec + (<usize>(2 * ringWords(capacity)) << 2);
  return atomicLoad<i32>(sig + 8);
}
