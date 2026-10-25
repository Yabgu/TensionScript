# Bootstrap self-compilation — scoping

**Status:** scoping only. No source changed, no plan, no code beyond this document.
**Base:** TensionScript `origin/main` @ `5fb0d964` (PR #16 squashed; see §1.0).
**Method.** Every number below was measured on that tree with a fresh worktree,
`npm run build`, then `npm run bootstrap:debug`. Probe programs cited in §2 were
compiled with this tree's compiler and, where the upstream comparison matters,
with released AssemblyScript 0.28.20.

---

## 0. The answer up front

**Proceed. Source-only, output-neutral, and concentrated — not a compiler release.**

1. **The errors are concentrated, not systemic.** 212 `TS2448` live in **6 files**,
   and 204 of them in 4. They name only **32 distinct symbols**, and 184 are
   accesses to **namespace constants** (`TypeRef`, `HeapTypeRef`, `PackedType`,
   `TypeBuilderErrorReason`).
2. **It is one problem in 212 places, not 212 problems.** The compiler refuses a
   read of a global that has not been compiled yet unless the global is marked
   `@lazy` (`compileGlobalLazy`, `src/compiler.ts:1196`). The compiler's own
   namespace constants are not marked `@lazy`, so every read of one is that error.
3. **The fix is an annotation, and it is output-neutral.** Adding `@lazy` to the
   seven `TypeRef` constants alone takes the run from **229 errors to 65** — exactly
   the 164 `TypeRef` errors. Extending it to the other namespace constants reaches
   **27** (17 `TS2322` + 10 residual `TS2448`). A `@lazy` constant with a literal
   initializer emits **byte-identical WAT** to the same constant without it (§2.6), so
   this is not a compiler release.
4. **The 17 `TS2322` are a second, independent problem** — flow narrowing, not
   ordering — and they are **inherited from upstream**, which fails the same probe.
   They are also fixable in source (two rewrites verified).
5. **Nothing forces a "no".** No redesign, no hash move, no compiler change. The
   remaining work is ~54 edits across 6 files, two commits, one PR.

---

## 1. Pre-work measurements

### 1.0 The merge, and how this was measured

PR #16 is merged as **`5fb0d964`** — a **squash commit**, not a merge commit:
`git merge-base --is-ancestor b5d62d3e origin/main` is false and `5fb0d964` has one
parent (`ee93c560`). The content is all present (`externalBoundary`,
`fieldCountOf`, `emitExportByValPrologue` are in `origin/main`), so nothing is lost
except the per-commit history the PR body argued for. Recorded here because a later
reader will look for `b5d62d3e` in ancestry and not find it.

A fresh worktree has no `dist/`, and `npm run bootstrap:debug` fails with
`ERR_MODULE_NOT_FOUND` on `dist/asc.js` before compiling anything. `npm run build`
first is a precondition of the measurement, not part of the bug.

### 1.1 Error distribution — **concentrated**

`npm run bootstrap:debug` → **229 errors**, unchanged from the pre-merge count.

| Code | Count |
|---|---|
| `TS2448` (used before its declaration) | 212 |
| `TS2322` (not assignable) | 17 |

`TS2448` per file — **6 files total**:

| Errors | File |
|---:|---|
| 93 | `src/compiler.ts` |
| 64 | `src/module.ts` |
| 28 | `src/builtins.ts` |
| 19 | `src/types.ts` |
| 5 | `src/flow.ts` |
| 3 | `src/ast.ts` |

Top 4 files hold 204/212 = **96.2%**. Files with exactly one error: **0**.

`TS2322` per file — 7 files, 17 distinct sites: `compiler.ts` 8, `resolver.ts` 2,
`types.ts` 2, `program.ts` 2, `ast.ts` 1, `builtins.ts` 1, `parser.ts` 1.

**Size reading: concentrated.** Four files carry almost all of it, and the next
section shows they carry *one* mechanism between them.

### 1.2 The forward-reference pattern — **one problem, 32 symbols**

The 212 `TS2448` name **32 distinct symbols**:

| Uses | Symbol | Kind |
|---:|---|---|
| 66 | `src/module/TypeRef.I32` | namespace const |
| 29 | `src/module/TypeRef.None` | namespace const |
| 25 | `src/module/TypeRef.I64` | namespace const |
| 18 | `src/module/TypeRef.F32` | namespace const |
| 18 | `src/module/TypeRef.F64` | namespace const |
| 4 + 4 | `TypeRef.V128`, `TypeRef.Unreachable` | namespace const |
| 14 | `HeapTypeRef.*` (7 members × 2) | namespace const |
| 9 | `src/module/DEBUG_TYPEBUILDER` | module const |
| 4 | `src/compiler/FUNCTION_INDEX_OFFSET` | module const |
| 3 | `src/ast/Source._native` | private static field |
| 3 + 3 | `PackedType.*`, `TypeBuilderErrorReason.*` | namespace const |
| 2 + 2 | `Compiler.SRET_STACK_SIZE`, `CLOSURE_ENV_IN_LOCAL` | static field, module const |
| 1 + 1 + 1 | `Module.UNLIMITED_TABLE`, `closure/ir/envInfoOf`, `closure/ir/creationEnvOf`, `async/ir/awaitSites`, `TypeRef.Funcref` | mixed |

**184 of 212 (86.8%) are namespace-constant accesses.** The rest are five module
consts, two static fields, two functions, and two counters.

The pattern is not a forward reference in the line-order sense. `TypeRef.I32` is
declared at `src/module.ts:67` and read at `src/module.ts:1418` — *earlier* line to
*later* line. The compiler's rule is not about lines:

```ts
// src/compiler.ts:1196
compileGlobalLazy(global: Global, reportNode: Node): bool {
  if (global.is(CommonFlags.Compiled)) return !global.is(CommonFlags.Errored);
  if (global.hasAnyDecorator(DecoratorFlags.Lazy | DecoratorFlags.Builtin) || global.is(CommonFlags.Ambient)) {
    return this.compileGlobal(global); // compile now
  }
  // Otherwise the global is used before its initializer executes
  this.errorRelated(DiagnosticCode.Variable_0_used_before_its_declaration, ...);
```

A namespace member is not compiled by the file walk — it is compiled on first use.
On that first use it is neither `Compiled`, nor `@lazy`, nor `@builtin`, nor
ambient, so the read is refused. Every subsequent read of the same global is a
*separate* first refusal for whichever global it names, which is why 32 symbols
produce 212 messages.

Sampled sites, all in function bodies (deferred evaluation, not top-level
initializers):

| Use site | Symbol | Declaration |
|---|---|---|
| `compiler.ts:11426` (`module.local_get(..., TypeRef.I32)`) | `TypeRef.I32` | `module.ts:67` (different file) |
| `module.ts:1418` (`this.sizeType == TypeRef.I64`) | `TypeRef.I64` | `module.ts:68` (same file) |
| `builtins.ts:1552` (`addGlobal(..., TypeRef.F64, ...)`) | `TypeRef.F64` | `module.ts:70` (different file) |
| `ast.ts:1751` (`let source = Source._native`) | `Source._native` | `ast.ts:1755` (same file, static field) |

**Answer: one mechanism, 32 symbols, 212 sites.** Not 212 distinct problems.

### 1.3 Upstream precedent — **upstream passes; the declarations are identical**

- `tsconfig-base.json`: **byte-identical** to upstream (`strict`, `noImplicitAny`,
  `strictNullChecks`, `noImplicitReturns`, `noEmitOnError: true`,
  `experimentalDecorators`, `preserveConstEnums: false`). No self-hosting-specific
  option exists in either.
- `src/asconfig.json`: **identical**.
- `bootstrap:debug` script: **identical** — plain compile, then `debug-bootstrap`
  with the self-built `.js`, then a third pass and a `git diff --no-index` of the
  two `.wast` files.
- `src/module.ts`'s `TypeRef`/`HeapTypeRef` declarations and `src/ast.ts`'s
  `static get native()` / `private static _native` are **byte-identical to
  upstream**.
- **Upstream's CI passes both Bootstrap jobs** on `b6bda05c` (run `29846737742`:
  `Bootstrap (debug) success`, `Bootstrap (release) success`). TensionScript's
  `5fb0d964` fails both.

So the startup discipline is not an upstream-documented constraint that the fork
inherited — it is a fork regression in what the compiler accepts. Note the
asymmetry, though: in isolation the patterns compile in **both** compilers
(`Source._native` read from a static getter, a namespace const read from a
function, cross-file namespace use). The failure is program-scale ordering, which
is why §2.1's annotation fix works where reasoning about the isolated snippets did
not.

**Candidate model:** upstream keeps the same source and *passes*, so "reorder the
source" is not upstream's approach — upstream's source simply has no read that
trips the rule in its own compile order. Whatever differs is inside the fork's
compiler, and the cheapest thing that makes the fork behave is `@lazy`, which the
compiler already supports for exactly this purpose (`DecoratorFlags.Lazy` is
accepted on globals: `src/program.ts:3002`).

### 1.4 The 17 `TS2322` — a **second, independent problem**

All 17 are nullability/narrowing, in three shapes:

| Shape | Example | Count |
|---|---|---|
| narrow-after-assign | `let cache = Type._fixedArrays; if (!cache) cache = ...; cache.get(key)` | 11 |
| property narrowing | `returnType.classReference != null && returnType.classReference.hasDecorator(...)` | 4 |
| `auto` inference | `let source = Source._native; ... return source;` | 2 |

They are **not** caused by the ordering: `@lazy` removes the 202 ordering errors and
leaves all 17 untouched (§2.1).

They are **inherited**, not fork-specific. Measured with released AssemblyScript
0.28.20 on the same pattern:

```
ERROR TS2322: Type '~lib/map/Map<~lib/string/String,i32> | null' is not
              assignable to type '~lib/map/Map<~lib/string/String,i32>'.
```

— identical on both compilers for the chained-assignment form. Upstream's own source
avoids the pattern; the fork has adopted it in 17 places.

**Fixable in source.** Two rewrites both compile clean:

```ts
// A: assign from a non-null local
if (!cache) { let fresh = new Map<K,V>(); H.cache = fresh; cache = fresh; }
return cache.get(key);

// B: non-null assertion after a guard
if (!H.cache) H.cache = new Map<K,V>();
return H.cache!.get(key);
```

**Answer: one fix (source), but a different fix from the ordering — two problems,
two mechanisms.**

### 1.5 The pipeline stage — **the self-compile, not tsc, not Binaryen**

`bootstrap:debug` is three compiles chained with `&&`. Running stage 1 alone
(`node bin/tensionscript.js --config src/asconfig.json --target debug`) reproduces
all 229 errors and exits 1, so stages 2–3 never run.

Every message is in TensionScript's own diagnostic format (`└─ in path(line,col)`
with a related declaration frame), and the codes come from
`src/diagnosticMessages.generated.ts:171`. So this is **TensionScript's compiler
compiling its own TypeScript source**, using the JS build in `dist/asc.js` — not
`tsc` (`npm run check` passes, §1.5 note) and not Binaryen validation.

*Note:* `npm run check` (tsc `--noEmit` + eslint) passes on the same tree. The two
compilers disagree about this source: tsc accepts it, TensionScript does not.

**Fix touches:** TypeScript **source** (annotations and small rewrites). Not codegen,
not the build script.

### 1.6 Behavior neutrality — **measured, and neutral**

**(a) `@lazy` on a constant-initialized const emits identical code.** Same probe
with and without `@lazy`:

```
(global $../nsp/lazyA/R.A i32 (i32.const 2))     (global $../nsp/lazyB/R.A i32 (i32.const 2))
(func $run (result i32) global.get $R.A return)  (func $run (result i32) global.get $R.A return)
```

Byte-identical WAT. The lazy guard is only emitted when the initializer is *not* a
compile-time constant, so annotating a literal-valued constant changes nothing.

**(b) `@inline` is the tighter alternative, and it does change the module.** The
same const marked `@inline` removes the global entirely and inlines the value
(`(func $run (result i32) i32.const 2 return)`), because `compileGlobal` sets
`CommonFlags.Inlined` only for `@inline` or annotated declarations
(`compiler.ts:1395`, `// Explicitly inline if annotated`). Better code, different output — a choice to make, not a
neutrality risk.

**(c) Class ids are not declaration-order-sensitive.** Reversing two class
declarations and compiling `idof<Alpha>() * 100 + idof<Beta>()` emits the same
constants in both orders (`i32.const 4 … * 100 … + 5`). Ids come from
`program.nextClassId++` inside the `Class` constructor (`program.ts:4839`), i.e.
**resolution order**, which follows reachability rather than the source order of
declarations.

**(d) `idof`/`offsetof` are compile-time constants** (`builtins.ts:1535`,
`classReference.id`), so they carry id assignment into the emitted module — which
is why (c) had to be measured rather than assumed.

**(e) The layout hash cannot move.** `786_288_195` is
`RECORDED_LAYOUT_HASH` in the **engine** (`tension-core/src/session/arena.rs:1678`),
folded from arena geometry and host constants by `arena::layout_hash()`. Nothing in
TensionScript's source participates in it, so no source edit here can move it.

**Conclusion: source-hygiene, not a release.** The only mechanism that could have
argued otherwise — an ordering-dependent id or constant — was measured stable, and
the dominant fix is byte-identical.

---

## 2. Design questions

### 2.1 Which approach: ordering, hoisting, or structural?

**Hoisting (an annotation), with a small amount of reordering. Not structural.**

The measurement rules out structural: there are no import cycles to break. The 212
errors are 6 files reading 32 globals that their own file or a neighbour declares;
nothing needs to move between layers.

| Approach | Effect here | Verdict |
|---|---|---|
| **Reorder** | Fixes the few same-file cases (`Source._native` above its getter) but not the 184 namespace-constant reads — `module.ts:67` already precedes `module.ts:1418` | Insufficient alone |
| **Hoist (`@lazy`)** | Removes the error at the mechanism: a lazy global compiles on first use, which is exactly what `compileGlobalLazy` wants | **Primary** |
| **Structural** | Would redesign file boundaries around a non-existent cycle | Rejected |

Measured effect of the hoist, in two steps:

| Change | Errors |
|---|---:|
| baseline | 229 |
| `@lazy` on the 7 `TypeRef` constants | **65** (exactly the 164 `TypeRef` errors) |
| `@lazy` on all namespace constants + the 5 module consts | **27** (17 `TS2322` + 10 `TS2448`) |

The 10 residual `TS2448` are genuinely forward references and want reordering or
their own annotation: `Source._native` ×3, `Compiler.SRET_STACK_SIZE` ×2,
`Module.UNLIMITED_TABLE`, `TypeRef.Funcref`, `closure/ir/envInfoOf`,
`closure/ir/creationEnvOf`, `async/ir/awaitSites`.

### 2.2 Source-only, or does it need a compiler change?

**Source-only.** No resolver rule changes, no new pass, no codegen change:

- `@lazy` is already an accepted global decorator (`program.ts:3002`,
  `DecoratorFlags.Lazy`), and `compileGlobalLazy` already honours it. The fix uses
  the mechanism rather than adding one.
- The 17 `TS2322` need source rewrites (§1.4), not a narrowing engine.
- §1.6 measured the output neutral.

**The alternative is a compiler change, and it is worth putting on the record.**
Upstream only inlines a constant global when it carries `@inline`
(`compiler.ts:1395`, `// Explicitly inline if annotated`). If the compiler folded `export const X: T = <literal>` in a
namespace unconditionally, the 184 namespace-constant errors would vanish *for all
future code* instead of being annotated 27 times — and every read would become an
`i32.const` instead of a `global.get`. That is a real improvement, and it is a
release: different codegen for every program using such a constant. It is **not
required** for this phase, and should not ride along with a hygiene PR.

### 2.3 `TS2322`: one fix or two?

**Two problems, two mechanisms — but they can ship together.** They share no root
cause (§1.4: `@lazy` fixes 202 ordering errors and zero nullability errors), and
they touch different lines. Recommended as **one PR, two commits**: the ordering
hoist is mechanical and low-risk; the 17 narrowing fixes are 17 small, local
rewrites with a verified shape. If review prefers, they split cleanly into two PRs
with no ordering dependency between them.

### 2.4 Behavior neutrality of the proposed fixes

| Fix | Emitted output | Why |
|---|---|---|
| `@lazy` on literal-valued constants | **identical** ("measured" above) | the lazy guard is only emitted for non-constant initializers |
| reordering the residual 10 | **identical** for the id probe measured; ids follow resolution order | `program.nextClassId++` at resolve time |
| 17 narrowing rewrites | **identical** | they replace an expression the compiler rejects with an equivalent one it accepts |
| layout hash | **cannot move** | it is an engine constant, `arena.rs:1678` |

No fix in this phase changes what the compiler emits for a user program. **Not a
release; no version bump; no hash move.**

### 2.5 What would force a "no"

| Condition | Applies? |
|---|---|
| Structural — circular dependencies needing redesign | **No.** 6 files, 32 globals, no cycles. |
| Compiler change **and** a hash move | **No.** Neither is needed. |
| Upstream is blocked by the same errors, so there is no precedent | **No for `TS2448`** — upstream passes (`Bootstrap (debug)` and `(release)` green at `b6bda05c`). **Yes for `TS2322`** — upstream fails the same probe, so that half has no upstream model and must be solved here (the two rewrites in §1.4). |

---

## 3. Recommendation

**Proceed, as one phase, one PR, two commits, source-only.**

**Shape:**

1. **Commit A — the ordering hoist.** `@lazy` on the namespace constants in
   `module.ts` (TypeRef, HeapTypeRef, PackedType, TypeBuilderErrorReason) and the
   module consts the errors name; reorder or annotate the 10 residual sites.
   Expected: 212 → 0 `TS2448`.
2. **Commit B — the 17 narrowing fixes**, one mechanical rewrite each, using the
   verified shape from §1.4.
3. **Verification:** `npm run bootstrap:debug` and `bootstrap:release` green, both
   including the `git diff --no-index` of the two `.wast` files that the bootstrap
   script already performs — that diff is the strongest available proof the fix is
   output-neutral, stronger than §1.6's probes.

**Size estimate: ~54 edits in 6 files.** 27 `@lazy` annotations, ~10 residual sites,
17 rewrites. One reviewer could read the whole diff in a sitting.

**Expected outcome:** 14/14 CI checks green, including the two Bootstrap jobs that
have been red on every PR this session.

**What this buys beyond the green check:** the compiler stops being a program its own
compiler rejects. Today `npm run check` (tsc) passes and `npm run bootstrap:debug`
does not, which means the source is written for one type system and consumed by
another. That gap is the actual debt; the red check is only its symptom.

---

## 4. What could not be measured read-only

- **Why the fork's compile order leaves `module.ts`'s namespace globals uncompiled
  when `compiler.ts` functions read them, while upstream's does not.** The isolated
  patterns compile in both compilers, and the declarations, tsconfig and asconfig are
  identical; the trigger is program-scale and needs an instrumented compile (a
  build with tracing in `compileGlobalLazy`) to pin to a specific change. This is
  the one open question, and it is not blocking: the annotation fix works regardless
  of which side of the fork the ordering difference lives on.
- **Whether the full fix makes `bootstrap:debug` green end to end.** Measured to
  **27 errors** in a scratch copy (`/tmp/boot-fix`), not to zero, and stages 2–3 were
  never reached. The 27 are named (§2.1, §1.4) but not fixed.
- **Whether the compiler binary's emitted `.wast` is byte-identical after the fix.**
  That is exactly what `bootstrap:debug`'s final `git diff --no-index` checks, and it
  was not run to completion. §1.6 measured the *language-level* neutrality that
  predicts it.
- **The `@inline`-instead-of-`@lazy` variant's effect on the compiler binary.** It
  changes the module (globals removed), which is fine for the compiler's own binary
  but was not measured end to end.
- **Whether any of the 17 `TS2322` sites predate the fork or arrived with it.** Not
  attributed per-line; the count is what matters for sizing.
