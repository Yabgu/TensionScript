# Session findings and their regression tests

**Status:** record. Written after the async-cleanup and lint sessions, from the
standing directive: *for every finding, a regression test should exist so it
cannot regress silently.*

**Why this file.** Not every finding is testable the same way, and a table that
pretends otherwise is worse than no table. Each row below names the test that
would fail on re-introduction, or says why no such test should exist. A future
reader can check coverage without re-deriving it.

**Citations are current as of `main@e2656f4a`** (PRs #9, #10, #11 and #12
merged; PR #13 — SROA — is this branch). PR #9 (`04986ac4`) and PR #10
(`f4c01b41`, squash-merged from head `49952a56`) are both on main, so every
test cited below exists in this branch's tree and runs in `npm test`. The
"Lands on" column records which PR introduced each one; it is history, not a
dependency.

---

## The four kinds of finding

| Kind | What proves it | Example |
|---|---|---|
| **Behavioural** | a fixture asserts the value; the assertion fails on regression | `alignof<{u32,u64}>() == 3` |
| **Structural** | removing the mechanism makes *another* test fail | no `__taskBindTable` → no park announcement → assertion fails |
| **Dead-code removal** | the lint gate, *if* the gate runs where developers run tests | PR #11 |
| **Prose** | nothing; record the reason | PR #9's doc clause |

---

## Findings

| # | Finding | Test that fails on regression | Lands on | Kind |
|---|---|---|---|---|
| a | `sizeof` returns the C size, trailing padding included (variant B, 0.8.0) | `tests/compiler/interop/sizeof-trailing-padding.ts:44` (`assert(sizeof<Tail>() == 40)`), `:51` (`!= 37`) | main | behavioural |
| b | `alignof` for records returns the record's own alignment, both `@unmanaged` and `@managed` | `tests/compiler/interop/alignof-records.ts:50-51` (`alignof<OneU16>() == 1`, `alignof<U32ThenU64>() == 3`), plus the base-alignment and class cases in the same file | PR #9 | behavioural, three-way |
| c | `DecoratorFlags` has no two names on one bit (`ManagedStruct` 1<<11, `Unsafe` 1<<13, `InlineStruct` 1<<12) | `tests/flags.js:84` (`no two entries share a value`), `:94` (`every non-zero entry is a single bit`), `:102` (`ManagedStruct and Unsafe are distinct`), the pinned values at `:99-101`, and the gate pair at `:151` / `:161` | this PR | behavioural |
| d | The two async `.wat` fixtures match the emitter | the `compare fixture` step against `tests/compiler/async-closure-value.{debug,release}.wat` and `…-closures-case6.{debug,release}.wat` | PR #10 | structural (the fixture *is* the test) |
| e | The lowered entry carries the buffered-completion `If` guard at index 3 | `tests/async/lower.js:230` (the kind array) and `:254` (`check("the guard is an if", guard.kind, NodeKind.If)`) | PR #10 | behavioural |
| f | `break`/`continue` are accepted by the async planner, not refused | `tests/async/lower.js:1013` (the `9a.` block) → `:1028-1035`: four shapes, `check(… lowers with no refusal, refusals(r), [])` | PR #10 | behavioural |
| g | `runtime.js` uses the post-`50cceb36` API (`__taskResume`/`__taskWake`/`__taskFail`, no `__taskTick`) | the file compiles at all (five removed symbols were imported before) and its 78 checks: `tests/async/runtime.js` | PR #10 | structural + behavioural |
| h | Host-driven cases bind the task table before resuming (no vacuous passes) | the eight park-observed assertions: `tests/async/runtime.js:564, 615, 766, 804, 846, 883, 959, 1050` | PR #10 | structural — chain measured, below |
| i | Two unused symbols removed; lint is clean | **the lint gate** — `npm run check`, now in `npm test` via `pretest` (this PR) | this PR | dead-code |
| j | The test-guest re-export is the entry point the harness needs | **nothing** — measured redundant, see *Correction 1* | — | claim measured false |
| k | §16 item 4 in the scoping doc is Tension-side, not TensionScript | none — one-time prose correction | PR #9 | prose |
| l | `@inline struct` locals are copied, not aliased (SROA) | `tests/compiler/interop/inline-struct-sroa.ts` — `assert(copyOnDeclaration() == 599)` (aliased gives 9999, unset 99), `copyOnAssignment() == 642`, `lopsided` `u8`+`u64` field widths, `pointerFieldCopy() == 72` | PR #13 | behavioural, three-way |
| m | A `T[N]` field and a GC-reference field in an `@inline struct` are refused, not emitted wrongly | `tests/compiler/interop/inline-struct-sroa-refusals.ts` (+ `.json`, 3 pinned diagnostics) | PR #13 | behavioural |
| n | A whole `@inline struct` value cannot be read or assigned as a whole (no address) | same fixture, third pinned diagnostic (`reading an @inline struct value as a whole`) | PR #13 | behavioural |
| o | `@inline struct` at top level is refused (a global is a pointer slot and aliases) | `tests/compiler/interop/inline-struct-top-level.ts` (+ `.json`, 5 pinned diagnostics for annotated const, inferred const, a second value, inferred `let`, annotated static) | PR #13 | behavioural, three-way — refuse cell measured |
| p | `Class.members` holds `PropertyPrototype`, not `Property`; the bound `Property` is at `prototype.instance` | `inline-struct-sroa.ts` — nothing is emitted without it (SROA's field list came back empty, so field access refused); the fixture fails outright | PR #13 | structural |
| q | SROA must intercept **before** the initializer is compiled | `inline-struct-sroa.ts` — `copyOnDeclaration()` needs the initializer's *shape*; compiling it first asserts on the bare value | PR #13 | structural |
| r | `@inline struct` parameters pass **by value** (flattened signatures) | `tests/compiler/interop/inline-struct-params.ts` — `passByValue() == 599` (9999 = aliased), `multiParamOrder() == 12534` (`(p.x,p.y,q,r.x,r.y) == (1,2,5,3,4)`) | PR #14 | behavioural, three-way |
| s | A closure inside a function with an `@inline` parameter reads both correctly | same fixture — `closureEnvSlot() == 26`. Fails if `getNonParameterLocalTypes` counts source arity instead of WASM arity | PR #14 | behavioural (the silent-drift guard) |

### (h) The chain, measured

Reasoning is not evidence, so the chain was tested: in a throwaway worktree of
PR #10's tree, `bindTaskTable()` was deleted from the guest-to-guest delivered
case. Result:

```
FAIL   ...and the park was announced to the host
       expected 1
       actual   0
```

The chain: no bind → `parkState` returns early (`std/assembly/task-rt.ts:209`,
"no table bound: pull path only") → `scheduler.park` is never called →
`parked.length` is 0 → the assertion fails. No new test was needed; the
existing assertion *is* the regression test, and it fails loudly rather than
passing vacuously.

---

## Gaps

### Gap 1 — the `DecoratorFlags` collision has no discriminating test

`tests/compiler/interop/managed-struct-unsafe-flag.ts` (PR #9) asserts that a
`@managed struct` using `new`, a method call, a field read/write and a global
write compiles clean under `--noUnsafe`. That is a **guard**, not a
discriminator: the collision was latent, so the fixture compiles clean with the
collision present too. Nothing in the repository fails if `Unsafe` is moved back
onto `1 << 11`.

A discriminating test is straightforward and not circular — `DecoratorFlags` is
reachable from `dist/assemblyscript.js` (verified), so a JS-level test can assert
the three flags are distinct. **It cannot land on this branch**, because this
branch is off `main`, where the collision is still present:

```
src/program.ts:3054  ManagedStruct = 1 << 11
src/program.ts:3064  Unsafe = 1 << 11
```

An assertion of distinctness — or of any exact value — fails while the
collision is present, so it could not be written before #9 merged.

**Closed by this PR.** `tests/flags.js`, wired into `npm test` as `test:flags`,
asserts distinctness, single-bit-ness, the three pinned values, that a
`@managed struct` reports no unsafe operation under `--noUnsafe`, and — as the
control — that a bare `load<u8>(p)` still is refused. Shape is a standalone node
script, not a guest fixture and not a `build.sh` grep: `DecoratorFlags` is
reachable from `dist/assemblyscript.js`, so the enum is enumerated directly
rather than re-parsed.

Verified it catches the bug rather than merely passing: reintroducing
`Unsafe = 1 << 11` in a scratch build fails three checks —

```
  FAIL no two entries share a value
  FAIL Unsafe is 1 << 13
  FAIL ManagedStruct and Unsafe are distinct
ERROR: 3 of 10 flag checks failed
```

### Gap 2 — the lint gate was outside the local loop

Closed by this PR: `pretest` now runs `npm run check`. Verified by deliberate
break — re-adding the unused `isPowerOf2` import and running `npm test`:

```
src/resolver.ts
  101:3  warning  'isPowerOf2' is defined but never used. …
✖ 1 problem (0 errors, 1 warning)
ESLint found too many warnings (maximum: 0).
```

exit 1, before any suite runs.

---

## Ratified decisions (not follow-ups)

### The GC-reference field refusal is the phase's final state, not a deferred commit

An `@inline struct` field that holds a **GC reference** (`@managed struct`, or a
class reference) is **refused**, and that is a decision rather than a staging
step. The reason is structural, not budgetary:

> An SROA'd field lives in a **WASM local**, not in memory. The write barrier's
> `__link` takes an **address** — the address of the slot the reference was
> stored into — and an SROA'd field has none. So "add the barrier" is not
> available: the implementable options are (a) a mixed representation, scalar
> fields in locals and GC fields in a shadow slot, or (b) refuse.

(b) is this phase. (a) is a **design phase** — it changes what a value *is*
(part-local, part-memory), and every downstream consumer of SROA inherits that
split: parameters, returns, captures, and the `@external` temp. Filed as its own
phase, not as a follow-up commit here.

Fixture: `tests/compiler/interop/inline-struct-sroa-refusals.ts`, the second
pinned diagnostic.

### `@inline struct` at top level: refused, with the alternative named

A global is one `i32` slot; a value needs one per field. The refusal says so and
names the fix — declare it inside a function, where SROA applies. The refuse cell
is measured in the fixture's header: `const H = G` then `H.x = 99` returned
`G.x == 99` before the fix.

---

## Count reconciliation (why the declaration numbers disagreed)

Three different numbers appeared across this session's reports, and all three
were "right" under a different rule. The canonical figure, and the rule:

| Rule | TensionScript `tests/` | Tension (engine) |
|---|---|---|
| `grep -o '@unmanaged[[:space:]]+(struct\|class)'` — **counts comment mentions** | 58 | 46 |
| Declarations at line start, decorator inline or on its own line, comments excluded | **46** | 46 |
| …plus plain `struct X {` (the parser injects `@unmanaged`) | **52** | 46 |
| `@managed struct` declarations, same rule | **14** | 0 |
| `@inline struct` declarations, same rule | **16** | 0 |

So:

- The **35** quoted in earlier phases counted `@unmanaged struct` *declarations*
  in the engine's framework at that time; the engine has since grown, and the
  count is repo- and scope-dependent. It was never a TensionScript number.
- The **55 / 27** in PR #13's report came from the `grep -o` rule while four new
  `@inline struct` fixtures were excluded — i.e. it counted comment mentions
  (`@inline struct` is an `@unmanaged class`…") and inflated each side by about six.
- **Canonical for this audit: 46 `@unmanaged` + 6 plain `struct` = 52 unmanaged
  records, 14 `@managed struct`, 16 `@inline struct` in TensionScript `tests/`**,
  counted as declarations with comments excluded, at PR #13's head.

A future reader reconciling a number should ask two questions first: *which
repo*, and *does the rule count comment mentions*.

---

## Follow-ups filed this phase

| Follow-up | Why it is not in scope |
|---|---|
| ~~**SROA parameters** (field-list signatures)~~ | **Landed in PR #14** (`f55fe7d0`): `wasmParamCountOf` / `wasmParamStartOf` / `wasmParamCount` / `sourceIndexOf` are the only translation site; the callee gets one local per field; the call site expands arguments in field order. |
| ~~**SROA return (sret)**~~ | **Landed in PR #16** (`73fb7a57`): hidden destination parameter, the static call-temp stack, per-call-frame mark/restore. Design note: `docs/interop-sret-design.md`. |
| ~~**`@external` temp**~~ | **Landed in PR #16** (`516104f9`): the caller's temp, `(param i32)`, borrowed for the call. |
| **SROA for top-level statics** | Per-field WASM *globals*, or a shadow slot. Refused until then, with the alternative named. |
| **SROA for GC-reference fields** | The mixed representation above — a design phase. |
| **`T[N]` fields in `@inline struct`** | Deep SROA: N locals per array field, plus a `makeZero` arm for `FixedArray` (it asserts today, `compiler.ts` `makeZero`). |
| **Closure capture, inline nesting** | Later commits of the 1.0 phase (scoping §9, §10). Closure capture needs inline nesting first (the environment is a class, and a value-typed field in one is nesting). |
| **`@external` return of `@inline struct`** | An ABI version: the host would have to write `sizeof<T>` bytes into a slot it never allocated. The last refused case. |
| **`--sretStackSize`** | The 4 KB limit is shared by sret and the `@external` temp, so this option is one limit for both. Structurally identical to `stackSize`. |
| **`unmanaged-single-field-tool-convention`** | A one-scalar `@unmanaged struct` passes as a pointer where BasicCABI passes the scalar. Ratified *accept*: the engine's adapter reads records through `guest_read(ptr, len)` (`tension_adapter.h:184`), so aligning it would change a live ABI. Revisit only if a C-authored consumer appears. See Finding 3. |
| **`--create=false` in the compiler test harness** | `tests/util/options.js`'s boolean parser treats `--create=false` as `true`, so there is no way to say "compare only" on the command line; passing it regenerates the fixtures from whatever build is present. Discovered the hard way (a broken build rewrote three fixtures). Also `--create` is `type: "b"`, so the value is never inspected. |

---

## PR #14: SROA parameters — two corrections and a pattern

PR #14 (flattened signatures, the source-to-WASM parameter mapping) shipped
green, but two of its *sites* were wrong in the plan and right in the code. Both
are recorded here because the next contributor will read the plan.

### Correction 1 — `operandsTostack` was missing from the site list

The pre-work enumerated 13–15 sites that assume source parameter index == WASM
parameter index. The actual change touched **16**. The missed one,
`operandsTostack` (then `compiler.ts:7231`), held

```ts
assert(parameterTypes.length >= operands.length - operandIndex);
while (operandIndex < operands.length) {
  let paramType = parameterTypes[parameterIndex];   // walks parameter types by operand index
```

— both an assumption flattening breaks and an index walk that only works under
it.

**Its failure mode is a compiler crash, not aliasing.** The first call with a
flattened argument asserted out of `operandsTostack` before emitting anything
(caught by running `take(a, 7)` on a two-field value, not by reading the list).
That distinction matters for triage: an aliasing bug ships silently, a crash
does not.

Caught after the fix by `tests/compiler/interop/inline-struct-params.ts` —
`passByValue()` and `multiParamOrder()` both fail to *compile* without it.

### Correction 2 — sites 6/7 are source arity, and must stay that way

The plan said "`maximum` becomes `wasmParamCount()`". That is **wrong**, and the
code deliberately does not do it:

```ts
compiler.ts:6630   let maximum = signature.parameterTypes.length;
compiler.ts:6748   assert(numArguments <= parameterTypes.length);
```

`numArguments` is how many arguments the **user wrote**. Both checks run *before*
the operand array is built, so both are source arity. Making them
`wasmParamCount()` would accept `f(x, y)` for a one-parameter function returning
`@inline struct` — a new bug wearing the costume of a fix.

The general rule the params work established: **checks are source arity,
emission is WASM arity.** Flattening happens when operands are emitted, after
every check has passed.

### The pattern: the site list is a first enumeration

Both corrections have the same shape. A pre-work site list, read off the source,
catches the **mechanical** sites — the ones that visibly compute an index. It
does not catch **arity-shape** sites: code that encodes "N parameters means N
operands" in a way no `grep` for `paramRefs` finds. Those surface only when the
compiler compiles something.

> **The pre-work site list is a first enumeration; running the compiler's own
> fixtures is the second, and the list is not complete until the fixtures are
> green.**

Budget accordingly: a pre-work that ends with a site list has not finished
measuring. The first fixture run is part of the measurement, not the
verification.

**Consequence for sret.** Its site list is **not empty** and **not final**.
`compiler.ts:7070` — `let tempIndex = 1 + parameterTypes.length;` (the comment
says `// incl. this`) — is the seventh site and the first predicted one: source-arity arithmetic for a
temp *local index*, which collides with a hidden destination parameter's slot.
That site is the sret analogue of `operandsTostack`, and by the pattern above it
should be assumed to be one of several. See `docs/interop-sret-design.md`.

---

## Corrections to this session's own record

**Correction 1 — the re-export is redundant.** PR #10's commit message and PR
body say the test guest needs
`export { __taskResume, __taskWake, __taskFail } from "~lib/task-rt";` so the
harness can reach the resume entry. Measured: deleting that line entirely leaves
all 78 checks passing. The tests drive `resumeOne`/`failOne`, which are
themselves guest exports; nothing calls `__taskResume` from JS. The line is
harmless but not load-bearing, and the record should not claim otherwise.
(Left in place — removing it is PR #10's call, not this branch's.)

**Correction 2 — "the doc's async follow-up entry".** An earlier commit message
said the scoping doc's async follow-up could be corrected once #10 merged. No
such entry exists: the doc never names `async-closure-value`,
`async-closures-case6` or `runtime.js`, and its only async-adjacent item is the
Tension-side `cargo test` debt. §16 item 4 now says so in the doc itself (PR #9).

---

## Verifications that are **not** tests

These were checked by hand during the sessions. None is captured as a test, so
each can drift silently. Listed so the gap is visible rather than assumed away.

- **`layout_hash == 786288195`.** Verified repeatedly against
  `arena.rs::layout_hash()`, `layout.ts:16` and the host binary. No TensionScript
  test asserts it; the engine's `arena.rs` tests cover the host side.
- **"Tracked `dist/` files unmodified."** A CI job step in
  `.github/workflows/test.yml` (`check` job, step 1), not in `npm test` or
  `npm run check`. A local run cannot catch a regenerated `dist/` that was
  accidentally staged.
- **"`isPowerOf2` has 0 call sites."** A one-time grep; the lint gate now covers
  re-introduction locally.
- **The `/tmp` probes** (alignof values, bind-table behaviour, guest-driver
  shapes) — one-time scripts, never committed. The alignof values were later
  captured as fixture b; the bind-table chain as (h).
- **"Stashed the diff and re-ran `test:async` to prove identical failure."**
  One-time. Its conclusion (the async failures predate the lint change) is
  durable because the failures belong to PR #10, whose tests are (d)–(h).

---

## What this PR adds and does not add

- **Adds:** `pretest` (Gap 2), and this record.
- **Adds (later commit):** `tests/flags.js` — Gap 1 closed once #9's fix reached
  main.
- **Does not add:** a test for the dead-code removal beyond the lint gate
  (circular), a test for the prose correction (one-time event).
- **Does not fix:** Correction 1 (PR #10's branch), the `dist/` local gap (a CI
  concern, unchanged), the bootstrap failures (the Bootstrap-ordering phase).

## PR #16: sret — the layout correction, the eighth site, and the read-back finding

**The layout correction.** The design note said the call-temp stack lives
"below `__data_end`", which reads like the shadow stack. Measured in an emitted
module: `__data_end` 520, `__stack_pointer` = `__heap_base` 33288. The region
`[16, __data_end)` is the **data segment**, and `visitStack` walks
`[__stack_pointer, __heap_base)` — so a slot in the data region is never scanned
as a GC root, which is exactly the property the mechanism needs. The base is a
compile-time constant (the segment's `.offset`), so a call site emits
`i32.const base + mark` and no address computation.

**The bump pointer's safety.** `compileVisitGlobals` (`builtins.ts:11058-11062`)
visits only class-typed globals. A plain `i32` global contributes no GC edge and
no interrupt threshold, so the bump pointer cannot be mistaken for a root or trip
a collection. Initial value = the segment offset; mutated only by alloc/restore.

**The eighth site.** `operandsTostack` mapped WASM operands to source parameters
through `sourceIndexOf` and treated `-1` as "past the end". With a hidden
destination at operand 0, that `break` fired on the first operand and abandoned
every managed operand after it — the managed argument reached the call as a bare
`local.get`, unspilled. Fixed by checking `wasmParamCount()` first (which makes
`-1` unambiguously the hidden slot) and advancing **both** indices past it.
Measured load-bearing: reverting the loop makes `inline-struct-sret-eighth-site`
fail on exactly the missing spill block.

**The stub fix is defensive.** `finalizeOverrideStub`'s temp local is
`1 + wasmParamCount()`, but a virtual method returning an `@inline struct` is
refused at `compileFunction` before the stub is finalized, so no test exercises
it. Verified by inspection and by no regression in the suite.

**Region size is policy.** 4 KB = 256 slots at the 16-byte fixture record size.
The precedent is the shadow stack (`compiler.ts:290`, 32 KB, abort on overflow).
Overflow aborts with a message naming the limit; a silent overwrite of the next
slot would be a corruption bug that reads as a wrong value. `--sretStackSize` is
a follow-up, structurally identical to `stackSize`.

**The read-back finding — the design note's §8 was wrong.** §8 framed
"multi-value results" as set aside. Measured before writing the read path: every
non-consumer use of an `@inline struct` call result is refused (the gate: `g(f())`
and the four other shapes), and no path treats the slot's address as a value.
Sret therefore does not need multi-value results — **the model says there is no
value** — and the change did not touch the expression pipeline at all. It
relocated the problem from the call to the read path, and that path has exactly
two shapes: one field load for `f().x`, a per-field copy for `let q: P = f()`.
Recorded as a correction in `docs/interop-sret-design.md` §8, which now also
records the **third** consumer: a bare `f()` statement (the discard shape), which
allocates, calls and unwinds without reading. Three consumers, and the refusal
covers everything else.

**The gate, measured.** The five non-consumer uses were compiled as probes
before the read path existed. Four refuse: `g(f())` (AS100, passing an
expression as a value argument), `f() + 1` (TS2365), `return f()` in an `i32`
function (TS2322), `a[i] = f()` (AS100: `Array<P>` is a refused type argument,
and the store reads the value as a whole), and `obj.field = f()` (AS100:
inline nesting at the field declaration). A bare `f()` compiles, and its WAT is
the safe shape: mark, bump, guard, pass `base + mark` as the hidden destination,
call, restore — no `local.get` of the slot, no address treated as a value. The
gate therefore did not fire; the four refusals are pinned in
`inline-struct-sret-refusal-reach.ts`.

### The three gate-probe findings

Each was found while measuring the refusal's reach, each is fixed, and each has a
fixture that fails if the fix is reverted. The reverts were run, not reasoned
about.

**1. Constructors are not sret** — `fd6c7772`. A constructor's declared return
type is its class type; for an `@inline struct` that made `hasHiddenDestParam`
true, and the emitted constructor came out as
`(param $this i32) (param $sretDest i32)` with **no result**, while its body
still returned `this`. `Signature` gains `sretDisabled`, part of the memoization
key and set only for inline-struct constructors; ordinary constructors keep their
old key and type-id sequence, because the flag had to be in the key *and* had to
stay off every other signature (an unconditional flag shifted type ids and broke
`builtins`, `async-closures-case6` and `async-closure-value`).
*Revert measured:* removing the `sretDisabled` check from `hasHiddenDestParam`
makes `inline-struct-sret` fail at validation with
`wasm-validator error in function interop/inline-struct-sret/P#constructor`.
*Fixture:* `inline-struct-sret.ts` (`inferredNew`, `zero`).

**2. Inferred locals enter SROA** — `fd6c7772`. `let p = new P()` and
`let q = f()` reach the post-inference SROA branch once constructors are valid;
`let q = p`, with **both** types inferred, had no annotated type to trigger the
SROA branch, so it compiled `p` as a bare identifier — the whole-value refusal.
A local lookup in `compileVariableStatement` before the initializer is compiled
fixes it, and deliberately resolves nothing (a `resolveExpression` there can
force a class before the compiler's builtin constants exist, which crashed on
`new Box()` during the first attempt).
*Revert measured:* removing the identifier pre-check makes `inline-struct-sret`
fail with `AS100: reading an @inline struct value as a whole`.
*Fixture:* `inline-struct-sret.ts` (`inferredFromLocal`, `inferredNew`,
`inferredCopy`), including a call counter proving `let q = f()` emits **one**
runtime call (`countedOnce() == 1067`).

**3. A refused field must not reach codegen** — `fd6c7772`. A class field of
`@inline struct` is refused at its declaration (inline nesting), but the
generated constructor still called `makeZero(fieldType)` for it and the field's
setter was still compiled. Both crashed Binaryen with
`Assertion failed: index < getNumLocals()` in `setLocalName`, from a local-index
mismatch in the generated function — a compiler crash on top of a diagnostic that
had already been reported.
*Revert measured:* removing the skip makes `inline-struct-sret-refusal-reach`
abort in `setLocalName` instead of reporting AS100.
*Fixture:* `inline-struct-sret-refusal-reach.ts` (`class Holder { field: P = new P(); }`).

**A pass-level constraint worth remembering.** Binaryen's passes assume one
parent per expression node. Sharing one address node between two field loads
compiles at -O0 and aborts `LocalCSE` in release
(`Assertion failed: !(requests && original)`). Every load builds its own
address node now, and the -O3 fixtures are what catch a regression.

**Instance-method sret: the shift.** An instance method's hidden destination is
WASM local 1 (`this` is local 0), so `compileSretReturnStatement`'s
`destIndex = signature.thisType ? 1 : 0` is a correctness hinge rather than a
formality: with 0, the method writes the returned fields over `this` and the
caller reads a wrong value out of a live object — no compile error, no crash.
`inline-struct-sret-instance.ts` is the guard, and it was measured: setting
`destIndex` to 0 for instance methods changes the emitted stores from
`local.get $sretDest` to `local.get $this`, fails the WAT comparison, and traps
the fixture's runtime assert at instantiation. The fixture also carries the
combined shape — `Calc#scale(this, dest, p.a, p.b, k)` — so the shift and the
parameter flattening are exercised together, which is where they would disagree.

## PR #16, continued: the `@external` argument temp

**The silent-flattening finding.** An `@external` declaration with an `@inline
struct` parameter emitted one WASM parameter per field — `(import "env"
"host_use" (func (param f32 f32) (result i32)))` for a two-field record. That
made the record's field list part of the host ABI with nothing recording it:
`layout_hash` folds arena geometry, and the host never sees the record. Measured
against the other two kinds: `@unmanaged` and `@managed` both emitted
`(param i32)`, so the value type was the only one with a different shape at the
same boundary. Refused first (`af88469e`), then served by the temp
(`516104f9`); the refusal stays as the fallback for a boundary signature without
the flag, and *that* is reachable — clearing the flag makes
`inline-struct-external-param-temp` fail on the diagnostic.

**One shape, one contract.** After the phase, all three record kinds cross as a
single borrowed pointer:

| Declaration | Import signature | Host receives |
|---|---|---|
| `@unmanaged struct` | `(param i32)` | borrowed pointer to the caller's record |
| `@managed struct` | `(param i32)` | borrowed reference |
| `@inline struct` | `(param i32)` | borrowed pointer to a caller-materialised temp |

The adapter has no per-field expectation anywhere: its only guest-memory path is
`guest_read(user, uint32_t ptr, void *dst, uint32_t len)`
(`tension_adapter.h:184`), and rule 6 (`:57-58`) makes it borrow.

**The temp's re-entrancy, measured.** The restore goes after the call node
because the host reads the temp during the call. Re-entry *inside* that window is
safe because the mark is a WASM local: `callback()`'s frame allocates above the
outer block and restores to the outer's post-bump value.
*Revert measured:* moving the restore before the call makes the host's second
read across re-entry return the **inner** temp's bytes — `before=3, after=101`,
`outer()` 205 instead of 107 — and the fixture's WAT comparison fails.
*Fixture:* `inline-struct-external-param-reentrancy.ts` (the glue re-enters the
guest and reads the same pointer twice).

**A per-call mark, not per-argument.** Two value-type arguments in one call take
one mark, one bump by the sum (32 = two 16-byte slices), one guard and one
restore; each argument gets a distinct slice, asserted by the host comparing the
two addresses. Bumping by the total before any operand is evaluated is what lets
a nested call allocate above the whole block rather than between two slices.

**Two traps the implementation hit, both recorded because they are cheap to
repeat.** (1) `paramRefs` for the boundary slot must be `TypeRef.I32` explicitly:
`toRef()` on an `@inline struct` builds a GC heap type via `ensureType`, which
produced a `~lib/string/String` type error in the first attempt. (2) The overflow
guard compiles a static message string, which leaves `currentType` pointing at
that string; the call's type must be restated after wrapping, the same way the
sret branch already did.

## PR #16, continued: the export mirror and single-field value types

**The export-flattening finding — the import defect, mirrored.** `export function
take(v: V)` declared `(param f32 f32)` for a two-field record: the field list as
the host ABI, with `layout_hash` not moving (it folds arena geometry, and this is
a guest-side declaration the hash never sees). Exactly the defect the `@external`
side had, in the outgoing direction. Refused first (`ca06c620`), then served by a
byval pointer (`5069aeba`): the host materialises, the callee loads each field at
entry. *Revert measured:* omitting the prologue fails
`inline-struct-export-param-byval` — the fields are never loaded, so the sums are
wrong — and the WAT comparison fails too.

**Two passes, not one, for byval binding.** Field locals of a byval parameter are
*additional* locals: the WASM signature spends one slot on the pointer, so the
fields have to come after every parameter local. Binding them in source order
gave local `i+1` the type of a WASM parameter that was really the next pointer —
`local.set` with an `f32` value into an `i32` local, refused by the validator.
The binding now assigns parameter locals first, then byval field locals, and
`getNonParameterLocalTypes` starts the additional list at `wasmParamCount()`,
which is exactly where the second pass begins.

### Finding 1 — the single-field breakage: broken everywhere, not just at the boundary

The pre-work asked a narrow question (does a one-field record pass a pointer or
the scalar at an `@external` position?) and the answer was: **a pointer**
(`(param i32)`, call site `base + mark`, 16 bytes reserved, field stored at
`+0`). The tool convention says the scalar, and both spell `(param i32)`, so the
mismatch is silent. That is why the shape is now refused at both boundaries.

Measuring it turned up something worse next door. **A one-field value-type
parameter was unusable everywhere**, including inside the module with no boundary
involved. Three sites decided "unpack into fields" from
`wasmParamCountOf(...) > 1`, and a one-field record spends exactly **one** WASM
slot:

| Site | What it did with `> 1` false |
|---|---|
| `program.ts` parameter binding | bound an ordinary local of the record type, with `toRef()`'s GC heap type, instead of an SROA field local |
| `Signature#paramRefs` | emitted that heap type as the WASM parameter |
| `Compiler#expandSroaArgument` | compiled the argument as a whole value — the refusal |

So the minimal case failed:

```ts
@inline struct S { a: i32; }
function take(s: S): i32 { return s.a; }   // AS100: reading an @inline struct value as a whole
```

All three now key on the **type** (`Signature.isInlineStructRef`) and use
`Signature.fieldCountOf` where a field count is what is meant. Commit `3db469cd`
both refuses the boundary case and fixes the internal one, because refusing alone
would have told the author to "use a scalar" while the scalar-shaped value was
silently broken.

*Revert measured:* restoring the `> 1` test in the parameter binding fails
`tests/compiler/interop/inline-struct-single-field.ts` — the guest function
`addOne(s: S)` reaching `s.a` is the load-bearing assertion, and it is the same
function the fixture exports through `run()`.

### Finding 2 — `wasmParamCountOf` answers two questions, and was used for the wrong one

`Signature.wasmParamCountOf(type)` answers **"how many WASM slots does this
parameter spend?"** It was repeatedly read as **"is this parameter an
aggregate?"** — a different question with a different answer precisely at one
field, where an aggregate spends one slot.

Three defects in this phase trace to that conflation:

1. **The single-field breakage above** — three sites, one wrong reading.
2. **The export flattening, pre-refusal** — the mirror signature was built from
   the same per-field expansion, so an export declared `(param f32 f32)` for a
   two-field record. Correct arity by the count's own rule; the count simply does
   not say "this is a boundary".
3. **The boundary temp's per-argument vs per-call shape** — deciding whether a
   parameter needed a temp meant asking a slot-count helper about a *position*;
   the answer was only well-defined once the signature carried the boundary as a
   flag, and the flag (not the count) is what the call site consults.

`Signature.fieldCountOf(type)` now separates the concepts, and
`wasmParamSlotCountOf` / `isInlineStructRef` / `isByValPointerParam` split the
remaining readings. **The rule for this audit, forward-looking:** *a helper that
answers two questions will be used wrong for one of them — split it before the
third defect, not after.* Two independent wrong readings are the signal; three is
a pattern that has already cost three fixtures.

The same shape of error appeared twice more in this phase in other helpers, which
is why the rule is stated generally rather than about this function: the
constructor flag (`sretDisabled`) had to be in the memoization key *and* absent
for every other signature, and `getNonParameterLocalTypes`'s boundary had to be
WASM arity rather than source arity.

### Finding 3 — the `@unmanaged` single-field divergence: ratified, not aligned

The same divergence exists for `@unmanaged`: a one-scalar `@unmanaged struct` also
crosses a boundary as a **pointer**, where BasicCABI would pass the scalar. Nothing
about `@inline struct` made this true — it was true before the phase, and the
phase's measurement merely made it visible.

**Ratified: accept, do not align.** The reasons are asymmetric, and the asymmetry
is the decision:

- The engine's adapter is **pointer-based by design**. Its only guest-memory path
  is `guest_read(void *user, uint32_t ptr, void *dst, uint32_t len)`
  (`tension-core/include/tension_adapter.h:184`) — a `(ptr, len)` pair — so every
  record it touches, `@unmanaged` included, arrives and is read through a pointer.
  Aligning `@unmanaged` to the scalar would change an ABI the adapter depends on
  today.
- BasicCABI is **a convention, not a law.** It describes how a C compiler targeting
  WASM lowers struct arguments; nothing in WASM enforces it, and a host written
  against this engine reads pointers.
- `@inline struct` is **new**, so no caller depends on its pointer shape. Refusing
  the one-field case there costs nothing and prevents a silent mismatch. Refusing
  it for `@unmanaged` would break existing callers to fix a theoretical one.

So the honest state is: one kind refuses the divergent shape (no dependants), two
kinds keep it (the adapter depends on it), and the divergence is **filed** rather
than hidden. Filed as **`unmanaged-single-field-tool-convention`** — revisit only
if a C-authored consumer of an `@unmanaged` single-scalar parameter ever appears,
at which point the choice is between flattening at the boundary and a documented
"this engine passes record pointers" note in the interop surface.

**Third finding (latent, not fixed).** The operand walk's `paramType.isManaged`
check uses the *source* parameter's type, not the individual field's. Correct
today because an `@inline struct`'s fields are scalar or struct-pointer, so
`isManaged` is false either way. It becomes wrong when GC-reference fields
exist: the walk's `-1` sentinel and its `isManaged` check both depend on the
flattening being field-safe, which it is only for unmanaged fields. Gated by the
GC-ref-fields phase.

---

## Bootstrap self-compile — the ordering phase

**Finding: the ratified mechanism was invisible to the toolchain.** The scoping
measured `@lazy` on namespace constants as the fix and verified it as
byte-identical WAT. Both of its spellings are dead:

- On a **variable declaration**, `@lazy` is an AssemblyScript grammar extension
  TypeScript rejects: `tsc` reports `TS1206: Decorators are not valid here`, and
  `@typescript-eslint` reports a **parse** error, which no directive can
  suppress — a parse error is raised before rules run. `// @ts-ignore` closes the
  tsc half and cannot touch the eslint half.
- On a **class member**, it parses and lints (TS treats it as a decorator
  expression; `// @ts-ignore` covers the undefined `lazy` name), but
  `npm run build` fails at module evaluation: `ReferenceError: lazy is not
  defined`. The JS build passes the decorator through as a runtime call, and
  `src/` contains no other decorator, so the path had never been exercised.

The lesson is about verification order: a WAT measurement answers "does this
change output?", not "does this build?". The gate that would have caught it —
`npm run check` — was run only after the annotation set was applied, at which
point it reported 29 errors against a fix that had already been adopted.

**Finding: the diagnostic was a false positive for constants.** `compileGlobalLazy`
refused any read of a global not yet compiled, on the theory that its initializer
might not have run. A constant initializer has no operands, so there is no order
it could observe. Relaxing that cleared 208 of 212 errors. The boundary is
pinned by `tests/compiler/variable-access-in-initializer.ts`, which keeps
`let b = (b = 4, 3)` **inside a function body** as `TS2448` — which is why the
relaxation is keyed on the initializer being constant, not on the read being
runtime code.

**Finding: `compilesToConst` answers two questions, so widening it broke one.**
Adding `Assertion` and `UnaryPrefix` to `Expression.compilesToConst` clears
`<Index>-1`, and also changes the gate for filling omitted arguments with their
initializers (`compiler.ts:7576`): four fixtures lost their varargs stub
(`call-optional`, `call-inferred`, `std/string`, `std/typedarray`) — emitted
output changed for code that compiles today. Split instead:
`evaluatesToConst` for the ordering question, `compilesToConst` unchanged for
the codegen question. Same pattern as `wasmParamCountOf`: a helper that answers
two questions gets used wrong for one of them.

**Finding: a file's walk does not order its globals before its readers.**
Instrumented walk order: `compiler.ts` is file 32 of 71 and imports
`closure/ir.ts` at 33, yet `closure/ir.ts`'s own globals compiled after the
refusals. So "hoist the declarations to a file imported first" does not work —
import order is not a compile order for globals. The four remaining tables
became accessors over null-initialized backing stores: `null` is a constant
(so reading the store is already allowed), and a function is compilable on
demand in any order.

**Finding: the self-host harness was never reachable, and now is not runnable.**
With stage 1 at 0 errors, `bootstrap:debug` proceeds to stage 2 and dies in
`cli/index.js:523` — the CLI marks std sources through `program.sources` and
`program.stdSources`, properties that exist on the JS compiler and are
`undefined` under `--wasm`. Measured directly: `newProgram()` returns an object
whose `.sources` is `undefined` for the WASM module, and the same CLI runs fine
when the compiler is JS. This is independent of the ordering work and was
invisible while stage 1 failed. Until it is fixed, the self-host fixpoint (the
final `.wast` diff, the phase's strongest neutrality proof) cannot run; the
interim proof is `npm test`'s 1339 fixtures compared byte for byte against their
checked-in `.wat`.

**Measurement note: "byte-identical for a literal" is not "byte-identical".**
The scoping's §1.6(a) measured `@lazy` on one literal-valued constant and
generalised. Re-measured across four shapes (identical file names, so no path
artifacts leak into the WAT):

- namespace `const` with a literal initializer — **identical**, as reported;
- module-scope `const` with a literal initializer — **identical**;
- `static readonly` field — the global's declaration **moves later** in the
  module (same initializer, different order);
- `const` with a non-literal initializer (`new Map()`) — the per-file
  `$start:<file>` function **folds into `$~start`**.

Only the first two are byte-identical, and those are the two the toolchain
refuses to accept. The generalisation was sound for the property it measured and
wrong for the property relied on.

## Bootstrap self-compile, continued — the CLI/WASM harness (stacked PR)

PR #17 left the ordering fix in place and the self-host fixpoint unrun: stage 2
died in the CLI/WASM harness at two gaps. This PR closes both, and the
fixpoint — stage 0's output against stage 2's, the phase's aggregate neutrality
proof — **now runs and is empty, debug and release**.

### Gap 2's shape: not a CLI gate, and not a class export either

The CLI pushed the two in-tree transforms unconditionally
(`cli/index.js:452-464` before this PR), and `src/asconfig.json` configures no
`transforms` at all. So "gate the push by asconfig" was the wrong diagnosis:
the transforms are the compiler's own pipeline, always on. Every `async` or
closure program in `tests/compiler` compiles with no `--transform` flag and
depends on exactly that push.

Exporting the *classes* is not available at this boundary, which the glue
settles: the WASM module exports 80 flat functions and no classes. A
class-typed value crosses as an opaque `__Internref` handle
(`__liftInternref(exports.newProgram(...))`), which the host may pass back into
an exported function but cannot construct, extend, or read a field off. That is
also why gap 1's guard exists: `program.sources` is not a number's property.

The shape is therefore **opaquely passable**, and the smaller end of it: one
flat export, `applyInTreeTransforms(program)`, which runs the pipeline *inside*
the instance on the handle the CLI already holds (`src/transforms.ts`). No
transform class crosses the boundary and no AST surface is exposed. The CLI
pushes one adapter for both hosts, so stage 0 and stage 1 run the same two
lines in the same order.

### Gap 2's cost, measured after the shape was chosen

The transforms had never been in the compiler's own build graph — the CLI
loaded them from the JS build. Importing them from `index-wasm.ts` exposed, in
one step, everything about those two files that the self-host had never
compiled:

- **55 `TS2322`** — the same nullability divergence PR #17 handled 16 of: this
  compiler does not carry a `!= null` narrowing across a repeated property
  read. Fixed with the phase's established idiom (a local for the repeated
  read, `assert(...)` where a local would be clumsier).
- **1 `AS100` spread** (`[ ...fields, thisEnvCtor ]`) — rebuilt in place.
- **1 `Set#forEach`** — AS's `Set` has no `forEach`; the tree's `Set_values`
  loop replaces it.
- **`null` is not a type.** `refuse(...): null` is fine for tsc and a `TS2304`
  here. `refuse` now returns `void` and each `return this.refuse(...)` is a
  call followed by `return null`.
- **`null` is a `usize` literal**, so `let x = cond ? null : someStatement`
  types the ternary as `usize` and fails. Two sites were rebuilt explicitly.
- **25 `Map#get` sites where the two hosts disagree.** AS's `Map#get` *aborts*
  on a missing key; JS's returns `undefined`, and the code reads a miss as
  `null`. This is not a type error — it is a host-semantics difference that
  only fires when the pass runs inside the compiler. First observable failure:
  `Scope#resolve` → "Key does not exist in ~lib/map.ts". Fixed with
  `getMapEntry` (`src/util/collections.ts`), the `has`-guarded read, named
  once.

None of these are output changes, and the 1339-fixture suite is what proves it:
every fixture now compiles through the new pipeline.

**Cost in bytes.** The compiler's own module now contains both passes: debug
`.wasm` 1,884,318 → 2,209,924 (+326 KB), release 970,930 → 1,103,068 (+132 KB).
The debug `.wast` grows 29.0 → 34.7 MB.

### Gap 3: a shadow-stack limit, measured, not a recursion cycle

The failure is `~stack_check`'s abort (`src/passes/shadowstack.ts:317-330`):
`__stack_pointer < __data_end`. That is the **shadow stack** — the region
`--stackSize` provisions in linear memory for managed locals under
`runtime: incremental` — not the engine's call stack, and not visible to V8.
The trace's frames (`Flow#lookup` → `Function#lookup` → `Element#lookup` →
`File#getMember`) are the deepest *chain*, not a cycle: each `lookup` delegates
to a parent or a map, and the JS compiler compiles the identical source with
exit 0.

So the shape is capacity, and it is the *running* compiler's capacity, not the
compiled program's. Measured by bisection on the compiler's own build:

- 32,768 (the default) — fails;
- 34,048 — fails;
- 34,304 — passes.

Peak usage ≈ **34.2 KB**, and the default is short by ~1.5 KB. All five targets
got `"stackSize": 65536` (2× the default, 1.9× the measured peak), and both
halves of each fixpoint pair got the same value — the shadow-stack size is a
global initializer (`__stack_pointer`), so an asymmetric setting would show up
in the `.wast` diff as a difference this PR introduced.

That this is load-bearing and not cosmetic was caught by the same measurement:
`release-bootstrap` was missed in the first edit, kept 32,768, and stage 2
overflowed again. The emitted `__stack_pointer` differed from `release.wast` by
exactly 32,768.

### Gap 1's residual: the std skip is inert under `--wasm`, and benign

Gap 1's guard makes `markStdSources` a no-op under `--wasm`, so `stdSources` is
empty and `AsyncLowerTransform#afterParse`'s `stdSources.has(source)` skip never
fires: the transform walks std along with everything else. Measured directly in
the JS host, with the two runs differing only in whether the marking happens:

- output: **byte-identical** `.wast` (sha256 equal);
- `stats.transform`: 76.4/72.7 ms marked, 78.3/77.4 ms unmarked — the walk
  costs about **2%**.

It is output-neutral because std declares no `async function` (two mentions,
both in comments), so there is nothing to lower and nothing to refuse. In
`--wasm` the same walk happens over the same sources and the fixpoint is empty:
the strongest available form of "benign". What restores the skip in both hosts
is moving the marking inside `parse` — its own small phase, not this one.

### The fixes

- `src/transforms.ts` — `applyInTreeTransforms(program)`: closures, then async.
  The one place the pipeline order is written.
- `src/index-wasm.ts` — exports it. One flat function, no class, no AST.
- `cli/index.js` — pushes one adapter (`afterParse: () =>
  assemblyscript.applyInTreeTransforms(program)`) instead of two classes; user
  transforms still run first; `applyTransform`'s error handling and stats still
  wrap it.
- `src/closure/lower.ts`, `src/async/lower.ts` — the portability pass above;
  `program` is no longer `readonly` (it was never readonly in practice: the CLI
  assigned it onto the prototype), and the doc comment now names both hosts.
- `src/util/collections.ts` — `getMapEntry`.
- `src/asconfig.json` — `stackSize: 65536` on all five targets.

### The fixpoint

`bootstrap:debug` exit 0, `bootstrap:release` exit 0, and the tree's own
comparison (`git diff --no-index` of the two `.wast` files, the last step of
each script) empty:

- debug: `b5953eb9…` = `b5953eb9…` (34,725,729 bytes each);
- release: `761f3d89…` = `761f3d89…` (15,202,144 bytes each).

Stage 0's output (the JS compiler) and stage 2's output (the compiler compiled
by the compiler compiled by the JS compiler) are the same text. The aggregate
neutrality proof for the ordering relaxation now exists.

### Item 5: the `variables.ts` unit test does not exist

Checked `tests/` and every worktree: no `variables.ts`, no fixture or test by
that name, and `git log --all -- '*variables*'` has no history for one. What
exists is `tests/compiler/variable-access-in-initializer.ts`, a compiler fixture
(a checked-in `.wat` pair), which passes — it is the boundary the ordering
diagnostic was narrowed against (`458c81f4`), unrelated to this phase's three
gaps. Nothing regressed; the prior report's reference does not resolve.

### Why stacked, not appended to PR #17

PR #17's six commits are the ordering story and they are told; this PR is the
harness story. Two merge-commits preserve both: PR #17 merges first, this one
retargets to `main` (GitHub does it automatically when the base branch is
deleted) and merges second. The tradeoff is explicit: `main` stays without the
ordering fix until both land. A single merge sequence over two spaced merges —
the user's call, recorded.

### Meta-finding: the aggregate proof waited on a second system (fifth instance)

The ordering phase could not run its own proof — the `.wast` fixpoint — until
the CLI/WASM harness worked, so its evidence was per-fixture (`npm test`,
1339 fixtures) with the aggregate deferred and the reason named. That is the
same shape as the layout-loop non-fix, the design note's §8, "the site list is
not final" and the scoping's §1.6(a): a measurement that is sound for the
property it measured, standing in for the one that was wanted.

This instance has a second layer worth recording: the deferral was **two
systems deep**. After gap 1, the harness needed gap 2; after gap 2's shape was
chosen, the transform sources needed to be compilable by the compiler, which
exposed 55 type sites and 25 host-semantics sites. Each layer was only visible
from the layer above it. The fixpoint was finally run — and it is empty — but
the sequence is the finding: "stage 1 is green" was not one step from the proof.
