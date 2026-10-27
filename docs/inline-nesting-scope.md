# Inline nesting — scoping

A field that holds another record **by value** instead of by pointer:

```ts
// the C shape no guest declaration can express today
struct Outer { uint8_t a; struct Inner b; };   // b at offset 8, Outer is 16 bytes

// today
@inline struct Inner { x: u64 }
@unmanaged struct Outer { a: u8; b: Inner }    // refused: "inline nesting is a later phase"
@unmanaged struct Outer { a: u8; b: Inner }    // as a pointer it would be 8 bytes, b at 4
```

Read-only scoping. Every number here was measured against `origin/main` at
`bcc95055` (PR #34's merge), with the compiler built from that tree. Probes are
listed in the appendix; each measurement names its source or its `.wat`.

---

## 0. The answer up front

**Scope: medium, two sub-phases, plus one downstream item.** Not one feature, and
not the feature this brief describes.

| | What it is | Size | Unblocks |
|---|---|---|---|
| **A** | Layout: an `@inline struct`-typed field inside any record; correct `sizeof`/`offsetof`/`alignof`; leaf read/write through a **memory** receiver; the cycle refusal | small–medium | C-interop records; `Transform { pos: Vec3f }` as a `@unmanaged` record; and it is the prerequisite for everything below |
| **B** | SROA: the same field inside a record used as a **value** (a local), where the inner's scalars become leaf WASM locals | medium (14 enumeration sites, no new representation) | `@inline struct` values that contain values; `@external`/sret temps of such a value |
| **C** | Closure capture of an `@inline` value | small **after A** | the deferred `closure-capture-of-inline` item |

Two corrections to the brief, both measured:

1. **There is no "@unmanaged inline nesting" for `@unmanaged`-typed fields, and
   there must not be.** A `@unmanaged struct` field is a 4-byte pointer, and that
   is the pointer model every existing record depends on: measured,
   `@unmanaged struct A { a: u8; b: B }` is 8 bytes with `offsetof(b) == 4`
   (p1) — byte-identical to `a: u8; b: usize`. Making that inline would be a
   breaking change to every record in both repositories. The feature is
   *"an `@inline struct`-typed field, inside any record"* — the field's **type**
   changes, not the outer record's decorator. So sub-phase A is not
   "@unmanaged nesting"; it is "inline field in a pointer-layout record", and it
   is where the C-interop payload lives.

2. **The transitive GC-ref refusal does not come for free.** The brief assumes
   the inner refuses to exist, so the outer cannot nest it. Measured: it does
   *not*. `@inline struct Bad { r: Node }` resolves and lays out (`sizeof<Bad>()`
   is **4**), and the refusal fires only when a *local* of it is declared
   (p8 vs p6). So nesting must actively re-refuse a leaf that is a GC reference,
   and the existing "skip a refused field" idiom — `if (!fieldLocal) continue;`
   (`compiler.ts:11822`, `:11898`, `:12093`, `:12177`) — would silently produce a **partial copy**
   instead of an error. That idiom cannot survive nesting.

**Recommendation: do A, then B, then C — but only if a consumer wants A.** The
engine has no nested record today (measured: 0 in 17 headers, 0 in 109 guest
sources), and it hand-flattens the shape it would use (§6). Inline nesting is a
keystone by *capability*, not by *demand*: the demand is documented in prose at
`tension-framework/assembly/ogre/wire.ts:455-459` and worked around with padding.

---

## 1. Tree state

- `origin/main` = `bcc95055` ("Merge pull request #34"). Worktree
  `/tmp/inline-nesting`, branch `docs/inline-nesting-scope`, clean.
- `npm install && npm run build` → 0; `dist/asc.js` present (the fresh-worktree
  trap: a probe against a missing `dist/` prints nothing and greps clean).
- Baseline suite: `npm run test:compiler` → **[ SUCCESS ]**, 70.2 s.
  `tests/compiler` holds **311** `.ts` fixture files.
- `@inline struct` declarations: **34** in `tests/`, **0** in `src/` + `std/`,
  **0** in the Tension engine's own sources. No declaration anywhere has an
  inline-typed field (that is the refusal), so **the layout branch in §2.3 cannot
  move an existing offset — by construction, not by care.**
- The scoping the brief cites, `docs/interop-scope-addendum-2.md`, **does not
  exist and never has** in this repository (`git log --all --diff-filter=A -- docs/interop-scope*`
  is empty). The layout-loop note it quotes is in
  `docs/interop-inline-struct-scope.md` §7.1-§7.2, and it is the §2.2 text below.

---

## 2. The twelve measurements

### 2.1 The refusals — one site, two reachability models

**One site.** `src/resolver.ts:3978-3981`, inside the layout loop:

```ts
this.program.checkInlineStructValue(
  fieldType, typeNode, "a field (inline nesting is a later phase)"
);
```

which reaches `src/program.ts:2101` and emits, at `:2111-2116`:

```
AS100: Not implemented: an @inline struct value in a field (inline nesting is a later phase) (value types are not implemented here yet; a pointer would alias)
```

Measured identical for four shapes — `@inline`-in-`@inline` (p3),
`@inline`-in-`@unmanaged` (p2), `@inline`-in-`@managed` (p4), and a class field
(p5b). `@inline` in `Array<T>` and `@inline` as `T[N]`'s element have their own
messages (`compiler.ts:1854`, `tests/compiler/interop/inline-struct-refusals.json`),
not this one.

**Two reachability models, and the difference matters for the phase.**

- The **nesting** refusal is emitted while a class is laid out, so it fires when
  the class is *resolved* — which happens when something uses it. Measured:
  `class Holder { inner: Inner }` with `Inner` `@inline`, never instantiated,
  **compiles clean** (p5, exit 0); add `new Holder()` and the refusal appears
  (p5b). A declared-but-unused field escapes.
- The **SROA** refusals (a `T[N]` field, a GC-reference field) live in
  `compileSroaLocal`, so they fire when a *local* of the type is declared
  (`compiler.ts:12230-12241`). Measured: `@inline struct Bad { r: Node }` and
  `@inline struct Arr { xs: u32[4] }` compile clean when nothing declares a
  local of them (p6b, p7b), and `sizeof<Bad>()` is 4 while `sizeof<Arr>()` is 16
  (p8). **The type has a layout and no usable value.** The refusal and `sizeof`
  disagree today.

Both gaps are the shape `tests/compiler/interop/inline-struct-sret-refusal-reach.ts`
was written for. The phase should add the nesting equivalent — and note that A
*removes* the nesting refusal, so its reach test must be re-pointed at the new
refusals (cycle, GC-ref leaf), not deleted.

### 2.2 The layout loop — the branch is two lines, and the brief's snippet is right

`src/resolver.ts:3919-3966`, per field:

```ts
let byteSize = fieldType.byteSize;          // :3919
...
let alignLog2 = fieldType.alignLog2;        // :3960   (pointer → 2)
assert(alignLog2 >= 0);
if (alignLog2 > classAlignLog2) classAlignLog2 = alignLog2;
let mask = (1 << alignLog2) - 1;
if (memoryOffset & mask) memoryOffset = (memoryOffset | mask) + 1;
boundInstance.memoryOffset = memoryOffset;
memoryOffset += byteSize;                   // :3966
```

and the round-up at `:4032-4045`, which finalizes `instance.alignLog2` and
`instance.nextMemoryOffset` for `Unmanaged | ManagedStruct`. The branch:

```ts
let classReference = fieldType.classReference;
let isInlineField = classReference != null &&
  classReference.hasDecorator(DecoratorFlags.InlineStruct);
let byteSize = isInlineField
  ? assert(classReference).nextMemoryOffset     // the value's extent
  : fieldType.byteSize;                         // today: a 4-byte pointer
let alignLog2 = isInlineField
  ? assert(classReference).alignLog2            // the value's own alignment
  : fieldType.alignLog2;
```

**Additive, measured by precedent.** The loop already takes a *whole extent* and
*element alignment* for an inline array, from the same two `Type` properties:
measured, `@unmanaged struct Ap { a: u8; arr: f32[4]; b: u8 }` gives
`sizeof 24`, `offsetof(arr) 4`, `offsetof(b) 20`, `alignof 2` (p12) — the array's
16-byte extent and 4-byte alignment, not a pointer's. The inline-struct branch is
the array branch with `(nextMemoryOffset, alignLog2)` for `(byteSize, alignLog2)`.
For every non-inline field both branches are the identity, and no declaration
can take the new branch (§1). `assert(alignLog2 >= 0)` holds; the mask math is
unchanged.

### 2.3 `sizeof` / `offsetof` / `alignof` — zero reader changes

All three read the numbers the loop writes:

- `builtin_sizeof` (`builtins.ts:1255`) returns `classReference.nextMemoryOffset`
  for `Unmanaged | ManagedStruct` (`:1274-1283`).
- `builtin_offsetof` (`:1341`) returns `property.memoryOffset` for a named field
  (`:1397`) and `classReference.nextMemoryOffset` for the no-argument form
  (`:1406`).
- `builtin_alignof` (`:1289`) returns `classReference.alignLog2` for the same two
  kinds (`:1329-1334`).

So the readers need **no change**: `offsetof<Outer>("inner")` stays the field's
starting offset, and `sizeof<Outer>` / `offsetof<Outer>()` follow the extent the
loop computes. The one reader that would break is a reader of a *field's* size,
and those are the codegen enumerators (§2.4) — not this group. Also
unchanged: `sretSizeOf` (`compiler.ts:11743-11746`) rounds `nextMemoryOffset` to
16, and the `@external` temp bumps by the same call (`:7248`, `:7268`), so a
nested record's temps grow with its extent for free.

### 2.4 SROA — no new representation; 14 recursive enumerations

**The representation already exists.** `Local.fieldLocals: Map<string, Local>`
(`program.ts:3866`), populated with one local per field under a synthetic name
`name + "$" + field.name` (`compiler.ts:12247`); the parent `Local` has index
`-1` and carries the map (`:12256-12257`), so a bare read of the value refuses
(`:8751-8758`) instead of aliasing. A record-typed field's `Property.type` *is*
the inner `Class`, which carries `members` (prototypes, with `.instance` the
bound `Property`), `memoryOffset`, `nextMemoryOffset` and `alignLog2` by the time
the outer's layout reaches it (§2.6). So a nested field needs **a recursive
enumerator over an existing structure**, not a new AST node or a new `Type`.

**Flat key or nested map?** Flat, measured by cost: `fieldLocals` is
`Map<string, Local>` in **16** statements across two files (`grep -n fieldLocals`),
and every one of them does `get(field.name)` or `set(field.name, …)`. A nested
sub-map changes the *type* of `Local.fieldLocals` and therefore all 16; a flat
key (`"inner$a"`) changes none of them and reads as `p$inner$a` in the WAT,
which extends the existing convention rather than inventing one. Flattening also
gives the arity for free: the value is its leaves, so "one operand per leaf" is
the same sentence as "one local per leaf".

**The sites that must recurse** (measured inventory, not an estimate):

| # | Site | What it enumerates for |
|---|---|---|
| 1 | `types.ts:1209` `Signature.wasmParamCountOf` | WASM arity of a value parameter |
| 2 | `types.ts:1312` `Signature.fieldCountOf` | the same, for an SROA argument |
| 3 | `types.ts:1420-1440` `Signature#paramRefs` | the WASM types, one per leaf |
| 4 | `program.ts:4160-4186` | leaf locals for an `@inline` parameter |
| 5 | `program.ts:4208-4232` | leaf locals for an export byval parameter |
| 6 | `compiler.ts:11600-11640` `expandSroaArgument` | the operands pushed at a call |
| 7 | `compiler.ts:11814-11820` `copyByValParamFields` | export prologue: pointer → leaves |
| 8 | `compiler.ts:11877-11900` `makeExternalTempArgument` | leaves → `@external` temp |
| 9 | `compiler.ts:12089-12095` `makeSretCallBlock` | sret slot → leaves |
| 10 | `compiler.ts:12169-12185` `compileSretReturnStatement` | leaves → sret slot |
| 11 | `compiler.ts:12744-12753` constructor initializers | `new P(field: …)` |
| 12 | `compiler.ts:12224-12255` `compileSroaLocal` | the local allocation |
| 13 | `compiler.ts:12315-12319` | `let q: P = p` copy |
| 14 | `compiler.ts:6306-6319`, `:6522`, `:10564` | assignment / field write / field read |

plus `isSroaFieldType` (`compiler.ts:12397-12405`), which is the leaf test and
must become "not a `T[N]`, not a GC reference, and — if a record — recursively
leaf-safe". Twelve of the fourteen are the same loop over
`classReference.members`; the recursion is one helper, `sroaLeavesOf(type)`,
returning `(path, Property)` pairs, replacing `Map_values(members)` in each.

**Hazard, and it is the one to design against.** Four of those sites silently
skip a field that has no local — `if (!fieldLocal) continue;`
(`compiler.ts:11822`, `:11898`, `:12093`, `:12177`) — because a refused field "was never
part of the value". With nesting, a nested field whose *inner* has a GC-ref leaf
would be skipped by exactly that line, producing a **partial copy** and no
diagnostic. The leaf enumerator must refuse, not skip.

**And one more, measured:** `@inline struct` fields get getter/setter prototypes
unconditionally (`program.ts:4439-4441`), but the value path never uses them —
measured, the SROA fixture's WAT contains `Inner#get:v` only for a pointer-model
`Inner`, and no getter for a value-type field. The compiler's own comment at
`compiler.ts:10596-10602` says why: the getter's return type has no value
representation. So a nested field's *read* must be the address form (§2.11), not
a getter call.

### 2.5 Alignment — the inner's is already computed; the field's is the pointer's

Measured (p1, `p1_pointer.wat`), with `@unmanaged struct B { x: u64 }`:

| | today | the value's own |
|---|---|---|
| `sizeof<B>()` | 8 | 8 |
| `alignof<B>()` | **3** | 3 |
| `sizeof<A>` for `A { a: u8; b: B }` | 8 | must be 16 |
| `offsetof<A>("b")` | **4** | must be 8 |
| `alignof<A>` | **2** | must be 3 |

`alignof<B>()` is 3 because PR #9 made the builtin read `Class.alignLog2`
(`builtins.ts:1329-1334`) after the loop accumulates it (`resolver.ts:3960-3962`).
So the inner's true alignment is already correct and already stored — the field's
`Type#alignLog2` is 2 because that Type describes the 4-byte reference. The
branch in §2.2 reads the stored value; no alignment computation is added.

### 2.6 The recursive-size hazard — no cycle check exists, and the failure is silent, not a hang

**Measured today:** `@unmanaged struct A { a: A; b: u8 }` compiles, `sizeof<A>`
= 8, `offsetof(a)` = 0, `offsetof(b)` = 4; mutual recursion (`M1 { m: M2 }`,
`M2 { m: M1 }`) compiles, `sizeof<M1>` = 8 (p13, `p13.wat`). There is **no field
cycle detection** — and no hang, because self-reference resolves through the
second branch of `resolveClass`: re-entry returns the pending instance
(`resolver.ts:3587-3590`, "This can return a class that isn't fully resolved
yet"). For a pointer field, 4 bytes is the right answer, so nothing showed.

**Derived (read, not executable until the feature exists):** for an inline field
the same early return hands back an instance whose `nextMemoryOffset` and
`alignLog2` are still their defaults — `program.ts:4780` (`nextMemoryOffset = 0`),
and `alignLog2` is assigned only at the end (`resolver.ts:4044`). So the branch
in §2.2 would read `(0, 0)`: the field takes 0 bytes, aligned 1, and
`sizeof<A>` is **0**, silently. Indirect recursion gives both records 0. That is
worse than a hang, and it is undetectable at the declaration by any existing
check.

**Where the check goes — measured available, no new pass.** `pendingClasses`
(`resolver.ts:3599`, the `resolveClassPending` set) is already in scope in the
layout loop and already used for exactly this question on other edges
(`:3652` base, `:3691` interface, `:3814`). The guard is:

```ts
if (isInlineField && pendingClasses.has(assert(classReference))) {
  // self- or mutual recursion through an inline field: the extent is not known
  // yet, and reading it would report 0
  this.error(DiagnosticCode.<new>, typeNode.range, "an @inline struct that contains itself by value");
  break;
}
```

It catches self-reference (A is pending while its own field is resolved) and
indirect recursion (A is pending while B's field is resolved) with one test. This
is the design answer to question 3: **at layout time, using an existing set** —
not a new declaration pass. What it does *not* catch is a cycle that never
resolves an extent at all (there is none — every cycle passes through a pending
instance).

### 2.7 The closure env class — the field is the blocker, and the refusal already proves it

`ClosureLowerTransform.makeEnvClasses` (`src/closure/lower.ts:2145`) synthesizes
one `ClassDeclaration` per scope, with one field per captured binding, typed by
the binding's own `TypeNode` (`:2189-2212`). A captured `@inline` value becomes a
field of that class — an inline field in a `@managed` record, i.e. §2.2.

**Measured:** capturing one fails *today*, with the **nesting** refusal, at the
local's declaration (p11b):

```
ERROR AS100: Not implemented: an @inline struct value in a field (inline nesting is a later phase)
 3 │ let p: P = new P();
   │        ~
```

That is the env class doing it — the local is lifted into the synthesized field,
and the field is refused. So the deferred item's cause is exactly §2.2, and the
phase that lifts it is A. (An unannotated `let f = () => p.x` reported `TS1110:
Type expected` in the first probe (p11) as well; the annotated form p11b reports
only the nesting refusal, so I record the `TS1110` as unverified — it may be a
cascade.)

**What A does not give closure capture:** the *store* into the env field. `env.p = p`
is a value → inline-heap-field assignment, which needs the leaf store path. That
is the same path A adds for `outer.inner = v` on a memory record (per-leaf stores
at `offInner + leafOffset`, no address for the value). So C is "A's write path,
in the env class" plus a leaf-safety test on the env class — small, but strictly
after A. B is not required for it: the env field is heap memory, not a local.

### 2.8 The GC-ref interaction — the *outer* must re-refuse; the prompt's transitivity does not hold

Measured (p6, p6b, p8):

- `@inline struct Bad { r: Node }` — the local is refused
  (`compiler.ts:12239`, "a GC-reference field in an @inline struct (a bare
  local.set skips the write barrier; deferred)"), but only when a local is
  declared; declared and unused it compiles (p6b), and `sizeof<Bad>()` is **4**
  (p8).
- `isManaged` on the field is what the SROA refusals test (`compiler.ts:12397-12405`).

So "the inner refuses to declare, so the outer cannot nest it" is **false**: the
inner's `Class` exists with a pointer-shaped layout and its members are
enumerable. If nesting lands without a leaf test, `Outer { inner: Bad }` would
lay out with `Bad`'s 4-byte GC pointer inside a value — a value type holding a
heap reference with no write barrier and no `__visit` entry, since the visitor
walks *fields of the class* (`builtins.ts:11200-11230`) and an `@inline` value is
not a field of its holder.

**Therefore the leaf test is not optional, and it is transitive by construction
if it recurses:** a leaf that `isManaged` refuses; a leaf that is a `T[N]`
refuses; a leaf that is a record is tested recursively. This is the same helper
§2.4 needs, used in two places.

**The `@unmanaged` case is unchanged:** a `@unmanaged` field may hold a pointer
to a GC object and that is the author's unsafe choice, exactly as today. Measured
(p14): a `@unmanaged` field reads and writes through the generated getter/setter,
4-byte width included. Nesting a *value* does not launder a pointer into one.

### 2.9 The `T[N]` interaction — nesting does not unblock it

Measured (p8): `@inline struct Arr { xs: u32[4] }` → `sizeof<Arr>()` = 16 and the
refusal at instantiation. Nesting `Arr` inside another record changes nothing
about the refusal: it lives in `compileSroaLocal`, and an inline struct nested in
a *memory* record is never SROA'd. The `T[N]`-of-`@inline` direction is blocked
elsewhere and also unchanged by nesting — `makeZero` still has **no**
`TypeKind.FixedArray` case (`compiler.ts:12407-12466`, `default: assert(false)`;
`grep FixedArray` in the body: 0 hits), which is the fill-path blocker the
`@inline` scoping filed as item 6.

So: inline nesting is a **prerequisite** for `T[N]` of `@inline struct`, not a
sufficient one. The brief's framing is right and the gap is wider than it says.

### 2.10 The C-interop consumer — no nested struct exists; the workaround is documented

Measured read-only against the engine (`~/work/Tension` at `3edf23c`):

- **17** first-party headers (excluding `third_party/`, `target/`, `zig-out/`).
  Nested struct members: **0**. The detector was controlled — a synthetic
  `struct S { int32_t a; tension_value probe; tension_value *p; tension_value arr[2]; }`
  reports all three shapes — and it reports nothing on the real headers. The
  guest-facing ABI records (`tension_core_api`, `tension_adapter`,
  `tension_solver_config`, the `tension_value` union) contain no record-typed
  member at all.
- **109** guest `.ts` files. Struct-typed fields: **0**. **37** struct
  declarations, every one flat.
- **0** `@inline struct` declarations anywhere in the engine.

**The driver is future, and the engine says so in prose.**
`tension-framework/assembly/ogre/wire.ts:455-459`:

> **Flat fields, like every other record here.** An AssemblyScript field whose
> type is a class is a *reference*: `position: Vec3f` would be a 4-byte pointer
> and this record would not be 64 bytes. The `Transformf` layout is written out
> instead, at the offsets `Renderable`'s inline transform already uses
> (16/32/48) …

and the shape is hand-flattened in four records: `Transformf` (`:90-103`,
twelve `f32` with `pad0`/`pad1`), `MotionUpdate` (`:463-479`), `BoneUpdate`
(`:486-501`), `Aabbf` (`:107-112`, `minX…maxZ`), `Mat4f` (`:81-88`, sixteen named
scalars), `Vec3f16` (`:45-50`, "a `Vec3f` padded to 16 bytes").

That is the strongest consumer evidence available short of a nested declaration:
the use case exists, is understood, and is paid for in padding and duplicated
field names. It is **not** a present C-header requirement, so the C-interop
driver is a *future* use case — say so, and let A's design be judged on that.

### 2.11 The `@unmanaged` (C-interop) case — the layout is half of it; the access path is the other half

Layout: §2.2 (`(nextMemoryOffset, alignLog2)`), with the numbers measured in
§2.5. Access, measured (p14, `p14.wat`):

```
// a scalar field of a pointer-model record: the generated accessor
(func $readB (param $s i32) (result i32)  local.get $s  call $S#get:b  return )
(func $writeB (param $s i32) (param $x i32)  local.get $s  local.get $x  call $S#set:b )

// an inline array field: address arithmetic, no accessor
(func $readArr (param $s i32) (param $i i32) (result i32)
  local.get $s  i32.const 8  i32.add  ... i32.load  return )
```

A nested record field must take the **second** shape, and the branch to copy is
already there: `compilePropertyAccessExpression`'s `TypeKind.FixedArray` case
(`compiler.ts:10609-10633`) returns `base + fieldOffset` and sets
`currentType` to the field's type, with the comment "an inline array field is
storage, not a value: there is nothing to read at the field's offset, only bytes
to address". The nesting path replaces the refusal immediately above it
(`:10596-10602`) with the same expression. The chained read `o.inner.x` then
resolves the inner's accessor against an **address** receiver —
`resolveSroaReceiver` returns `null` for a non-identifier
(`compiler.ts:11650-11657`), so the ordinary path calls `Inner#get:x` with
`this` = the address, which is a record's normal `i32` `this`. That is the
crux of A: **no value representation is ever requested, only addresses.**

Write-in: `o.inner = v` where `v` is an SROA value — per-leaf stores at
`offInner + leafOffset` from `v`'s leaf locals. The shape is
`compileSretReturnStatement`'s store-out loop (`compiler.ts:12169-12185`) with a
summed offset.

SROA involvement: **none** — an `@unmanaged` local is a pointer view (§2.4's
enumerators do not see it). This is why A is separable from B.

### 2.12 Three-way fixtures — all three sub-features have a specifiable partial cell

| Sub-phase | refuse (before) | partial (the half-fix ships) | fixed |
|---|---|---|---|
| **A** layout | the nesting refusal, per position (§2.1) | **size branch without align branch**: `A { a: u8; b: Inner{x:u64} }` → `sizeof 16` but `offsetof(b) 1` — a C-incompatible record that looks right in `sizeof`. Second partial: align without size → `offsetof 8`, `sizeof 12` | `sizeof 16`, `offsetof(b) 8`, `alignof 3` |
| **A** access | `o.inner` → `AS100` + `unreachable` (`:10597-10602`) | address computed but the read goes through the getter → `toRef` assertion or a 4-byte load of an extent field | `load8_u` at `offInner`, `store32` at `offInner + 4`, per leaf |
| **B** SROA | the local compiles as a 4-byte pointer and aliases (`let q = p` shares) | leaf locals allocated, copy only at depth 1 → the inner's leaves are zero or shared: `q.inner.x = 9` changes `p.inner.x` | one local per leaf, field-wise copy at every depth, no memory touched |
| **B** boundary | `@external` pass of a nested value: refused in A (named) | temp sized `nextMemoryOffset` but filled field-wise → the inner field's 4 bytes copied, tail garbage | temp filled leaf-wise; `(param i32)` unchanged |
| **C** closure | today's nesting refusal at the lifted local (p11b) | env field is inline, capture stores the *first* leaf only | env field inline, all leaves stored; mutating the source after capture does not change the captured copy |

The `A`-partial cells are the ones that matter most: they are the half-fix that
*publishes a wrong layout* while every `sizeof` assertion in a naive fixture
passes. The layout fixture must assert `offsetof`, not only `sizeof`.

---

## 3. Design, per sub-feature

### A. Layout + memory access (`@inline struct`-typed field in any record)

1. **Layout branch** (§2.2), two `Type` reads selected by
   `DecoratorFlags.InlineStruct` on the field's `classReference`.
2. **Cycle refusal** (§2.6) using the in-scope `pendingClasses` set; a new
   diagnostic code beside 6403/6404 (`TS6405`: "An `@inline struct` cannot
   contain itself, directly or indirectly, by value").
3. **Leaf test** `sroaLeavesOf(type): (offset, Property)[] | null` — refuses on a
   `T[N]` leaf and on an `isManaged` leaf, recurses on a record leaf. Used by A's
   write path now and by B's enumerators later, so it is one function.
4. **Read path:** replace `compiler.ts:10596-10602` with the array branch's
   `base + fieldOffset`. Keep the refusal for the *value* shapes A does not add
   (a whole-value read into a local; a pass across a boundary) — those are B.
5. **Write path:** leaf stores at `offInner + leafOffset` from a local value.
6. **Refusals A keeps by name** (so the partial state is a compile error, not a
   wrong number): a value read of the nested field (`let q: Inner = o.inner`), a
   pass of a value containing a nested field at `@external`/export/return, and
   the whole-value forms B lifts.

### B. SROA flattening (`@inline struct`-typed field in a value)

1. `sroaLeavesOf` becomes the single enumerator; the 14 sites in §2.4 iterate
   leaves instead of members. Flat keys (`"inner$a"`), one WASM local per leaf,
   `addLocal` per leaf (`compiler.ts:12245-12249` — the count is a property of
   the type, so nothing about allocation changes).
2. `isSroaFieldType` → `isSroaLeaf`, the same test A uses.
3. **Delete the `if (!fieldLocal) continue;` idiom** at `:11822`, `:11898`, `:12093`,
   `:12177` — a missing leaf is a compiler bug once the leaf set is total, and
   the current silence is the partial-copy hazard (§2.4).
4. **Constructor initializers** (`:12744-12753`) must recurse instead of
   `continue` — otherwise `new Outer(inner: …)` drops the inner's initializers
   silently, the same defect class.
5. Arity: `wasmParamCountOf`/`fieldCountOf`/`paramRefs` count **leaves**. A
   nested record's guest call therefore spends more operands than it does today
   — but today it cannot exist, so no ABI moves (§1). The host boundary is
   unaffected (`(param i32)` temp, `:11877`, `:11743`).

### C. Closure capture of an `@inline` value

The env field is A's field; the capture is A's write path into `env + offset`;
the leaf test must pass for the whole env class or the capture is refused by
name. Requires A, not B (§2.7).

### D. What is generously *not* in any of them

`T[N]` of `@inline` (the `makeZero` fill path, §2.9); GC-reference leaves (the
write barrier); `@inline` **returns** across the host boundary (an ABI version);
`Array<@inline struct>` (the shape question, `interop-inline-struct-scope.md`
§10.4). None is made easier by nesting, and none is claimed here.

---

## 4. Scope, order, and what each unlocks

| Order | Sub-phase | Rough size | Why this order |
|---|---|---|---|
| 1 | **A** — layout, leaf test, cycle refusal, memory access | ~120-180 lines across `resolver.ts`, `compiler.ts`, `diagnosticMessages.json`; 4-6 fixtures | Without A nothing else has a correct layout. A alone is the C-interop payload: a `@unmanaged` record holding a value field, read and written through a pointer. |
| 2 | **B** — SROA leaf flattening | ~200-300 lines, mostly mechanical, at 14 measured sites; 5-7 fixtures | Needs A's leaf test and the layout to be true. Unlocks values containing values, which is what "value types" means for `Transform { pos: Vec3f }`. |
| 3 | **C** — closure capture | ~40 lines plus an env-class check; 2 fixtures | Needs A's write path only. |

**One PR or three?** Three. The three-way discipline is per sub-phase (§2.12), and
A's partial cells are the dangerous ones; shipping A green with B half-built
would put a wrong `sizeof` behind a passing fixture. A alone is coherent: it
refuses, by name, every value form it does not implement.

**How large is "medium"?** For calibration: sized enums were one resolver
repoint, two setters, a guard and fixtures — and the phase was small. A is
comparable (one layout branch, one read branch, one write loop, one cycle test).
B is the largest single piece in the value-type arc after the SROA phase itself,
because it is 14 sites — but each is the same three-line change, and no new
representation is introduced (§2.4). C is small.

---

## 5. The refusals that stay in place

Each must be re-pinned by a fixture in the sub-phase that lands, because A
removes one of them and changes the reachability of two more:

- **Recursive inline structs**, direct and indirect — *new in A* (§2.6).
- **A GC-reference leaf** — now transitive: refused at the outer field, not only
  when a local of the inner is declared (§2.8). Today's refusal site
  (`compiler.ts:12239`) still applies to a direct local.
- **A `T[N]` leaf** — unchanged in reason, now also checked at the outer field.
- **`T[N]` of `@inline struct`** — unchanged; `makeZero` still has no fill path
  (`compiler.ts:12407-12466`).
- **A whole-value read of a nested field**, and **a boundary pass of a value
  containing one** — A refuses by name; B lifts.
- **`changetype` to an `@inline` type**, inheritance from one, a global of one,
  `Array<@inline struct>` — untouched by nesting; keep their fixtures.

---

## 6. What forces a "no" — each checked

| Forcing condition (from the brief) | Measured verdict |
|---|---|
| The byteSize-on-pointer assumption is deeper than field size | **No.** The layout loop reads `byteSize`/`alignLog2` per field (:3919, :3960) and nothing else computes a field's size; the readers (`sizeof`/`offsetof`/`alignof`, sret/temp sizing) all read the finalized class numbers, so they follow for free (§2.3). |
| SROA needs a new AST/type representation | **No.** The inner `Class` is resolved before the outer's field is laid out (§2.6) and carries members/offsets/extent/alignment. 14 sites need a recursion over an existing structure; `fieldLocals` stays `Map<string, Local>` with flat keys (§2.4). |
| The recursive check is a new declaration pass | **No.** `pendingClasses` is already in scope in the loop and already answers this question for bases and interfaces (§2.6). |
| Closure env needs more than the field | **Partly.** It needs the *write* path (value → inline heap field), which is A's; no additional mechanism. C stays after A, not after B (§2.7). |
| There is no consumer | **True today, and it is the honest risk.** 0 nested members in 17 headers, 0 struct-typed fields in 109 guest files, 0 `@inline` declarations in the engine; the shape is hand-flattened with documented padding (`wire.ts:455-459`). A is justified as *capability with a documented workaround*, not as a present requirement (§2.10). |

None of the technical conditions forces a no. The consumer condition makes the
**priority** the open question, not the feasibility.

---

## 7. Recommendation

1. **Land A** as its own PR: layout branch, cycle refusal via `pendingClasses`,
   `sroaLeavesOf` + the leaf test, the address-form read path, the leaf-store
   write path, and *named refusals* for every value form it does not implement.
   Fixtures: the layout three-way (`sizeof` **and** `offsetof` **and**
   `alignof`), the access three-way, the cycle refusal, the transitive GC-ref
   refusal, backward compatibility (every existing record's numbers
   byte-identical — the suite's 311 fixtures are that proof, since none can take
   the new branch).
2. **Then B**, SROA leaf flattening, with the `if (!fieldLocal) continue;` sites
   removed rather than adapted, and the constructor-initializer `continue`
   replaced by recursion.
3. **Then C**, closure capture, which is A's write path plus an env-class leaf
   test.
4. **Do not** attempt `T[N]` of `@inline struct`, GC-reference leaves, or
   `@external` returns of an `@inline` value in any of the three. They are
   separate blockers, measured above.
5. **File, and keep filed:** `inline-nesting-containment` (A's diagnostic), and
   the pre-existing mismatch measured in §2.1 — a type whose fields are refused
   at instantiation still reports a `sizeof` (4 for a GC-ref record, 16 for a
   `T[N]` one). That one is not caused by nesting, but nesting makes it easier
   to hit.

---

## 8. What could not be measured read-only

- **The nested layout itself.** No declaration can express it, so `sizeof 16 /
  offsetof 8 / alignof 3` in §2.5 is the *requirement*, computed from the C rule
  and from the inner's measured extent — not an observation. What *is* measured
  is every input to it: the inner's extent (8), alignment (3), and the pointer
  model's current answers (8/4/2).
- **The cycle failure mode.** §2.6's "silently 0" is *derived* from two measured
  facts — no cycle detection exists (p13), and `resolveClass` returns a pending
  instance whose `nextMemoryOffset` is the default 0 (`resolver.ts:3587-3590`,
  `program.ts:4780`) — not observed, because observing it needs the branch that
  would read it.
- **The getter path's behaviour on an inline receiver.** §2.11 argues the chained
  read resolves `Inner#get:x` with `this` = an address; that the getter exists
  is measured (`program.ts:4439-4441`), that it is *reached* is not, because a
  value-typed field cannot be addressed today.
- **The `@external` temp with a nested value.** Sized correctly by construction
  (`sretSizeOf` reads `nextMemoryOffset`, `:11743`), filled leaf-wise only after
  B — unmeasurable before either exists.
- **Engine-side layout.** The C header count (§2.10) is a grep; no engine build
  was run, and nothing in `~/work/Tension` was modified.
- **`layout_hash`.** Engine-side (Tension's `arena.rs`), not reachable from this
  tree — the same limit every scoping in this repository records.

---

## Appendix — probes and citations

All probes in `/tmp/inp/probe/`, compiled with the compiler built from
`bcc95055` (`/tmp/inline-nesting/bin/tensionscript.js`, `dist/asc.js` rebuilt
from that tree).

| Probe | What it measured | Result |
|---|---|---|
| `p1_pointer.ts` | the pointer model's numbers | `sizeof<A>` 8, `offsetof(b)` 4, `offsetof(a)` 0, `sizeof<B>` 8, `alignof<B>` 3, `alignof<A>` 2 |
| `p2/p3/p4` | the nesting refusal per outer kind | identical `AS100` for `@unmanaged` / `@inline` / `@managed` |
| `p5`, `p5b` | refusal reachability | unused class field compiles (0); `new Holder()` refuses |
| `p6`, `p6b`, `p7`, `p7b` | SROA refusals fire at instantiation | declared-unused compiles; a local refuses |
| `p8_sizeof_bad.ts` | `sizeof` of a refused-field type | `sizeof<Bad>` 4, `sizeof<Arr>` 16 |
| `p9_indirect_recursion.ts` | nesting refusal on mutual inline records | two `AS100`s (one per field) |
| `p10_self_recursion.ts` | nesting refusal on self-reference | one `AS100` (no hang) |
| `p11`, `p11b`, `p11c` | closure capture of an inline value | nesting refusal at the lifted local; scalar control compiles |
| `p12_unmanaged_tn.ts` | `T[N]` in a pointer record (the array precedent) | `sizeof` 24, `offsetof(arr)` 4, `offsetof(b)` 20, `alignof` 2 |
| `p13_self_ptr.ts` | cycle behaviour for pointer fields | self and mutual recursion compile; `sizeof<A>` 8, `offsetof(b)` 4 |
| `p14_field_shape.ts` | accessor vs address form | scalar → `S#get:b`/`S#set:b`; array → `base + 8; add; load/store` |

Source citations are to `origin/main` at `bcc95055`.
