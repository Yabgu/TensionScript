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

import { mainExecutor } from "./thread";
import { __lastStatus } from "./task-stack";

// @ts-ignore: decorator
@builtin
declare function __resumeMain(): i32;

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
 * The stackful executor loop: drive main's executor until it has nothing left.
 *
 * **The loop is the entry; the policy is the `step` field** (`docs/task-design.md`
 * §1.3, §5). One iteration is `e.step(e)`; `true` stops. Main's default step is
 * `mainStep` (drain inbox, pop ready, drive), and assigning
 * `mainExecutor().step` replaces it — which is what makes the fallback a
 * program decision rather than a runtime one (§9.0).
 *
 * **The ready queue holds slots, and a task's slot is its identity.** `main` is
 * slot 0; every `async function`'s entry hands its task object a slot from
 * `__installCont`. A suspension parks the current task (its slot is the waiter)
 * and queues the awaited task; a completion (`TaskBase#settle`) queues every
 * waiter on its own executor. Nothing is resumed from inside a completing task's
 * own body, so the executor is the only resumer.
 *
 * The loop stops when the queues are empty: a step that never stops on its own
 * (main's) is bounded by the work there is.
 */
export function __coreloopAwait(): void {
  let e = mainExecutor();
  // main is slot 0 and has no task object.
  e.ready.push(0);
  while (!e.stop && (e.ready.depth > 0 || e.inbox.depth > 0)) {
    if (e.step(e)) break;
  }
  __suspendDone(__lastStatus());
}
