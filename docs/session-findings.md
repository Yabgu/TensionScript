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
| **SROA parameters** (field-list signatures) | Fits `Signature#paramRefs` — it is already a tuple (`createType(typesToRefs(parameterTypes))`), so N refs are expressible — but it introduces a source-parameter-index vs WASM-parameter-index mapping that many sites assume is the identity (`module.local_get(0)`, `getNonParameterLocalTypes`, the callee's body-local start index). Its own turn. |
| **SROA return (sret)** | `Signature#resultRefs` is a single `toRef()`, so a struct return needs either a hidden destination parameter (changing the WASM arity, which inherits the parameter work above) or a multi-value result shape `module.ts` does not currently build. |
| **SROA for top-level statics** | Per-field WASM *globals*, or a shadow slot. Refused until then, with the alternative named. |
| **SROA for GC-reference fields** | The mixed representation above — a design phase. |
| **`T[N]` fields in `@inline struct`** | Deep SROA: N locals per array field, plus a `makeZero` arm for `FixedArray` (it asserts today, `compiler.ts` `makeZero`). |
| **Closure capture, `@external` temp, inline nesting** | Later commits of the 1.0 phase (scoping §9, §10). |

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
