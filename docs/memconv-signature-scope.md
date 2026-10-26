# Use-site memory models at the boundary — scoping (10.0b)

**Status:** scoping only. No source changed, no plan, no code beyond this document.
**Base:** TensionScript `origin/main` @ `c890342e` (PR #19 `10e9456f`, then PR #20
`c890342e`).
**Method.** Every number below was measured on that tree with a fresh worktree
(`/tmp/ts-memconv-sig`), `npm run build`, then probes compiled with that tree's
compiler (`node bin/tensionscript.js <probe>.ts --debug -t <probe>.wat`). Probe
programs are short enough to reproduce from the description; where a probe's
output is the evidence, the emitted WAT is quoted verbatim.

---

## 0. The answer up front

**Both gates pass, and the phase is smaller than the briefing assumes.**

1. **The memoization key is restructurable (gate, item 2).** `Signature.create`
   keys on a **string**: three optional flag prefixes concatenated with
   `signature.toString()` (`src/types.ts:1070-1073`). A per-parameter model can
   be appended as a fourth segment. Appended **conditionally** (only when some
   parameter names a model), every existing key is byte-identical, so every
   existing signature keeps its identity and its id. `Signature.equals`
   (`src/types.ts:1358-1402`) and `Signature.clone` (`src/types.ts:1527-1545`) are the
   other two sites that must agree with the key; both are mechanical.
   **No STOP. A new `Signature` dimension is not needed.**

2. **Behaviour neutrality holds (gate, item 6), with one honest caveat.** The
   annotation has **no readers at all today**: `MemoryModel` is written by
   `parseType` and read nowhere outside `src/parser.ts` and `src/ast.ts`
   (`grep -rn "MemoryModel" src/ | grep -v '^src/parser.ts\|^src/ast.ts'` →
   zero hits). Four probes confirm the annotation is inert at a guest
   parameter, an `@external` parameter, a local, and a return type. Zero
   in-tree programs name a model at a boundary. Therefore honouring the
   override changes emitted output **only** for programs that write one — and
   there are none. 10.0a is `## Unreleased`, so no published program can
   contain one either. **→ same unreleased cycle, not a release event.**

What the briefing gets wrong, and what it costs:

- **Two of the four override cells it asks for cannot be honoured.** `@managed`
  over an `@unmanaged` declaration is not "pointer + root": a use cannot confer
  GC provenance on a value the collector does not own, and rooting a non-heap
  address in the shadow stack is worse than not rooting it (§5). `@unmanaged`
  over an `@inline` declaration is not "borrow, no copy": an SROA value has no
  address, and on the export side its callee representation cannot be made a
  pointer without the per-local representation problem 10.0a avoided (§4.2).
  Both are refusals, not implementations.
- **The two implementable cells are one mechanism, not two.** `@inline` over a
  pointer declaration, on the import side (`@external`) needs a memory→temp
  copy; on the export side the byval prologue already does the field loads.
  Both, and the guest→export call path, are served by **one additive branch** in
  the existing argument-temp emitter (§3.3).
- **The phase is ~17 sites, not "the phase's hard part".** PR #19's §9.1 called
  this the structural cost. Measured, the decision surface is **two predicates
  and one flag derivation**; everything else routes through them (§1.4).

**Recommendation: proceed as its own phase, in two commits — refusals first,
then the key and the two cells. Do not split it external-only / export-only;
they share the gate, the key, and the emitter branch.** §10.

---

## 1. The Signature construction chain (item 1)

### 1.1 The parameter nodes are already in scope

Signature construction resolves parameters in a loop that holds the **AST node**
(`src/resolver.ts:3105-3144`):

```ts
let signatureParameters = signatureNode.parameters;              // :3105
let parameterTypes = new Array<Type>(numSignatureParameters);    // :3107
for (let i = 0; i < numSignatureParameters; ++i) {
  let parameterDeclaration = signatureParameters[i];             // :3111
  ...
  let typeNode = parameterDeclaration.type;                      // :3117
  let parameterType = this.resolveType(typeNode, ...);           // :3127
  parameterTypes[i] = parameterType;                             // :3144
}
```

`typeNode` is a `TypeNode`, and since 10.0a it carries `memoryModel`
(`src/ast.ts:917`, written at the single `parseType` chokepoint,
`src/parser.ts:982`). So the override is **index-aligned with the resolved
types at the moment the signature is built**. No AST re-plumbing is needed —
PR #19's §3.4 said "the parameter nodes are not passed" to
`signatureHasMultiFieldInlineStructParam`, which is true of that helper, but
they are one frame up in the loop that calls it.

### 1.2 Snapshot, not a new node reference

The signature must **store** the models, not hold the nodes:

- the consumers are signature-driven (`paramRefs`, `wasmParamSlotCountOf`,
  `program.ts`'s parameter binding, `compileCallDirect`), and none of them has
  the callee's parameter AST in hand at the point of decision;
- `Signature` is memoized and shared (§2), so a per-function answer cannot live
  in the AST alone;
- storing the answer is what makes the callee and the call site agree **by
  construction** — which is precisely the invariant 10.0a's rooting bug
  violated (it keyed on the callee's *type*, and the caller could not
  disagree because it asked the same question).

### 1.3 Three construction callers, one of them relevant

`Signature.create` is called from exactly three places:

| Site | What it builds | Boundary? |
|---|---|---|
| `src/resolver.ts:3205` | a function instance's signature | **yes** — the only one with a boundary |
| `src/resolver.ts:463` | a `FunctionTypeNode`'s signature (`(a: i32) => void`) | no — a call shape, not a declaration |
| `src/types.ts:1534` | `Signature#clone` | inherits the original |

So the threading is one capture site, one "pass it", one "store it", and
`clone` passes it through. The function-type caller can pass an empty array (and
an override written on a function-type parameter should be refused — a function
type declares no boundary, so there is nothing for a model to mean there).

### 1.4 The decision surface is two predicates

Every boundary emitter asks one of two methods, and both are already
per-parameter:

```ts
isExternalPointerParam(sourceIndex: i32): bool {          // types.ts:1178
  if (!this.externalBoundary) return false;
  return Signature.isInlineStructRef(unchecked(this.parameterTypes[sourceIndex]));
}
isExportByValParam(sourceIndex: i32): bool {              // types.ts:1186
  if (!this.exportByValParams) return false;
  return Signature.isInlineStructRef(unchecked(this.parameterTypes[sourceIndex]));
}
isByValPointerParam(sourceIndex: i32): bool {             // types.ts:1193
  return this.isExternalPointerParam(sourceIndex) || this.isExportByValParam(sourceIndex);
}
```

Those feed, directly or through `isByValPointerParam`:

- `wasmParamSlotCountOf` (`types.ts:1165`), `paramRefs` (`types.ts:1316`),
  `wasmParamStartOf` (`:1256`), `wasmParamCount` (`:1267`), `sourceIndexOf`
  (`:1292`) — arity; **all unchanged**, because a record spends one `i32`
  under either model (§3.1);
- `Compiler#compileFunction`'s three boundary refusals (`compiler.ts:1771`,
  `:1775`, `:1803`);
- the export prologue gate (`compiler.ts:1859`) and its body
  (`compiler.ts:11468`);
- the import temp (`compiler.ts:6998`, `:7002`, `:7017`);
- `program.ts`'s parameter binding (`program.ts:4107`).

Plus the flag derivation (`resolver.ts:3196`, `:3202` →
`signatureHasMultiFieldInlineStructParam`, `resolver.ts:4158`) and the three
`Signature` core sites (key `:1070`, `equals` `:1358`, `clone` `:1527`).

**Count: ~17 sites. Four carry the decision** (`isExternalPointerParam`,
`isExportByValParam`, the flag derivation, the temp branch). The rest either
route through those or need only the plumbing (`create` signature, ctor field,
key, `equals`, `clone`, capture). This is **low tens**, and it is the opposite
of PR #19's §3.3 estimate of ~25-40 — because that estimate counted the *inline
representation* chokepoints, and a boundary crossing does not change
representation. `compiler.ts` has eight `isInlineStructType` call sites
(`:1775 :1807 :3146 :6308 :7002 :7017 :10245 :10258`, plus the definition at
`:11210`); the four that a boundary touches are `:1775`/`:1807` (the refusals)
and `:7002`/`:7017` (the temp), and none of them is a representation decision.

---

## 2. The memoization key (item 2) — GATE

### 2.1 The key today

```ts
// types.ts:1070
let uniqueKey = (sretDisabled ? "!sret-disabled:" : "")
  + (externalBoundary ? "!external-boundary:" : "")
  + (exportByValParams ? "!export-byval:" : "")
  + signature.toString();
if (signatureTypes.has(uniqueKey)) { ... }            // :1077
```

The key's only function-identifying input is the parameter/return types plus
those three booleans. **The flag vocabulary is already the "a boundary signature
shares nothing with a guest signature" mechanism**, and the comment at `:1067`
states the rule: a flag is part of the key when it changes the ABI shape.

### 2.2 A boolean is not enough — the collision is real and measurable

Two declarations can have **identical parameter types** and different overrides:

```ts
@unmanaged struct U { a: i32; b: i32; }
@external("host","f") declare function f(v: @inline U): i32;
@external("host","g") declare function g(v: @unmanaged U): i32;
```

`signatureHasMultiFieldInlineStructParam([U])` is **false** for both (`U` is not
an inline struct), so both currently build key `"(v: U) => i32"` and share one
`Signature`. Measured — `expU` and `expUI` in the export probe emitted
byte-identical bodies:

```
(func $ex/expU  (param $v i32) (result i32)  local.get $v; call $ex/U#get:a; ...
(func $ex/expUI (param $v i32) (result i32)  local.get $v; call $ex/U#get:a; ...
```

Under 10.0b those two must differ (temp vs pointer), and a signature-level
boolean cannot express it: `f(a: @inline U, b: @unmanaged U)` and
`g(a: @unmanaged U, b: @inline U)` have the same types, the same count, and the
same "some parameter is inline" answer, but different per-parameter ABIs.
**The key must carry the per-parameter models, not a flag.**

### 2.3 The change

```ts
// resolver.ts:3105-3144 — capture, beside parameterTypes[i]
let memoryModels = new Array<MemoryModel>(numSignatureParameters);
... memoryModels[i] = typeNode.memoryModel;

// types.ts — create(..., memoryModels: MemoryModel[] = []), stored on the
// Signature; key gains a conditional segment:
+ (hasAnyModel ? "!mm:" + memoryModelsToString(memoryModels) + ":" : "")
```

`memoryModelsToString` writes one letter per parameter (`-` for `Any`, `i`,
`m`, `u`), so the segment is stable, readable in a debugger, and cheap:
`!mm:-iu:`. Three consequences to get right:

- **`equals` must compare it** (`types.ts:1358`), because `create` asserts
  `signature.equals(existing)` (`types.ts:1078`) — a key that distinguishes
  what `equals` does not is an assertion failure at the first collision.
- **`clone` must pass it** (`types.ts:1527-1545`), or a cloned signature silently
  loses its overrides.
- **Append only when non-empty.** All-`Any` must produce exactly today's key,
  or every program's signature ids shift. (Ids are inert — `signature.id` is
  written at `types.ts:1065` and read nowhere — but an unnecessary change is
  still an unnecessary change, and the conditional form makes the neutrality
  argument trivial instead of argumentative.)

### 2.4 Does this change any existing signature's identity?

No. With `memoryModels` all-`Any` (every signature in the tree today), the
segment is absent, so the key string is byte-identical to today's, the memo map
is populated in the same order, and `nextSignatureId` advances identically.
Signatures that *do* carry a model become distinct — which is the point, and
which affects only programs that write a boundary override (zero, §6).

**Verdict: restructurable. The STOP condition in the brief is not met.**

---

## 3. The `@external` boundary cells (item 3)

### 3.1 The shipped baseline, measured

One module, three structurally identical two-field records, three declarations
(`base.ts`):

```
(import "host" "takeU" (func $base/takeU (param i32) (result i32)))   ;; @unmanaged
(import "host" "takeI" (func $base/takeI (param i32) (result i32)))   ;; @inline
(import "host" "takeM" (func $base/takeM (param i32) (result i32)))   ;; @managed
```

**All three are `(param i32)`.** At the call site:

- `takeU(u)` → `local.get $u; call` — pointer, no copy, no root.
- `takeI(i)` → `~sretStackPointer` mark/bump/guard, two stores of `$i$a`/`$i$b`
  into the 16-byte slot, `call` — **temp + copy**.
- `takeM(m)` → `local.get $7; <stack_pointer>; local.get $7; i32.store;
  local.get $7; call` — pointer, **rooted**.

So the record ABI is invariant (one `i32`); the model selects only (a) whether
the caller copies into a temp and (b) whether the operand is rooted.

### 3.2 The four override cells, measured

Same records, with the override on the parameter (`ov.ts`). All four imports are
`(param i32)`; the call sites are what differ:

**Cell I1 — decl `@unmanaged` + `@inline`.** Emitted: `local.get $u; call`.
No temp, no copy. **The declaration wins; the override is dropped.**

**Cell I2 — decl `@inline` + `@unmanaged`.** Emitted: the mark/bump/guard, two
stores, `call`, restore. **Temp + copy — the declaration's shape.**

**Cell I3 — decl `@unmanaged` + `@managed`.** Emitted: `local.get $u; call`.
**No root** — the operand is not stored on the shadow stack, while the harness's
own managed control (`takeM`) is.

**Cell I4 — decl `@managed` + `@unmanaged`.** Emitted: `local.get $m;
local.set $7; <stack_pointer>; local.get $7; i32.store; local.get $7; call`.
**Pointer + root** — which is already correct (§5).

### 3.3 What each cell costs, and why two of them refuse

**I1 — implementable, one emitter branch.** The caller has a pointer, the host
must see a private copy. `makeExternalTempArgument` (`compiler.ts:11524`)
cannot do it: it requires the argument to be an `Identifier` whose local has
`fieldLocals` — an SROA local — and errors otherwise ("the temp is filled by
copying a local's fields; a value has no address, so only a local can be
passed"). The cell needs the mirror: compile the argument to its `i32` pointer,
stash it in a temp local, then `temp[j] = load(ptr + off_j)` per field. ~25
lines, additive, inside the existing emitter — one new branch selected by
"the local has fieldLocals, or it does not".

**I2 — refuse.** An `@inline` value is per-field locals; it has no address, so
"lend the host a pointer for the call" requires materialising memory, i.e. the
temp — which is what happens today. Honouring the override would therefore
*change nothing observable* while promising a longer lifetime than the temp has.
The only implementable reading is "the pointer's lifetime is the call either
way", which is not a distinction worth a model. Refuse, with the reason.

**I3 — refuse.** This is the cell that looks free and is not. Rooting writes the
operand into a traced shadow-stack slot; the collector then treats that word as
a reference. An `@unmanaged` record is not a GC object (no header), so either
(a) the value is really managed and the declaration is wrong — the caller's
`changetype` route to the same call is already rooted, so no override is needed
— or (b) it really is unmanaged and rooting it would hand the collector a
bogus reference. A use cannot confer provenance. The refusal shape already
exists: `TS2322` is what 10.0a's `changetype` path reports for the same
direction.

**I4 — nothing to do.** Codegen is already right, and must stay right: the value
*is* managed, the view is not, and the root keys on what the value is (§5).

### 3.4 `sizeof` does not move with the model

`sizeof<U>()`, `sizeof<I>()`, `sizeof<@inline U>()`, `sizeof<@unmanaged I>()`
all compile to `i32.const 12` for a three-`i32` record. The temp's size
(`sretSizeOf`, `compiler.ts:11401` — `nextMemoryOffset` rounded to 16) is
therefore unchanged by any override, which is what makes I1 a **copy** problem
and not a layout problem.

---

## 4. The export boundary cells (item 4), and the contract

### 4.1 The shipped baseline, measured

`ex.ts`, six exports over two-field records:

| Export | Emitted body | Meaning |
|---|---|---|
| `expU(v: U)` — `@unmanaged` | `local.get $v; call $ex/U#get:a` → pointer, per access | **alias**: live view of the host's memory |
| `expI(v: I)` — `@inline` | `(param $v$byval i32)` + `(local $v$a) (local $v$b)`; `local.get $v$byval; i32.load; local.set $v$a` ×2, body reads locals | **byval**: copy at entry |
| `expM(v: M)` — `@managed` | frame at entry (`stack_pointer -= 4`; slot; `local.set $1; store $1`), reads through `$v` | pointer + **entry root** |

### 4.2 The two override cells, measured — one cheap, one a trap

**Cell E1 — decl `@unmanaged` + `@inline`.** Emitted: **identical to `expU`**
(the alias shape). The override is dropped.

**Cell E2 — decl `@inline` + `@unmanaged`.** Emitted: **identical to `expI`**
(the byval shape). The override is dropped.

**E1 is genuinely cheap.** `emitExportByValPrologue` (`compiler.ts:11459`) reads
each field *from the pointer the host supplied* (`i32.load` at
`field.memoryOffset`) and the second pass in `program.ts:4181-4211` builds the
field locals by iterating the parameter type's members with no inline-flag test.
So flipping `isExportByValParam` to consult the effective model produces a
working byval export over a pointer declaration, with the binding and the
prologue unchanged.

**E2 is a trap, and the naive implementation regresses the ABI.** If
`isExportByValParam` simply returned false for an `@inline` declaration under an
`@unmanaged` override, `paramRefs` (`types.ts:1316-1343`) would fall through to

```ts
} else if (Signature.isInlineStructRef(parameterType)) {
  // one ref per field, in declaration order
```

and emit `(param f32 f32)` for a two-field record — the field list *becomes the
host ABI*, which is the exact shape PR #14 refused and `compiler.ts:1803-1810`
guards. Binding the parameter as an ordinary local does not rescue it either:
`Type.toRef()` for an `@inline` type is a GC heap type (`types.ts:1318-1322`
says so in as many words — "a different ABI that would need the GC feature"),
so any path that treats the parameter as a normal local hits a type reference
the module cannot build. Making a value type pointer-backed **inside the
callee** is the per-local representation problem, not a boundary decision.

**Refuse E2**, with a diagnostic that says why: "a value has no address; an
`@unmanaged` view of an `@inline` parameter would have to become a pointer-
backed value, which this compiler does not have."

### 4.3 The semantic contract the CHANGELOG must state

The override's whole value at a boundary is that a caller can read the model as
the ownership rule. Measured behaviour of the cells that will exist after 10.0b:

| Spelling | Who owns the memory | Mutations | Pointer lifetime |
|---|---|---|---|
| `export f(v: @inline V)` | host allocates the value, guest copies fields at entry | host's later writes **do not** reach the call; guest's writes stay in locals | no pointer survives entry |
| `export f(v: @unmanaged V)` | host's memory | host writes **are** visible during the body; guest writes reach the host's memory | valid for the call; keeping it needs the host's own lifetime guarantee, which the compiler cannot check |
| `@external f(v: @inline V)` | guest materialises a call-temp | host writes go to the temp and are invisible to the guest | **the call only** — the temp dies with it (adapter rule 6, `tension_adapter.h:57-58`) |
| `@external f(v: @unmanaged V)` | guest's record | host writes **are** visible to the guest | **the call only** — the same rule |

Two sentences carry it: **`@inline` at a boundary is a copy; `@unmanaged` is a
borrow.** A borrowed pointer is valid for the call; retaining it needs a
guarantee the compiler cannot check, and for the guest→host direction the
adapter contract forbids it outright.

### 4.4 The guest→export path shares the signature

An exported function can also be called from guest code, and the call goes
through `compileCallDirect`'s `byValPointerParams` gate
(`compiler.ts:6998`). With E1 implemented, a guest call to that export passes a
`U`-typed argument — a pointer, no `fieldLocals` — into
`makeExternalTempArgument`, which would refuse. So **E1 needs the same
memory→temp branch that I1 needs**, for a second call shape. One branch, two
callers: another reason not to split the phase external-only / export-only.

---

## 5. Boundary rooting (item 5)

### 5.1 Where rooting actually happens

- **Call side**: `Compiler#operandsTostack` (`compiler.ts:7464`) walks *WASM*
  operands, maps each to its source parameter (`signature.sourceIndexOf`), and
  tests `paramType.isManaged` (`:7502`) — the resolved type, i.e. the
  declaration. **This is untouched by 10.0b**, and must stay untouched (§5.2).
- **Export entry**: `program.ts` emits a frame slot and stores the parameter for
  `expM` and `expMU` alike (measured, §4.1).
- **`@external` calls** are not special: they are `compileCallDirect` calls like
  any other. Measured (`extroot.ts`):

```
takeU(changetype<U>(make()))   → frame; slot; store $0; local.get $0; call $takeU
takeM(make())                  → frame; slot; store $0; local.get $0; call $takeM
```

**10.0a's rooting fix already covers the `@external` boundary.** The briefing's
worry that boundary rooting would entangle the phases does not survive
measurement: the call site roots on the *source* value's managedness, and a
`changetype` operand carries that fact on the side channel, irrespective of
which function is being called.

### 5.2 The rule to write down (and test)

> **Rooting keys on what the value is, never on the model the use names.**

Consequences:

- decl `@managed` + `@unmanaged` view → **still roots** (measured: `expMU` roots
  at entry; `ovMU` roots at the call). Dropping the root because the *view* is
  unmanaged would reintroduce exactly the use-after-free 10.0a closed.
- decl `@unmanaged` + `@managed` view → **cannot root** (§3.3, I3) → refuse.

This is the same rule as 10.0a's free cell, stated from the other side. If a
future phase ever lets `@unmanaged` at a guest parameter change the parameter's
rooting — the naive reading — `tests/compiler/interop/managed-to-unmanaged-
operand.ts`'s `sumOverride` would silently become unrooted. The rule is what
prevents that, and it deserves a fixture of its own in 10.0b.

---

## 6. Behaviour neutrality and the version boundary (item 6) — GATE

### 6.1 The annotation is inert everywhere — four probes

| Position | Probe | Result |
|---|---|---|
| guest parameter | `take(v: M)` vs `takeOv(v: @unmanaged M)` | **identical** bodies, both `(param $v i32)`; both callers identical (frame, slot, store) |
| `@external` parameter | four override cells (§3.2) | every cell emits the **declaration's** shape |
| local | `let x: M = m` vs `let y: @unmanaged M = m` | **identical** (module-normalised diff) |
| return type | `makeV(): V` vs `makeVOv(): @unmanaged V` | both `(param $$sretDest i32)`; callers both allocate the slot |

Plus the `sizeof` probe (§3.4). `MemoryModel` has no reader outside the parser.

### 6.2 The corpus

- Boundary overrides in the tree: **zero**. `grep -rn "[:@(,] *@\(inline\|managed\|unmanaged\) [A-Z]" --include=*.ts tests/ examples/ std/ src/` returns three hits and none is a boundary: one real use — a **local**, `tests/compiler/interop/managed-to-unmanaged-operand.ts:57` (`let view: @unmanaged Record_ = record;`) — and two doc comments (`src/parser.ts:660`, `src/ast.ts:905`) that spell the form as an example. A local is not a boundary, so that fixture's bytes do not move under 10.0b.
- The post-type spelling (`v: V @inline`) is refused since 10.0a (`TS6392`), so
  the `@fieldOffset`-shaped trap the briefing warns about is already closed for
  this decorator family.

### 6.3 Under the change

Adding an override to an existing boundary fixture emits **identical** output
today. Measured on the real fixture
(`tests/compiler/interop/inline-struct-export-param-byval.ts`): the file as
committed compiles byte-identical to its committed `.debug.wat` (module prefix
normalised), and adding `@unmanaged` to `sum`'s parameter emits byte-identical
output again:

```
diff <(compile fixture) <(committed .debug.wat)          → empty
diff <(compile fixture) <(compile fixture + @unmanaged)  → empty
```

So the change is real and it is *narrow*: the only programs whose output moves
are ones that name a model at a boundary, and there are none.

### 6.4 The suite at base

`npm run test:compiler -- --parallel` → `[ SUCCESS ]` (7 fixtures skipped:
`simd`, `threads`, `reference-types`, `exception-handling`, `gc` not enabled).
221 fixture pairs (debug + release) compare. This is the baseline 10.0b's gate
would diff against.

### 6.5 The version statement

**10.0b is minor, and it can share 10.0a's unreleased slot.** Two reasons, and
the second is the one that matters:

1. No published program can contain a boundary override: 10.0a is
   `## Unreleased`, and before 10.0a the pre-type form was `TS1110`/`TS1109`
   everywhere (PR #19 §7.1).
2. The change is to a form that is currently *accepted and meaningless*, and the
   CHANGELOG already says so in as many words ("The `@external` boundary still
   reads the declaration's model and drops a use-site override"). A reader of
   10.0a has been told the boundary is not honoured; 10.0b makes the document
   true rather than changing a promise.

**The one thing that would change this**: shipping 10.0a to npm *and* documenting
`v: @inline V` at a boundary as "accepted, ignored". Then 10.0b is a behaviour
change against published behaviour and belongs in a coordinated release. It is
not that today.

---

## 7. The interaction with 10.0a's free cell (item 7)

### 7.1 They share the argument loop, and nothing else

Both live in `compileCallDirect`'s argument loop (`compiler.ts:7011-7034`):

```ts
this.rootNextOperand = false;                     // :7016
if (externalMark != null && this.isInlineStructType(parameterType)) {
  operands[index++] = this.makeExternalTempArgument(...);      // :7017
} else {
  index += this.expandSroaArgument(...);                       // :7024
}
if (this.rootNextOperand) { ... module.tostack(...); }         // :7028
```

They cannot co-occur on one argument: the temp branch fires for an
**effectively-inline** parameter, and `rootNextOperand` is set only by
`changetype` from a managed record to an unmanaged one — a *pointer* type, which
takes the `expandSroaArgument` branch. Measured: the `@external` +
`changetype` probe roots correctly (§5.1), so the two features compose without
either knowing about the other.

### 7.2 The one tension, stated plainly

10.0a's free cell is "free" *because* the override is inert: the parameter stays
managed, so `operandsTostack` roots it. 10.0b must not convert that accident
into the rule. The rule is §5.2 — source model governs — and if 10.0b writes it
down and tests it, the free cell keeps working for the right reason.

### 7.3 What 10.0b must not touch

`operandsTostack` and its three callers; `TypeNode.memoryModel`'s parser-side
behaviour (including `TS6391`/`TS6392`/`TS2322`); `changetype`'s side channel;
the SROA paths (`expandSroaArgument`, `compileSroaLocal`). None of the six
refused cells needs any of them.

---

## 8. Answers to the design questions

1. **The matrix at boundaries.** Of the nine model pairs, only two are
   *codegen-distinct* at a boundary (the `@inline` ↔ pointer distinction), and
   only one direction of that pair is implementable per side: `@inline` over a
   pointer declaration (I1, E1). The rest are refusals or no-ops. The size is
   **one additive emitter branch (~25 lines) + two predicate rewrites + three
   diagnostics**, not a conversion matrix.
2. **Threading shape.** Per-parameter `MemoryModel[]` captured at
   `resolver.ts:3105-3144` from `parameterDeclaration.type.memoryModel`, passed
   to `Signature.create`, stored on the `Signature`. Not on the `Type` (interning
   shares it), not from the AST at the consumer (the consumers do not have the
   callee's nodes, and the memo key must distinguish).
3. **The key.** A conditional fourth segment (`!mm:-iu:`), plus `equals` and
   `clone`. Existing keys unchanged.
4. **`@external` cells.** I1 implement (temp + memory→temp copy); I2 refuse (a
   value has no address; the temp is the only implementable answer and it is
   what happens anyway); I3 refuse (a use cannot confer GC provenance —
   `TS2322`'s shape); I4 unchanged (already rooted).
5. **Export cells.** E1 implement (byval prologue — predicate + flag only; the
   prologue and the binding already read memory); E2 refuse (one-ref-per-field
   flattening would become the host ABI — the PR #14 refusal — and a
   pointer-backed value type in the callee is the per-local representation
   problem). Contract in §4.3.
6. **Behaviour neutrality.** Holds; minor; same unreleased cycle.
7. **Interaction with 10.0a.** Disjoint; the rooting rule (§5.2) is the bridge
   and needs a fixture.
8. **What forces a no.**
   - *Key not restructurable* → **no**; measured restructurable.
   - *Rooting entanglement* → **no**; measured disjoint.
   - *Neutrality failure* → **no**; measured, with the published-10.0a caveat.
   - *"The full 3×3 at boundaries"* → **yes, no** — I2/E2 need a per-local
     representation (the ~25-40-site problem), and I3 needs a GC-provenance rule
     that does not exist. So the answer is "no to the matrix, yes to the two
     cells that are actually about copying".
   - *Parser grammar collision* → **none**; 10.0a's pre-type path is a prefix
     loop in `parseType` (`parser.ts:664-692`), unrelated to the post-type
     attribute loop (`parser.ts:958-981`), and the post-type memory-model
     spelling is already refused there (`TS6392`, `parser.ts:971-977`).

---

## 9. What forces a "no" — the short list

Only one thing in this scoping is close to a stop, and it is not a gate:

- **If the phase is scoped as "honour every override at every boundary", it must
  not proceed.** Three of the six cells are not boundary decisions at all: they
  are GC provenance (I3), value addressability (I2), or callee representation
  (E2). Implementing them inside a `Signature` change would either open the ABI
  leak (`paramRefs` flattening) or root a non-heap word.

Nothing else stops it. The key is restructurable, the rooting is disjoint, the
tree is neutral, and the annotation currently means nothing anywhere.

---

## 10. Recommendation

**Proceed as its own phase (10.0b), scoped to two cells, in two commits.**

**Commit A — the refusals (add-only, no behaviour change for valid programs).**
- I3: `@managed` over an `@unmanaged` declaration at a boundary → refuse, same
  shape as 10.0a's `changetype` refusal (`TS2322`).
- I2 / E2: `@unmanaged` (or `@managed`) over an `@inline` declaration at a
  boundary → refuse, `AS100` with the reason (the existing boundary refusals'
  shape), naming "a value has no address".
- A model on a function-type parameter → refuse (a function type declares no
  boundary).
- Zero fixtures move: all three refusals fire only on forms that are inert today
  and absent from the tree.

**Commit B — the key, the two cells, the emitter branch.**
- `Signature` gains `memoryModels`; the key gains the conditional segment;
  `equals` and `clone` follow.
- `isExternalPointerParam` / `isExportByValParam` consult the effective model;
  `signatureHasMultiFieldInlineStructParam` is computed from it; the two
  boundary sanity refusals (`compiler.ts:1775`, `:1807`) stay correct for a
  single-field record under an override.
- `makeExternalTempArgument` gains the "the argument is a pointer" branch
  (memory→temp copy), serving I1 and the guest→export call.
- One fixture per implemented cell, plus one for the rooting rule (§5.2):
  `@unmanaged` over `@managed` still roots, at an `@external` call and at an
  export entry.
- Gate: the compiler suite is byte-identical except those fixtures, and the
  `.wast` fixpoint stays empty.

**Do not split external-only / export-only.** They share the key, the flag
derivation, the predicates, and the emitter branch; the export half alone would
land a byval prologue that the guest→export call path cannot feed.

**Do not bundle 10.0c.** `@inline` → `@managed` is an allocation, unchanged by
anything above.

---

## 11. What this scoping could not measure read-only

- **The implemented cells' output.** I1/E1 are described, not built. Their
  emitters are inferred from the code that would call them; the ~25-line branch
  is an estimate by inspection, not a measurement.
- **The alias/copy contract at runtime.** The byval fixture ships a JS glue
  (`inline-struct-export-param-byval.js`) that would catch a regression in the
  copy-at-entry contract; extending it to cover E1 is work for the phase, not
  something this scoping could run.
- **Signature sharing, directly.** The collision argument (§2.2) is read from
  `Signature.create`'s key — the key contains no function identity — not from
  instrumented output. Instrumenting it would be a source change.
- **Out-of-tree code.** "Zero uses" is an empirical fact about this repository,
  not a language guarantee.
- **Whether the shadow stack would actually fault on a rooted `@unmanaged`
  pointer.** The argument (§3.3, I3) is structural: the slot is traced, and the
  value has no header. Running it would demonstrate corruption rather than
  infer it.
- **The single-field sub-case of I1.** A one-field record is refused at every
  boundary (`compiler.ts:1775`, the C-convention mismatch); an `@inline`
  override does not change that, so I1's reachable surface is two-or-more-field
  records.

---

## 12. Summary of measurements

| # | Question | Answer |
|---|---|---|
| 1 | Parameter AST at construction | In scope (`resolver.ts:3117`); capture is local; 3 `create` callers, 1 with a boundary |
| 2 | Memo key | String with 3 flag prefixes; a conditional `!mm:` segment suffices; `equals` + `clone` follow; **no STOP** |
| 3 | `@external` override cells | I1 pointer→temp (needs memory→temp copy); I2 refuse (no address); I3 refuse (no GC provenance); I4 already correct |
| 4 | Export override cells | E1 alias→byval (predicate + existing binding/prologue only); E2 refuse (would flatten the ABI / needs pointer-backed value types) |
| 5 | Boundary rooting | Never driven by the override; `@external` + `changetype` already roots; rule = source model governs |
| 6 | Neutrality / version | Annotation inert in all four positions; zero boundary uses in-tree; suite green; **minor, same unreleased cycle** |
| 7 | Interaction with 10.0a | Disjoint; share only the argument loop, and cannot co-occur on one argument |
| 8 | Site count | ~17, of which 4 carry the decision; 1 additive emitter branch; 3 diagnostics |
