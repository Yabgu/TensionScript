// The async core loop — the **policy** half of the continuation shell.
//
// `docs/async-core-loop.md` §7.4 splits the runtime in two: the *mechanism*
// (the tags, `suspend`, `cont.new`, `resume`, the continuation table) and the
// *policy* (the loop, the ready list, fairness). The mechanism cannot be
// written in TensionScript — the language has no syntax for those instructions
// and no continuation type — so it lives in the compiler and reaches this file
// as the `@builtin` intrinsics below. The policy is ordinary code, and it lives
// here so a later round edits a loop rather than a `.wat` file.
//
// **Pulled in only when referenced.** The compiler emits a call to
// `~lib/async/__coreloop` when it builds the shell (a program that contains a
// may-suspend declaration and no `await`); a program that does not gets
// exactly the module it got before this file existed. Nothing else in std
// imports it, and no top-level statement runs at startup.
//
// The intrinsics are the tree's `__`-prefixed compiler-owned convention
// (`__visit`, `__new`, `__closureInit`) and are deliberately **not exported**:
// a user cannot import them from here, and the compiler refuses a call reached
// from any source other than this file (`src/builtins.ts`).

import { TaskRecord } from "./task";

// @ts-ignore: decorator
@builtin
declare function __resumeMain(): i32;

// A2's mechanism, declared here because only this file calls it.
// @ts-ignore: decorator
@builtin
declare function __resumeSlot(slot: i32, record: i32): i32;

// @ts-ignore: decorator
@builtin
declare function __lastStatus(): i32;

// @ts-ignore: decorator
@builtin
declare function __suspendDone(status: i32): void;

// @ts-ignore: decorator
@builtin
declare function __suspendIdle(): void;

/**
 * Resumes the program's entry continuation, then reports its status.
 *
 * A1 has exactly one continuation and it cannot suspend (there is no `await`
 * yet), so this is a straight line. P3 replaces the first statement with
 * "take the next runnable and resume it" and adds the idle park
 * (`__suspendIdle`) for when the ready list is empty — the three primitives are
 * already the ones that shape needs, and the parking rule (park only when
 * *nothing* is runnable) is why the loop belongs here rather than in
 * `__start`.
 *
 * **Deliberately not exported.** The compiler reaches it by internal name
 * (`~lib/async/__coreloop`), exactly as the closure lowering reaches
 * `~lib/closures/__closureInit`, so `export` is not what makes it compile —
 * and without the export no source can call it. That matters: a second entry
 * into the core loop is §4.7's nested pump, and there is nothing it could
 * safely do.
 */
function __coreloop(): void {
  let status = __resumeMain();
  __suspendDone(status);
}

/**
 * The single host entry (`docs/async-core-loop.md` §6): resume the core loop
 * and report how many contexts ran.
 *
 * **Nothing can be idle in A1.** The one continuation runs to completion inside
 * `__coreloop` before `__start` returns, so there is no parked core loop to
 * resume and `0` is the honest answer. The export exists now because its
 * absence later would be a silent change to the host API; P3 fills in the
 * resume when a ready queue can actually be empty.
 */
export function __asyncPump(): i32 {
  return 0;
}

/**
 * A2's core loop: resume the next runnable task, and park only when there is
 * nothing runnable.
 *
 * A2 never has more than one runnable task: a park names exactly one awaited
 * task, and a completion releases exactly one waiter. `ready` is therefore the
 * ready queue's head and the queue's length is one; the **wait** side is a
 * stack threaded through `TaskRecord.status`, which is what makes
 * `main → a → await b` work with two parks live at once. When `b` completes the
 * top waiter is `a`; when `a` completes the next is `main`. A single park cell
 * — the cheaper alternative — would overwrite the outer waiter here and lose
 * `main`.
 *
 * **Two `TaskRecord` fields are borrowed.** `class_` is the ready-list link
 * and `status` is the wait-stack link. A2's tasks deliver no capability status
 * and belong to no family, so neither field has its Backend A meaning here;
 * the record's contract fields A2 *does* use are `payload` (the i32 result),
 * `done`, and `key` (the continuation slot).
 *
 * `__resumeSlot` returns the awaited task's record address, or `0` for a
 * normal completion; `__lastStatus()` then carries the status the continuation
 * returned. Every continuation is `() -> i32` (the compiler wraps `main` too),
 * so the status is always there.
 *
 * **The root never suspends on a task.** This loop calls `resume`; a
 * suspension inside a task is caught by `__resumeSlot`'s `$await` handler, so
 * nothing here can be captured. `$idle` is only reached when the ready queue is
 * empty, which in A2 means there is no host work — the loop exits with the last
 * status instead.
 */
export function __coreloopAwait(): void {
  // The ready queue. `0` is main (there is no record for the root); `-1` is
  // empty. A task record pointer is never 0, so the encoding is unambiguous.
  // The links live in `TaskRecord.class_`, which A2 uses for nothing else.
  let readyHead: i32 = 0;
  let readyTail: i32 = 0;
  // The wait stack, as a record pointer; `0` is main, `-1` is empty. A task's
  // link lives in its record's `status` field (unused by A2 for anything else).
  let waitHead: i32 = -1;
  let status = 0;
  while (readyHead != -1) {
    let task = readyHead;
    if (task == 0) {
      readyHead = -1;
      readyTail = -1;
    } else {
      let rec = changetype<TaskRecord>(task);
      readyHead = rec.class_;
      if (readyHead == -1) readyTail = -1;
    }

    let parked: i32;
    if (task == 0) {
      parked = __resumeSlot(0, 0);
    } else {
      parked = __resumeSlot(changetype<TaskRecord>(task).key, task);
    }

    if (parked != 0) {
      // The task parked on `parked`: it becomes the top waiter, and the
      // awaited task joins the ready queue. In A2 the queue is empty here, so
      // this is one element — the shape is a queue anyway, because A4 adds
      // independent work.
      if (task != 0) changetype<TaskRecord>(task).status = waitHead;
      waitHead = task;
      let awaited = changetype<TaskRecord>(parked);
      awaited.class_ = -1;
      if (readyHead == -1) readyHead = parked;
      else if (readyTail != 0) changetype<TaskRecord>(readyTail).class_ = parked;
      readyTail = parked;
    } else {
      status = __lastStatus();
      if (waitHead != -1) {
        let waiter = waitHead;
        if (waiter == 0) {
          waitHead = -1;
        } else {
          waitHead = changetype<TaskRecord>(waiter).status;
        }
        // Put the released waiter at the back of the ready queue. `main` has
        // no record to link, and in A2 it is the only waiter for a completion,
        // so the queue is empty and it becomes the head directly.
        if (waiter == 0) {
          readyHead = 0;
          readyTail = 0;
        } else {
          let wrec = changetype<TaskRecord>(waiter);
          wrec.class_ = -1;
          if (readyHead == -1) readyHead = waiter;
          else if (readyTail != 0) changetype<TaskRecord>(readyTail).class_ = waiter;
          readyTail = waiter;
        }
      }
    }
  }
  __suspendDone(status);
}
