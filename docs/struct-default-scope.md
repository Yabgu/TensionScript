# The default flip — plain `struct` becomes a value

Today `struct Foo { … }` is `@unmanaged class Foo { … }`, exactly: the parser
injects the decorator (`parser.ts:531`, `withUnmanaged` at `:2098`) so the
resolver and every layout rule see one form. The ratified design makes plain
`struct` an **inline value** instead, and demotes the explicit spellings to
opt-ins:

| spelling | today | after the flip |
|---|---|---|
| `struct Foo { … }` | 4-byte pointer | **N inline bytes** (a value) |
| `@unmanaged struct Foo { … }` | 4-byte pointer | 4-byte pointer — unchanged |
| `@managed struct Foo { … }` | 4-byte GC reference | 4-byte GC reference — unchanged |
| `@inline struct Foo { … }` | N inline bytes | **synonym** for plain `struct` |

Read-only scoping. Measured against `origin/main` at `f48ee6cf` with the compiler
built from that tree, plus one **simulated flip** — the parser change applied in a
scratch worktree, both suites run, the change then reverted (Appendix). Every
number below comes from one of those two states, and the flip's measurements were
taken with the fixtures compiled through the harness's own base directory so that
module names and embedded path strings match.

---

## 0. The answer up front

**The flip is cheap; the closure-capture warning is not. Split them.**

- **The flip itself: small.** With the parser changed and nothing else, **309 of
  311 compiler fixtures pass and 54 of 56 parser fixtures pass.** The four
  failures are: `interop/struct` (needs a **one-line** migration to `@unmanaged`),
  `interop/sized-enum-layout` (**compiles; snapshot regenerated**), and the two
  parser AST round-trips (`struct-keyword`, `type-attributes`, each gaining
  exactly one `+@inline` line).
- **`src/` and `std/` hold zero plain `struct` declarations**, so the self-compile
  cannot be affected — and measured anyway: `bootstrap:debug` reaches the `.wast`
  fixpoint under the flip, exit 0.
- **The engine does not move.** All 37 struct declarations in the Tension engine's
  guest sources are decorated — **35 `@unmanaged`, 2 `@managed`, 0 plain**. The
  whole 200,098-byte framework guest compiles **byte-identically** under the flip
  (`.wasm` and `.wat`, `cmp` clean), which is the `layout_hash` premise verified
  by construction.
- **The warn-copy is a phase, and it is not merely a warning.** Capturing a value
  by copy requires the closure's environment class to hold an **inline field**,
  and a class field is exactly the inline-in-heap case this repository refuses by
  name. Measured: under the flip, capturing a plain struct is *refused*. So
  Phase B is **two PRs**: the flip (small), then capture semantics (its own
  phase), filed as `closure-capture-of-value`.

**Two corrections to the brief**, both measured:

1. **There are 9 plain-struct declarations in `tests/`, not 6.** The three not on
   the brief's list are `tests/parser/type-attributes.ts:26`,
   `tests/parser/struct-keyword.ts:14` and
   `tests/compiler/interop/fixed-array-bound.ts:11`.
2. **`struct` must not stop injecting `@unmanaged`; it must add `@inline` on top.**
   `@unmanaged` is what gives an `@inline struct` its record layout. Measured: a
   flip that *replaces* the injection crashes the compiler with
   `AssertionError: assertion failed` at `src/module.ts:1586` (`tostack`), reached
   from `operandsTostack` on a call assignment in
   `interop/inline-struct-sret-refusal-reach`. The flip is therefore **additive at
   the parser**, which is also what makes plain `struct` and `@inline struct` the
   same declaration — the synonym the design asks for.

---

## 1. The plain-struct fixtures — all nine

`grep -rnE "^[[:space:]]*(export[[:space:]]+)?struct[[:space:]]+[A-Za-z_]" tests/`
minus the decorated forms. **Zero** matches in `src/`; **zero** in `std/`.

| # | Fixture | Declares | Test shape | Under the flip |
|---|---|---|---|---|
| 1 | `tests/compiler/interop/struct.ts:16` | `Record_` | **Pointer semantics**: 5 `sizeof` / 10 `offsetof` assertions plus **3 `changetype<Record_>(ptr)`** entry points (`writeB`, `readB`, `readC`) — the wire-record idiom | **compile failed**: 3 × `AS100 changetype to an @inline struct` |
| 2 | `tests/compiler/interop/struct-reserved.ts:26` | `Warned` | layout only (`sizeof<Warned>() == 4`, `== sizeof<Explicit>()`) | **passes; `.wat` byte-identical** |
| 3 | `tests/compiler/interop/sized-enum-layout.ts:40` | `Value` | layout + **`new Value()` field access** (the file calls this the SROA case) | **compiles; `.wat` changes** — see §7 |
| 4 | `tests/compiler/interop/abi-alias.ts:16` | `Aliased` | `abiNameOf` + 1 `sizeof` / 5 `offsetof` | **passes; `.wat` byte-identical** |
| 5 | `tests/compiler/interop/memory-model-override-allowed.ts:117` | `Holder` | `@inline U` as a field type — a memory-model override cell | **passes** (0 errors; `.json`-only fixture) |
| 6 | `tests/compiler/interop/memory-model-provenance-refusals.ts:60` | `Holder` | a `@managed` view held in a field — a *refusal* fixture | **passes** (11 diagnostics emitted, its 7 pinned patterns all present and in order) |
| 7 | `tests/compiler/interop/fixed-array-bound.ts:11` | `ConstBound` | a **parse-refusal** fixture: `f32[FOUR]` → `TS1005` | **passes** (still exactly 1 `TS1005`) |
| 8 | `tests/parser/struct-keyword.ts:14` | `Borrowed` | **AST round-trip**: `struct` → `@unmanaged class` | **diff is one line**: `+@inline` |
| 9 | `tests/parser/type-attributes.ts:26` | `Mixed` | **AST round-trip**: type attributes vs declaration decorators | **diff is one line**: `+@inline` |

**Gate answer: exactly one fixture cannot be rewritten in place.**
`struct.ts` is a deliberate pointer-semantics test — `changetype<Record_>(ptr)` is
what a wire record *is*, and a value type has no address, so `AS100` is the
correct answer for that declaration under the new model. Its migration is **one
line** (`struct Record_` → `@unmanaged struct Record_`), and with that change the
fixture compiles and its debug `.wat` is **byte-identical** to the committed
snapshot (verified: module-path normalised, `diff` = 0). The fixture keeps testing
what it tests; it now says the storage model out loud, which is the point of the
flip.

---

## 2. `changetype<PlainStruct>` — three sites, one fixture

Measured across `tests/`, `src/`, `std/` for all nine names:

```
tests/compiler/interop/struct.ts:60  changetype<Record_>(ptr).b = v;
tests/compiler/interop/struct.ts:63  return changetype<Record_>(ptr).b;
tests/compiler/interop/struct.ts:66  return changetype<Record_>(ptr).c;
```

Those three are the entire set. No `changetype` names `Value`, `Warned`,
`Borrowed`, `Mixed`, `Holder`, `ConstBound` or `Aliased`.

The neighbouring hits are out of scope and stay valid because their records are
explicitly `@unmanaged`: `fixed-array-write.ts:18` / `fixed-array-read.ts:15,64`
and `sized-enum-layout.ts:82,96`.

The refusal already says the right thing — *"changetype to an @inline struct (a
value has no pointer representation; use @unmanaged struct for a view over
bytes)"* — and it names the migration. No new diagnostic is needed.

---

## 3. `@inline` — the deprecation is a synonym, with no diagnostic

**Inventory:** 199 textual `@inline struct` occurrences across `src/`, `std/`,
`tests/`; **34 real declarations**, all in `tests/` (33 compiler, 1 parser),
**0 in `src/` or `std/`**, **0 in the engine**.

**The tree already made this exact decision once.** When the 0.9.0 "plain struct
becomes managed" change was cancelled, the redundant spelling kept compiling with
no diagnostic — `tests/compiler/interop/struct-reserved.ts:9-14` records it:

> `plain struct` → no diagnostic, as of 0.9.0. 0.8.x warned (TS6385) that
> `struct` would become a managed type at 0.9.0; that change is cancelled, so the
> warning is gone and plain `struct` means `@unmanaged struct` permanently.

and again for the explicit form (`:18-19`): *"`@unmanaged struct` -> no diagnostic
(the explicit spelling; now redundant, still valid)"*. `diagnosticMessages.json`
has **zero** entries matching `deprecat`, and TS6385 was **deleted** when its flip
was cancelled (`docs/interop-managed-struct-scope.md:479-497`).

**Recommendation: `@inline struct` is a synonym with no diagnostic.** Under the
flip it produces the same two decorators as plain `struct` — indistinguishable by
construction, the strongest form of synonym, at no cost. A warning would invent a
convention this tree deliberately deleted. If a nudge is ever wanted, it belongs
in the docs.

The one asymmetry: `@inline` on a **class** stays `AS212` (a misplaced decorator).
`@inline` means "value type" only on `struct`.

---

## 4. The parser line, and every reader of the injected decorator

**The line** is `parser.ts:529-533`:

```ts
let decl = this.parseClassOrInterface(
  tn, flags,
  explicitManaged ? decorators : this.withUnmanaged(decorators, structRange),
  startPos
);
```

The flip adds a sibling. Order matters: `@unmanaged` first (layout), then
`@inline` (storage model), and neither is added when the author wrote a model
explicitly (§0, correction 2). An explicit `@unmanaged` or `@managed` keeps its
model and gains nothing.

**What reads the injected decorator.** It is a real `DecoratorNode`, not a flag,
so everything downstream sees it:

| Reader | What it does |
|---|---|
| `program.ts:2148` `declaredInlineStruct` | `declaredAsStruct && hasDecoratorFlag(decorators, Inline)` — **the line the flip turns on** |
| `program.ts:2163-2174` | `checkDecorators(... Unmanaged \| ... \| Inline \| ManagedStruct)`; sets `DecoratorFlags.InlineStruct` |
| `program.ts:2184-2190` | `ManagedStruct \| InlineStruct` → forces `Final` |
| `resolver.ts:4041-4045` | `Unmanaged \| ManagedStruct` selects record layout, `alignLog2` accumulation, extent round-up |
| `builtins.ts:1274-1283`, `:1329-1334` | `sizeof` / `alignof` read `nextMemoryOffset` / `alignLog2` for the same two kinds |
| `resolver.ts:4331` `declaredMemoryModelOf` | the inverse reading the layout branch keys on |
| 15 × `hasDecorator(DecoratorFlags.Unmanaged)` | `T[N]`, `COPY_STRUCT`, field access, unmanaged allocation |

**None of them needs a change.** They all keep seeing `Unmanaged`, which is why
the flip is additive — and why the swap in §0 crashed. `declaredAsStruct` remains
the guard that keeps `@inline class` an `AS212` rather than a value type.

---

## 5. Closure capture — the gate, and it does not pass in this phase

**Measured today (main):** capturing a plain struct compiles and **aliases**.

```ts
struct P { x: u32; y: u32 }
let p: P = new P(); p.x = 5; p.y = 7;
let f: () => u32 = () => p.x * 10 + p.y;
p.x = 99;
return f();          // → 997
```

997 means the closure read `p.x` **after** the write: the environment holds the
4-byte pointer. Capture by reference — honest for a pointer record, and exactly
what the flip exists to stop.

**Measured after the flip:** the same program is **refused**:

```
AS100: Not implemented: an @inline struct value in a field (inline nesting is a later phase)
```

(on post-#36 main the message is the more specific *"an @inline struct as a class
field (a class field is a pointer slot; inline-in-heap is a separate, deferred
case)"*.)

**The refusal comes from the environment class**, not from capture logic:
`ClosureLowerTransform.makeEnvClasses` (`src/closure/lower.ts:2145`) synthesises
one field per captured binding, typed by the binding's own `TypeNode`
(`:2188-2212`). A captured value makes that field an **inline field of a managed
class** — inline-in-heap, refused by name.

**So the warn-copy is not "a warning plus a copy".** Copying into the environment
requires the environment class to *store a value in the heap*, which is the
deferred inline-in-heap case: allocation size, `__visit` (a value's GC references
would be invisible to the collector), the constructor, and per-leaf copy-in and
copy-out. That is a phase.

**And the transform cannot see the type.** `ClosureLowerTransform` runs on the AST
before resolution: it holds `program.sources` (`:238`) and a
`Map<string, TypeNode>` of known type nodes (`:896`), and touches no resolved
`Type`, `Class` or `Property` (zero hits for `getMember` / `ClassPrototype` /
`.instance`). A warning keyed on "this binding's type is an inline struct" would
need a post-resolution pass or a new side channel into the transform. Neither
exists today.

**Recommendation: land the flip without the warn-copy; the capture case becomes a
loud refusal.** That is a strict improvement: today the aliasing is silent and
wrong (997); after the flip it is a compile error naming the reason. The
warn-copy — or a proper inline-in-heap environment — is its own phase, filed as
`closure-capture-of-value`.

What the flip does **not** break: capturing an `@unmanaged` record still compiles
and aliases, because that is what a pointer means. A user who wants pointer
capture writes `@unmanaged`; a user who wants a copy gets a diagnostic until the
phase lands.

---

## 6. The `@unmanaged` declarations — unchanged, and the engine does not move

**In TensionScript:** 35 `@unmanaged struct` declarations, all in `tests/`
(**0** in `src/`, **0** in `std/`). Under the flip they keep their decorator and
their layout is byte-identical; the two fixtures that exercise them through
layout only (`struct-reserved`, `abi-alias`) compile to **byte-identical `.wat`**
(verified at the harness's base directory).

**In the engine** (`~/work/Tension` at `3edf23c`): 37 struct declarations in the
guest sources — **35 `@unmanaged`, 2 `@managed`, 0 plain**, across
`tension-framework/assembly/ogre/wire.ts` (24),
`tension-framework/assembly/runtime/wire.ts` (10),
`tension-framework/assembly/runtime/managed-alias.ts` (2) and
`examples/solver/collision/game.ts` (1). The brief's "33" undercounts; the shape
of the claim holds — **nothing in the engine is a plain `struct`**.

**`layout_hash`:** measured, not argued. The framework guest compiled with the
flipped compiler is **byte-identical** to the same guest compiled from
`origin/main` — `cmp` clean on both `.wasm` (200,098 bytes) and `.wat`. Since the
guest does not change by a byte, nothing it sends in the TLV can change, and the
engine-side hash (`arena.rs:1030-1104`, host constants only) cannot move. The hash
value itself is **not verifiable from this repository**; its premise is, and holds.

**The self-compile:** zero plain structs in `src/` and `std/`, so no path exists —
and measured anyway: `npm run bootstrap:debug` under the flip reaches the `.wast`
fixpoint, exit 0.

---

## 7. The `.wast` migration — one snapshot moves

Measured by compiling each fixture from `tests/compiler`, which is the base
directory the harness uses, so module names and embedded source-path strings match
the committed snapshots exactly.

| Fixture | `.wat` under the flip | Why |
|---|---|---|
| `struct.ts` | **compile failed** (3 × `AS100`) → after the one-line migration, **byte-identical** (`diff` = 0) | `changetype` needs an address |
| `struct-reserved.ts` | **byte-identical** (`diff` = 0) | `Warned` is used only through `sizeof`, which is the same number either way |
| `abi-alias.ts` | **byte-identical** (`diff` = 0) | used only through `abiNameOf` / `sizeof` / `offsetof` |
| `sized-enum-layout.ts` | **differs**: allocation calls **3 → 2**; `Value#constructor` and all four accessors (`get`/`set` for `tag`, `kind`) **disappear**; `__data_end` **unchanged at 316** | `new Value()` stops allocating and becomes an SROA local — the behaviour the file's own comment already claims |
| `memory-model-override-allowed.ts` | n/a (`.json`-only) | passes, 0 errors |
| `memory-model-provenance-refusals.ts` | n/a (`.json`-only) | passes; 11 diagnostics, all 7 pinned patterns present in order |
| `fixed-array-bound.ts` | n/a (`.json`-only) | still exactly 1 `TS1005` |
| `struct-keyword.ts` (parser) | AST dump gains one `+@inline` line | the round-trip prints decorators |
| `type-attributes.ts` (parser) | one `+@inline` line | same reason |

Note the direction of the `sized-enum-layout` change: the flip makes that
fixture's **comment true**. It says *"SROA: an `@inline` struct with an enum field
is a narrow local"* while measuring a plain `struct Value`, which today
**allocates** (`tlsf/__alloc` present, `Value#constructor` present) and is read
through pointer accessors. Under the flip the plain struct *is* the inline struct
and the value really is a set of locals. Its assertions pass either way — which is
why only the snapshot moves, and why that fixture is the flip's best
demonstration.

**Outside `tests/`:** `docs/interop-memory-conversions-scope.md:467` contains a
plain `struct Plain { … }` measurement showing the `tlsf/__alloc` pointer path.
That is a historical measurement of the 0.8.x behaviour and should be **marked
historical, not recompiled**. `docs/inline-nesting-scope.md:7` is C, not this
language. The engine's examples and the showcase contain no plain `struct` (§6),
so nothing there recompiles differently.

---

## 8. Scope and order

| Order | PR | Contents | Size |
|---|---|---|---|
| 1 | **the flip** | the parser line + the `@inline` injection; `struct.ts` → `@unmanaged`; regenerate `sized-enum-layout`'s debug and release `.wat`; two parser AST fixtures; docs (CHANGELOG, showcase, README) | **small**: 1 changed source line (+ ~15 for the helper), 1 fixture line, 2 regenerated snapshots, 2 AST expectations |
| 2 | **capture semantics** (deferred) | inline-in-heap environment fields, then copy-in/copy-out (or the warn on top of them) | **phase**: allocation size, `__visit`, constructor, both copy directions |

**Why not one PR.** The flip's evidence is complete without capture: 309/311
compiler and 54/56 parser fixtures pass with the parser change alone, and the four
that do not are one-line or snapshot work. Capture is a different mechanism
(inline-in-heap), in a different file (`lower.ts` plus the class-field refusal),
with its own three-way fixture. Bundling would put a phase-sized change behind a
one-line flip and delay the flip's benefit — which is that the silent alias becomes
a diagnostic.

**Why the flip should land even though capture gets worse for a while.** Today a
plain struct captured in a closure compiles and silently aliases (measured, 997).
After the flip the same program is refused, with a message naming the reason. A
compile error is strictly better than a wrong value, and the flip is what makes the
case visible at all — the same trade the value-type phase made when it refused
`@inline` storage positions rather than letting them alias.

---

## 9. Recommendation

1. **Flip the default.** Bare `struct` → `@unmanaged` + `@inline`; explicit
   decorators win; `ast.ts` untouched; no new diagnostic codes.
2. **Migrate `struct.ts` to `@unmanaged`** in the same PR — one line, `.wat`
   byte-identical, and the fixture keeps testing the wire-record idiom.
3. **Keep `@inline struct` a silent synonym.** Precedent: the tree deleted TS6385
   rather than warn about a redundant spelling.
4. **Regenerate `sized-enum-layout`'s `.wat`** (debug and release) and update the
   two parser AST fixtures; assert the other snapshots are unchanged — they are,
   and that is the backward-compatibility proof.
5. **Do not attempt the warn-copy here.** File `closure-capture-of-value`: the
   environment class cannot hold a value until inline-in-heap exists, and the
   transform cannot see resolved types to warn from. The flip's refusal is the
   correct interim behaviour.
6. **Mark `docs/interop-memory-conversions-scope.md` §5.1 historical** — its
   `tlsf/__alloc` measurement describes the pointer default this PR removes.

---

## 10. What could not be measured read-only

- **The flip in its final form.** §0-§7 measure a *simulated* flip: the parser
  change applied in a scratch worktree, built, both suites run, then reverted. It
  is the same change the implementation would make, but I did not run `lint`,
  `check` or the `dts` build under the flip, and I did not regenerate the release
  snapshots. A declaration-time `checkDecorators` surprise is therefore possible,
  though none appeared across 367 fixtures.
- **The warn-copy's cost.** It cannot be built on top of the refusal it must
  replace; §5 measures the blocker, not the work.
- **`layout_hash` itself.** Engine-side (`arena.rs`), unreachable from this tree.
  Verified instead: the framework guest is byte-identical under the flip.
- **Consumers outside the two repositories.** No plain `struct` exists in the
  engine, so there is no observable consumer of the old default to survey.
- **The 34 existing `@inline` declarations' snapshots.** They should be unchanged
  by construction (the same two decorators), but I compared only the fixtures
  whose plain declarations changed.

---

## Appendix — the simulated flip

Applied in a worktree at `f48ee6cf`, then reverted:

```ts
// parser.ts:531
explicitManaged ? decorators : this.withFlippedModel(decorators, structRange),

// A bare `struct` keeps the @unmanaged injection (layout) and gains @inline.
private withFlippedModel(decorators: DecoratorNode[] | null, range: Range): DecoratorNode[] {
  let explicitUnmanaged = hasUnmanagedDecorator(decorators);
  let explicitInline = hasInlineDecorator(decorators);
  let out = explicitUnmanaged ? <DecoratorNode[]>decorators : this.withUnmanaged(decorators, range);
  if (!explicitUnmanaged && !explicitInline) { /* prepend @inline */ }
  return out;
}
```

Results:

- `npm run test:compiler` → **2 failures**: `interop/struct` (compile failed),
  `interop/sized-enum-layout` (fixture mismatch). Baseline on the unmodified
  parser: `[ SUCCESS ]`, 0 failures.
- `npm run test:parser` → **2 failures**: `struct-keyword`, `type-attributes`,
  each a single `+@inline` line with no removals.
- `npm run bootstrap:debug` → **0** (fixpoint).
- The framework guest → **byte-identical** `.wasm` and `.wat` (200,098 bytes).
- `struct.ts` migrated to `@unmanaged` under the flip → compiles, `.wat`
  byte-identical to its committed snapshot.

**A first attempt swapped the injection** (`withUnmanaged` → an `@inline`-only
injection) and crashed the compiler with `AssertionError` at `module.ts:1586`
(`tostack`), from `operandsTostack` on a call assignment in
`interop/inline-struct-sret-refusal-reach`. That is the measurement behind §0's
second correction: the `@unmanaged` injection is load-bearing for the inline
layout, so the flip adds `@inline` rather than replacing it.

Source citations to `origin/main` at `f48ee6cf`; engine citations to
`~/work/Tension` at `3edf23c`.
