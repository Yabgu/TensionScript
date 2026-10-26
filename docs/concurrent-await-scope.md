# Concurrent await and the lazy local — scoping (v3)

**Status:** scoping. Read-only on source. This branch adds one file.
**Base:** `origin/main` @ `c3be16fc` (release 0.10.0). Measured 2026-10-26.

**Question.** Four forms of deferred work, distinguished by whether the callee
starts at the declaration or at the first read, and whether the value is awaited
at the read or never:

```
@lazy EXPR                    defer EXPR's evaluation to first read, memoized
@lazy await f()               call+await at first read
@lazy await spawn(f)          spawn launches at declaration; await deferred to read
@lazy spawn(f)                spawn launches at declaration; the Task is never awaited
```

**The premise this scoping tested and did not confirm.** The model above assumes
`@lazy` means *deferred evaluation, memoized*. Measured in this tree, it does
not, and never has — see §1. That is not a quibble about naming: it decides
whether Phase 1 is a small reuse of the global mechanism (as the brief assumes)
or new machinery with a new AST node. It is the latter.

Everything below is measured on `origin/main` content in a throwaway worktree
(`/tmp/spawn-probe`, since removed). §9 lists the commands and §8 lists what
could not be measured read-only.

---

## 0. Measurements A–C, first

### A. Does the scheduler support launch-without-park?

**There is no "launch" operation to support, because a call *is* the launch.**

`f(args)` on an `async function` compiles to a plain call that:

1. allocates `f$State` (`work$State#constructor`),
2. builds the handle (`Task<T>#constructor`), stores it on `state.handle`,
3. calls `__taskRegister(state)` — which **claims a task-table slot at
   creation** (`std/assembly/task-rt.ts:383`, the 0.7.0d-pre change; the comment
   there says "the table's capacity is a bound on *live* tasks, not on parked
   ones"),
4. calls `f$resume(state)` — running the synchronous prefix **inline in the
   caller's frame**,
5. returns the handle.

No scheduler call appears in steps 1–5. The scheduler learns about a task only
when it suspends: `scheduler::park` is the *only* scheduler import in an emitted
module, and it is absent from a module whose async functions never suspend and
present in one that does. Measured side by side:

| probe | `scheduler::park` import |
|---|---|
| `a1.ts` — `async function work(x) { return x + 1; }`, handle held | absent |
| `h1.ts` — the same function with `await h` inside | present, one call site in `f1$resume` |

So "launch eagerly" is the status quo, and `spawn` would add **zero scheduler
work**. That is the single largest correction to the arc's cost model: the
scheduler is finished for this feature; what is missing is syntax and lowering.

### B. Does `Task<T>` exist as a user type, or is `TaskRecord` an internal handle?

Both exist, and they are different things:

- `std/assembly/task.ts:39` — `TaskRecord`, the eight-field layout (32 bytes:
  `class_`, `key`, `payload`, `status`, `f0`, `f1`, `tag`, `done`). This is the
  state the runtime's typed read goes through.
- `std/assembly/task.ts:87` — `@final export class Task<T> { _record!: TaskRecord; }`.
  A real class, instantiated per `T` by the ordinary class machinery
  (`resolver.ts:2839`, `resolveAsyncCallType`), one word wide for every `T`.

`Task<T>` is what an async call produces and what `await` consumes. `_record` is
deliberately not `private` — the lowering reads it — but nothing else may touch
it. **No wrapper is needed**: `Task<T>` is already the user type the design asks
for, and a guest can hold one, pass one, store one in a global (measured), or
return one.

### C. Does `await a` where `a: Task<T>` work today?

Yes, and it was run, not just compiled.

- **Resolution**: `resolver.ts:1344` `resolveAwaitExpression` — the operand
  resolves on its own, then `resolveTaskValueType` (`:1366`) matches the class
  *by identity* against `program.taskPrototype` (not by name) and yields its type
  argument. So `await t : Task<i32>` is `i32`, and `await 1` is `i32` unchanged.
- **Codegen**: `compiler.ts:8674` `compileLoweredAwaitExpression` reads the
  record at the payload offset (8) or `f0` (16), *not* re-evaluating the operand
  — the value was produced before the suspension and parked with the task.
- **Runtime, measured**:

  ```ts
  async function add(x: i32): i32 { return x + 1; }
  async function use(): i32 {
    let t: Task<i32> = add(1);      // launch, handle held
    let v: i32 = await t;           // settled → immediate, no park (§4.8)
    return v + 1;
  }
  ```

  `go() = 3`. A held `Task<T>` is awaited correctly; an already-settled await
  returns without suspending.

**Two limits on C, both measured, both load-bearing for the design:**

- `await` on a **reference-typed** result is refused:
  `AS100: Not implemented: a reference-typed await result`, on
  `Task<string>` and on `Task<SomeClass>` alike. So every lazy-await form below
  works for numerics and `bool` only.
- `await` in a **non-async** function is refused at parse (`TS1308`), and —
  measured — so is `await` at a module top level, *despite the diagnostic's text*
  ("…and at the top levels of modules"). The message is TypeScript's; the
  compiler does not implement that half. A lazy-await read therefore requires
  every read site to be inside an async function.

---

## 1. What `@lazy` actually means here (the correction)

The brief's model — "`@lazy EXPR` defers EXPR's evaluation to first read,
memoized" — is not what this compiler does. `@lazy` is a **compile- and
evaluation-order permission**, not deferred evaluation.

**Measured, at runtime:**

```ts
let ticks: i32 = 0;
function bump(): i32 { ticks += 1; return ticks; }
@lazy const lazyG: i32 = bump();
const eagerG: i32 = bump();
export function getTicks(): i32 { return ticks; }
```

Running the module and calling `getTicks()` **before any read of either global**:

```
getTicks() = 2
readLazy() = 2
readEager() = 1
```

Both initializers ran in `$~start`. The emitted start function is literally
`call bump; global.set lazyG`. There is no guard word, no getter, no memo cell —
and the declaration order in `$~start` is the only thing `@lazy` changes.

**Measured, at the source:** `compiler.ts:1274` and `:1386` — when a global has
`DecoratorFlags.Lazy`, `compileGlobal` swaps `currentFlow` to
`global.file.startFunction.flow` while compiling the initializer. That is the
whole mechanism: "compile this initializer as though it ran at the top of the
file's start function," which makes it legal for the initializer to reference a
global declared later. `resolver.ts:1479`'s own comment says it plainly:
"Resolves a **lazily compiled** global, i.e. a static class field or annotated
`@lazy`."

**Where `@lazy` is accepted** (measured, four placements):

| Placement | Result |
|---|---|
| module global (`@lazy const g = …`) | accepted |
| class static field (`@lazy static readonly M = …`) | accepted |
| function declaration | accepted |
| **local** (`@lazy let x = …`) | **`TS1109: Expression expected.`** |
| **expression** (`await @lazy f()`) | **`TS1109: Expression expected.`** |
| getter (`@lazy get x()`) | `AS212: Decorator '@lazy' is not valid here.` |

The parse failure is structural: `Parser#parseStatement` (`src/parser.ts:3302`)
has no `Token.At` arm, so a `@` at statement position falls through to
`parseExpressionStatement` and dies. And there is **no expression node that
carries decorators** — `src/ast.ts` has 31 exported expression classes and not one has a
`decorators` field, nor is there a `DecoratedExpression` or `SpawnExpression`.

**Consequence for the design.** Two different costs hide behind one spelling:

- `@lazy let t = EXPR` (declaration form) needs **no new AST node** — decorators
  already exist on declaration nodes. This is the cheap surface.
- `@lazy EXPR` (expression form, what the four-form table is written in) needs a
  **new node kind**, because no expression can carry a decorator today.

The rest of this document designs the declaration form and shows that it
expresses all four meanings; §6 records what changes if the expression form is
wanted anyway.

---

## 2. The four forms, measured against the compiler

Rewritten in declaration position — the form the parser can reach without a new
node — with what each means in terms of machinery that exists:

| Written (declaration form) | callee starts | await happens | never read | exists today |
|---|---|---|---|---|
| `let t = await f()` | immediately | immediately | n/a | **yes** (measured, `go() = 3`) |
| `@lazy let t = f()` — sync `f` | first read | n/a | nothing | no |
| `@lazy let t = f()` — async `f` | first read (the launch is the call) | caller's business | nothing launched | no |
| `@lazy let t = await f()` | first read | first read | nothing | no |
| `@lazy let t = await spawn(f)` | **declaration** | first read | task completes, value discarded | no |
| `@lazy let t = spawn(f)` | **declaration** | never | task completes, `Task` retained, discarded | no |
| `let t = spawn(f)` | declaration | wherever the user awaits | task completes, discarded, warn | no |

Three things this table says that the brief's version does not:

1. **`@lazy let t = f()` with an async `f` is already a deferred launch.**
   Because the call *is* the launch (§0.A), deferring the call defers the launch.
   That is a useful semantic the brief's table omits, and it is free once the
   read-site inlining exists — no `spawn` needed.
2. **`await @lazy f()` has no declaration-form equivalent that is redundant.**
   `@lazy let t = await f()` defers *both* the call and the await, which is not
   pointless. The redundancy the brief wants warning 1 for exists only if `@lazy`
   can be written *inside* an expression that is already being awaited. In the
   declaration form, warning 1 **has no reachable trigger** — see §4.
3. **`@lazy spawn(f)` is the same as `let t = spawn(f)` with an unused
   annotation**: the launch is at the declaration either way, and nothing awaits
   it either way. `@lazy` buys nothing there, which is exactly what its warning
   should say.

### Never-read behavior, established by the runtime

For the forms whose callee launched (rows 5–7), never reading means:

- **The task runs to completion and the result is discarded.** Measured end to
  end: a table of capacity **1**, two async tasks launched, both complete —
  `status = 0`, `done = 1`, `payload` = the computed values. The first task's
  slot is released on completion (`__taskComplete` → `finishTask`, `task-rt.ts:556`
  → `:421`) before the second registers, so the release is what makes capacity 1
  serve two sequential tasks.
- **There is no cancellation.** `docs/scheduler-contract.md` names it out of
  scope: "A task removed from the scheduler while parked is a future contract;
  this one has no cancellation." So the model is JS's *complete-and-discard*, not
  Rust's *cancel on scope exit*.
- **A task that parks and is never delivered holds its slot and its state struct
  forever.** Measured: capacity **2**; one manual registration plus one task
  parked on a record nobody completes → that task reads `status = 0, done = 0`
  (still parked), and the next launch is refused with `status = -28` (`-ENOSPC`)
  and `done = 1`. The refusal is the bound working; the leak is real within it.

The practical consequence for `@lazy await spawn(f)`: abandonment is safe *iff
the spawned work completes*. A lazily-spawned task that parks forever is an
invisible slot leak — invisible precisely because the `await` that would have
surfaced it never ran.

---

## 3. `spawn` — what the word would have to mean

Measured: `spawn` does not exist. `spawn(f, 1)` is
`TS2304: Cannot find name 'spawn'.`, and there is no `spawn`, `submit`,
`enqueue`, or `schedule` anywhere in `std/`, `src/`, or the scheduler's host
imports.

Given §0.A, `spawn(f, args)` **cannot be a runtime primitive that does something
a call does not** — the call already launches. So `spawn` can only be one of two
things:

**Option 1 — a marker on an ordinary call.** `spawn(f, a, b)` desugars to `f(a, b)`
plus a bit that says "this call escapes the surrounding `@lazy`". Its only jobs
are to lift the call out of the deferral and to give the unawaited-task warning a
subject. Zero runtime cost, zero scheduler change; the desugaring is an AST
rewrite.

**Option 2 — a scheduling call that does not run the prefix in the caller's
frame.** This would genuinely be a scheduler change (an executor entry point the
host does not have today; `scheduler` exports only `park`). It would buy
"launch without running any of the callee's synchronous prefix now" — real, but a
*third* semantic the brief does not ask for, and it would need a host-side
contract change in the engine.

**Recommended: Option 1.** It is what the four forms need. Record Option 2 as a
separate proposal, because it is the only version of `spawn` that would justify
new scheduler surface.

### The lowering, concretely

`@lazy let t: i32 = await spawn(work(1));` inside an async function becomes:

```ts
// at the declaration site (hoisted out of the deferral):
let $t$task: Task<i32> = work(1);      // the launch — ordinary call, §0.A
let $t$done: bool = false;
let $t$value: i32 = 0;

// at each read site of `t` (inside the reader's own function):
if (!$t$done) { $t$value = await $t$task; $t$done = true; }
// …then use $t$value
```

**Measured: this shape compiles today.** Both halves were written by hand and
compiled clean — the launch-then-deferred-await (`x2.ts`) and the guard+await+memo
read (`x1.ts`):

```ts
async function reader(): i32 {
  let task: Task<i32> = work(1);                     // launch at declaration
  let done: bool = false;
  let v: i32 = 0;
  if (!done) { v = await task; done = true; }        // deferred await at read
  return v;
}
```

The read-site `await` suspends **the reader**, which is the requirement — see §5
for why a getter cannot do that.

---

## 4. The three warnings

### Infrastructure: present and adequate

- `DiagnosticEmitter` has `pedantic`, `info`, `warning`, `error`
  (`src/diagnostics.ts:381–450`), and `Parser`, `Program` and `Compiler` all
  extend it — so a transform can warn.
- Warnings **do not fail a build**: `checkDiagnostics` (`cli/index.js:1203`)
  increments `numErrors` only when `isError(diagnostic)` is true.
- They are **suppressible**: `--disableWarning <code>` (`cli/options.json:335`).
- They are **pinnable in fixtures**: `tests/compiler/field-initialization-warnings.json`
  pins `AS906` and `AS233` in `stderr`. The catalogue holds 215 diagnostics and
  none covers a discarded value, so all of these would be new codes.

### Where they must be computed — three measured ways it does not work

The obvious site is `Compiler#compileExpressionStatement` (`compiler.ts:2878`).
Every variant tried there failed, for three *different* reasons:

1. **A fresh `resolveExpression` changes the output.** Resolving the statement's
   expression to learn whether it is a `Task<T>` **shifted type-id instantiation
   order**: 8 compiler fixtures failed (`simd`, `function-call`, `builtins`,
   `issues/2707`, `duplicate-field-errors`, `class-errors`, and both async `.wat`
   pairs). Suite green before the patch, red after.
2. **The already-compiled type has been discarded.** Reading `this.currentType`
   after the fact is byte-safe — the full compiler suite (309 `.ts` fixtures) passed —
   but the warning **never fired**: `compileExpressionStatement` compiles with
   contextual type `void`, so the task type is not what comes back.
3. **`isAsync` is false by the time codegen runs.** Resolving only the *callee*
   as an element (no expression resolution, no instantiation) is byte-safe and
   still never fires — because the transform **clears the trait**:
   `lower.ts:1008` sets `declaration.isAsync = false` after rewriting the entry,
   for a good reason it documents ("keeping the trait would wrap it twice" — the
   entry's declared return type is already `Task<T>`). So after lowering, no
   element in the program is async, and "is this an unawaited async call?" is not
   a question codegen can ask.

The conclusion is structural, not a matter of finding a better call site: **the
warning must be emitted inside the async transform, before `lower.ts:1008`
runs** — where `isAsync` is still true and nothing has been instantiated. The
natural home is `src/async/validate.ts`, which already walks statements and
expressions by name, already has an `ExpressionStatement` arm (`:173`) and a
`CallExpression` arm (`:426`), and already reports through the emitter. It is a
pure traversal with a documented allocation invariant, so a warning there cannot
perturb emission.

### The three, one at a time

**W1 — `await @lazy f()`: "await forces the read; @lazy is pointless."**

*Not implementable in the declaration form, because it has no reachable trigger.*
The redundancy needs `@lazy` to appear inside an expression that is already
awaited; in declaration position, `@lazy let t = await f()` is a *real* deferral
of both the call and the await, not a no-op. Implementing W1 therefore requires
the expression form (§1), i.e. a new AST node — and even then, the cleaner answer
is to **refuse the form rather than warn about it**: a decorator that provably
does nothing is a mistake, and this compiler's habit is to refuse
(`AS212` on a getter, `TS6392` on a post-type memory-model spelling) rather than
to warn and continue.

**Recommendation: drop W1.** It is the only one of the three whose trigger does
not exist in the recommended syntax, and the diagnosis it offers is better
delivered as an error at parse.

**W2 — `@lazy spawn(f)` (or `let t = spawn(f)`) with no await: "the Task is never
awaited; the result is discarded."**

Implementable, and *only* in the transform, because it is a **use** property: "is
this cell ever awaited?" Two checks, both local:

- The **cheap half** is unconditional: if the initializer is a `spawn` call and
  the annotated declaration is never read at all, that alone justifies the
  warning, and "never read" is a flow/lookup question the resolver already
  answers for every binding.
- The **costly half** is "read but never awaited" — every read site must be
  inspected, and `await t` may be nested (`await g(t)`, `await (t ? a : b)`). For
  a value whose type is `Task<T>`, "was it awaited" is not a local property of
  the read.

**Recommendation: implement the cheap half now** ("declared, never read, and the
initializer is a spawn") and scope the read-but-never-awaited half as a
follow-up, since it needs an await-context walk the transform does not have.
Note that `@lazy spawn(f)` is, measured, *exactly* equivalent to
`let t = spawn(f)` with an unused annotation (§2) — so this warning can also be
phrased "the `@lazy` here changes nothing."

**W3 — `spawn(f)` unawaited at statement position.**

**Implementable now, at zero cost, and measured.** The shape is an
`ExpressionStatement` whose expression is a `spawn` call; `validate.ts` already
visits exactly that. Scoped to `spawn`, no existing code can trip it — `spawn`
does not exist yet.

The interesting question is whether to extend it to **plain unawaited async
calls** (`work(1);` with the result dropped), which is the same behavior written
without the marker. Measured over the whole `tests/compiler` corpus (309 `.ts` fixtures):

- **exactly one** statement-position dropped async call exists —
  `tests/compiler/async-closure-value.ts:22`, `inner(changetype<Task<i32>>(0));`
  (`async-closures-case6.ts` *assigns* its call to a global rather than dropping
  it);
- that fixture has **no pinned-stderr `.json`**, so a warning there costs no
  fixture update;
- `std/` and `src/` contain no real async functions at all — every textual
  `async function` in `src/` is a comment or a string — so the self-compile is
  unaffected.

(Site counts above are a source-level scan for statement-position calls to
declared `async function` names, not a compiler instrumented run: the compiler
cannot answer the question at codegen time, per the three reasons above. The scan
is mechanical and the single hit was confirmed by reading the file.)

So the extension is affordable. It is still a **behavior change for users**
(code that compiles silently would start warning), which is a decision for the
phase, not a measurement. W3 scoped to `spawn` alone costs nothing at all,
because `spawn` does not exist yet.

---

## 5. Why the mechanism is read-site inlining and not a getter

The brief asks whether the getter mechanism exists for locals, and whether the
spawn is "hoisted out of the getter." Measured, the getter framing cannot work,
for a reason that is specific to this compiler's async model:

> **`await` is a state transition of the enclosing function's machine, not a
> call.** The lowering (`src/async/lower.ts`) rewrites the *body that contains*
> the await: it sets `state.resumePoint`, parks, and returns
> (`h1.wat`'s `f1$resume`: `set:$awaited1`, `set:resumePoint 1`, `__taskSettled`
> → `__taskPark` → `return`). A getter has its own state machine; its caller
> cannot suspend on it. A getter that awaited would return a `Task<T>` it never
> awaited, and the read site would still have to await that.

So the deferred await must be **inlined at each read site**, where the reader's
own machine can suspend. That is the design in §3, and it has three measured
consequences:

- **One lazy-await read per statement.** `let v: i32 = await t1 + await t2;` is
  already refused: `AS100: Not implemented: more than one await in one statement
  (async lowering)`. Two lazy-await reads in one expression would hit the same
  wall, so the feature must refuse (or split) that case explicitly.
- **The read site must be inside an `async` function** (`TS1308` otherwise), and
  the value must be a numeric/bool type (§0.C).
- **The memo cells get lifted for free** — *if* the lazy expansion runs before the
  async lowering. Measured: the cell pair read after a suspension
  (`let done: bool; let v: i32; … let a = await h; if (!done) {…}`) lifts
  correctly, with `done` and `v` becoming state fields.

### Transform order

`applyInTreeTransforms` (`src/transforms.ts:34`) runs exactly two transforms, and
the order is documented as load-bearing: **closure first, then async.**
A lazy-local transform must be inserted **before async** (so its synthesized
`await` is lowered) and has one real ordering question against **closure**:

- *after closure* — the initializer has already been rewritten to environment
  field accesses; duplicating it at read sites duplicates already-lowered code,
  which is safe because the guard makes only one copy run;
- *before closure* — closure sees each duplicated copy and rewrites captures in
  each.

The second is more robust (one rule, applied to whatever the tree contains) and
matches the existing rationale for putting closure first. Recommend: **lazy
before closure** only if the lazy transform introduces no captures of its own;
otherwise **between closure and async**. This must be decided by measurement in
the phase, not here — it is the one ordering question I could not settle
read-only, because it depends on the transform's actual output shape.

---

## 6. If the expression form is wanted anyway

Everything above designs the declaration form. If `@lazy EXPR` must be spelled as
an expression (the brief's literal model), the delta is:

- a new AST node kind (e.g. `LazyExpression`) plus parser support for `@`
  at expression position — `parseStatement` and every expression parser entry;
- `@lazy` must then be rejected everywhere it is a *declaration* decorator and
  accepted everywhere it is not, or the two meanings coexist (an ordering
  permission on declarations, a deferral on expressions) with the same spelling.
  That ambiguity is worse than the node;
- W1 becomes reachable, and the redundancy it names is real.

Cost: a parser + AST change touching the most-tested part of the compiler, plus a
semantic collision on one word. **Recommend against.** The declaration form
expresses all four meanings (§2) with zero parser change.

---

## 7. Two phases

### Phase A — the lazy local (small, sync only)

**Scope.** `@lazy let t: T = EXPR` inside a function body, where `EXPR` is
synchronous and `T` is a scalar. Lowering: two hidden cells plus a guard at each
read site (§3). Transform slot in `applyInTreeTransforms`, before async.

**What it does *not* reuse.** The brief calls this "small — reuses the global
mechanism". Measured, there is nothing to reuse: `compileGlobalLazy`
(`compiler.ts:1197`) is an ordering permission and produces no getter, no cell,
and no memoization (§1). Phase A is new machinery. It is small for a different
reason: it is **purely local syntactic sugar over cells the async lowering
already knows how to lift**, with no runtime, no std, and no scheduler change.

**Measured constraints to build against.**

- Parser: add a `Token.At` arm to `parseStatement`, accept `@lazy` only on a
  local `let`/`const`, reject everything else (AS212's shape already exists for
  getters).
- A read site must be splittable into a statement. (In Phase A there is no
  await in the initializer, so this only constrains Phase B; the AS100
  one-await-per-statement refusal is the precedent there.)
- `T` must not be a reference type if the initializer awaits (§0.C); for the sync
  phase any `T` is fine.
- Cells must be declared *before* the first read, and before any await that
  precedes a read, or the lift will not see them.

**What forces a no.** If the read-site expansion cannot be expressed as
statements the async lowering accepts — i.e. if a read occurs inside a
sub-expression the splitter cannot escape — then the *awaiting* half has to wait.
The synchronous half is unaffected.

**Verification, cheap and already available.** The emitted WAT for
`x1.ts`/`x2.ts` (guard + await + memo) is the target shape; those two files
compile today, so the phase's codegen can be pinned against an exact `.wat`
before the transform exists.

### Phase B — spawn and the warnings (medium, and smaller than assumed)

**Scope.** `spawn(f, args…)` as a marker (Option 1, §3), the hoist out of the
`@lazy` initializer, W2's cheap half, and W3.

**What it does *not* need** — each item the brief listed as a prerequisite:

- *launch-without-park* — **exists** (it is the call; `scheduler::park` is the
  only scheduler import and only when suspending) §0.A;
- *`Task<T>`* — **exists** as a user type with the boxed handle semantics
  required §0.B;
- *await-a-Task* — **exists**, and was run end to end §0.C;
- *a Task wrapper around `TaskRecord`* — **not needed** §0.B.

**What it does need** — and this is the honest cost:

1. `spawn` as a **special form** in the `afterParse` stage: recognized by name,
   desugared to a call, marked as escaping.
2. The **hoist**: move the spawn call out of the deferred initializer to the
   declaration site, and rewrite the deferred initializer to `await $t$task`.
   Measured feasible — the hand-written expansion compiles (§3).
3. **W3** in `validate.ts` (trivial), and **W2**'s "never read" half (a binding
   lookup the resolver already does).
4. A **decision** on extending W3 to plain unawaited async calls: affordable
   (measured: one fixture, no pinned stderr) but user-visible.

**What forces a no.** If `spawn` must mean "do not run the callee's synchronous
prefix in the caller's frame" (Option 2), it becomes a scheduler-contract change
with a new host entry point, and it belongs in the engine's repo, not this one.
The four forms as specified do not require it.

### Dependencies between them

Phase B's hoist is *built on* Phase A's read-site inlining: `@lazy await spawn(f)`
is "Phase A's cell" + "the launch moved out". So **A first, strictly**. Nothing
in A depends on B. Neither depends on the fork-arc phases
(`docs/fork-arc-scope.md`), though both are examples of the posture: features AS
cannot express, landed on purpose.

---

## 8. What could not be measured read-only

1. **A parking task resumed by a host.** The settled path was run end to end
   (`go() = 3`); the suspend path is covered by `tests/async/runtime.js`'s
   driver, which I read but did not execute against these probes. The park shape
   in `h1.wat` was read, not driven.
2. **Slot accounting under a real executor loop.** The `-ENOSPC` refusal and
   release-on-completion were measured with a hand-bound table and a node
   harness; a real host that resumes tasks could interleave differently.
3. **The transform-order question in §5** (lazy before vs. after closure). It
   depends on the transform's own output shape, which does not exist yet.
4. **Whether `@lazy` on a local interacts with the existing
   `variable-access-in-initializer` fixture** (`var a = (a = 4, 3)` is `TS2448`).
   A lazy cell read inside its own initializer would be a new ordering hazard; I
   did not construct it.
5. **The engine's executor.** What the host does with a completion whose task
   was abandoned is the engine's side; `docs/scheduler-contract.md` §4.7 speaks
   to *lost* completions, not *unwanted* ones, and the Tension repo is out of
   scope for this arc.
6. **Cost of a new AST node** (the expression form, §6) — estimated from the
   parser's shape, not measured.

---

## 9. Method — exact commands

Environment: this machine, node v24.21.0, 2026-10-26, base `c3be16fc`, in
`git worktree add --detach /tmp/spawn-probe origin/main` with `node_modules`
symlinked from the primary checkout. The primary checkout was not modified; the
worktree was discarded.

Compile a probe and read the WAT:

```
node bin/tensionscript.js probe.ts --textFile probe.wat --optimizeLevel 0 --shrinkLevel 0 --debug
node bin/tensionscript.js probe.ts --textFile probe-O3.wat          # default -O3
```

Run a probe (imports stubbed except `scheduler::park`, which was never reached):

```
node /tmp/runwasm.mjs probe.wasm f1 f2 …
```

The `@lazy`-is-not-lazy measurement (§1) is `l1.ts` + `getTicks()` before any
read — the answer `2` is the whole measurement.

The warning-site trap (§4) is three probe patches to `compileExpressionStatement`,
each reverted, each measured with `npm run test:compiler -- --parallel` against a
green baseline:

| variant | suite | warning fires |
|---|---|---|
| fresh `resolveExpression` on the statement's expression | 8 fixtures fail | yes |
| read the already-compiled `this.currentType` | green (309 fixtures) | no — compiled as `void` |
| resolve only the callee as an element (`isAsync`) | green | no — `isAsync` already false |

The dropped-call site count is a source scan:
`python3` over `tests/compiler/**/*.ts` matching a line-initial call to a name
declared `async function` in the same file, ending in `;`.

The lazy-cell lift (§5) is `x4.ts` — clean compile, with `State#get:done` /
`State#get:v` present in the WAT.

---

## 10. Recommendation

1. **Correct the model first.** `@lazy` does not defer evaluation in this
   compiler, and cannot be made to without new machinery (§1). Write that down
   before designing on top of it — otherwise Phase A looks like a reuse and gets
   estimated as one.

2. **Phase A, declaration form, synchronous first.** `@lazy let t = EXPR` with a
   sync `EXPR`. It is the smallest thing that makes "deferred, memoized" true,
   it needs no new AST node, and it produces exactly the cell machinery Phase B's
   hoist reuses.

3. **Phase B, `spawn` as a marker (Option 1), not a primitive.** Measured, the
   "primitive" already exists as the ordinary call; `spawn` is a marker whose
   only job is to escape the deferral and to give the warning a subject. This
   makes Phase B materially smaller than the brief assumes on infrastructure, and
   larger only where it must be: the hoist and the read-site inlining.

4. **Drop W1; implement W3; implement W2's cheap half.** W1 has no reachable
   trigger in the declaration form and is better as a parse error if the
   expression form ever exists. W3 is free today. W2's "never read" half is a
   lookup the resolver already performs; its "read but never awaited" half needs
   an await-context walk, so scope it separately.

5. **Do not build the expression form (§6)** unless a concrete user need appears.
   It costs a new node kind and makes one word mean two things.

6. **Say the abandonment rule out loud in the docs:** a lazily-spawned task that
   is never read completes and discards (measured), there is no cancellation
   (contract), and a task that parks forever holds its slot (measured, `-28` on
   the next launch). Users will hit that last case, and it is the one place where
   "nobody awaits it" becomes a resource bug rather than a wasted result.
