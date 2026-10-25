# Memory-model conversions — scoping

**Status:** scoping only. No source changed, no plan, no code beyond this document.
**Base:** TensionScript `origin/main` @ `65d8b774` (PRs #17 and #18 merged).
**Method.** Every number below was measured on that tree with a fresh worktree
(`/tmp/ts-memconv`), `npm run build`, then probes compiled with this tree's
compiler. Probes are cited by the fact they establish; the programs are short
enough to reproduce from the description.

---

## 0. The answer up front

**Two of the three premises in this scoping's briefing do not survive
measurement.** Both matter, and one of them decides the version.

1. **Plain `struct` is `@unmanaged`, not `@managed`.** The parser injects
   `@unmanaged` at `src/parser.ts:408` (`withUnmanaged`), and the code records
   that the 0.9.0 change to a managed default was **cancelled**:

   ```
   // No deprecation warning. 0.8.x warned (TS6385) that a plain `struct`
   // would become a managed type at 0.9.0; that change is cancelled.
   // `struct` means `@unmanaged struct` permanently...
   ```
   (`src/parser.ts:414-423`)

   Measured: `struct Plain { x: i32; y: i32; }` allocates with
   `~lib/rt/tlsf/__alloc`, crosses as one `i32`, and carries no GC header. The
   briefing's "plain `struct` = `@managed` default (0.9.0 semantic, zero
   migration)" describes a change that was considered and explicitly rejected.
   **Adopting it now would be breaking, not zero-migration** — see §5.

2. **The matrix is 9 cells, not 12.** The grid is 3 source models × 3 target
   models. The "12" is reachable only by splitting the `@inline` row into
   *within-function* and *across-a-boundary*, which are two implementations of
   one semantic cell, not two cells. §1 reports the 9 and lists the boundary
   sub-states separately.

What does hold:

- **Item 7 is a clean "additive".** A pre-type decorator (`v: @inline V`) is
  refused at **every** type position — `TS1110 "Type expected"` (param, local,
  field, return) or `TS1109 "Expression expected"` (`changetype<…>`, `Array<…>`,
  which parse as expressions first). No program that compiles today contains
  one. Accepting them changes no existing output. **→ minor (0.10.0).**
- **Item 1's size:** of the 9 cells, **3 are shipped** (`@inline → @inline` SROA,
  `@inline → @unmanaged` temp, `@managed → @unmanaged` identity), **2 more are
  free identity** (`@managed → @managed`, `@unmanaged → @unmanaged`), **2 share
  one gated mechanism** (the byval prologue already does the field loads, so
  `@managed`/`@unmanaged → @inline` is a gate, not a new emitter), **1 is
  absent** (`@inline → @managed`, alloc + copy), and **1 is refused by the type
  checker but reachable through `changetype` with no diagnostic** (a soundness
  hole, §1.4). Three shipped, five cheap, one real emitter.
- **Item 4 has a live gap:** `@managed @unmanaged` is refused (`TS6390`), but
  `@inline @managed` is **accepted silently** and produces a hybrid — the
  `InlineStruct` flag plus `itcms/__new` allocation. §4.

**Recommendation: proceed as 0.10.0, in three sub-phases, and take the default
question back to the user.** The override mechanism is additive and small; the
`@inline → @managed` conversion is real codegen; and the "managed default" is a
breaking change that the source says was already cancelled once. §9.

---

## 1. The conversion matrix (item 1)

### 1.1 The grid, with the current state of every cell

`From` is the declared memory model of the value; `To` is the model the use-site
asks for. "Shipped" means codegen that performs the conversion exists and runs;
"gated" means the mechanism exists but is selected by the declaration's flag, so
a use-site override cannot reach it.

| From \ To | `@inline` | `@managed` | `@unmanaged` |
|---|---|---|---|
| **`@inline`** | **shipped** — SROA copy (locals) | **absent** — alloc + copy | **shipped at boundaries** — call-temp + copy |
| **`@managed`** | **gated** — byval prologue field loads | **free** — identity | **free** — same pointer (rooting differs) |
| **`@unmanaged`** | **gated** — same byval prologue | **refused** by the type checker, **reachable** via `changetype` | **free** — identity |

### 1.2 The shipped cells, cited

**`@inline → @inline` (SROA copy).** `let q: P = p` copies field-by-field into
fresh locals; a mutation through `q` does not reach `p`. Measured: a two-field
`@inline struct` parameter binds `(local $1 …)` and the copy binds a second
pair, and `q.a = 9` writes only the second. Emitted by the SROA path
(`src/compiler.ts` field-local machinery, `addLocal` at `program.ts:4267` from
PR #13/#14). Also shipped across a *guest* call with the same signature.

**`@inline → @unmanaged` (the `@external` temp, PR #16).** At an `@external`
boundary, each `@inline` parameter is materialised on the call-temp stack:

```
;; from the probe: @external("host","takeV") declare function extV(v: V): f32
local.get $0
f32.load
local.set $3            ;; field a → local
local.get $0
f32.load offset=4
local.set $4            ;; field b → local
...
i32.const 16            ;; sretSizeOf: (fieldBytes + 15) & ~15
local.get $5
i32.add
...
local.get $3
f32.store               ;; temp.a = local
...
call $p8-external/extV  ;; one (param i32)
```

The temp size is `sretSizeOf` (`src/compiler.ts:11366-11369`):
`(classReference.nextMemoryOffset + 15) & ~15` — **16 bytes for an 8-byte
record**, per parameter, per call, allocated on `$sretStackPointer` and released
after the call. Sizing sites: `src/compiler.ts:7002` (`total +=`) and `:7018`
(`externalOffset +=`).

**`@managed ↔ @unmanaged` (identity, same pointer).** Measured: both are
`(param i32)`; `sizeof` is the same **8** for the same two-`i32` layout in all
three models, and the reference is the identical word. What differs is *not* the
conversion but the surrounding obligations:

- `@managed` is allocated by `~lib/rt/itcms/__new` and is **re-rooted on the
  shadow stack at every field access** — the `@managed` parameter body does
  `__stack_pointer - 4`, store, load, then the accessor, where the `@unmanaged`
  body does a bare `local.get; call …#get`.
- `@unmanaged` is allocated by `~lib/rt/tlsf/__alloc` and needs no rooting.

So the conversion costs **zero instructions**; the *choice* costs a root-store
per access on one side and a collector-invisible pointer on the other.

### 1.3 The gated cell: `@managed` / `@unmanaged` → `@inline` (field loads)

The mechanism **already exists** and is the same one the export mirror uses.
`sum(v: V)` for an `@inline struct` emits a byval prologue that reads each field
from the incoming pointer into its SROA local
(`tests/compiler/interop/inline-struct-export-param-byval.debug.wat:14-26`):

```
(func $…/sum (param $v$byval i32) (result f32)
  (local $v$a f32) (local $v$b f32)
  local.get $v$byval
  f32.load
  local.set $v$a
  local.get $v$byval
  f32.load offset=4
  local.set $v$b
  ...
```

That is precisely "pointer → inline": the record stays in memory and the value
is reconstructed into locals. It is **gated on the declaration's flag**, not on
the use site — `isInlineStructType` (`src/compiler.ts:11200-11202`) and
`Signature.isInlineStructRef` (`src/types.ts:1204-1208`) read
`classReference.hasDecorator(DecoratorFlags.InlineStruct)`.

For a `@managed` or `@unmanaged` declaration the prologue is never emitted: all
three cross as `(param i32)`, but only the `@inline` one copies. Measured with
three structurally identical records in one module: `takeU`/`takeM` read through
`#get` accessors on the pointer; `takeV` copies to locals first.

**Constraint on the target:** `@inline` refuses a GC-reference field today
(`AS100: a GC-reference field in an @inline struct (a bare local.set skips the
write barrier; deferred)`, `src/compiler.ts:11815`). So this cell is
*scalar-record only* until that lands. A `@managed` record with a `string` field
cannot convert to `@inline`.

### 1.4 The refused cell, and the hole under it

`@unmanaged → @managed` is refused by the type checker (`TS2322`, measured), and
the reason in the briefing is right: the collector cannot trace a `tlsf`
allocation — it has no `itcms` header, so a traced reference to one reads a
header that is not there.

**But the refusal is not enforced at the runtime boundary.** `changetype<M>(u)`
compiles to a bare passthrough:

```
(func $p5-unmanaged-to-managed/conv (param $0 i32) (result i32)
  local.get $0
  return
)
```

No diagnostic, no check. `changetype` is an intentional escape hatch, so this is
not a defect in `changetype`; it is a statement that **the "REFUSED" cell is
refused only in the type-directed path**. Any override work must decide whether
it also closes the `changetype` route (it should not — but the scoping's
recommendation must not promise a safety property the language does not
provide).

### 1.5 The absent cell: `@inline → @managed` (alloc + copy)

Nothing converts implicitly. `let m: M = v` is `TS2322` plus
`AS100: reading an @inline struct value as a whole`. It **can** be done by hand,
and the manual form works today:

```ts
let m = new M();
m.a = v.a;
m.b = v.b;
```

Measured: this emits the `@managed` constructor (`itcms/__new`, shadow-stack
rooting) then per-field stores — i.e. every piece of the conversion exists as an
ordinary statement sequence. What is missing is an *emitter* that produces that
sequence from a single conversion expression, plus write-barrier handling for
GC-reference fields on the target (the target `@managed` may hold them; the
source `@inline` cannot).

### 1.6 The remaining implicit-conversion measurement

One probe wrote all five cross-model assignments. Every one failed — there is
**no implicit conversion in any direction today**:

| Assignment | Diagnostic |
|---|---|
| `let a: M = v` (`@inline`→`@managed`) | `TS2322` + `AS100 reading an @inline struct value as a whole` |
| `let b: U = v` (`@inline`→`@unmanaged`) | `TS2322` + same `AS100` |
| `let c: U = m` (`@managed`→`@unmanaged`) | `TS2322` |
| `let d: M = u` (`@unmanaged`→`@managed`) | `TS2322` |
| `let e: V = m` (`@managed`→`@inline`) | `AS100 initialising an @inline struct local from this expression` |

So the matrix's "free" cells are free in *codegen* but not in *syntax*: the
compiler will not let you express them. That is the actual gap the phase
closes, and it is a type-system surface as much as a codegen one.

---

## 2. The parser (item 2)

### 2.1 Where types are parsed

Every type reference in the grammar funnels through **one** function,
`Parser#parseType` (`src/parser.ts:601`). There are **27** call sites, covering:

| Position | Site(s) |
|---|---|
| variable declaration `let x: T` | `parser.ts:1172` |
| parameter | `parser.ts:1584` |
| `this:` parameter | `parser.ts:929`, `:1451` |
| return type (declaration) | `parser.ts:1707`, `:1826` (arrow), `:2554` (method) |
| field | `parser.ts:2692` |
| index signature `[key: K]: V` | `parser.ts:2760`, `:2771` |
| function type `(a: A) => R` | `parser.ts:645`, `:671`, `:695`, `:752`, `:780`, `:1043` |
| `extends` / type-parameter default | `parser.ts:1382`, `:1954`, `:1395` |
| type alias | `parser.ts:3858` |
| type arguments — `new T<…>`, `changetype<…>`, `Array<…>` | `parser.ts:4420` |
| assertion `<T>expr` | `parser.ts:4293` |
| `as T` / `is T` | `parser.ts:4498`, `:4521` |
| function-expression parameter | `parser.ts:4153` |

This is the structurally important result: **the grammar has a single chokepoint
for type references**, so "accept a decorator before a type" is *one* change at
`parseType`, not 27. What it does not give is per-position policy — `extends` and
a type alias must not take a memory-model override, so the accept-then-validate
split (parse broadly, diagnose per position) is required.

### 2.2 Pre-type decorators: refused everywhere today

`parseType` opens with `let token = tn.next()` and switches on it; there is no
`@` case. Probed at all five positions with `@inline`, `@managed`, `@unmanaged`
and `@final` — every combination reports `TS1110 Type expected` (or `TS1109
Expression expected` where the grammar parses an expression first):

```
v: @inline V        → TS1110 Type expected
let x: @inline V    → TS1110 (×2) + TS1012
f: @inline V        → TS1110
(): @inline V       → TS1110
changetype<@inline V> → TS1109
new Array<@inline V>() → TS1109
```

No file in `tests/`, `examples/`, `src/`, `std/` contains a pre-type decorator
(the only grep hits are `@` characters inside string literals in the URI tests).

### 2.3 Post-type attributes: accepted, unvalidated — the `@fieldOffset` trap

`parseType` ends with a loop (`src/parser.ts:871-886`) that attaches **any**
`@name` on the same line to `type.attributes`:

```ts
while (tn.peek() == Token.At && !tn.peekOnNewLine()) {
  tn.next();
  let attribute = this.parseDecorator(tn);
  if (!attribute) break;
  if (!type.attributes) type.attributes = [ attribute ];
  else assert(type.attributes).push(attribute);
}
```

Only `@abi.alias` is ever consumed (`src/builtins.ts:1461-1486`, matched by exact
dotted spelling); everything else is silently dropped. Measured:

- `x: f32 @totally.bogus("q")` — **compiles, zero diagnostics**.
- `v: V @inline` where `V` is `@unmanaged` — **compiles**, and the parameter is
  `(param i32)` with no byval prologue: the attribute is ignored.
- The permissiveness is *tested*: `tests/parser/type-attributes.ts` contains
  `bare: i32 @custom;` deliberately.

So today there are two spellings, one refused and one ignored:

```
v: @inline V     → parse error (safe: cannot be silently misread)
v: V @inline     → accepted, meaning nothing (the trap)
```

Any design must choose which channel carries the override. §9 recommends
pre-type only, plus a diagnostic for the post-type spelling — but note that
diagnostic is a (tiny) behavior change, because `@custom`-style attributes are
deliberately accepted.

---

## 3. The resolver (item 3)

### 3.1 Where the model lives today

Entirely on the **declaration**, in `ClassPrototype.decoratorFlags`:
`InlineStruct` (`1 << 12`), `ManagedStruct` (`1 << 11`), `Unmanaged`
(`1 << 4`). Set in `Program#initializeClass` (`src/program.ts:2148-2176`), with
`@unmanaged` injected by the parser for a plain `struct` (`parser.ts:408`). No
use-site node carries a model: `resolveType` (`src/resolver.ts:148-190`)
dispatches on the node kind and **never reads `node.attributes`**.

### 3.2 The obstacle: types are interned per class instance

`Resolver#resolveClass` (`src/resolver.ts:3426`) keys instances by
`(prototype, typeArguments)`:

```ts
let instanceKey = typeArguments ? typesToString(typeArguments) : "";
let instance = prototype.getResolvedInstance(instanceKey);
if (instance) return instance;          // :3440
...
prototype.setResolvedInstance(instanceKey, instance);   // :3451
```

A `Type` is therefore **shared by every use of the class**. An override cannot
be applied to the `Type` in place — `@inline V` and a plain `V` would then be
the same object. Two shapes are possible:

- **Intern by override** — fold the model into `instanceKey`. This mints a
  second `Class` instance for the same prototype: a second set of members, a
  second vtable id, a second name. Almost certainly wrong.
- **Carry on the use** — leave the `Type` alone and thread the override with the
  *use* (parameter / local / field node), so codegen asks "what model does this
  use ask for?" rather than "what is this type?". This is the recommended shape:
  no new type identity, no interning change, and the decision is local to the
  places that actually emit code.

### 3.3 Site count

Distinct sites that read a memory-model flag: **59** across `compiler.ts` (20),
`program.ts` (16), `types.ts` (9), `builtins.ts` (7), `resolver.ts` (6),
`parser.ts` (1).

Of those:

- **3 chokepoints** carry most of the traffic:
  `Compiler#isInlineStructType` (`compiler.ts:11200`, 11 callers),
  `Signature.isInlineStructRef` (`types.ts:1204`, 8 callers),
  `Signature.fieldCountOf` (`types.ts:1213`, 4 callers).
- **13** call `hasDecorator(DecoratorFlags.InlineStruct)` directly, bypassing
  the chokepoint — about 4 of those are declaration setup (`program.ts:2184`,
  `:2221`; the definitions at `compiler.ts:11202`, `types.ts:1207`), the rest
  are real use-site decisions.
- The `ManagedStruct` / `Unmanaged` reads are mostly declaration validity
  (`@unmanaged` cannot implement interfaces, cannot be `instanceof`-ed, etc.)
  and allocation choice.

**Order of magnitude: 10s, not 100s.** Realistically ~25-40 sites take an
override parameter (3 chokepoint signatures + their 23 callers + the 9-10 direct
flag reads). The declaration-side reads do not move.

### 3.4 Signature construction is the pinch point

The boundary decision is made at **signature** time, before any body is
compiled (`src/resolver.ts:3196-3215`):

```ts
let externalBoundary = prototype.hasAnyDecorator(External|ExternalJs) &&
  signatureHasMultiFieldInlineStructParam(parameterTypes);      // :3197
let exportByValParams = prototype.is(ModuleExport) &&
  ... && signatureHasMultiFieldInlineStructParam(parameterTypes); // :3204
```

and `signatureHasMultiFieldInlineStructParam` (`:4158-4170`) sees only
`Type[]` — the parameter **nodes** (and their attributes) are not passed. So an
override must be resolved into the signature contract, which is a `Signature`
change rather than a codegen change. That is the one place where this stops
being a local edit. §6.

---

## 4. The combination diagnostic (item 4)

### 4.1 What exists

`@managed` + `@unmanaged` on a struct is **already** a diagnostic, at the
parser, on the `struct` keyword (`src/parser.ts:394-408`):

```
TS6390: A struct cannot be both '@managed' and '@unmanaged'.
```

It is reported and parsing continues, deliberately: "the two markers select
different runtime kinds, so there is no reading in which both hold, and stopping
here would cascade a parse error through the rest of the file."

The general decorator machinery is `Program#checkDecorators`
(`src/program.ts:1977-2007`): an unaccepted decorator is
`Decorator_0_is_not_valid_here` (AS212), a repeated one is `Duplicate_decorator`.

### 4.2 What does not exist — and is a live gap

**`@inline @managed` is accepted with no diagnostic**, and produces a hybrid:

```
@inline @managed struct IM { a: f32; b: f32; }
→ sizeof<IM>() == 8
→ allocates via ~lib/rt/itcms/__new   (managed)
→ element has DecoratorFlags.InlineStruct  (value-type codegen would apply)
```

`declaredInlineStruct` is true (`parser.ts:412` / `program.ts:2148`) and
`@managed` passes the accepted-flag list (`program.ts:2160-2166`), so both flags
land. Every `isInlineStructType` path then treats it as a value while its
allocation is GC-managed — a combination with no defined semantics.

`@inline @unmanaged` is fine (redundant-but-valid; `@inline` implies unmanaged).

### 4.3 Where the use-site check belongs

Two candidates:

- **Parser**, beside TS6390. The contradiction is syntactic ("these two markers
  cannot both hold"), the parser already owns the one existing case, and the
  range to report on is the decorator list. `TS6391` is free (6390 is the only
  code in 6370-6420).
- **Resolver/program**, via the accepted-flag set. More extensible, but the
  parser can already see the whole decorator list at the point of use, and a
  resolver pass would report later and at a less precise range.

**Recommendation: parser, mirroring TS6390**, with a distinct message per
contradictory pair (`@inline`+`@managed` today; a third model later would extend
the same table) — and, separately, close the existing `@inline @managed`
declaration hole with the same check, which is a small behavior change for a
declaration that currently means nothing.

### 4.4 Existing multi-decorator sites

**Zero.** No `@inline @managed`, `@inline @unmanaged` or `@managed @unmanaged`
appears in `tests/`, `examples/`, `src/`, `std/`. Closing the `@inline @managed`
hole breaks nothing.

---

## 5. The default question (item 5)

### 5.1 Measured: plain `struct` is `@unmanaged`

The measurement, not the reading:

```
struct Plain { x: i32; y: i32; }
export function make(): Plain { return new Plain(); }
```

emits

```
(func $…/make (result i32)
  i32.const 0
  call $…/Plain#constructor
  return)
(func $…/Plain#constructor (param $0 i32) (result i32)
  ... i32.const 8
      call $~lib/rt/tlsf/__alloc      ;; NOT itcms/__new
```

and the parameter crosses as `(param i32)`. Contrast the same layout under
`@managed`: `~lib/rt/itcms/__new` plus a shadow-stack root at every access.

The source agrees and records the decision (`src/parser.ts:414-423`): the
deprecation warning that promised a managed default at 0.9.0 is gone, and
"`struct` means `@unmanaged struct` permanently".

### 5.2 How many declarations that default covers

| Form | Count |
|---|---|
| plain `struct X` (no decorator) | **6** |
| `@unmanaged struct` | 50 |
| `@managed struct` | 41 |
| `@inline struct` | 161 |

The 6 plain declarations are all fixtures:

```
tests/parser/type-attributes.ts:26            struct Mixed {
tests/parser/struct-keyword.ts:14             struct Borrowed {
tests/compiler/interop/struct.ts:16           struct Record_ {
tests/compiler/interop/struct-reserved.ts:26  struct Warned {
tests/compiler/interop/fixed-array-bound.ts:11 struct ConstBound {
tests/compiler/interop/abi-alias.ts:16        struct Aliased {
```

**What the flip would actually break, measured.** Each fixture was compiled
unchanged and again with only the decorator added (`struct X` → `@managed
struct X`), both through the same CLI so the harness flags cancel:

| Fixture | `struct` → `@managed struct` | Why |
|---|---|---|
| `interop/struct.ts` | **output changes** (+98/−24) | the record is passed through `writeB`/`readB`/`readC`, so it gains a shadow-stack root at entry (23 changed lines), plus `__stack_check` and the `abort` import |
| `interop/struct-reserved.ts` | **byte-identical** | the record is only measured (`sizeof`/`offsetof`), never passed or allocated |
| `interop/abi-alias.ts` | **byte-identical** | same |
| `parser/struct-keyword.ts` | **AST assertion fails** | asserts `struct` dumps as `@unmanaged class` |
| `parser/type-attributes.ts` | **AST assertion fails** | same (`Mixed`) |
| `interop/fixed-array-bound.ts` | unaffected | expects `TS1005`; never compiles |

**The suite is nearly blind to this flip, and that is the finding.** Only one of
the three byte-compared fixtures notices. Worse, `struct.ts`'s own runtime
assertions — `sizeof<Record_>() == 24`, `offsetof == 24`,
`sizeof != sizeof<usize>()` — **still pass**, because `sizeof` reports the record
*extent* for a `@managed struct` too (24), not the reference width. Measured:
`sizeof` is 4 for a managed **class**, and 8/8/8 for `@managed` / `@unmanaged` /
`@inline` structs of the same two-field layout.

So the default is pinned by *checked-in bytes*, not by any assertion that
distinguishes the two models. A flip plus a fixture regeneration would go green
and change the ABI silently. Outside this repo, every downstream `struct` user
changes allocation class, tracing, and what `changetype<Record>(ptr)` means — the
raw-pointer wire idiom in `struct.ts` becomes an instance of the refused
`@unmanaged → @managed` cell (§1.4).

### 5.3 The honest reading

The briefing's ratified decision — "plain `struct` = `@managed` default (0.9.0
semantic, zero migration)" — is **not the shipped state and cannot be
zero-migration**. It is the change that `parser.ts:414` says was cancelled. Two
things follow:

- If 0.10.0 adopts it, 0.10.0 is **breaking**: an unknown external corpus changes
  allocation class, plus the in-tree breakage measured above. The migration is
  "add `@unmanaged` to every plain `struct`" — mechanical, but user-facing — and
  the tree's own test suite under-reports it (§5.2), so the migration cannot be
  measured by running the suite.
- If 0.10.0 keeps the shipped default, the override work is purely additive and
  the version stays minor.

**Recommendation: keep `@unmanaged` as the `struct` default.** It is what ships,
what the code documents as permanent, and what the fixtures' checked-in bytes already encode.
Treat "managed default" as its own decision, taken explicitly, with the fixture
migration and a major-version note — not as a premise smuggled into an additive
phase. The "what if" is measured above: 6 fixtures today, plus external users,
plus a permanent split between `struct` (unmanaged) and `@managed struct`.

---

## 6. The `@external` boundary (item 6)

### 6.1 The three shipped shapes, measured

One module, three structurally identical records, three `@external` declarations:

| Declaration | Import signature | At the call site |
|---|---|---|
| `extV(v: V)` — `@inline` | `(param i32)` | fields → locals → 16-byte call-temp → pointer |
| `extM(m: M)` — `@managed` | `(param i32)` | pointer passed directly, **stored on the shadow stack** to root it across the call |
| `extU(u: U)` — `@unmanaged` | `(param i32)` | pointer passed directly, no rooting |

All three are `(param i32)`; the differences are the copy (inline), the rooting
(managed), and neither (unmanaged). This is the shipped state the briefing
describes, confirmed.

### 6.2 The machinery reads the declaration, not the use

Both boundary decisions read the resolved `Type` and then the declaration flag:

- `signatureHasMultiFieldInlineStructParam(parameterTypes)`
  (`src/resolver.ts:4158-4170`) → `Signature.isInlineStructRef(type)` →
  `type.classReference.hasDecorator(DecoratorFlags.InlineStruct)`
  (`src/types.ts:1204-1208`).
- The refusals in `Compiler#compileFunction` (`compiler.ts:1748-1795`) use
  `Signature.isInlineStructRef` and `this.isInlineStructType` — again the
  declaration's flag.

**No code path consults the parameter node's type attributes.** The closest
existing analogue to a use-site override is a post-type attribute, and it is
ignored. Measured:

```
@unmanaged struct U { a: f32; b: f32; }
@external("host","takeU") declare function extU(u: U @inline): f32;
→ (import "host" "takeU" (func … (param i32) (result f32)))
→ sretStackPointer references in the call site: 0
```

The `@inline` was accepted and had no effect: no temp, no field copy, plain
pointer. So the answer to "does the current boundary machinery respect use-site
overrides?" is **no — it cannot, because it never looks**, and the one existing
override-shaped signal (a type attribute) is dropped on the floor.

### 6.3 Consequence for the design

`externalBoundary` and `exportByValParams` are computed **at signature time**
(`resolver.ts:3196-3215`) from `Type[]`. To honour an override, the override has
to be part of what the signature is built from — either by making the resolver
resolve the override into a distinct `Type` (the interning problem, §3.2) or by
extending `Signature` to carry a per-parameter model. This is the single most
structural cost in the phase, and it is why §9 splits it into its own sub-phase.

---

## 7. Behavior neutrality and the version boundary (item 7)

### 7.1 Pre-type acceptance is additive

- `@foo Type` is `TS1110`/`TS1109` at every position (§2.2).
- No file in the tree contains a pre-type decorator (§2.2).
- Therefore **no program that compiles today can be affected** by accepting it.
  → **minor (0.10.0).**

### 7.2 The post-type spelling is the one caveat

`v: V @inline` parses today and is ignored (§2.3). It appears **zero** times in
the tree — measured by grepping for a memory-model name in post-type position
(five grep hits were all comments or diagnostic strings). So:

- Giving the post-type spelling a meaning changes **no in-tree program**.
- It *would* change behavior for any external code that wrote the ignored form.
  That is a real, if narrow, compatibility risk — an empirical fact about the
  corpus, not a language guarantee.

Two ways to handle it, both defensible:

- **Recommend pre-type only, and diagnose the post-type memory-model spelling**
  ("memory-model decorators precede the type; `V @inline` is not an override").
  This is a behavior change only for code that is currently silently
  meaningless, which is the right trade.
- **Leave post-type alone** and document it. Cheaper, but leaves the trap.

### 7.3 What the version decision actually is

The override **mechanism** is minor. The **default** change (§5) is breaking.
The two must not be bundled: bundling them makes an additive feature carry a
breaking one, and the briefing's "0.10.0's headline" would then be a major in a
minor's clothing.

**→ 0.10.0 for the mechanism; the default is a separate, explicit decision.**

---

## 8. What forces a "no"

Each of the briefing's three conditions, measured:

1. **"The override changes emitted output for existing code."** — **Not
   triggered** for the pre-type form (parse error today → additive). **Triggered**
   for the default change (§5.2: measured per fixture; plus an external corpus
   the suite cannot see), and
   *potentially* triggered for the post-type spelling if it is given meaning
   (§7.2 — zero in-tree, external risk only).
2. **"The non-free cells' codegen is phase-sized."** — **Partly triggered.**
   `@managed`/`@unmanaged → @inline` is a gate change on a mechanism that
   already runs (§1.3) — small. `@inline → @managed` is a new emitter (alloc +
   per-field store + write barriers for GC fields) — one focused phase, not
   obviously two (§1.5). Neither is 2.0-sized, but the first is not a one-line
   change either, because the boundary half of it is a `Signature` change
   (§6.3).
3. **"The parser change collides with the post-type grammar."** — **Not
   triggered, but adjacent.** Pre-type and post-type are different token
   positions and cannot collide grammatically. The collision is *semantic*: two
   spellings, one refused, one ignored (§2.3). That is a design decision, not a
   blocker.

**Nothing here forces a "no".** One thing forces a *split*: the default.

---

## 9. Recommendation

### 9.1 Proceed as 0.10.0 — in three sub-phases

**10.0a — the override surface, additive (minor).**
Pre-type decorator parsing at the single `parseType` chokepoint; per-position
allow-lists; the combination diagnostic (§4.3); thread the override through the
~25-40 use sites (§3.3) with the 3 chokepoints changed first; wire the three
free/gated cells:

- `@managed↔@unmanaged` — identity, but now expressible; carries the rooting
  decision (does an `@unmanaged` view of a `@managed` value still root? it must,
  or the collector can reclaim it mid-call).
- `@managed`/`@unmanaged → @inline` — reuse the byval prologue, now gated on the
  use-site model rather than the declaration flag. Scalar-record only (§1.3).
- `@unmanaged → @managed` — **stay refused**, and say so in the diagnostic
  (§1.4).

**10.0b — the boundary.**
`Signature` carries a per-parameter model so `externalBoundary` /
`exportByValParams` can honour an override (§6.3). This is the phase's hard
part: it changes a contract that the resolver, the compiler and the export
mirror all read. It should land on its own so that a regression in the boundary
is attributable.

**10.0c — `@inline → @managed` (alloc + copy).**
The new emitter (§1.5). Write barriers for GC-reference fields are the
interesting half; a scalar-only first cut is a coherent stopping point.

### 9.2 Keep the `struct` default, and take the default question back

§5. The shipped default is `@unmanaged`, the source says it is permanent, and
the fixtures encode it in bytes. Flipping it is a breaking change that belongs in its own
decision with its own migration, not inside an additive phase.

### 9.3 What this scoping could not measure read-only

- **Runtime GC behaviour of `changetype` across models** (§1.4). Compiling it
  needs no execution; *running* it needs a harness and would demonstrate the
  corruption rather than infer it. Not run.
- **The external corpus.** "Zero in-tree uses of the post-type spelling" is
  measured; what downstream code does is not knowable from this repo.
- **Whether `Signature` can carry a per-parameter model without a type-system
  change.** That is a design question for 10.0b, not a measurement.
- **The exact cost of the write-barrier path** in `@inline → @managed` with
  GC-reference target fields — the source `@inline` refuses those fields today,
  so the shape has to be decided before it can be measured.
- **The "12 cells".** The briefing counts 12; the grid is 9 plus boundary
  sub-states (§1.1). If a fourth model is intended, it is not named in the
  briefing and is not in the tree.

---

## 10. Summary of measurements

| # | Question | Answer |
|---|---|---|
| 1 | Matrix state | 3 shipped, 3 free-but-inexpressible, 2 gated (one mechanism), 1 absent, 1 refused-but-reachable |
| 2 | Parser surface | 27 call sites, **one** chokepoint (`parseType`, `parser.ts:601`); pre-type refused everywhere |
| 3 | Resolver propagation | 59 flag reads, 3 chokepoints, **~25-40 sites** to thread; order 10s |
| 4 | Combination check | `TS6390` exists (managed+unmanaged); **`@inline @managed` accepted silently** — gap |
| 5 | Default | plain `struct` = **`@unmanaged`**; managed default **cancelled** in source; flip changes 1 of 3 byte-compared fixtures, and its assertions still pass |
| 6 | `@external` | reads declaration flags only; use-site attribute empirically ignored; needs a `Signature` change |
| 7 | Version boundary | override **additive → minor**; default change **breaking**; keep them apart |
