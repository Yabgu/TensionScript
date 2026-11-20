# The task model: promise is a state machine, task is a stack

**Promise = state machine. Task = stack.**

That sentence is the law this fork ships under, and it is the one fact the names
in the tree had stopped agreeing with. A *Promise* lowers a suspension into a
resume point plus the fields that have to survive it; the suspended frame is
gone, reconstructed at each resume. A *Task* keeps the suspended frame on its
own stack: the continuation is parked whole, and resuming it continues the same
frame rather than rebuilding one.

## What a suspension costs

In the Promise model, every `await` is a compiled split: the function becomes a
state machine, each await site becomes a numeric state, and every local that is
live across a suspension becomes a field of a record. The cost is paid at
compile time (a lowered copy of the function per instantiation) and at run time
(a record write per live local, per suspension). The host drives the machine: it
is told "parked at state 3 with this record" and later "resume at state 3".

In the Task model, a suspension parks the current continuation and saves nothing
in the source language: the frame is already on a stack, and the continuation
handle names it. The cost is a stack per task and a switch between them; the
benefit is that the function's own locals, its loops and its call depth all
survive without the compiler enumerating them, and a suspension inside a loop is
the same cost as any other. This fork's shipped path is the Task, because the
programs it exists for (a guest that awaits inside a loop, a task that crosses a
store, a frame that must come back exactly where it stopped) are the ones a state
machine makes expensive and fragile.

## Which file is which

| file | model | what it is |
|---|---|---|
| `std/assembly/task.ts` — `TaskRecord` | **Promise** | the state-machine backend's storage record; fixed byte offsets are its contract |
| `std/assembly/task-rt.ts` — `hostPark` | **Promise** | the state machine's park seam: the record and the await tag go to the host scheduler |
| `src/async/lower.ts` | **Promise** | the lowering that turns each `await` into states and record writes |
| `std/assembly/task.ts` — `TaskBase` | **Task** | one object per execution; `drive` is the only operation |
| `std/assembly/task-stack.ts` | **Task** | the slot table, `__parkOn`, `__resumeTask`, the mask counters |
| `src/async/stack.ts` | **Task** | the transform that emits `f$body` / `f$start` / `f$spawnStart` and the per-function `f$Rec extends Task<R>` |

`src/async/lower.ts` is the Promise backend only. It is still compiled and its
tests still pass; it is not what an `await` produces in a program built with
`--enable stack-switching`, and it is not what any example or threading test
exercises.

## The shipped path

The shipped path is the **Task**. `tests/rt/gate4.js` — the suite that proves the
whole threading ABI, from rings across threads through a cross-store await,
identity, masks and a program-written `MaskBase` — exercises Tasks only. Its
fixtures are compiled with `--enable stack-switching`, and their suspension is a
parked continuation, not a lowered record. The examples in `examples/` are the
same backend.

A Task suspension has three builtins in its protocol:

- `__installCont(f$start)` gives a task its slot in the module's continuation
  table (`$~asyncCont`), the table `cont.new`/`resume` actually use;
- `__parkOn(t)` registers the current task as a waiter on `t`, recording the
  executor that must resume it;
- `__resumeTask(slot)` runs the continuation and answers the slot it is waiting
  on, or `-1` when it finished.

`await t` is therefore `if (!t.settled) <awaiter>(t); return t.value` — the
awaiter is `t.policy.await(t)` when a policy is attached, and `t.drive()`
otherwise.

## Why `TaskRecord` is still named that

`TaskRecord` is a Promise record and its name is historical. It is **not** being
renamed in this round: the Promise backend reads and writes it at fixed byte
offsets (`payload` at 8, `f0`/`f1` at 16, `done` at 28), and those offsets are a
contract for that backend's compiled output and fixtures. A rename is a
mechanical change across `task.ts`, `task-rt.ts`, `src/async/lower.ts` and the
fixtures; it should be its own commit, with the offsets re-measured, not a
side-effect of this document.

Until then: read `TaskRecord` as "the Promise record", and read `TaskBase` /
`Task<T>` as "the Task".

## Writing a step

A **step** is one iteration of "what runs next on this thread": `(e: Executor) =>
bool`, where `true` stops the executor. The default is `__mainStep__` — drain the
inbox, then resume **one** ready slot — and it is a field (`Executor.step`), so a
program replaces it three ways, one name throughout: declare `mainStep` and the
shell installs it at startup, assign `mainExecutor().step = myStep` at runtime, or
build an executor with the step you want. The default does not change when you
do; the point is that you can replace it.

Everything a step needs is importable from **one** module:

```ts
import {
  Executor, mainExecutor, __drainInbox, driveReady,
  __taskAt, __resumeTask, __parkOn, __currentTask, __serveSlot, __lastStatus,
  __submitTask,
} from "~lib/thread";
```

`~lib/task-stack` still *defines* the primitives; `~lib/thread` re-exports them,
so a step author does not have to know which file owns which. (A slot names an
entry in this store's continuation table, and the table is the runtime's, not a
policy's — that is why they live beside the executor rather than in the compiler.)

### The primals, and what each one is allowed to touch

- **`__drainInbox(e): i32`** — serves every request addressed to `e` and answers
  the last serve's status (`-1` if there were none). *Reads* `e.inbox`, the
  request table; *writes* the continuations it creates, the tasks they name, and
  the ready ring. It runs no task body: a served entry parks on the task it
  creates, and that slot is queued for a later iteration. That is what makes
  "drain first" a policy choice rather than a necessity.
- **`driveReady(e)`** — the one-slot step: pops the oldest ready slot and resumes
  it, skipping a settled task, then queues whatever the resume reports it parked
  on. *Reads* `e.ready`; *writes* the continuation table (a suspension is stored
  back at its own slot) and `e.ready` again.
- **`__taskAt(slot): TaskBase | null`** — the task registered at `slot`, or
  `null` for main (slot 0) and for a served continuation, which has no task
  object at all. *Reads* the slot table; writes nothing. This is how a step
  inspects the work it is about to run: `__taskAt(slot).policy` is readable by
  design, so a policy's rank (or deadline, or affinity) is the caller's
  information and the step can sort by it.
- **`__currentTask(): TaskBase | null`** — the task whose continuation is
  running, or `null` on main. Restores correctly across a nested resume, so a
  served body that drains its own inbox still sees *itself*.
- **`__resumeTask(slot): i32`** — runs `table[slot]` with the shell's `$await`
  handler. Answers `-1` when the task ran to completion, `>= 0` when it parked
  on that local slot, and `-2` when it parked on something that is not a local
  slot (work in another store). A step that ignores a non-negative answer loses
  the wake-up; there is no second chance to learn it.
- **`__parkOn(task)`** — never called by a step. It is what a body's `drive()`
  calls before suspending; it records the waiter and the executor that must
  resume it. Listed here because it is in the import, and because the rule it
  encodes ("the waiter is woken in the store it parked in") is the one a step
  must not try to second-guess.
- **`__serveSlot(funcIndex): i32`** — turns `$starts[funcIndex]` into a fresh
  continuation in **this** store. The receiving half of `__spawnOn`; a step
  normally reaches it through `__drainInbox`.
- **`__lastStatus(): i32`** — the status the last normal resume answered on this
  thread. *Reads* a module global; writes nothing. It is a report, not a
  decision: no primitive consults it.
- **`__submitTask(task): bool`** — see below.

### Submit versus run

Two ways to make a task runnable, and they mean different things:

- **`task.drive()`** runs (or resumes) the body **inline** and parks the
  *caller* on it. An eager policy uses this in `create`: the prefix executes at
  the call site.
- **`__submitTask(task)`** puts the task in this executor's ready ring and runs
  **none** of it. The step decides when, and in what order. A pool, a priority
  queue or a rank-ordered scheduler is a policy whose `create` is one
  `__submitTask` call.

`__submitTask` answers `false` — never a silent success — for a task with no
slot (one that never went through the transform's entry), a settled task, or a
full ring. Submitting twice is a **stated** no-op: the ring holds a slot at most
once, so the second call answers `false` and the body still runs once.

There is no `__submitTaskOn(exec, task)`, and the reason is structural rather
than stylistic: a slot is an index into *this store's* continuation table
(`$~asyncCont`), so "submit to executor 7" means something only if executor 7
shares that table. Work that belongs in another store is a **request**, not a
submission, and `__spawnOn` already carries it — the target store makes its own
continuation.

### Two invariants

1. **A slot is resumable only when the thing it waits for has settled.** The
   entry installs a task's start continuation at creation, so `task.slot` is
   valid immediately — the *first* resume runs the body from the top. After a
   suspension the suspended continuation is written back at the same slot, and
   the task becomes resumable again only when its waiter is woken. Resuming a
   continuation that has already returned is `RuntimeError: resuming an invalid
   continuation` — a trap, not a diagnostic. `driveReady` guards the one case
   that can reach it by accident (a settled task still sitting in the ring); a
   hand-written step owes the same guard.
2. **A slot is in the ready ring at most once.** `SlotRing#push` scans the
   published entries and refuses a duplicate, which is why two waiters waking one
   task cannot advance its body twice. Treat the `false` as information: the work
   is already queued.

`tests/rt/order.js` is these two rules written as a program: three tasks
submitted in creation order 1, 5, 9, a step that sorts the ready set by rank, and
a transcript asserted line by line — `enter 9, enter 5, enter 1`, each body
exactly once.
