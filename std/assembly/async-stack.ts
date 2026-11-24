// The suspending shell's source-visible half (A2).
//
// A1's library (`std/assembly/async.ts`) is the policy of a shell that cannot
// suspend. A2 adds the task object and the ready queue; this file is where the
// names the *transform* emits live, because a transform can only name top-level
// std declarations (a submodule's members are not in the program's global
// element index).

import { TaskRecord } from "./task";

// **Nothing is emitted unless the shell is built.** The file is parsed with
// every program, but its functions and globals are ordinary lazy elements: a
// program that does not use the suspending shell compiles none of them, which
// is what keeps A1 and Backend A byte-identical.

/**
 * Installs `start`'s continuation in the next table slot and returns the slot.
 *
 * `start` is a function *name*, not a value — `cont.new` needs a raw
 * `(ref $ft)`, and the compiler is the only layer that can emit `ref.func`.
 * The entry stores the slot on the task object; the slot's table entry is the
 * task's start continuation and, after a suspension, its suspended
 * continuation.
 */
// @ts-ignore: decorator
@builtin
export declare function __installCont(start: () => i32): i32;

/**
 * Suspends the **current** task, naming the task slot it is waiting for.
 *
 * The payload is an `i32` slot rather than an object reference, so the tag is
 * the same in both class representations and a scheduler can carry it across a
 * thread boundary. `drive` is the only caller: a task that awaits an unsettled
 * task parks itself here, and the executor resumes it from the same slot once
 * the awaited task settles.
 */
// @ts-ignore: decorator
@builtin
export declare function __suspendAwait(awaitedSlot: i32, awaited: TaskRecord | null): void;

