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

## Backends and policies

A build has exactly one backend — the lowering chosen in `src/transforms.ts`:
`hasAwait && --enable stack-switching` selects the continuations (Task) backend,
and every other program, including one with an `await`, keeps the promise
(state-machine) backend.

A policy declares which backend its `create`/`await` are written against, in a
literal the compiler can read:

```ts
export enum AsyncBackend {
  Continuations = 1,
  Promise = 2,
}

export abstract class TaskPolicy {
  readonly backend: AsyncBackend = AsyncBackend.Continuations;
}
```

`1`/`2`, not `0`/`1`: the numbers are the artifact's encoding, and a zeroed byte
must not read as "continuations". `TaskPolicy` is the stack model's base, so
every existing policy inherits `Continuations`; a promise-side policy would
declare `AsyncBackend.Promise` once that path grows a policy seam.

At an `on` site whose policy class is statically visible, the resolver compares
that literal with the build's backend (`src/resolver.ts`,
`checkOnPolicyBackend`). A mismatch is one diagnostic naming the class, the
backend it wants, the backend the build has, and the two ways out. A policy held
as a `TaskPolicy` value — a variable or a call — names no concrete class and is
skipped: the build's backend is still the hard gate, because a promise build
refuses `on` outright (`src/async/lower.ts`, `reasonFor`).

The artifact records the choice in the `tension.async` custom section, emitted
only when the program contains an `await` (`src/compiler.ts`,
`emitAsyncBackendSection`). Its layout is version `u8`, backend `u8` (1 =
continuations, 2 = promise), flags `u8` (bit 0 = may suspend), count `u32`, then
`count` × (length `u32`, UTF-8 class name). The names are the policy classes the
compiler saw at `on` sites, deduped in first-use order; the list is empty on a
promise build by construction. A host reads the section before instantiating and
refuses a guest built for another backend, naming the policies that forced it.

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
