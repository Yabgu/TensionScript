# Sized enums — implementation scoping

**Status:** scoping. Read-only on source; nothing implemented. This branch adds one
file.

**Base:** `origin/main` @ `98305208` (lazy-expression arc closed). Measured
2026-10-27.

**What this document is.** `docs/fork-arc-scope.md` §3 measured the *current
behaviour* of enums — the 4-byte fields, the `i32.eq` switch chain, the silent
`A = 2147483648` wrap, the `AS200` into a `u8` field. This document measures the
*change surface*: which sites would have to move for `enum Foo: u8 { … }` to mean
what it says. Every claim below is from a compiled probe or a counted grep, not
from reading the prior scoping.

**The one finding that sets the whole design.** There is no enum type in this
compiler's type system. An enum **is** `i32`:

- `Enum.setType(Type.i32)` (`src/program.ts:3668`), `EnumValue.setType(Type.i32)`
  (`:3771`), both in the constructors;
- `Resolver#resolveType`'s enum arm (`src/resolver.ts:311`, comment "Handle enums
  (become i32)") returns `Type.i32` **hardcoded**, never consulting the element;
- so `byteSize`, `alignLog2`, field offsets, array stride, `sizeof`, `offsetof`,
  SROA load widths and store widths are all *i32 arithmetic* that happens to be
  correct because the type is i32.

That is why the phase is smaller than it looks **and** why it must be done at the
type, not at the layout: the 55 `.byteSize` readers in the compiler need **zero**
changes. Repoint the enum's `Type` at `u8` and every one of them produces 1 byte
for free — measured below by simulation.

---

## 9. Parser

**Today.** `Parser#parseEnum` (`src/parser.ts:1414`) reads
`enum` → identifier → expects `{`.

```ts
if (tn.next() != Token.OpenBrace) {   // ← the whole grammar
  this.error(DiagnosticCode._0_expected, tn.range(), "{");
  return null;
}
```

`enum Small: u8 { A, B }` therefore fails at the colon:

```
ERROR TS1005: '{' expected.
 1 │ enum Small: u8 { A, B }
   │           ~
```

**The change.** One arm before the brace check:

```ts
let underlyingType: TypeNode | null = null;
if (tn.skip(Token.Colon)) {
  underlyingType = this.parseType(tn, false);   // no parenthesized form
  if (!underlyingType) return null;
}
```

**Conflict measurement — none, and for the same reason as `@lazy`.** The colon
position is *already* a hard parse error (`TS1005`), so accepting something there
cannot change what an existing program means. This is the same discipline the
`@lazy` arm used in `parseExpressionStart`: measure the position that currently
fails, then claim exactly that position and nothing else.

Two smaller points, both measured:

- `parseType` accepts pre-type decorators (`v: @inline V`). Writing
  `enum Foo: @inline u8` would parse, so the *type* check (integer, non-pointer,
  ≤ 32 bits) belongs in the resolver/program, not in the grammar.
- `EnumDeclaration` (`src/ast.ts:2146`) has no field for the underlying type;
  it gains `underlyingType: TypeNode | null`, and `Node.createEnumDeclaration`
  gains the parameter. Two edits.

**Line count: parser +8, ast +2.** No tokenizer work — `Token.Colon` exists.

---

## 10. Resolver and type representation

### Where the type comes from today

Two hardcodes, and the resolver's is the load-bearing one:

| site | today | needed |
|---|---|---|
| `src/program.ts:3668` `Enum` ctor | `this.setType(Type.i32)` | underlying type, resolved at declaration |
| `src/program.ts:3771` `EnumValue` ctor | `this.setType(Type.i32)` | the parent enum's type |
| `src/resolver.ts:311` enum arm | `return Type.i32;` | `return (<Enum>element).type;` |

`resolveType`'s arm **never looks at the element** — it answers `Type.i32` and
returns. So changing `Enum.setType` alone would do nothing: the resolver would
still hand `i32` to every use. Both must change, and the resolver's arm is the one
that makes the feature observable.

**Where the underlying type lives.** Two options, measured against the code:

- **(a) The enum's `Type` *is* the underlying type** — `Enum.setType(Type.u8)`.
  Then `resolveType` returns `element.type`, and every consumer sees a plain
  `u8`.
- **(b) A separate `underlyingType: Type` field on `Enum`**, with `type` still
  i32 and consumers taught to consult it.

Recommend **(a)**, and the measurements are why. Under (b) every `.byteSize`
reader would need an enum special case — 55 sites times a "is this an enum, and
what is it really" question. Under (a) the question never arises: the enum's
`Type` *is* the storage class, which is exactly what `byteSize`, `alignLog2`,
`isShortIntegerValue`, `isAssignableTo` and `computeSmallIntegerMask` are asking
about. The nominal identity of the enum survives where nominality actually lives
today — in the *element* (`ElementKind.Enum`, `EnumValue.parent`), not in the
`Type` — which is why `case 99:` and `let e: E = 5` compile today and will still
compile.

One consequence to state: `enum Foo { A }` and `u8` become **the same `Type`**.
That is already true for i32 today (`enum → Type.i32` and `i32` are identical),
so it is not a new kind of leak — but it does mean a sized enum does not add
nominal checking. `w.kind = E.A` where `kind: u8` becomes legal, which is the
feature's whole point.

### What reads an enum's byteSize today

Counted: **55** `.byteSize` reads — `src/builtins.ts` 26, `src/compiler.ts` 25,
`src/types.ts` 2, `src/resolver.ts` 1, `src/program.ts` 1. Plus `.alignLog2`,
which is derived from it.

**Every one of them needs zero changes**, because each reads a `Type`. Measured by
substituting `u8` for the enum in the same shapes (so the numbers are observed,
not predicted):

| shape | today (enum = i32) | at `u8` |
|---|---|---|
| `sizeof<E>()` | 4 | **1** |
| `alignof<E>()` | 2 (log2 → 4B) | **0** (1B) |
| `@unmanaged struct { u8 tag; E e }` `sizeof` | 8 | **2** |
| … `offsetof("e")` | 4 | **1** |
| `@unmanaged struct { u8 n; E[3] e }` `sizeof` | 16 | **4** |
| `@inline struct { u8 tag; E e }` `sizeof` | 8 | **2** |
| `E[3]` stride | `shl 2` | no shift |

The `u8` column is measured from an equivalent program with `u8` written where the
enum would be; each value is the one the current generic layout code produces for
that field type. The claim being made is narrow and checkable: **nothing in the
layout path needs to learn about enums.**

---

## 11. Literal folding and overflow

**Where enum members fold.** `Compiler#compileEnum` (`src/compiler.ts:1544`), not
the resolver. Each `valueNode` is compiled with a **hardcoded i32 context**:

```ts
initExpr = this.compileExpression(valueNode, Type.i32, Constraints.ConvImplicit);
```

then constant-folded with `module.runExpression(...)`; implicit successors
(`B` after `A`) are `BinaryOp.AddI32` over `global_get(..., TypeRef.I32)`; the
value lands in `setConstantIntegerValue(i64_new(getConstValueI32(initExpr)), Type.i32)`.

**The folder can be constrained per-enum, and it needs almost nothing new.** Two
measured facts make this cheap:

1. The **conversion machinery already refuses out-of-range narrow literals**:
   `let x: u8 = 300;` → `AS200: Conversion from type 'i32' to 'u8' requires an
   explicit cast.`; `let x: u8 = -1;` → same; `let x: u8 = 200;` → compiles.
   So compiling the member initializer at the *underlying* type gets the range
   check for free from `convertExpression` (`src/compiler.ts:4088`).
2. The **i32 context does not refuse** — it wraps: `let x: i32 = 2147483648;`
   emits `i32.const -2147483648`, and `enum E { A = 2147483648 }` emits the same.
   That asymmetry is why the phase's overflow rule is "refuse on a *declared*
   width" rather than "refuse everywhere": the narrow path already refuses, and
   the i32 path's wrap is pre-existing behaviour that changing would be a
   separate, breaking decision.

**Recommendation.** Compile member initializers at the enum's type (one line:
`Type.i32` → the underlying type), keep `AS200` for the out-of-range case, and add
**one** enum-specific diagnostic that says more than `AS200` does — the value, the
width, and the member's name — because at a declaration site "requires an explicit
cast" is advice that cannot be followed (there is nothing to cast in
`enum E: u8 { A = 300 }`).

**A trap to avoid.** `compileInlineConstant` (`src/compiler.ts:3870`) already has
a `U8`/`U16` arm that **masks**: `i64_low(value) & mask`. A `const enum` member of
300 in a `u8` enum would therefore silently become 44 *if the check were left to
codegen*. The refusal must happen at the declaration, before the inlined constant
is produced — the same ordering lesson as the `@lazy` validation walk (guard
before the thing that would silently misbehave).

**Sites: ~4** in `compileEnum` (the value context, the successor add, the
`setConstantIntegerValue` type, the global's value type) + 1 new diagnostic.

---

## 12. Switch and match

**Today, measured twice** — once for an i32-backed enum and once for a plain `u8`
discriminant, which is the target shape:

```ts
enum E { A, B, C }                    export function sw8(c: u8): i32 {
export function sw(e: E): i32 {         switch (c) { case 1: … }
  switch (e) { case E.A: … }
```

```
i32-backed enum                     u8 discriminant (the target)
  local.get $1                        local.get $1
  global.get $E.A                     i32.const 255
  i32.eq                              i32.and
  br_if $case0                        i32.const 1
                                      i32.eq
                                      br_if $case0
```

Both are `br_if` chains with `i32.eq`; neither becomes a `br_table` at `-O3`.
The difference at `u8` is the mask, and it comes from the operand's type, not from
the switch: a `u8`-typed value is wrapped to 8 bits wherever it is *used as an
i32*.

**So the switch needs no change beyond the type.** `compileSwitchStatement`
(`src/compiler.ts:3231`) takes `condType` from the condition's `currentType`,
allocates `flow.getTempLocal(condType)`, and compiles each label with
`compileExpression(case_.label, condType, Constraints.ConvImplicit)`. With the
enum's type at `u8`, all three of those are `u8`, the mask appears, and the
comparison stays `i32.eq` — which is the correct wasm lowering, because a `u8` in
wasm is an i32 whose high bits are zero.

**The leak hazard the brief asks about does not exist in this path.** The
"wrong-load reads 4 bytes where 1 is valid" failure would require the discriminant
to be *loaded* with a 4-byte load. It is not: a switch on `s.e` goes through
`compilePropertyAccessExpression`, which emits `i32.load8_u` for a `u8`-typed
field — the same generic path that already emits `store8`/`load8_u` for a plain
`u8` field (measured: `U#set:a` → `i32.store8`, `U#get:a` → `i32.load8_u`). The
load width comes from the field's `Type`, so it is correct for free.

**`case 99:` on a sized enum** stays accepted, as it is today for i32 enums: the
literal narrows to the enum's width when it fits, and is `AS200` when it does not.
That is a change in *what is accepted* (`case 300:` on a `u8` enum would refuse)
but not in the switch's shape.

**Sites: 0**, beyond the type.

---

## 13. Wire records — the payoff

Measured today:

- `@unmanaged struct { u8 tag; E e }` → `sizeof` 8, `offsetof("e")` 4,
  store `i32.store offset=4`, load `i32.load offset=4`;
- `w.e = E.B` where `w.e: u8` → **`AS200: Conversion from type 'i32' to 'u8'
  requires an explicit cast`** — the wire-record bug class, reproduced.

With the enum's type at `u8`, both become the same-kind case that
`convertExpression` early-returns on (`if (toType.kind == fromType.kind)`, line
4165): no conversion, no diagnostic, no mask; the field accessor emits
`store8`/`load8_u`; `offsetof` answers 1. **Zero code changes in the accessor or
the layout path** — measured by simulation (§10's table).

**Which framework records would benefit: none today.** Enums do not appear as
wire-record fields in this repo, precisely because of the size mismatch — a `u8`
field cannot receive an enum member without a cast. So the payoff is prospective:
*after* this phase, an enum-typed wire field is expressible at its true width,
which is what makes the layout describable in the engine's headers rather than
worked around with `u8` plus casts.

**The dependency this creates is outside this repo**, and it is the phase's only
hard external gate: whether a `u8`-sized enum matches the engine's C declaration.
That is a Tension-repo measurement (see §18).

---

## 14. Cast semantics

Measured, current behaviour, on `enum E { A, B }` (i32):

| cast | emitted | reading |
|---|---|---|
| `<u32>e` | `local.get $e` — **no mask** | widening is already free |
| `<u8>e` | `local.get $e; i32.const 255; i32.and` | narrowing masks |
| `<E>u8` | `i32.and 255` (measured in the prior scoping) | the width of the *target* |

With the enum's type at `u8`, each case falls out of `convertExpression`:

- `<u8>e` where `E` is `u8` — **same kind → early return → no-op**. Correct: the
  value is already 8 bits.
- `<u32>e` — widens to `u32`; on wasm32 both live in an i32 slot and the value is
  already zero-extended, so the emission stays a bare `local.get` (as it is
  today for i32 → u32).
- `<u8>e` where `E` is i32 — unchanged, still `i32.and 255`.
- `<smaller>e` from a wider enum — masks, as any narrowing does.

**The width decisions live in `Type` (`computeSmallIntegerMask`,
`computeSmallIntegerShift`, `isShortIntegerValue`), not in the cast site.** So
**sites: 0** for casts. The one thing worth adding is a *constant* out-of-range
cast refusal (`<u8><E>300`), which is knowable at compile time — but that is a
general improvement, not an enum one.

---

## 15. `const enum`

Measured: `const enum CE { A = 5 }` inlines `i32.const 5`, and
`compileInlineConstant` decides the emission from `element.type.kind`.

Two consequences, both measured by reading the arm:

- With the member's type at `u8`, the `U8`/`U16` arm runs:
  `i64_low(value) & mask` → `i32.const 5`. The **value** is right, and the
  inlined expression carries `currentType = type` = `u8`.
- But the same arm **masks rather than refuses**, so a member of 300 would inline
  as 44. That is the trap in §11: the overflow refusal must precede codegen.

`const enum`'s "only a string literal may name a member" rule
(`ensureEnumToString`) is orthogonal and unaffected.

**Sites: 1** — `setConstantIntegerValue(..., Type.i32)` in `compileEnum` becomes
the underlying type; the rest of the path is already type-driven.

---

## 16. Backward compatibility

**`enum Foo { A, B }` stays `i32`** by construction: the parser produces
`underlyingType == null`, and the declaration keeps `Type.i32`. Nothing else in
this design touches the no-underlying-type path.

**How many existing enums would change size if the default flipped: all of them** —
68 declarations in `src/` + `std/`, 40 in `tests/` (grep, declarations at line
start). That is the argument for *not* flipping it: the measured answer to "how
many would change" is "every one", so the default must stay i32 and the sized form
must be opt-in. (The brief's expectation — "should be zero if the default stays
i32" — holds, and this is the count that makes it matter.)

Two smaller compatibility notes:

- A sized enum and a plain `u8` are the same `Type`, so `let e: E = <u8 value>`
  compiles without a cast. Consistent with today's enum/i32 relationship, but it
  is a widening of the surface and should be stated in the CHANGELOG.
- Enum member **globals** can stay `TypeRef.I32` in the emitted module regardless
  of the enum's width: measured, a narrow global is `(global $small (mut i32))`,
  because wasm globals have no i8/i16 form here. So `module.addGlobal(..., TypeRef.I32)`
  in `compileEnum` does not have to change; only the compiler-level `Type`
  arguments do.

---

## 17. The design

### Syntax

**C23 form: `enum Foo: u8 { … }`**, as the prior scoping recommended. Confirmed
implementable: the colon position is currently `TS1005`, `Token.Colon` exists, and
`parseType` already reads what follows. Accepted underlying types: the integer
scalars `i8`, `u8`, `i16`, `u16`, `i32`, `u32` — refused for `bool`, `f32`/`f64`,
`i64`/`u64`, references and `@inline`/`@managed`-decorated types, with one
diagnostic naming the restriction.

### Type representation

The enum's `Type` **is** the underlying type (§10, option (a)). `Enum.setType` and
`EnumValue.setType` take it; `resolveType`'s enum arm returns `element.type`
instead of `Type.i32`. Nominal identity stays on the element, where it lives now.

### Site count

| file | change | size |
|---|---|---|
| `src/parser.ts` | `parseEnum`: `:` + `parseType` arm | ~8 lines |
| `src/ast.ts` | `EnumDeclaration.underlyingType`, factory param | ~2 lines |
| `src/program.ts` | `Enum` ctor takes the type; `EnumValue` inherits parent's | ~10 lines |
| `src/resolver.ts` | enum arm returns `element.type` (was `Type.i32`) | ~3 lines |
| `src/compiler.ts` | `compileEnum` 11 hardcoded-i32 spots; `ensureEnumToString` 4; `EnumValue` read arm 4 (incl. one `assert`) | ~25 lines |
| `src/diagnosticMessages.json` | 1–2 new codes (non-integer underlying type; member out of range) | 2 lines |
| fixtures | sizeof/offsetof, wire record, switch, cast, const enum, overflow refusal, non-integer refusal, backward-compat | 8–10 files |

**≈ 50–60 lines of source, 6 files, 8–10 fixtures.** The 11 + 4 + 4 hardcoded-i32
spots are the bulk and each is mechanical (`Type.i32` → `underlying`, `TypeRef.I32`
→ `underlying.toRef()`), because wasm's ref for a narrow type is still `I32`.

### Switch narrowing

No change (§12). The `u8` mask comes from the operand's type; the comparison stays
`i32.eq`; the load width comes from the field's `Type`. The hazard the brief
anticipated would require a hand-written 4-byte load, and this path does not have
one.

### Literal overflow

Refuse at the declaration, before codegen (§11): compile member initializers at
the underlying type so `convertExpression` refuses out-of-range values, and add an
enum-specific message that names the member, the value and the width. The i32
enum keeps its current wrap (a deliberate, separate decision).

### Interaction with the record forms

| form | effect | code change |
|---|---|---|
| `@unmanaged struct` field | 4 → 1 byte; `offsetof` 4 → 1; `store8`/`load8_u` | none |
| `T[N]` field | 12 → 4 for `E[3]`; stride `shl 2` → none | none |
| `@inline struct` field (SROA) | per-field load width already tracks the type (`load8_u`) | none |
| `@abi.alias` | already width-neutral (respects the field's type) | none |
| `@managed struct` field | same layout path; a GC record with an enum field shrinks identically | none |

### Scope estimate

**Small-to-medium — a `small` phase, not a `phase`.** It is six files and ~55
lines, with a well-defined blast radius, and three of the seven surfaces (switch,
casts, records) need *no* code at all. The reason it is not trivially small is the
fixture work and the two refusal rules, both of which are where silent-wrong-answer
bugs would otherwise hide.

### Dependencies

- **Nothing needs to land first.** The lazy-expression arc is closed and shares no
  code (different transform, different node). The fork-arc's Phase 0 (posture) is
  documentation and is already written.
- **Nothing in this phase blocks the fork-arc's Phase 1 or 2.** It does not change
  the build pipeline or `@lazy`.
- **One external dependency, and it is a gate, not a blocker:** the engine's C
  headers. If a wire enum is declared `int` on the C side, a `u8`-sized enum
  changes byte offsets and the arena's `layout_hash` moves. That must be measured
  in the Tension repo before any wire record adopts a sized enum — the language
  feature can land without it, because it only *enables* narrower records.

### What forces a no

- **If the engine declares the corresponding C enums as `int`.** Then the feature
  is correct but inapplicable to wire records until the ABI changes; it would
  still be worth having for in-memory records, so this narrows scope rather than
  stopping the work.
- **If signed narrow enums (`i8`/`i16`) must refuse negative values** or carry a
  signed domain, the overflow matrix doubles (per-signedness ranges). Implementable;
  v1 could accept only unsigned narrow types and refuse the signed ones by name.
- **If enum identity must become nominal** (`w.kind = SomeOtherU8Enum` refused),
  that is a different, larger feature — it needs a real enum `Type`, i.e. option
  (b) in §10 with its 55-site tax.

---

## 18. What could not be measured read-only

1. **The engine's C enum widths.** Whether a wire enum is `int` or a narrow type on
   the host side, and therefore whether a sized enum is additive or an ABI break
   (`layout_hash`). Tension is out of scope for this arc.
2. **The `--wasm` self-host path** with a changed `Enum` element: `bootstrap:debug`
   is green on the current tree, but the sized-enum change has not been built, so
   nothing about the self-compile under the new type is measured here.
3. **`br_table` formation.** Both switch shapes measured emit `br_if` chains at
   `-O0` and `-O3`; whether Binaryen ever forms a table for a denser u8 enum is
   unmeasured and unrelated to this phase.
4. **The `@managed struct` layout path** was reasoned about (same layout code) but
   not probed with an enum field.
5. **A sized enum in an `@external` signature** — the byval/C-ABI boundary — was
   not probed; `@inline struct` boundaries refuse single-field records for a
   related reason, and the same question would need its own measurement.
6. **The exact diagnostic wording** for the two new refusals; this scoping names
   what they must say, not the strings.

---

## 19. Method — exact commands

Environment: this machine, node v24.21.0, 2026-10-27, base `98305208`, in
`git worktree add -b docs/sized-enums-scope /tmp/se`. **`dist/` had to be built
first**: without it, `bin/tensionscript.js` dies with `ERR_MODULE_NOT_FOUND` and a
`grep -E "^ERROR"` finds nothing — six probes "passed" vacuously before the build
was run. Recorded because it is the same trap the primary checkout set in a
previous session; a clean-looking grep is not evidence.

```
npm run build
node bin/tensionscript.js probe.ts --textFile probe.wat --debug -O0
node bin/tensionscript.js probe.ts --noEmit
```

Probes: `sizeof`/`alignof` of an enum and of `u8`; the three record shapes with an
enum field and with `u8` substituted; `E[3]`; a switch over an i32-backed enum and
over `u8`; the four cast directions; `const enum` inlining; `A = 2147483648`;
`let x: u8 = 300 / -1 / 200`; `let x: i32 = 2147483648`; the `AS200` wire-record
case; a narrow global's emitted form.

Counts are `grep -c` over `src/`, `std/`, `tests/`, with the patterns stated
inline where the number is used.

---

## 20. Recommendation

**Build it, and build it as one small phase.** The measurement that decides this is
§10: the enum *is* its `Type`, so the feature is a repoint rather than a layout
rewrite — 55 `byteSize` readers, zero changes; switch, casts and records, zero
changes each. What remains is ~55 mechanical lines and the two refusal rules,
which are where the value is: `w.e = E.B` into a one-byte field stops being
`AS200`, and `A = 300` in a `u8` enum stops being a silent 44.

Order inside the phase, smallest irreversible step first:

1. **Parser + AST + the refusal for a non-integer underlying type.** Syntax that
   cannot yet change a layout — and a fixture asserting the refusal, so the
   grammar's new arm is pinned before anything depends on it.
2. **The type repoint** (`Enum`/`EnumValue` constructors, the resolver arm) with a
   `sizeof`/`alignof`/`offsetof` fixture set. This is the commit where existing
   enums must be *provably* unchanged — the whole 108-enum corpus is the
   regression test, and `npm test` already compiles it.
3. **`compileEnum`'s 11 spots + the overflow refusal** (`const enum` included,
   since it masks).
4. **`ensureEnumToString`'s 4 spots** and the wire-record / SROA / `T[N]` fixtures.

**Do not fold in** signed-narrow support, nominal enum identity, or an i32-overflow
refusal. Each is a separate decision with its own compatibility surface, and the
i32 wrap in particular is pre-existing behaviour that code may rely on.

**Measure the engine's enum widths before any wire record adopts this**, and treat
that as a separate gate rather than a reason to delay the language feature.
