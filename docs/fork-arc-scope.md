# The fork arc — scoping

**Status:** scoping. Read-only on source; nothing here is implemented. The only
file this branch adds is this one.

**Base:** `origin/main` @ `c3be16fc` (release 0.10.0). Measured 2026-10-26.

**Question.** TensionScript is a fork of AssemblyScript that publishes as
`@acakar/tensionscript`, maintains the fiction of AS compatibility, and makes
fork-specific decisions the fiction cannot carry: the memory-model taxonomy, the
scheduler contract, `@lazy` handling, wire records. The `@lazy` dead end is the
evidence — `tsc` refuses the decorator on a variable declaration, and the
diagnostic relaxation was the workaround.

This arc owns the divergence instead of denying it. The first decision is not
"should we diverge" — the project has diverged. It is "own the divergence or keep
pretending not to."

**Method.** Every number below was produced by running a gate or a compiler on
`origin/main` content in a throwaway worktree, not by reading a document. Where
something was read rather than run, it says so. Where it could not be measured
read-only at all, §6 says so. §7 lists the exact commands.

**Two premises this scoping overturned** (both measured, §0.1 and §2):

1. **Removing `tsc` would not unblock `@lazy`.** Three JS-side tools reject the
   decorator at parse time — `tsc` (`TS1206`), `eslint` ("Parsing error:
   Decorators are not valid here"), and `esbuild` (the same message, at 94 ms,
   before any test runs). Dropping `npm run check` leaves `esbuild` refusing
   `@lazy` in `src/`, and `npm run build` fails. The blocker is the *JS build
   path*, not one gate.
2. **`tsc` is the cheapest gate in the chain, not the expensive one.** `tsc -p
   src` is 2.54 s of a 14.6 s `npm run check`; the two `eslint` passes are
   11.4 s (78%). The cost argument for removing `tsc` does not exist. The
   *posture* argument does, and it is about the constraint, not the clock.

---

## 0. The two measurements you asked for first

### 0.1 Phase 1 — what `npm run check` catches that `npm test` and `npm run bootstrap:debug` do not

The gates, as they exist today:

- `npm run check` = `tsc --noEmit -p src` (`check:config`) + `tsc --noEmit …tests/import`
  (`check:import`) + two `eslint` passes (`lint`).
- `pretest` runs `npm run check`, so every `npm test` pays for it.
- `npm test` builds nothing. `dist/` must already exist, and the AS-side gates
  cannot even start without it: running `bin/tensionscript.js` on a clean
  worktree fails to resolve `dist/asc.js`.
- `npm run bootstrap:debug` = stage 1 (JS compiler compiles `src/`), stage 2
  (that output compiles `src/`), stage 3 (again), then a `.wast` diff.
- CI order is build → check → test, with Bootstrap in a separate job.

**Costs, measured, single run, this machine:**

- `tsc --noEmit -p src`: **2.54 s**, exit 0. 52 project files (`src/glue/wasm/**`
  is excluded by `src/tsconfig.json`; 45 `.ts` + 5 `.d.ts` live in `src/`, and
  six `std/` files enter through `std/portable.json`).
- `tsc --noEmit … tests/import/index`: **0.74 s**.
- `eslint --ext js .`: **5.75 s**; `eslint --ext ts .`: **5.61 s**.
- `npm run check` (all four): **≈14.6 s**.
- `npm run build`: **7.8 s** — esbuild 0.13 s, `build-dts` **7.17 s**.
- AS stage 1, full: **3.7 s** (parse 281 ms, compile 1155 ms, emit 1480 ms,
  validate 77 ms). With `--noEmit`: **2.1 s** (emit `n/a`, compile unchanged at
  1.11 s).
- `npm run bootstrap:debug` end to end: **13 s**.
- `npm test` (with `pretest`): **109 s**, green. Suite alone ≈ 94 s.

**The probe.** Sixteen shapes were compiled through both gates, plus four
whole-file injections. Result: the AS self-compile is a *much* stronger
TypeScript checker than the fiction assumes — of the fourteen shapes `tsc`
refuses, AS refuses eleven, often with the same diagnostic code.

Where **both** refuse (13 shapes), AS is not weaker, it is sometimes stricter:

- `readonly` assignment — tsc `TS2540` / AS `TS2540`.
- `class X implements I` missing a member — `TS2420` / `TS2515`.
- nullable deref without narrowing — `TS18047` / `TS2322`.
- unknown property — `TS2339` / `TS2339`.
- generic constraint violation — `TS2344` / `TS2322` (different site, still refused).
- arity — `TS2554` / `TS2554`.
- callback parameter type — `TS2322` / `TS2322`.
- excess property, missing property in a literal — `TS2353` / `TS2741` on the
  tsc side, `AS100 "Not implemented: Interface hidden classes"` on the AS side
  (a refusal, not the same check — but a refusal).
- optional property — `TS2322` / `AS219 "Optional properties are not supported"`.

Where **AS is stricter** (tsc silent, AS refuses):

- `enum` member into a `u8` field — `AS200`. This is the class from 10.0b.
- a literal-union type (`"a" as "a" | "b"`) — tsc clean, AS `AS100: union types`.

Where **tsc is the only voice** — three shapes:

1. **`private` / `protected` access from outside the class**: tsc `TS2341` +
   `TS2445`; AS **clean**. Access modifiers are parsed and ignored.
2. **`strictPropertyInitialization`**: `class C { f: i32; }` — tsc `TS2564`;
   AS **clean** (an AS field defaults to zero).
3. **The JS half**: an injected `let x: i32 = "not a number"` compiles AS
   **clean** in `src/index-js.ts` and in `src/glue/js/index.ts`, and errors in tsc.
   The AS entries are `glue/wasm/index.ts` and `index-wasm.ts`, so the JS entry
   and its glue are never read by the self-compile. esbuild does not type-check
   them either (0.13 s, no diagnostics, no type knowledge).

   The miss is narrower than "the JS half", and it is worth stating exactly:
   `src/bindings/js.ts` *is* compiled by AS (injected `TS2322` caught), because
   `src/compiler.ts` imports it. So the AS-invisible surface is **`src/index-js.ts`
   plus `src/glue/js/index.ts` and its `.d.ts` declarations** — measured by
   injection, not inferred from the entry list.

   The gap runs both ways, which is the cleaner way to say it:
   **`src/glue/wasm/**` (4 files) is excluded from `tsc` by `src/tsconfig.json`
   and compiled only by AS**, while **`src/index-js.ts` and `src/glue/js/**` are
   compiled only by `tsc` and `esbuild`**. Two small, symmetric, deliberate-looking
   gaps — neither of them documented anywhere.

**But `npm run build` already covers all three.** Measured by injection:

- `src/index-js.ts` + a `string`-into-`i32` — `npm run build` rc=1,
  `EmitterError: Declaration generation failed`, `TS2322`.
- The same in `src/glue/js/index.ts` — rc=1, same shape.
- `private` misuse and an uninitialized field appended to `src/compiler.ts` —
  rc=1, `TS2341` and `TS2564` respectively.

The mechanism: `scripts/build-dts.js` parses **`src/tsconfig.json`** (confirmed
with `NODE_DEBUG=dts`: `parsing "src/tsconfig.json"`) and runs
`ts.createProgram` over the same graph `check:config` does, with emit redirected
to declarations. So `npm run check`'s tsc step and the build's dts step are the
same check at different prices: **2.54 s** versus **7.17 s**.

One asymmetry that matters: `check:config` is the only one of the two that runs
in `pretest`. In a local loop that runs `npm test` without rebuilding, the build
step never happens — which is how the JS half could drift unnoticed *if* tsc were
removed.

**Does AS have a faster AS-only type-check?** Yes, and it is already written:
`--noEmit` exists (`cli/options.json:342`, honoured at `cli/index.js:929`).
It is **2.1 s**, i.e. *faster* than `tsc -p src`, and it rejects the AS200 class
that `tsc` accepts. There is no separate `--typecheck` mode; `--noEmit` is the
whole compile minus emit.

**The pretest chain, measured end to end:** `pretest` → `check` (tsc 3.3 s +
eslint 11.4 s) → nine test suites (~94 s). The tsc step is 2.3% of `npm test`.

### 0.2 Phase 3 — current switch/match behaviour on enums

Written as WAT and read at `--optimizeLevel 0 --shrinkLevel 0 --debug`, and again
at the default `-O3`, over the same source.

```ts
enum Color { Red, Green, Blue }
export function pick(c: Color): i32 {
  switch (c) {
    case Color.Red: return 10;
    case Color.Green: return 20;
    default: return 30;
  }
}
```

Emits an if-chain, not a table, and every comparison is `i32.eq`:

```wat
(global $../enumprobe/e1/Color.Red i32 (i32.const 0))
(global $../enumprobe/e1/Color.Green i32 (i32.const 1))
…
local.get $1
global.get $../enumprobe/e1/Color.Red
i32.eq
br_if $case0|0
```

Measured facts, each from a compiled probe:

- **Members are module `i32` globals, not constants** — unless `const enum`, which
  inlines (`i32.const 1`) and still compares `i32`.
- **`-O3` does not change the shape.** A six-case switch still emitted six
  `i32.eq` + `br_if`, no `br_table`. The comment in `compileSwitchStatement`
  ("leave it to Binaryen to optimize the sequence of br_ifs to a br_table") is a
  hope, not a measurement: Binaryen 131 did not take it here.
- **No narrowing anywhere.** `switch` on an enum compares at the enum's type,
  which is always `i32`, in both the case label and the discriminant.
- **No nominality.** `case 99:` on a `Color` switch compiles; `let c: Color = 5;`
  compiles.
- **Sized-enum syntax does not exist.** `enum Small: u8 { A, B }` →
  `ERROR TS1005: '{' expected`. `parseEnum` (`src/parser.ts:1320`) goes straight
  from the identifier to `{`; there is no `:` arm, so the diagnostic names the
  wrong problem.
- **Literal overflow wraps, silently.** `enum Big { A = 2147483648 }` compiled
  clean and emitted `(i32.const -2147483648)`.
- **Casts are masks, not checks.** `<u8>e` → `i32.and 255`; `<E>u8` → the same
  mask. `changetype<E>(u)` is `TS2315` (not generic), so casts are the only route
  and they truncate silently.
- **String enums are refused** (`TS2322` ×3 on `enum S { A = "a" }`), so a sized
  enum has exactly one axis to design: integer width.

Layout, which is where the payoff lives:

- `@unmanaged struct WithEnum { tag: u8; e: E; }` → `sizeof` **8**,
  `offsetof("e")` **4**. Three padding bytes per enum field.
- `@unmanaged struct Arr { n: u8; e: E[3]; }` → `sizeof` **16**; indexing is
  `i32.shl 2` then `i32.load`. Four bytes per element.
- `@inline struct Val { tag: u8; e: E; }` → `sizeof` **8**; SROA reads are
  `i32.load8_u` for `tag` and `i32.load offset=4` for `e`. The width is already
  per-field in the SROA path — it is the enum that is uniformly 4 bytes.
- `@abi.alias("e") kind: E` in an `@unmanaged struct` → `offsetof` **4**,
  sizeof **8**, store `i32.store offset=4`, read `i32.load offset=4`. The alias
  path is neutral; it respects whatever width the field has.
- `@unmanaged struct Wire { tag: u8; e: u8; }` with `w.e = E.B` → **`AS200`**.
  The AS200 class, reproduced in the exact wire-record shape the ask is about.

So the current model is internally consistent and completely 32-bit. The
`AS200`-into-`u8` trap is not a bug in the wire records; it is the only place the
language's "enums are i32" decision becomes *visible*, and it becomes visible as
a refusal, which is the good failure mode — today.

---

## 1. Phase 1 — the build pipeline

### The measurement that constrains it

§0.1. In summary: `tsc` is 2.54 s and is duplicated by the mandatory build's dts
step (7.17 s, same tsconfig, same program). `--noEmit` on the AS side is 2.1 s
and covers the half `tsc` cannot see. Each gate's unique surface is now known,
and the overlap is larger than the arc assumed.

### The decision (measured)

**Keep `tsc`. Do not replace it with an AS-only check, and do not remove it.**
Three measured reasons, in order:

1. **It is not the expensive gate.** 2.54 s of a 14.6 s `check` and 2.3% of
   `npm test`. If the goal is a cheaper loop, the target is `eslint`'s two
   passes (11.4 s, 78% of `check`) — folding them into one pass over
   `--ext js,ts`, if the rule work is the same, saves ~5.7 s: 2.2× everything
   `tsc` costs.
2. **It is the only *type* check that covers the JS half inside `pretest`.** The build's
   dts step covers the same ground but does not run in `pretest`; `npm test` on a
   previously-built tree would never re-check `src/index-js.ts`. Removing
   `check:config` buys 2.5 s and moves the JS half's coverage from "always" to
   "when someone remembers to build".
3. **The AS-only check is a complement, not a replacement.** `--noEmit` never
   reads `index-js.ts` or `glue/js/**`; that is structural (different entry
   points), not a gap to be closed by a flag.

What *should* change is the label. `tsc` is not a TypeScript-conformance gate and
cannot become one — it is the **JS-target compiler's** type check, plus two
checks AS does not implement (access modifiers, definite assignment). Naming that
in the scripts and the docs is the whole of Phase 1's real work.

The genuinely useful Phase 1 output is an **AS-side 2 s gate that exists but is
not wired in**:

```
node bin/tensionscript.js --config src/asconfig.json --target debug --noEmit
```

2.1 s, exits 0 on `main`, and rejects the AS200 class. It is the cheapest thing
in the repository that fails on a real defect class `tsc` accepts. Today the only
route to that check is `bootstrap:debug` (13 s) or CI.

**The tsc question is therefore answered "keep, and relabel" — but the arc's tsc
question was really the `@lazy` question**, and that one is answered differently:
the constraint that hurts is not a script entry, it is that `src/` must be
parseable by `esbuild`, `tsc`, and `eslint`. `npm run check` is one of three
places that fact bites, and the cheapest of them.

### Scope

**Small**, if the decision is "keep + relabel + wire the 2.1 s AS check into
`pretest`" — a few lines in `package.json`, a paragraph in a doc. **Medium** if
the arc also wants `src/` to stop being TypeScript-parsed (a decorator-stripping
preprocessor in `scripts/build`), which is Phase 2's precondition and should be
scoped there, not here.

### Deferral / dependency

Nothing depends on Phase 1 *except* one thing, and it is the thing the arc
expected: **if `src/` is ever to use a fork-only annotation, a preprocessor must
run before esbuild, tsc, and eslint.** That is a build-pipeline change and cannot
be earned by deleting a gate. Phase 2 must not assume Phase 1 removed the
blocker; it must either want the preprocessor (Phase 1 work) or decide not to use
the annotation in `src/` at all.

### What forces a no

- **A `dist/` that cannot be trusted**: if the dts step were ever removed from
  `npm run build`, `check:config` becomes the only JS-half gate and removing it
  is unsafe. Today it is not removed (measured: build rc=1 on a JS-half type
  error).
- **If `tsc`'s program is cut down** (e.g. excluding `bindings/js.ts` to speed it
  up), the "same program as the dts step" property measured in §0.1 is lost and
  the two gates diverge — then one of them is a lie and should be deleted rather
  than kept cheap.

---

## 2. Phase 2 — `@lazy` proper

### The measurement that constrains it

**The relaxation's scope, measured by reverting it.** `hasConstantInitializer`
(`src/compiler.ts:1230`) returns `initializer != null && initializer.evaluatesToConst`.
Patched to `return false`, rebuilt, and self-compiled:

```
212 × ERROR TS2448: Variable '…' used before its declaration
  3 × ERROR TS2322 (cascade)
= 215 diagnostics over 30 distinct globals
```

By file: `src/module.ts` **24** (`TypeRef.*`, `HeapTypeRef.*`, `PackedType.*`),
`src/compiler.ts` **3**, `src/closure/ir.ts` **2**, `src/ast.ts` **1**. That is
the revert's true scope: **30 annotations**, not 208 error sites. (CHANGELOG
0.10.0 records the pre-relaxation figure as 229 errors.)

**Does AS's parser accept `@lazy` on a variable declaration?** Yes — measured.
`@lazy const lazyA: i32 = 7;` compiles, and for a literal initializer the WAT is
byte-identical to the unannotated form (`(global $…/lazyA i32 (i32.const 7))`).
The decorator is accepted at `src/program.ts:3003`
(`acceptedFlags = DecoratorFlags.Global | DecoratorFlags.Lazy`).

**`@lazy` is already load-bearing in this tree — everywhere except `src/`.**
`std/` uses it **212 times across 20 files** — `string.ts`, `array.ts`,
`typedarray.ts`, `date.ts`, `math.ts`, `number.ts`, `process.ts`, `symbol.ts`,
`builtins.ts`, five `util/*.ts`, and four `rt/*.ts`. `src/` uses it **0 times**;
its only two textual mentions are comments. That number (212) coinciding with the
TS2448 count is a coincidence of the corpus, not a relationship.

The reason for the split is measured in §0.1: `std/` is compiled only by
TensionScript, so `@lazy` is free there; `src/` is compiled by `esbuild` and
`tsc` as well, and all three refuse it:

- `tsc --noEmit -p src` → `TS1206: Decorators are not valid here`
- `eslint src/compiler.ts` → `error Parsing error: Decorators are not valid here`
- `npm run build` → `rc=1`, `src/compiler.ts:12723:0: ERROR: Decorators are not valid here` (esbuild, 94 ms)

**What `@lazy` actually means here** — worth stating precisely, because the arc's
framing ("explicit opt-in vs implicit relaxation" as *deferral* semantics) does
not match the code. `DecoratorFlags.Lazy` does not defer the initializer to a
later point in execution. It changes *whether the compiler may compile the global
before its declaration is reached*
(`compileGlobalLazy`, `src/compiler.ts:1197`). The relaxation does exactly the
same thing for a narrower and safer class — a literal has no operands, so it
cannot observe initialization order, which is the hazard the diagnostic models.
The relaxation is not a weaker `@lazy`; it is the same permission, keyed on a
property the compiler can prove instead of one the user asserts.

### The decision (measured)

**Keep the relaxation. Do not revert to `@lazy` everywhere. Add nothing.** And
say so on the record.

- The relaxation's boundary is already narrow, already documented in code, and
  already pinned by `tests/compiler/variable-access-in-initializer.ts`
  (`let b = (b = 4, 3)` inside a function body stays `TS2448`).
- A revert needs 30 annotations that `src/` **cannot legally carry** (§above):
  it is a build-pipeline project wearing a language change's clothes, and it buys
  visibility, not correctness — the two mechanisms compile identically for the
  constant case (measured: identical WAT on the literal probe).
- `@lazy` keeps its role, and its honest description is *guest-facing*: std and
  user programs opt in explicitly; the fork's own TypeScript-parsed source relies
  on the provable class. That asymmetry is worth a paragraph in
  `docs/fork-posture.md` rather than a 30-file revert.

### Scope

**Small — a doc paragraph, and arguably nothing else.** The boundary is already
covered from the outside: `tests/compiler/variable-access-in-initializer.ts` pins
`TS2448` for a non-constant global read inside its own initializer
(`var a = (a = 4, 3)`) and for a local, and its `.json` holds the three pinned
diagnostics. The only gap is the *allowed* case — no fixture names "a
constant-initializer global read from another global's initializer compiles";
the self-compile exercises it 212 times and nothing asserts it directly.

### Deferral / dependency

Phase 2 does **not** depend on Phase 1's tsc decision (§0.1: deleting the gate
does not remove the refusal). It would depend on a Phase 1 *preprocessor* — if one
is ever built, the revert becomes a 30-line diff and can be reconsidered then.

### What forces a no

- **A non-constant initializer that must be read early.** `hasConstantInitializer`
  is deliberately `evaluatesToConst`-only; `Type.fixedArray`'s cache and three
  other tables are already "accessors over null-initialized backing stores"
  precisely because they are not constant. If another such table appears and the
  accessor pattern is not acceptable, the relaxation cannot cover it and only a
  preprocessor + `@lazy` can.
- **If `std/` ever has to be type-checked by `tsc`** (e.g. publishing std types
  as TS), the 212 `@lazy` uses in `std/` become `TS1206` × 212 and the whole
  language extension becomes unshippable. Nothing does this today; it is the
  test that would flip the decision.

---

## 3. Phase 3 — sized enums

### The measurement that constrains it

§0.2 in full. The three numbers that set the design:

- an enum field costs **4 bytes** (`sizeof 8` / `offsetof 4` for
  `{ tag: u8; e: E }`), and `E[3]` costs **12**;
- the switch compares `i32.eq` against `i32` globals, at `-O0` and `-O3`, with no
  `br_table` and no narrowing;
- an enum into a `u8` field is **`AS200`**, and an enum literal past `2^31` is
  **silently wrapped**.

### The design decisions (measured, not assumed)

**Syntax: C23 form — `enum Foo: u8 { … }`.** It reads closest to the wire
records' intent (`enum Kind: u8` next to `tag: u8`), it is the smallest parser
change (`parseEnum` gains one `:`-then-type arm before the `{`; today that
position errors as `TS1005 '{' expected`), and it needs no new token. The C++11
`enum class` form changes the meaning of every unqualified member reference in
the file, and the Rust `#[repr(u8)]` form is foreign to a TypeScript-shaped
surface. Rejected forms are named so the parse error can point at them.

**Default stays `i32`.** `enum Foo { A, B }` is unchanged — measured today as
`i32` globals; additive by construction.

**Literal overflow refuses.** `enum Foo: u8 { A = 256 }` must error rather than
wrap. This is the one behavior change in the phase that *fixes* a measured
silent-wrong-answer (`A = 2147483648` → `-2147483648` today). Note the asymmetry
to keep: the refusal applies to a *declared* width; the existing i32 enum keeps
its current wrap-free domain (`i32` range) and gains the same refusal beyond it.

**Casts.** Upcast (`<u32>` from a `u8` enum) widens — free, and it should not
emit a mask. Downcast stays explicit-and-masking (`<u8>` = `i32.and 255`) because
that is today's measured behavior and changing it is a separate decision; a
*constant* whose value is out of range should refuse at compile time, since that
is knowable.

**Switch/match compares at the underlying width — in representation, not in the
comparison.** Measured: the discriminant is materialized in a temp local and
compared with `i32.eq` per label. For a `u8` enum, the honest lowering is to mask
once at materialization to the field width and keep `i32.eq`; narrowing the
compare itself buys nothing on wasm32 and complicates the shared
`compileCommutativeCompareBinaryExpressionFromParts` path. Keep `case 99:`
accepted, as it is today: the switch is not the place to enforce nominality, and
enforcing it there would be a breaking change to code that compiles now.

**Members: constants, not globals.** Today a plain enum's members are mutable-free
`i32` globals; a sized enum's members should be emitted as `const`-width values
(or at least as globals typed at the underlying width). Keeping them as `i32`
globals while laying out `u8` fields would make `s.e = E.B` an implicit
`i32 → u8` narrowing — i.e. it would *reintroduce* the AS200 class inside its own
fix. The member representation is the load-bearing decision of the phase.

**The payoff table.** Every row is measured today at 4 bytes per enum value; at
`u8` each becomes 1 byte, and three of the six need no code change at all:

- `@unmanaged struct`: `sizeof` 8 → 2, `offsetof` 4 → 1.
- `T[N]` field: `sizeof` 16 → 4 for `E[3]`, index scale `shl 2` → none.
- `@inline struct`: SROA already loads per field width (`i32.load8_u` for `u8`,
  `i32.load offset=4` for the enum) — the pass needs no new concept.
- `@abi.alias`: already neutral (measured: `i32.store offset=4` / `i32.load
  offset=4`); it inherits the width, so it needs only a test, not a change.
- `const enum`: already inlined; inlining is where the width is easiest to get
  right (`i32.const 200` for a `u8` member, no mask needed if the value is checked).
- `AS200`-into-`u8` becomes unrepresentable: `s.e = E.B` where `s.e: Kind(u8)` is
  same-width, and where `s.e: u8` and `E` is `u8`-sized it is a legal implicit
  conversion. That is the arc's stated payoff, and it is the one item that
  requires no new diagnostic.

### Scope

**Phase**, not a commit. Touches: `src/parser.ts` (one arm + the type node),
`src/program.ts` / `src/types.ts` (the enum's underlying type and its member
type), `src/compiler.ts` (`compileEnum` member emission, the field/global width
path, `sizeof`/`offsetof` consumers, cast rules, comparison width),
`src/resolver.ts` (overflow refusal at the declaration), plus fixtures for every
row of the payoff table and every refusal.

### Deferral / dependency

- **Independent of Phase 1 and Phase 2.** Nothing in sized enums needs a
  preprocessor, provided `src/` does not itself *use* the new syntax. That
  constraint is real: `DecoratorFlags` (`1 << 11`) is an obvious candidate for
  `enum DecoratorFlags: u16`, and writing it would hand `tsc` a `TS1005` and
  `esbuild` a parse error. Sized enum syntax may be *parsed* by `src/`; it may not
  be *used* by `src/` until Phase 1's preprocessor exists.
- **Depends on the engine's wire contract, not on any phase in this arc.** See
  below. This is the phase's only hard external dependency.

### What forces a no

- **If the engine's C headers declare the corresponding enum as `int`.** Then a
  `u8`-sized enum changes byte offsets on the wire, the arena's `layout_hash`
  changes (the currently-recorded value, `786288195`, comes from
  `docs/session-findings.md` and was **not** re-measured for this scoping), and
  the phase stops being additive. Measure `tension_adapter.h` / the layout headers *before* choosing
  widths — this is a Tension-repo measurement and was **not** done here (out of
  scope for this arc, and this scoping is read-only outside TensionScript).
- **If signed narrow enums (`i8`) are required for a wire field**, the "literal
  overflow refuses" rule needs a different domain per signedness, and the
  `i32.and` mask convention stops being uniform. Implementable, but it doubles
  the refusal matrix; better to refuse negative-width support in v1 and say so.
- **If a sized enum must remain addressable as a global for identity** (e.g.
  `toString` self-registration, which today keys on globals), then members cannot
  become constants without a second path. Measure `ensureEnumToString` before
  choosing; it reads `constantIntegerValue` and emits `i32(i64_low(...))`, so the
  constant route looks available — but that is a code read, not a measurement.

---

## 4. Phase 0 — posture (and Phase 4's first half)

### The measurement that constrains it

The README's own Status section, measured against the tree:

- It says the fork tracks upstream: *"Everything else tracks the upstream project
  it was forked from."* The tree disagrees: **33 files changed, +12,967 / −158**
  against the upstream base, in `src/` and `std/` alone.
- It lists `async/await — pending` and `closures — pending`. Both are landed:
  `src/async/lower.ts` +3,451, `src/closure/lower.ts` +3,289, `std/assembly/task-rt.ts`
  +609, and `npm test` (109 s, green) runs `test:async`, `test:closure`,
  `test:compiler`. The README is stale in the *opposite* direction from the usual
  one: it under-claims what shipped and over-claims what it tracks.
- There is no `docs/fork-posture.md` (`git log --diff-filter=A` is empty for it),
  and no file anywhere states that an upstream merge is not a goal.
- The existing frame is not absent — `README.md:9,37,56` and `NOTICE` already say
  "fork of AssemblyScript", and `CONTRIBUTING.md:4` says it too. What is missing
  is the *decision*, not the attribution.

### The decision

Write `docs/fork-posture.md`: one paragraph, one commit, the decision, not a
history. The paragraph this arc should carry (draft, to be tightened in Phase 0):

> TensionScript is a fork of AssemblyScript. It tracks AS's parser and standard
> library where that is useful, and it does not aim for upstream merge: AS's
> repository is a reference, not a target. Features that AS cannot express —
> memory-model overrides, the scheduler contract, sized enums — are in scope
> here, and a feature is not rejected for lacking an AS equivalent. Where the
> fork tracks AS, it says which commit it tracks (see *Sync*). Where it diverges,
> it says so in the CHANGELOG, and the divergence is deliberate.

Two edits belong in the same phase, because they are the same claim: delete the
"Everything else tracks the upstream project" sentence from `README.md:46`, and
replace the stale `async/await — pending` / `closures — pending` list with what
is actually true.

### Scope

**Small — one paragraph and two edits.** This is the only phase in the arc that
can land in a single commit with no design risk.

### Deferral / dependency

Phase 4's *pinning* half is the same paragraph's §Sync; do them together.
Everything else cites this file, so it should land first — but nothing is blocked
on it, since no other phase's code depends on a doc existing.

### What forces a no

- **If a mergeable relationship with upstream is genuinely wanted** (e.g. to
  upstream sized enums some day), the posture becomes "mergeable in principle,
  never merged in practice" — a different paragraph with a different
  consequence (it would reopen the `src/`-must-be-TypeScript constraint as a
  feature rather than a tax). That is the fork's one real strategic fork in the
  road, and it is worth naming explicitly in the doc instead of leaving implied.

---

## 5. Phase 4 — the sync posture

### The measurement that constrains it

- `git remote -v`: **one remote**, `origin` = `Yabgu/TensionScript`. There is no
  upstream remote, so "how far behind" is not a query the repository can answer
  today.
- Upstream tip, measured against a fresh clone: `b6bda05c` ("chore: Update
  Binaryen and other dependencies (#3035)", 2026-07-21). It **is an ancestor of
  fork `HEAD`** (`git merge-base --is-ancestor`). So the fork's base *is* today's
  upstream tip; the brief's "has not tracked upstream in months" is true of the
  fork's *own* work (2026-10-18 → 2026-10-26, **117 commits**), not of its base.
- Divergence against that base, restricted to `src/` + `std/`: **33 files,
  +12,967 / −158**; 7 files added, 17 modified in `src/`; 9 files in `std/`.
  Concentrated: `async/lower.ts` +3,451, `closure/lower.ts` +3,289,
  `compiler.ts` +2,072/−78, `parser.ts` +460/−12, `types.ts` +474/−12,
  `resolver.ts` +524/−14.
- Published versions: **`assemblyscript@0.28.20`** (2026-07-22) versus
  **`@acakar/tensionscript@0.10.0`** (2026-10-26). The fork's published number is
  *lower* than upstream's for a code base that contains upstream's latest work. A
  consumer cannot tell which upstream the fork is based on from `package.json`
  (it has `homepage`/`repository`, no base pin) — and
  *"Based on AssemblyScript"* in `README.md:56` does not say which one.
- The CHANGELOG does not claim AS compatibility; it claims fork-internal
  compatibility ("a program that compiles on 0.9.0 compiles unchanged"). The
  compatibility claim that needs retiring is the README's, not the CHANGELOG's.

### The decision (measured)

1. **Pin the base commit** — `b6bda05c` — in `docs/fork-posture.md` and in the
   `package.json` description/README, as a fact with a date. (Not as a
   dependency; the fork is not built against upstream.)
2. **Add the missing query, not the missing merge**: an `upstream` remote or a
   documented one-liner
   (`git ls-remote https://github.com/AssemblyScript/assemblyscript main`), and a
   quarterly line in the posture doc that records the SHA and the date it was
   checked. The current state — base equals upstream tip, no remote — is the best
   possible starting point for that habit and the worst possible state to leave
   undocumented.
3. **Stop claiming tracking.** `README.md:46` is the sentence; it is measurable
   false and it is the fiction this arc is about.
4. **Do not merge upstream wholesale.** 12,967 lines across 33 files is a rewrite
   with a merge's name on it. Cherry-pick stays available precisely because the
   base is an ancestor, so pinning forecloses nothing.

### Scope

**Small** for the pin + the reading habit + the README sentence. **Medium** if
the version numbering is also addressed — the fork at `0.10.0` under a 0.28.20
base is a standing source of confusion for anyone who reads the version as an AS
compatibility statement. That is a publishing decision (semver epoch, or a
`+as0.28.20` build-metadata suffix) and it belongs in this phase's scope
discussion, not in a commit.

### Deferral / dependency

Shares its paragraph with Phase 0. Independent of Phases 1–3.

### What forces a no

- **If the fork ever needs an upstream parser fix** (the realistic case: a new
  TypeScript syntax), the pin makes the *cherry-pick* the unit of sync, and a
  cherry-pick across 12,967 lines of divergence is a measurement, not a rebase.
  That is not a no — but it is the cost that should be written down next to the
  pin.
- **If a consumer needs `assemblyscript`'s package name** (some C-ABI tools probe
  for it), the fork's identity has to be a shim, and the posture doc must say the
  shim is deliberate rather than a compatibility claim.

---

## 6. What could not be measured read-only

Named so the next reader does not assume otherwise:

1. **The engine's wire contract.** Whether the C headers declare these enums as
   `int`, and therefore whether sized enums are additive or an ABI break
   (`layout_hash`). That requires reading the Tension tree, which this arc
   excludes. Phase 3's "what forces a no" turns on it.
2. **Any behaviour of a reverted-relaxation build beyond its diagnostics.** I
   measured 215 errors over 30 globals; I did not measure what the emitted
   `.wast` would be if those 30 globals were annotated `@lazy`, because `src/`
   cannot carry the annotation at all (measured, §2).
3. **CI behavior and cost.** All timings are one machine, one run: this commit,
   this node (v24.21.0), this repo state. CI runners differ (the same gates are
   `ubuntu`/`macos`/`windows` × 2 node versions in `.github/workflows/test.yml`),
   and no CI run was triggered or read for this scoping.
4. **`--noEmit`'s diagnostic parity on a failing tree.** It was measured clean on
   `main` and it fires the same diagnostics as a full compile on every probe, but
   I did not diff its error set against a full compile on a deliberately broken
   tree at scale (e.g. all 215 revert diagnostics).
5. **Whether Binaryen ever makes the `br_table`** the switch comment hopes for.
   Measured *not* on two shapes (2 and 6 cases, `-O0` and `-O3`); not proven
   impossible.
6. **Anything about the four upstream `src/glue/wasm/**` files** — excluded from
   `check:config` by `src/tsconfig.json`, compiled by AS. Whether that exclusion
   is deliberate or historical is not recorded anywhere I could find.
7. **Publication state beyond versions**: no registry metadata was inspected
   beyond `npm view <pkg> version time.modified` for both packages.

---

## 7. Method — exact commands

Environment: this machine, node v24.21.0, 2026-10-26, base `c3be16fc`, in
`git worktree add --detach /tmp/fork-probe origin/main` with
`node_modules` symlinked from the primary checkout. The primary checkout was not
modified; the worktree was discarded.

Gates:

```
npx tsc --noEmit -p src                       # check:config
npx tsc --noEmit --skipLibCheck --target ESNEXT --module nodenext \
    --moduleResolution nodenext --experimentalDecorators tests/import/index
npx eslint --max-warnings 0 --ext js . ; npx eslint --max-warnings 0 --ext ts .
npm run build ; npm run check ; npm test ; npm run bootstrap:debug
node bin/tensionscript.js --config src/asconfig.json --target debug --noEmit
NODE_DEBUG=dts node scripts/build.js           # which tsconfig the dts step loads
```

Compiler probes (each a standalone file, `--textFile` to read the WAT):

```
node bin/tensionscript.js probe.ts --textFile probe.wat \
     --optimizeLevel 0 --shrinkLevel 0 --debug
node bin/tensionscript.js probe.ts --textFile probe-opt.wat    # -O3
```

Type-gap probes: a `src/__probe.ts` imported from `src/index-wasm.ts`, or an
appended line in a real file, each reverted before the next — with one trap
respected: **a function that nothing calls is never compiled**, so every probe
was called from module scope or exported and reached from an entry.

The relaxation revert:

```
# src/compiler.ts: hasConstantInitializer() -> return false;
npm run build && node bin/tensionscript.js --config src/asconfig.json \
    --target debug --noEmit      # 215 diagnostics, 30 distinct globals
```

Upstream distance:

```
git ls-remote https://github.com/AssemblyScript/assemblyscript main
git clone --filter=blob:none --no-checkout … /tmp/as-upstream
git merge-base --is-ancestor b6bda05c HEAD
git rev-list --count b6bda05c..HEAD
git diff --shortstat b6bda05c HEAD -- src std
npm view assemblyscript version time.modified
npm view @acakar/tensionscript version time.modified
```

---

## 8. Recommendation — order

**My read differs from the brief's, and the difference is measured.**

The brief proposes Phase 1 first because it "unblocks Phase 2 and demonstrates
the posture in code". Phase 1 does **not** unblock Phase 2: `tsc` is one of three
JS-side tools that refuse `@lazy` on a variable declaration, and the one that
actually stops the build is `esbuild` at 94 ms — deleting `npm run check` would change
nothing about `npm run build`. Phase 1's real content is a *relabel plus an
unused 2.1 s gate*, and both are worth doing, but neither unblocks anything.

Recommended order:

1. **Phase 0 — posture.** One paragraph, two README edits, one commit. Zero risk,
   and every later phase's docs cite it. Includes Phase 4's pin (`b6bda05c`) and
   the missing upstream query.
2. **Phase 3 — sized enums.** The only phase with a self-contained payoff and no
   dependency on the toolchain question: it needs no preprocessor as long as
   `src/` does not *use* the syntax. It also demonstrates the posture in code far
   better than removing a gate does — a feature AS cannot express, landed on
   purpose, with `AS200` made unrepresentable instead of worked around. Its first
   act is the Tension-side measurement in §6, item 1; if that says "int", the phase
   stops before it starts, which is the cheapest possible failure.
3. **Phase 2 — `@lazy`, decided as "keep".** Small, and it should be settled
   before anyone spends a week on a 30-annotation revert. The decision is
   measured, the boundary is already pinned by a test, and the honest asymmetry
   (std opts in; `src/` relies on the provable class) is a paragraph, not a
   project.
4. **Phase 1 — the pipeline, re-scoped as "own it".** Relabel `tsc` for what it
   checks; wire the 2.1 s AS `--noEmit` into `pretest`; consider one `eslint` pass
   instead of two (5.7 s saved, 2.2× the cost of the tsc step it would sit next
   to). The preprocessor is only worth building when something wants a fork-only
   annotation *in `src/`* — which, after Phase 2's "keep", is nothing today.
5. **Phase 4 — the review mechanism.** The pin lands with Phase 0; what remains
   is the quarterly check and the version-numbering conversation, both cheap, both
   worth doing once the posture exists to hang them on.

**If you want one commit that changes the most perception for the least risk**,
it is Phase 0. **If you want one that changes what the compiler can do**, it is
Phase 3. **If you want the one the brief asked for**, Phase 1 — but scope it as
"relabel and wire the cheap AS gate", not as "remove tsc", because the
measurement says removing it costs the JS half its only always-on check and buys
2.5 seconds.
