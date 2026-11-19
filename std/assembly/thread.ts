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

  /** Appends `slot`; false when the ring is full. */
  push(slot: i32): bool {
    let capacity = this.capacity;
    if (capacity <= 0) return false;
    let data = this.data;
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
