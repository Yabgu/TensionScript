# Concurrent await and the lazy expression — scoping (v4)

**Status:** scoping. Read-only on source; nothing here is implemented. Replaces
the v3 draft on this branch, which designed the declaration form instead.

**Base:** `origin/main` @ `c3be16fc` (release 0.10.0). Measured 2026-10-26.

**Target syntax** (ratified, and what this document measures):

```ts
let a = @lazy await spawn(f, args);   // spawn launches now, await deferred
let b = @lazy await f();              // f deferred, awaited at read
let c = @lazy f();                    // f deferred, sync
let d = spawn(f);                     // launches now, no deferral
```

**Measurement 1 came back clean: there is no grammar conflict, and the whole
syntax surface is 38 lines.** That is measured, not estimated — a throwaway
prefix arm plus a `LazyExpression` node built cleanly and left the compiler suite
(309 fixtures) and the parser suite green. Everything below is the design that
measurement supports, plus one **spec ambiguity that needs your ruling** (§8.1).

§1–§6 are the six measurements. §7 is the cost. §8 is the recommendation. §9 is
what could not be measured read-only.

---

## 1. Measurement 1 — expression-position parsing

### Where the prefix dispatch is

`Parser#parseExpressionStart` (`src/parser.ts:4053`) — one `switch` on the first
token, and the only entry point for a prefix operator. Every prefix form already
lives there:

| Token | Line | Shape produced |
|---|---|---|
| `!`, `~`, `+`, `-`, `typeof`, `void`, `delete` | 4065–4075 | `UnaryPrefixExpression`, operand at `Precedence.UnaryPrefix` |
| `await` | 4078 | `AwaitExpression`, operand at `Precedence.UnaryPrefix` |
| `++`, `--` | 4163 | `UnaryPrefixExpression` (with a variable-operand check) |
| `new`, `(`, `[`, `{`, `<`, literals, identifiers… | 4182, 4389, … | their own nodes |
| **anything else** | **4486** | `default:` → `Expression_expected` (`TS1109`) |

`@` is **not** in that switch. Asked for an expression, the parser has no reading
for `@` at all, so the `default` arm fires. That is the whole conflict question,
and it answers itself: a `case Token.At:` intercepts exactly the position that is
currently a hard parse error, so **no existing program changes meaning.**

`Token.At` already exists (`src/tokenizer.ts:164`, scanned at `:923`) — no lexer
work.

### The `@` token's other four positions, all disjoint

Measured by grep and by probe:

| Position | Site | Reading today |
|---|---|---|
| declaration decorator, top level | `parseTopLevelStatement:269` | `@lazy const X = 1` accepted |
| declaration decorator, class member | `parseClassMember:2224` | `@lazy static readonly M = 1` accepted |
| pre-type | `parseType:669` | `v: @inline V3`; non-model decorators → `AS212` |
| post-type attribute | `parseType:962` | `x: f32 @abi.alias("f")` |
| **expression** | **none** | **`TS1109 Expression expected`** |

Expression position is the only one with no reading, and it is disjoint from the
other four: `parseExpressionStart` is reached from `parseExpression`, which is
never called where a decorator or a type is expected.

### The probe: what actually parses

A probe built the node and the arm (§2, 38 lines) and dumped the AST. Every
target form parses as intended:

```
let a = @lazy await spawn(f, 1);
  VariableDeclaration
    Lazy                          <== LazyExpression
      Await                       <== await
        Call callee=Identifier(spawn)   [spawn, f, 1]

let b = @lazy await g();      Lazy → Await → Call(g)
let c = @lazy h();            Lazy → Call(h)
let d = spawn(f);             Call(spawn) → [f]
```

And the shapes the warnings need:

```
await @lazy f()      →  Await → Lazy → Call(f)        (W1's shape)
@lazy f() + 1        →  Binary( Lazy → Call(f), 1 )   (binds like `await`: unary)
g(@lazy f())         →  Call(g) → [ Lazy → Call(f) ]  (parses; no binding)
@lazy @lazy f()      →  Lazy → Lazy → Call(f)         (redundant nest, parses)
```

`@lazy` at `Precedence.UnaryPrefix` gives TypeScript's own rule for `await`:
`@lazy f() + 1` is `(@lazy f()) + 1`, not `@lazy (f() + 1)`. That is the right
reading for "defer this expression", and it matches `await` exactly.

### Four collisions the probe found, none fatal

1. **`let x: i32 @lazy = 5;` compiles clean today** — `@lazy` is silently
   accepted as a **post-type attribute** (`NamedType` carrying
   `Decorator(lazy)`), because `parseType:962` accepts any non-memory-model
   decorator there. Once `@lazy` means deferral, this is a decorator that does
   nothing, in a position that looks like it might mean something. **Must be
   refused**, using the refusal that already exists one branch up: the
   memory-model case at `parseType:961`
   (`A_memory_model_decorator_must_precede_the_type_it_applies_to_0`). One
   condition, three lines.

2. **`@lazy f();` as a top-level statement** → `TS1206 Decorators are not valid
   here`, because `parseTopLevelStatement` consumes `@` as a decorator before any
   statement parsing. Not a problem: §1.5 — a lazy expression is only meaningful
   as a declaration initializer, so a statement-position one is always wrong.

3. **`@lazy let x = 1;` inside a body** still fails `TS1109`: after `@lazy` the
   parser wants an expression and finds `let`. The rejected declaration form
   stays rejected — the syntax is expression-only, measured.

4. **`@lazy 1` parses clean** (`let x: i32 = @lazy 1;`). Legal, pointless —
   nothing to defer. One check in the transform, not a grammar issue.

### The position rule this implies

`@lazy EXPR` needs a **name** to hang the memo cell and the read-site guard on.
The target syntax supplies it from the declaration (`let a = @lazy …`). But an
expression can appear where there is no name:

```ts
g(@lazy f())       // parses; no binding, nothing to defer to
return @lazy f()   // parses; same
@lazy f() + 1      // parses; one cell for a sub-expression
```

**Design rule: a `LazyExpression` is legal only as the root of a variable
declaration's initializer.** Everywhere else it is refused by name. This is not a
limitation invented here — it is what the feature can mean: deferral with no read
site is not deferral. The parser cannot enforce it (no context), so the transform
does, at the same place it looks up the binding. Every shape the rule forbids was
previously a parse error, so the refusal costs nothing in compatibility.

---

## 2. Measurement 2 — the AST node

### What it is

`AwaitExpression` (`src/ast.ts:1779`) is the template: a 12-line class with one
field, `NodeKind.Await`, and a `Node.createAwaitExpression` factory. The probe's
`LazyExpression` is the same shape:

```ts
export class LazyExpression extends Expression {
  constructor(public expression: Expression, range: Range) {
    super(NodeKind.Lazy, range);
  }
}
```

**Exported? Yes, it has to be.** `src/ast.ts` exports every node class, and
`extra/ast.ts`'s `ASTBuilder` is exported through `index-js.ts` and used by
`tests/parser.js:80` to serialize a parsed source. A private class cannot be
named by the switches that need it. Measured cost: **18 lines in `ast.ts`** (enum
entry + class + factory).

### What hooks it needs — and the trap

Three of the six files that switch on expression kinds terminate in
**`assert(false)`**, not `default: break`:

| file | switches over expression kind | terminator |
|---|---|---|
| `src/compiler.ts` | `compileExpression` | `assert(false)` at `:3889` |
| `src/resolver.ts` | `doResolveExpression` | `assert(false); return null` |
| `src/extra/ast.ts` | `ASTBuilder#visitNode` | `assert(false)` (6 sites) |
| `src/closure/lower.ts` | 3 walks | `default: break` |
| `src/async/lower.ts` | 7 sites | `default: break` |
| `src/async/validate.ts` | 1 walk | `default: break` |

**The compiler measures this as a crash, not a diagnostic.** Probe
`return @lazy g();` with the node and arm in place but no lowering:

```
AssertionError: assertion failed
    at r.compileExpression (src/compiler.ts:3889)
    at r.compileReturnStatement (src/compiler.ts:3156)
```

Exit code 2, and **no `ERROR` line** — a crash that no diagnostic-shaped grep
finds. Two consequences:

- the transform must erase **every** `LazyExpression` before resolution, and
- there must be an explicit guard for the case it does not, because the default
  arm cannot produce a message. Recommended: a validation walk on the
  `src/async/validate.ts` precedent (526 lines, pure traversal, no allocation)
  reporting `Not implemented: a @lazy expression in <position>` for any survivor.
  Without it, a transform bug is a compiler crash.

`ASTBuilder` needs a real arm regardless: it is on a test path
(`tests/parser.js` serializes parsed sources), so a fixture containing `@lazy`
hits its `assert(false)` even when the compiler never does.

The closure and async walks need **nothing** if the transform runs first — but
note what their `default: break` does: `visitExpression` on a `Lazy` would visit
*nothing*, so a survivor's children would be invisible to capture analysis. That
is a silent-wrong-answer, which is a stronger argument for the guard than the
crash is.

---

## 3. Measurement 3 — the lowering shapes

### The four forms, and what "never read" means for each

| Form | `f` starts | await happens | never read |
|---|---|---|---|
| `@lazy f()` | first read | n/a (sync) | **nothing** — `f` is never called |
| `@lazy await f()` | first read | first read | **nothing** — `f` is never called |
| `@lazy await spawn(f)` | **declaration** (the hoist) | first read | task **completes, result discarded** |
| `spawn(f)` + await later | declaration | at the explicit await | task completes, discarded; warn if never awaited |

The first two rows hold **by construction**: the call sits inside the guard, so a
binding that is never read never reaches it. The third and fourth hold **by
measurement** — a launched task runs whether or not anything reads it:

- a launched-and-never-read task was **run** and read back `status = 0`,
  `payload = 30` (the computed value): it completed and the value was discarded;
- there is **no cancellation** — `docs/scheduler-contract.md` names it out of
  scope — so the model is JS's *complete-and-discard*, not Rust's *cancel on
  scope exit*;
- a task that **parks forever** and is never awaited holds its task-table slot:
  measured with a hand-bound table, the parked task stays `status 0 / done 0` and
  the next launch is refused with `-28` (`ENOSPC`). That is the abandoned-`@lazy await spawn` failure mode, and it is
  invisible precisely because the `await` that would have surfaced it never ran.

### The three shapes

Each was written out by hand — the exact desugaring the transform would emit —
and compiled. All three compile clean; the memoized ones were also **run**.

### Shape A — sync `@lazy f()`

```ts
// let c = @lazy f();
// ⟶
let c$done: bool = false;
let c$val: T = <zero>;
// before the first statement that reads `c`, once per execution of that statement:
if (!c$done) { c$val = f(); c$done = true; }
// each read of `c` ⟶ `c$val`
```

Measured, **run**: a counter probe returned `182` (`41 + 41 + calls*100`), i.e.
`f` was called **exactly once for two reads**.

Measured, compile: reads in arithmetic (`(a + a) * 2`), in a call argument, in a
loop body (guard re-checked per iteration), and inside an arrow closure all
compile. The closure case matters: the cells are ordinary locals, so the closure
transform captures them into its environment with no special handling.

### Shape B — `@lazy await f()`

```ts
let b$done: bool = false;
let b$val: T = <zero>;
if (!b$done) { b$val = await f(); b$done = true; }
```

Identical to A with one `await` in the guarded region. Measured compile-clean,
including with the guard placed after an earlier `await` in the same function —
the cells lift to state fields because they are ordinary lifted locals.

**The read site suspends, not the declaration.** That is why this cannot be a
getter: `await` is a state transition of the *enclosing* function's machine
(`src/async/lower.ts` sets `resumePoint`, parks, returns). A getter has its own
machine, so one that awaited would hand back a `Task<T>` its caller still had to
await.

### Shape C — `@lazy await spawn(f, args)`: the hoist

```ts
let a$task: Task<T> = f(args);          // the launch, hoisted to the declaration
let a$done: bool = false;
let a$val: T = <zero>;
if (!a$done) { a$val = await a$task; a$done = true; }
```

The only new step over B: the inner call moves **out** of the deferred region to
the declaration site, and the deferred region awaits the already-launched handle.

Why that is cheap here — and why this arc is smaller than it looks: **a call to an
`async function` *is* the launch.** It allocates the state struct, builds the
handle, claims a task-table slot at creation (`__taskRegister`,
`std/assembly/task-rt.ts:383`), and runs the synchronous prefix inline in the
caller's frame. `scheduler::park` is the only scheduler host import in an emitted
module, and it appears only when something suspends.

Measured on the two-launch probe: **no `scheduler` import at all**, and the
emitted `go()` body is

```wat
call $…/work          ;; launch 1
call $…/work          ;; launch 2
call Task<i32>#get:_record
call TaskRecord#get:payload
call Task<i32>#get:_record
call TaskRecord#get:payload
i32.add
```

Both launches before either read, then two reads. Run: `go() = 30` (`10 + 20`).
**The parallel requirement is satisfied by construction** — the hoist is just
"emit the call earlier".

### What `spawn` has to be for this to work

Measured: `spawn` does not exist (`TS2304`), and nothing in `std/`, `src/`, or the
scheduler's imports resembles it. Given that a call is already the launch,
`spawn` **cannot be a primitive that does something a call does not**. It is a
marker, with exactly the three jobs you named:

- escape the deferral when it is the operand of the `await` inside `@lazy`
  (Shape C's hoist trigger);
- give the unawaited-`Task` warning a subject;
- launch eagerly by default — already true, nothing to do.

Its desugaring is `spawn(f, args)` → `f(args)` plus a marker bit. Zero runtime,
zero scheduler, zero std change.

### Value types, measured

`await` on a **reference-typed** result is refused today:
`AS100: Not implemented: a reference-typed await result` — on `Task<string>` and
`Task<SomeClass>` alike. Shapes B and C are therefore numeric/`bool` only until
that is lifted. Shape A has no such limit.

---

## 4. Measurement 4 — the read-site rewrite

### The question as posed has a different answer than expected

The brief asks which of the "113 `compileExpression` sites" intercepts a local's
read. Measured: `this.compileExpression(` has **113 call sites** in
`src/compiler.ts`, and **none of them needs to change.**

The interception is at the **AST level, before resolution**, not in codegen. By
the time `compileExpression` runs, a read of a lazy binding is already an ordinary
read of an ordinary local; codegen has nothing to know. This is the house
pattern, not a new idea: `ClosureLowerTransform` rewrites every reference to a
captured binding into an environment access at the AST, and codegen never learns
that closures exist.

**So "how does the compiler know a local is lazy?" — it does not, and it must
not.** The knowledge lives and dies inside the transform.

### What the transform needs, and what already exists

It needs a **scope walk with per-reference records**. Measured,
`src/closure/lower.ts` has exactly that and has had it since the closures phase:

- `class Scope` (`:829`) — `bindings: Map<string, Binding>`, plus block/loop
  bookkeeping;
- `class Binding` (`:796`) — name, type, `isConst`, `hasInitFlag`, `captured`;
- `refs: Map<IdentifierExpression, Binding>` (`:1084`) and
  `writes: Set<IdentifierExpression>` (`:1087`) — every reference resolved, reads
  and writes distinguished;
- a two-phase **collect → emit** `afterParse` (`:236`, `:224`) whose rationale is
  written down: collect answers "would this pass synthesize anything" before
  anything is mutated.

The lazy transform is the same shape, one field smaller: for each
`let a = @lazy EXPR`, collect the reads of `a`, then emit the cells, the guard
before each containing statement, and the cell reads.

**It cannot import them.** `Scope` and `Binding` are module-private (`class
Scope`, not `export class Scope`). Three options: (a) export them from
`closure/lower.ts`, (b) put the lazy transform in that module, (c) write a
narrower walk in `src/lazy/lower.ts`. Sizes, for grounding: `closure/lower.ts`
3289 lines, `async/lower.ts` 3451, `async/validate.ts` 526. A narrow walk that
tracks only declared names per block (no capture analysis, no closure synthesis)
is a fraction of those; (a) is cheapest and keeps one scope model in the codebase,
at the cost of a wider module API.

### Three details the walk must get right (each measured)

- **Guard placement, not per-read splitting.** Because the value is memoized, one
  guard per *containing statement* suffices and every read in that statement
  becomes a cell read. Measured: `(a + a) * 2` compiles against a single guard —
  far simpler than the per-read design, which would collide with the existing
  `AS100: more than one await in one statement` refusal.
- **A guard inside a loop stays inside the loop.** Placing it before the reading
  statement preserves per-iteration re-checking; measured compiling, and correct:
  a not-yet-evaluated binding evaluates at the first iteration that reaches a
  read.
- **Writes need a decision.** `let a = @lazy f(); a = 5;` — `Binding` already
  tracks writes. Recommended: refuse. A memo cell plus an assignment has two
  readings (reset the memo / bypass it) and no obvious winner; `const`-like
  behaviour is the honest answer, and `TS2540`/`AS212` shapes exist.

### Transform order

`applyInTreeTransforms` (`src/transforms.ts:34`) runs two transforms in a
documented load-bearing order: **closure, then async**. The lazy transform must
run **before both**:

- before **async**, so the `await` it synthesizes is lowered by the existing
  machinery (measured, Shapes B/C);
- before **closure**, so capture analysis sees the final code shape — the cells
  and the guard — rather than having to rewrite already-rewritten environment
  accesses.

One consequence: its synthesized names must join the shared reserved namespace
(`isReservedName`, `closure/lower.ts:150-168`, which already holds `$init$`,
`$env`, `$this`, `$parent`, `$awaitedN`). A `$lazy$` prefix is one line there. If
it is forgotten, a user identifier can collide with a synthesized cell — and that
guard exists precisely because this class of bug was found before (F14).

---

## 5. Measurement 5 — the three warnings

### Infrastructure: present, adequate, and not where you would put it

`DiagnosticEmitter` has `pedantic`/`info`/`warning`/`error`
(`src/diagnostics.ts:381–450`); `Parser`, `Program`, `Compiler` all extend it, so
any transform can warn. Warnings do not fail a build (`checkDiagnostics` counts
only `isError`, `cli/index.js:1203`), they are suppressible
(`--disableWarning <code>`), and they are pinnable in fixtures
(`tests/compiler/field-initialization-warnings.json` pins `AS906`/`AS233`). The
catalogue holds 215 diagnostics and none names a discarded value, so all three are
new codes.

Three measured reasons **not** to detect them at `compileExpressionStatement`
(the site the v3 draft assumed):

| variant at the statement site | suite | warning fires |
|---|---|---|
| fresh `resolveExpression` on the statement's expression | 8 fixtures fail (type-id order shifted) | yes |
| read the already-compiled `this.currentType` | green | no — compiled as `void` |
| resolve only the callee as an element, check `isAsync` | green | no — `lower.ts:1008` clears `isAsync` |

All three belong in the transform, where the shapes are syntactic and nothing is
instantiated.

### W1 — `await @lazy f()`

**Shape (measured): `Await → Lazy → Call`.** Trivial to detect: an
`AwaitExpression` whose operand is a `LazyExpression`.

**Trivial to lower, too:** drop the wrapper and compile `await f()`. Await forces
the read, so memoization is unobservable — the erasure is not a shortcut, it is
the correct semantics. Emit the warning at the same moment.

### W2 and W3 — and why they are one warning

- **W3** `spawn(f);` unawaited: `ExpressionStatement → Call(spawn)`. Measured
  shape, trivially detectable.
- **W2** `@lazy spawn(f)` whose `Task` is never awaited: `Lazy → Call(spawn)`.

Both are the same defect — **a `Task<T>` value that is never awaited** — at two
positions. Recommend **one diagnostic, one message**, reported wherever the
unawaited task value is found: at a statement-position `spawn` call, and at a lazy
binding whose value is a `Task` and none of whose reads is awaited.

That second half is a **use property, not a shape property**: it needs "is any
read of this binding an await?" — the walk the transform is already doing for
`refs`. So it is nearly free inside the transform and expensive anywhere else.

**Affordability, measured:** of the 309 `.ts` fixtures in `tests/compiler`,
exactly **one** contains a statement-position dropped async call
(`async-closure-value.ts:22`, `inner(changetype<Task<i32>>(0));`), and that
fixture has no pinned-stderr `.json`. `std/` and `src/` contain no real async
functions (every textual `async function` in `src/` is a comment or a string), so
the self-compile is unaffected. Extending W3 to plain unawaited async calls is
therefore cheap — but it is a user-visible behaviour change, so it is your call,
not a measurement.

### One thing to decide explicitly

`await @lazy f()` is **allowed and lowered correctly**, and only warned about.
That is the ratified choice and it is self-consistent — but it means the compiler
emits code for a construct it calls pointless. Refusing is a one-line change in
the same arm. Worth deciding rather than inheriting.

---

## 6. Measurement 6 — the two meanings of `@lazy`

### The parser accepts both, and cannot confuse them

Measured with the probe in place:

- `@lazy const FOO: i32 = 1;` still parses through `parseTopLevelStatement:269`
  and compiles exactly as before (probe: clean, and the global carries
  `DecoratorFlags.Lazy` as it always did). **No regression.**
- `@lazy f()` in an initializer parses through the new `parseExpressionStart` arm.

The two never meet: at top level and at class-member position the `@` is consumed
by a decorator loop *before* statement/expression parsing begins; inside an
expression, only the new arm can see it. Disambiguation is **positional, decided
before either reading is attempted** — no lookahead, no backtracking.

The one place both readings could apply is a **top-level statement** `@lazy f();`
— there the decorator reading wins and yields `TS1206 Decorators are not valid
here` (measured). Which is the correct outcome anyway (§1.5).

### The resolver distinguishes them by carrier, not by context

This is what makes the two-meanings design safe rather than merely tolerable:

| | carrier | meaning | lifetime |
|---|---|---|---|
| `@lazy const X` | `DecoratorFlags.Lazy` **on a `Global` element** | ordering permission: compile the initializer as though it ran at the top of the file's start function (`compiler.ts:1274`, `:1386` swap `currentFlow`) | survives into the program |
| `@lazy EXPR` | a **`LazyExpression` node** | deferral + memoization | erased before resolve |

Different objects, different phases. No resolver arm asks "which `@lazy` is
this"; the question cannot arise, because a `Global` and an `Expression` never
occupy the same position in any switch.

**But it must be said out loud**, in the language docs and in
`docs/fork-posture.md`: the same token means *"compile-time ordering permission"*
on a declaration and *"run-time deferred evaluation"* on an expression. Those are
not one concept wearing two hats — one changes what the compiler may do first,
the other changes when the program does something. Position makes them
distinguishable; a reader still deserves a sentence.

### The collision that is real

`let x: i32 @lazy = 5;` — accepted silently as a post-type attribute (measured:
`NamedType` carrying `Decorator(lazy)`). Under the new reading that is a
decorator that does nothing in a position that looks meaningful. Refuse it (§1,
collision 1) — the same class of bug the memory-model phase closed for
`V @inline`, with the same fix.

---

## 7. The cost

Measured pieces first, then the estimate.

| piece | measured | note |
|---|---|---|
| `src/ast.ts` — `NodeKind.Lazy`, class, factory | **+18 lines** | probe, builds |
| `src/parser.ts` — `parseExpressionStart` arm | **+20 lines** | probe, builds |
| `src/extra/ast.ts` — `ASTBuilder` arm | ~6 lines | required: `tests/parser.js` serializes sources |
| `src/parser.ts` — post-type `@lazy` refusal | ~3 lines | the memory-model refusal is the template |
| `isReservedName` — one prefix | ~1 line | `closure/lower.ts:150` |
| validation walk for a surviving `LazyExpression` | ~40–60 lines | `async/validate.ts` precedent |
| **the transform** — scope walk, cells, guards, hoist, warnings | **~120–180 lines** | the real work |
| fixtures | 8–12 files | `.ts` + `.json` per refusal; `.wat` pairs for the three shapes |

**Total: ~200–300 lines of source across 5 files, plus fixtures.** Your ~150–250
estimate was close; the delta is the validation walk and the `ASTBuilder` arm,
both found by measurement rather than assumed.

The probe establishes the cheapest part as fact: **the whole syntax surface —
node, kind, factory, prefix arm — is 38 lines, and it left the compiler suite (309
fixtures) and `tests/parser.js` green.**

What keeps the number from being higher, each measured:

- **no scheduler work** — a call is the launch; the two-launch probe emits no
  scheduler import at all;
- **no `Task<T>` work** — the user type exists (`std/assembly/task.ts:87`) with
  the handle semantics the hoist needs;
- **no std change** — nothing in `std/` participates;
- **no codegen change** — the 113 `compileExpression` sites are untouched because
  the rewrite is at the AST;
- **no new analysis invented** — the scope/binding model exists
  (`Scope`/`Binding`/`refs` in `closure/lower.ts`), needing only to be shared or
  narrowed.

What could push it higher: lifting reference-typed await results (separate work,
`AS100`-gated today), and the read-but-never-awaited half of the warning if it is
attempted outside the transform.

---

## 8. Recommendation

**The grammar is clean; build it.** Measurement 1 was the gate and it passed: 38
lines, suites green, positional disambiguation with no lookahead, no existing
program changes meaning.

Sequence, smallest irreversible step first:

1. **Node + parser arm + position rule + post-type refusal + the validation
   guard.** No semantics yet: `@lazy EXPR` parses, and any surviving node is a
   *diagnostic*, not a crash. This must land alone, because the `assert(false)`
   defaults (measured, §2) make every later bug a compiler crash with no message.
2. **Shape A (sync) in the transform.** Cells, guards, reads. This is the entire
   read-site machinery; B and C are that machinery plus one operator and one
   hoist. Measure against the run-probes in §3 (`182`, `30`).
3. **Shape B (`@lazy await f()`)** — adds the `await` inside the guard.
4. **Shape C (`@lazy await spawn(f)`)** — adds the hoist and the `spawn` marker.
5. **Warnings.** W1 with the erasure (two lines of lowering plus a message);
   W2/W3 as one diagnostic.

Decisions I would make now, with the measurements attached:

- **`@lazy spawn(f)` with no await: the "deferred launch" reading, warned
  conditionally** — see §8.1. It makes `@lazy await spawn(f)` the only escape and
  collapses W2 into W3.
- **Writes to a lazy binding: refuse.** A memo cell plus assignment has two
  readings and no obvious winner.
- **Reference-typed lazy-await: out of scope**, matching today's `AS100`.
- **W1: warn, as ratified** — noting it lowers correctly, so a change of heart to
  "refuse" is one line.

### 8.1 The spec ambiguity that needs your ruling

Two statements in the ratified design pull in opposite directions:

> "spawn … ESCAPES `@lazy`'s deferral — you cannot defer a spawn, because spawn
> means 'launch now.'"

> "`@lazy spawn(f)` — allowed but pathological (deferred spawn, Task never
> awaited, result discarded)"

"Escapes always" makes `@lazy spawn(f)` a **launch now** with a useless
annotation — in which case the warning should be *"spawn escapes `@lazy`; the
deferral is nullified"*, i.e. W1's message, not W2's. "Deferred spawn" makes it a
**launch at first read**, contradicting the first sentence.

**Recommended reading: escape only when `spawn` is the operand of the `await`
inside the `@lazy`.**

- It is the only reading under which "deferred spawn" is true, and it gives one
  rule with no special cases: *inside `@lazy`, `await spawn(x)` launches now;
  anything else defers.*
- It makes `@lazy spawn(f)` a real fifth form rather than a mistake — deferred
  launch with an explicitly awaited handle:
  `let t = @lazy spawn(f); … await t;` is deferred-start, awaited when you choose.
- It makes W2 conditional ("the `Task` is never awaited") instead of
  unconditional — exactly the text you gave it — and makes W2 and W3 the same
  defect, so one diagnostic covers both.

Under the alternative ("escapes always"), `@lazy spawn(f)` and `spawn(f)` are
identical, the warning is W1's message, and there is no fifth form. Both are
implementable in the same arm; the choice changes the warning text and the form
table, not the cost.

---

## 9. What could not be measured read-only

1. **A parking task resumed by a real host.** The settled path was run
   (`go() = 30`, and v3's `go() = 3`); the suspend path was read as WAT and is
   covered by `tests/async/runtime.js`, which I read but did not drive against
   these probes.
2. **Slot accounting under a real executor loop.** Completion/discard and
   release-on-completion were measured with a hand-bound table and a node
   harness; a host that resumes tasks could interleave differently.
3. **A lazy binding read from a *different* function** via capture. The guard
   inside an arrow body compiles (§3, Shape A), and the cells are ordinary
   captured locals, but I did not build the cross-function probe.
4. **`ASTBuilder`'s printed form for a `LazyExpression`.** The arm is required
   (measured: it would `assert(false)`), but the exact serialization was not
   written, so `tests/parser.js`'s expected shape for it is unmeasured.
5. **The `--wasm` self-host path** with a new node kind: the transforms run inside
   the compiled compiler too, and I measured only the JS host.
6. **Cost of lifting reference-typed await results** — out of scope, and the
   `AS100` gate means no probe exists.
7. **The engine's executor**, and what the host does with a completion nobody
   wants: `docs/scheduler-contract.md` §4.7 addresses *lost* completions, not
   *unwanted* ones. Tension is out of scope for this arc.

---

## 10. Method — exact commands

Environment: this machine, node v24.21.0, 2026-10-26, base `c3be16fc`, in
`git worktree add --detach /tmp/lazy-probe origin/main` with `node_modules`
symlinked. The primary checkout was not modified; every probe patch was reverted
before the worktree was discarded.

**The parse probe** (§1, §2): `src/ast.ts` +18, `src/parser.ts` +20 — a
`NodeKind.Lazy`, a `LazyExpression` class, a `Node.createLazyExpression` factory,
and one `case Token.At:` in `parseExpressionStart` that reads `lazy` and parses
its operand at `Precedence.UnaryPrefix`. `npm run build` rc=0;
`npm run test:compiler -- --parallel` rc=0; `node tests/parser.js` rc=0.

AST shapes were read with a dump script over `dist/assemblyscript.js` (signature
is `parse(program, text, path, isEntry)`, not `(program, path, text)` — worth
noting, it cost a wrong first dump).

Compile / read the WAT / run:

```
node bin/tensionscript.js probe.ts --noEmit
node bin/tensionscript.js probe.ts --textFile probe.wat --debug -O0
node /tmp/runwasm.mjs probe.wasm go
```

Runtime probes: `r1` (memoization → `182`), `r2` (two launches then reads → `30`,
no `scheduler` import in the WAT), `r3` (launched and never read → `30`: the task
completed and was discarded).

The crash measurement (§2) is `return @lazy g();` with the node and arm in place
and no lowering: `AssertionError` at `compiler.ts:3889`, exit code 2, no `ERROR`
line.

The fixture/warning affordability count (§5) is a source scan over
`tests/compiler/**/*.ts` for a line-initial call to a name declared
`async function` in the same file, ending in `;` — one hit.
