# Session findings and their regression tests

**Status:** record. Written after the async-cleanup and lint sessions, from the
standing directive: *for every finding, a regression test should exist so it
cannot regress silently.*

**Why this file.** Not every finding is testable the same way, and a table that
pretends otherwise is worse than no table. Each row below names the test that
would fail on re-introduction, or says why no such test should exist. A future
reader can check coverage without re-deriving it.

**A caveat that matters for reading the citations.** Most of the tests cited
here are **not in this branch's tree**. They land with PR #9 (`alignof`,
`DecoratorFlags`) and PR #10 (the async suite). The "Lands on" column says
which; a reader checking `chore/dead-code-lint` alone will find those files
absent. The citations become true in the order the PRs merge.

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
| c | `DecoratorFlags` has no two names on one bit (`ManagedStruct` 1<<11, `Unsafe` 1<<13, `InlineStruct` 1<<12) | **none anywhere** — see *Gap 1* | — | **gap** |
| d | The two async `.wat` fixtures match the emitter | the `compare fixture` step against `tests/compiler/async-closure-value.{debug,release}.wat` and `…-closures-case6.{debug,release}.wat` | PR #10 | structural (the fixture *is* the test) |
| e | The lowered entry carries the buffered-completion `If` guard at index 3 | `tests/async/lower.js:230` (the kind array) and `:254` (`check("the guard is an if", guard.kind, NodeKind.If)`) | PR #10 | behavioural |
| f | `break`/`continue` are accepted by the async planner, not refused | `tests/async/lower.js:1013` (the `9a.` block) → `:1028-1035`: four shapes, `check(… lowers with no refusal, refusals(r), [])` | PR #10 | behavioural |
| g | `runtime.js` uses the post-`50cceb36` API (`__taskResume`/`__taskWake`/`__taskFail`, no `__taskTick`) | the file compiles at all (five removed symbols were imported before) and its 78 checks: `tests/async/runtime.js` | PR #10 | structural + behavioural |
| h | Host-driven cases bind the task table before resuming (no vacuous passes) | the eight park-observed assertions: `tests/async/runtime.js:564, 615, 766, 804, 846, 883, 959, 1050` | PR #10 | structural — chain measured, below |
| i | Two unused symbols removed; lint is clean | **the lint gate** — `npm run check`, now in `npm test` via `pretest` (this PR) | this PR | dead-code |
| j | The test-guest re-export is the entry point the harness needs | **nothing** — measured redundant, see *Correction 1* | — | claim measured false |
| k | §16 item 4 in the scoping doc is Tension-side, not TensionScript | none — one-time prose correction | PR #9 | prose |

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

An assertion of distinctness — or of any exact value — fails here and passes
only once PR #9 merges. So it belongs on PR #9, with the fix that makes it true.
Filed there rather than written here as a test that is known to fail.

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
- **Does not add:** a `DecoratorFlags` test (Gap 1 — belongs on PR #9, and would
  fail here), a test for the dead-code removal beyond the lint gate (circular),
  a test for the prose correction (one-time event).
- **Does not fix:** Correction 1 (PR #10's branch), the `dist/` local gap (a CI
  concern, unchanged), the bootstrap failures (the Bootstrap-ordering phase).
