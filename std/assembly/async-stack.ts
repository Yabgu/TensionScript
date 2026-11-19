// The suspending shell's source-visible half (A2).
//
// A1's library (`std/assembly/async.ts`) is the policy of a shell that cannot
// suspend. A2 adds the task cell and the queue; this file is where the names
// the *transform* emits live, because a transform can only name top-level std
// declarations (a submodule's members are not in the program's global element
// index). Everything else — the loop, the queues, the park rule — stays in
// `async.ts`, as §7.4 of `docs/async-core-loop.md` asks.
//
// **Nothing is emitted unless the shell is built.** The file is parsed with
// every program, but its functions and globals are ordinary lazy elements: a
// program that does not use the suspending shell compiles none of them, which
// is what keeps A1 and Backend A byte-identical.

import { TaskRecord } from "./task";

/**
 * Installs `start`'s continuation in the next table slot and returns the slot.
 *
 * `start` is a function *name*, not a value — `cont.new` needs a raw
 * `(ref $ft)`, and the compiler is the only layer that can emit `ref.func`.
 * A2's park tag carries the awaited record address, so there is no
 * slot -> record map and the slot allocation needs nothing but the counter.
 */
// @ts-ignore: decorator
@builtin
export declare function __installCont(start: () => i32): i32;

/**
 * Bump-allocates `size` bytes from the zeroed task arena and returns the
 * address. No runtime, so a module that starts a task still instantiates on a
 * bare wasmtime: `new` would import `env.abort`.
 *
 * The arena is a static data segment, so a cell's unwritten fields (the wait
 * link, the ready link, `done`, `payload`) are zero, and the heap starts after
 * the arena rather than inside it.
 */
// @ts-ignore: decorator
@builtin
export declare function __allocCell(size: i32): usize;

/**
 * Writes the handle's `_record` (offset 0) with a plain store. The class's
 * generated setter calls the runtime's `__link`, which a static-arena cell does
 * not need; avoiding it keeps a task-starting module import-free.
 */
// @ts-ignore: decorator
@builtin
export declare function __setTaskRecord(task: i32, record: i32): void;

/** The current task record's address, set by `__resumeSlot` before a resume. */
// @ts-ignore: decorator
@builtin
export declare function __currentRecordRaw(): usize;

/** The record as a typed reference; the raw builtin carries the address. */
export function __currentRecord(): TaskRecord {
  return changetype<TaskRecord>(__currentRecordRaw());
}
