# Changelog

## Unreleased

### Bootstrap self-compile: the compiler's own source now compiles

`npm run bootstrap:*` stage 1 ran red on every tip in this fork: the compiler
rejected its own source with 229 errors (212 `TS2448`, 17 `TS2322`). It now
compiles clean — **0 errors**, debug and release.

Three changes, all in compiler source:

- **Diagnostic relaxation.** A read of a global whose initializer is a
  compile-time constant is no longer refused. The `used before its declaration`
  diagnostic models an initialization-order hazard; a constant has no operands
  and so no order to observe. Non-constant initializers are still refused.
- **A second predicate.** `Expression.evaluatesToConst` sees through `Assertion`
  and numeric `UnaryPrefix` (minus `++`/`--`), so `<Index>-1` counts as the
  constant it is. Deliberately **not** a widening of `compilesToConst`: that one
  gates filling omitted arguments with their initializers, and widening it
  removed the varargs stub in four fixtures — an output change for programs that
  compile today.
- **Accessors for the four non-constant tables.** `envInfoOf`, `creationEnvOf`,
  `awaitSites` and `TypeRef.Funcref` became accessor functions over
  null-initialized backing stores. A prelude hoist was measured and rejected: a
  file's walk does not guarantee its globals compile before the function bodies
  that read them.

**The `@lazy` path is closed, both forms.** `@lazy` on a variable is a TypeScript
syntax error (`TS1206`, plus an unsuppressible eslint parse error); on a class
member it parses and lints but fails `npm run build` with `ReferenceError: lazy
is not defined`. The scoping ratified a mechanism the toolchain rejects.

**The CLI/WASM harness is complete, and the self-host fixpoint runs.** Stage 2
of the self-host used to stop in the harness at three gaps; all three are
closed:

- **The in-tree transforms run inside the compiler.** `ClosureLowerTransform`
  and `AsyncLowerTransform` used to be classes the CLI constructed and handed a
  program. That is impossible when the compiler is WebAssembly — compiler
  classes cross the boundary as opaque handles — so the pipeline moved to
  `src/transforms.ts` and both hosts call it through one flat export,
  `applyInTreeTransforms(program)`. No transform class and no AST is exposed;
  the ordering (closures before async) is written once. Programs declare no
  transform and never did: the passes are always on, which is why gating them
  on `asconfig` was not the answer.
- **The shadow stack is sized for the compiler's own source.** Stage 1 aborted
  with `~stack_check`'s `stack overflow`: the compiler's own build needs
  ≈34.2 KB of shadow stack (measured: 34,048 fails, 34,304 passes) and the
  default is 32,768. All five `src/asconfig.json` targets now request 65,536.
  The abort is a capacity limit, not a runaway recursion — the JS compiler
  compiles the same source with exit 0.
- **The transform sources are portable between hosts.** They had never been
  compiled by this compiler. Making them so was 55 nullability sites, one
  spread, one `Set#forEach`, `null`-as-a-type (and `null`-as-a-`usize` in two
  ternaries), and 25 `Map#get` sites where AS aborts on a missing key and JS
  answers `undefined` (`getMapEntry` in `src/util/collections.ts` names the
  guarded read once). Mechanical throughout; all output-neutral.

**Aggregate neutrality, now proven.** `npm run bootstrap` (debug and release)
runs to completion and its final step — `git diff --no-index` of the two
`.wast` files — is **empty**: the JS compiler's output and stage 2's output are
byte-identical (debug `b5953eb9…`, release `761f3d89…`). The ordering relaxation
does not change codegen; this is not a release boundary.

Neutrality for *user* programs is unchanged: `npm test` passes all 1339
fixtures against their checked-in `.wat` byte for byte, and `npm run check` is
green. Programs that previously failed to compile now compile — additive and
backward-compatible. The compiler's own module grows with both passes: debug
+326 KB, release +132 KB.

Version: **minor** by the additive reading; the exact release (0.9.1, 0.10.0, or
bundled with the `@inline struct` batch) is the user's decision.

### `@inline struct` phase complete (scalar and struct-ref fields)

The minimum viable value type is finished. What is in:

- **Type kind + per-use refusals.** `@inline struct` declares, lays out as a C
  record (`sizeof`/`offsetof`/`alignof`), and every use the phase does not
  support refuses **by name with a reason** rather than compiling as a pointer.
  The refuse cell is the point: a silent pointer would alias, and that is the bug
  the value type exists to remove.
- **SROA locals.** One WASM local per field, `local.get`/`local.set` for access,
  copy on assignment and on declaration. No address, no aliasing, no collector
  interaction.
- **SROA parameters.** Field-list signatures; `wasmParamCountOf` /
  `wasmParamStartOf` / `wasmParamCount` / `sourceIndexOf` are the only
  source-to-WASM index translation; the callee binds one local per field and the
  caller expands the argument in declaration order.
- **Sret returns**, free functions and instance methods. The hidden destination
  is the **first** WASM parameter (after `this`), so it is local 0 for a free
  function and local 1 for an instance method. Slots come from a static
  call-temp stack inside `[16, __data_end)` with align 16 — outside the region
  `visitStack` scans, so a slot is never a GC root — with a per-call-frame bump
  pointer and mark/restore, and a 4 KB limit whose overflow **aborts**.
- **`@external` parameters.** The caller materialises a temp on that stack and
  passes `(param i32)`; the host borrows it for the call (adapter rule 6). One
  mark and one bump cover all of a call's temps.
- **Export parameters.** The mirror: `(param i32)` is a byval pointer the **host**
  supplies, and the callee copies each field into its SROA locals at entry. sret
  writes to `(dest + offset)` at exit; an export reads from `(ptr + offset)` at
  entry. Between them a value crosses the boundary as memory in both directions.
- **Single-field structs.** Usable inside the module (the field-count question is
  now answered by `Signature.fieldCountOf`, not by a WASM slot count). Refused at
  both host boundaries, where the C/WASM tool convention passes a one-scalar
  struct **as the scalar** while this compiler passes records as pointers — both
  `(param i32)`, so the mismatch would be silent. The `@unmanaged` case has the
  same divergence and is **kept**, because the engine's adapter reads records
  through `guest_read(ptr, len)` and already depends on it; filed as
  `unmanaged-single-field-tool-convention`.
- **Refused, with the reason named:** `@external` return of an `@inline struct`
  (an ABI version: the host would have to write into a slot it never allocated),
  a function value, a virtual method, an export, a global, a field, `Array<T>`,
  `T[N]`, `changetype`, inheritance, and returning anything but a local.
- **Multi-value results: superseded.** The memory-only model means there is no
  whole value in the pipeline, so there is nothing for multi-value to carry. The
  design note's §8 framed this as "set aside"; it was a mischaracterisation, and
  the correction is recorded in the note and in the commit record.

Deferred, each filed with a reason:

- **Closure capture** — needs inline nesting (the environment is a class, and a
  value-typed field in one is nesting).
- **`T[N]` fields** — deep SROA plus a `makeZero` arm for `FixedArray`.
- **GC-reference fields** — the mixed representation needs write barriers in SROA.
- **Inline nesting** — a nested value type needs one local per leaf, and inherits
  the layout question for record-typed fields.
- **Top-level statics** — a global is a pointer slot, so two values would alias.
- **`@external` return** — an ABI version change; the last refused case.
- **`--sretStackSize`** — the 4 KB limit is shared by sret and the `@external`
  temp, so this is one limit for both; structurally identical to `stackSize`.
- **`unmanaged-single-field-tool-convention`** — see above.
- **`--create=false` in the test harness** — the boolean parser treats it as
  `true`, so there is no "compare only" spelling; it regenerates fixtures from
  whatever build is present.

### `@inline struct` returns (sret)

A function can now return an `@inline struct`. The value is **memory-only**:
it has no WASM representation, so the call has no result. The caller allocates a
slot and passes its address as the hidden **first** WASM parameter (after
`this`); the callee writes the fields into it and returns nothing.

`Signature` gains `hasHiddenDestParam`. `wasmParamCount()` counts the hidden
slot, `wasmParamStartOf()` starts after it, `paramRefs` emits `i32` first, and
`resultRefs` is `None`. `sourceIndexOf(0)` is `-1`; its doc comment states both
meanings of `-1` (hidden slot / past-the-end), because the second is only
unambiguous when the caller checks `wasmParamCount()` first.

- **Callee:** `$sretDest` is WASM local 0 (1 for an instance method). `return p`
  writes one `memory.store` per SROA field at `(dest + memoryOffset)`;
  `return new P()` writes zeros to the slot. Returning anything but a local is
  refused by name.
- **Caller:** mark, allocate, guard, call, read, restore. The mark lives in a
  **WASM local**, so slots are per-call-**frame**: recursion and nested calls
  each get their own, and the slot stack is LIFO. Reads happen before the
  restore.
- **Two consumers, no third:** `f().x` loads one field; `let q: P = f()` copies
  every field into `q`'s locals; a discarded call allocates and unwinds.

The slot comes from a **4 KB static call-temp stack inside the data segment**
(`[16, __data_end)`), which `visitStack` does not scan — it walks
`[__stack_pointer, __heap_base)` — so a slot is never a GC root and the base is
a compile-time constant. The bump pointer is a plain `i32` global; `compileVisitGlobals`
visits only class-typed globals, so it adds no GC edge and no interrupt
threshold. Overflow **aborts** with a message naming the limit; `--sretStackSize`
(structurally identical to `stackSize`) is a follow-up.

Two sites the shape needs:

- **`operandsTostack`**: the hidden slot is operand 0 and belongs to no source
  parameter. Treating `sourceIndexOf(-1)` as "past the end" stopped the walk
  before the first managed argument and never spilled it. Fixed by checking
  `wasmParamCount()` first and advancing both indices past the hidden slot;
  measured load-bearing by reverting it (the fixture's WAT diff is the missing
  spill).
- **The override stub's temp local** is `1 + wasmParamCount()`. Defensive: a
  virtual method returning an `@inline struct` is refused before the stub runs.

**Instance methods.** `$sretDest` sits at WASM local **1** for an instance
method (`this` is local 0), and the return path selects it from
`signature.thisType`. Covered by `inline-struct-sret-instance.ts`: a method
returning the two-field value, and a method that takes an `@inline struct` **and**
returns one — WASM `(this, dest, p.a, p.b, k)` — so the shift and the parameter
flattening are exercised together. Measured load-bearing: with the instance
destination read from local 0, the stores land on `this`, the WAT comparison
fails, and the fixture's runtime assert traps at instantiation.

**The refusal's reach, measured.** Every non-consumer use was compiled as a
probe before the read path was written: `g(f())` (AS100, passing an expression
as a value argument), `f() + 1` (TS2365), `return f()` in an `i32` function
(TS2322), `a[i] = f()` (AS100: `Array<P>` is a refused type argument, and the
store reads the value as a whole), and `obj.field = f()` (AS100: inline nesting
at the field declaration). A bare `f()` is the one use that compiles, and it is
safe: it allocates the slot, passes its address as the hidden destination,
calls, and unwinds — it never reads the slot as a value. It is therefore the
**third consumer** of the memory-only model, alongside `f().x` and
`let q: P = f()`. Pinned in `inline-struct-sret-refusal-reach.ts`.

**Constructors are not sret.** A constructor returns `this`, not a value, so it
must not acquire the hidden destination parameter even when its class is an
`@inline struct` (its declared return type is the class type). `Signature` gains
`sretDisabled`, set only for an inline-struct constructor and part of the
memoization key so a method with the same parameter and return types still gets
the hidden parameter. Without it, `new P()` emitted a constructor with an unused
destination parameter and no result — invalid WebAssembly. Ordinary
constructors keep their existing signature identity.

This also makes the **inferred local forms** value-correct: `let p = new P()`
and `let q = f()` enter SROA (per-field locals, not a heap pointer), and
`let q = p` is intercepted by the local lookup before the whole-value refusal.
The fixture counts calls to prove `let q = f()` emits one runtime call.

**A refused field must not reach codegen.** A class field of `@inline struct`
is inline nesting and is refused at its declaration, but the generated
constructor still called `makeZero` for it and the field's getter/setter were
still compiled — crashing Binaryen's debug-info writer on a local-index
mismatch. Constructor field initialization now skips the refused field, and the
field getter/setter paths return `unreachable` with the declaration diagnostic
as the report.

Refused, unchanged by name: an export and an `@external` import (an ABI
version), a function value, a virtual method, returning anything but a local,
and an `@inline struct` field of another record (inline nesting). Sret **does
not** need multi-value results — the design note's §8 described a problem this
model does not have, because the value never enters the pipeline.

### `@inline struct` at the `@external` boundary (the argument temp)

An `@external` function taking an `@inline struct` now receives the **address**
of a temp the guest materialises, so the import is `(param i32)` — the same
shape `@unmanaged` and `@managed` already crossed in. Before this, `paramRefs`
expanded the record into one WASM parameter per field, so for a two-field record
the import was `(param f32 f32)`: the record's field count, order and types
became part of the host ABI, `layout_hash` did not move (it folds arena
geometry), and the host could not notice — it never sees the record, only the
flattened scalars.

One shape, one contract, three record kinds:

| Declaration | Import signature | What the host gets |
|---|---|---|
| `@unmanaged struct U` | `(param i32)` | a borrowed pointer to the caller's record |
| `@managed struct M` | `(param i32)` | a borrowed reference |
| `@inline struct V` | `(param i32)` | a borrowed pointer to the caller's temp |

- **Signature.** `Signature.externalBoundary` (part of the memoization key)
  makes `wasmParamSlotCountOf` answer 1 for a value-type parameter; `paramRefs`,
  `wasmParamCount`, `wasmParamStartOf` and `sourceIndexOf` all ask it, so a
  boundary signature and a guest signature cannot disagree. The slot's ref is
  `i32` explicitly, not `toRef()` — an `@inline struct`'s ref is a GC heap type.
- **Call site.** One mark per call (a WASM local), one bump by the sum of the
  arguments' rounded sizes, one guard, one restore; each argument is stored into
  `(base + mark + offset)` inside its own operand block, and the address is what
  the call receives. Bumping by the total first is what lets a nested call in the
  argument stream allocate above the whole block.
- **Lifetime.** The restore follows the call node, because the host reads the
  temp while the call runs. That is sound because the host *borrows*:
  `tension_adapter.h` rule 6 (`:57-58`) — "An adapter never caches a pointer into
  guest memory and never holds a slice across a call" — and its only guest-memory
  path is `guest_read(ptr, dst, len)` (`:184`). An async host that retained the
  pointer would need a different contract; the code would not change.
- **Refused, still.** A non-local argument: the temp is filled by copying an
  SROA local's fields, so a call result or a literal has nothing to copy. The
  declaration-time refusal from the first commit of this phase remains as the
  fallback for any boundary signature without the flag.

The temp and sret share one stack, so the 4 KB limit and its abort are one
limit; `--sretStackSize` covers both.

### `@inline struct` on the export side, and single-field value types

**Exports.** An export with an `@inline struct` parameter now declares
`(param i32)` — a byval pointer the **host** supplies — and the callee copies
each field into its SROA locals at entry. It used to declare `(param f32 f32)`
for a two-field record: the field list as the host ABI, the same silent defect
the `@external` side had, in the mirror direction. Refused first, then
implemented, so the refusal remains as the fallback for a declaration that does
not take the byval path.

This is sret's mirror inside the same boundary:

- sret **return**: the callee writes each field to `(dest + offset)` at exit.
- export **parameter**: the callee reads each field from `(ptr + offset)` at entry.

Both keep the value in memory on both sides, and the body runs on SROA locals
either way. The single load per field is also what makes the copy by value: the
caller's later mutation cannot be observed, and the body's writes land in its own
locals (both asserted).

**The pass-by-value model, all four positions:**

| Position | Multi-field | Single-field |
|---|---|---|
| `@external` parameter | `(param i32)` — caller's temp | refused (convention mismatch) |
| export parameter | `(param i32)` — host's byval pointer | refused (convention mismatch) |
| `@external` return | refused (ABI version) | refused |
| sret return (in-module) | `(dest, …)` | `(dest, …)` |

**Single-field value types.** A one-field `@inline struct` parameter was
unusable **anywhere**, not just at boundaries: the parameter binding, `paramRefs`
and the argument expansion all decided "unpack into fields" from
`wasmParamCountOf(...) > 1`, and a one-field record spends exactly one WASM slot.
The binding therefore made an ordinary local of the record type (with `toRef()`'s
GC heap type), `paramRefs` emitted that heap type, and the caller compiled the
argument as a whole value — the refusal. All three sites now key on the type, and
`Signature.fieldCountOf` answers the field count where that is what is meant, so
"one field" and "one slot" stop being the same number.

At a host boundary the single-field shape is **refused**, because the two
conventions disagree invisibly: the C/WASM tool convention (BasicCABI) passes a
struct whose only member is a scalar as that scalar, while this compiler passes
records as pointers. Both are `(param i32)`, so a C module and this compiler link
cleanly and then one reads an address as a number. Boundary detection now
requires two or more fields, so the byval pointer and the temp apply exactly
where the conventions agree.

### `@inline struct` pass-by-value (SROA parameters)

A function parameter of `@inline struct` type now passes by value. The source
parameter becomes one WASM local per field in the callee; the call site expands
the argument into one operand per field, in declaration order.

Source parameter `i` is no longer WASM parameter `i`: for
`(p: P{2}, q: i32, r: P{2})` the WASM operands are `(p.x, p.y, q, r.x, r.y)`.
`Signature` gains `wasmParamCountOf` / `wasmParamStartOf` / `wasmParamCount` /
`sourceIndexOf`, and they are the only place that translation happens.

Two sites that are easy to get wrong, both now covered by fixtures:

- **`getNonParameterLocalTypes`** must use the *WASM* parameter count for
  `numFixed`. With the source count, a parameter's trailing field locals land in
  the "additional locals" list, one extra local is declared, and every body local
  after it — the closure environment included — shifts one slot, silently.
- **`operandsTostack`** asserted the source-arity relationship that flattening
  breaks, and walked parameter types by operand index. It now maps through
  `sourceIndexOf`.

Arity *checks* stay source-arity (`maximum` is how many arguments the user
wrote); only operand emission is flattened.

Refused, unchanged: `@inline struct` as a top-level value and as a field.
(`@inline struct` as a **return** is implemented — see the sret section above.)


Developer-facing: `npm test` now runs the lint step via `pretest`; a fresh
clone without a build fails at `pretest` naming the generated file. Build
first (`npm run build`) as before — the requirement is unchanged, the error
is clearer.

## Unreleased — async test cleanup (the 50cceb36 debt)

The scheduler contract (`50cceb36`) changed the async runtime and did not
update the tests that pinned it. Four layers of the same debt, each reached
only because the previous one stopped failing first. All four are fixed; the
suite is green.

### 1. Two stale `.wat` fixtures

`async-closure-value` and `async-closures-case6` had been failing on `main`
since `50cceb36`. They are stale pre-scheduler snapshots, proven: built at
`78b24c2e` (the commit immediately before the contract) both pass all six
steps. The re-emit is broad, not two lines — 2,082 lines reordering-insensitive
(146 `local.get`, 58 `call`, 25 functions, 14 data segments).

The new emit imports `scheduler::park`, so regenerating the `.wat` files was
not sufficient: `tests/compiler.js` supplied only `env`, and both fixtures then
failed at `instantiate` with `Import #1 "scheduler": module is not an object or
function`. The harness now supplies that module with a no-op body matching the
real `void` signature — `instantiate` remains a real link check, not a skipped
step.

### 2. The entry-shape assertion

The lowered entry gained an `If` at index 3 — `if (!<call>) { return … }`, the
buffered-completion guard — and the async unit test still expected six
statements, so every later index read the wrong node. The assertion is
corrected and the guard is now pinned as structure (an `If` whose condition is a
`UnaryPrefix` over a `Call`, whose then-branch is a `Return`), not merely as a
shifted index.

### 3. `break`/`continue`: `reasonFor` now matches the planner

The planner has treated both as leaves since `50cceb36`, but `reasonFor` still
listed them as refusals — the planner's case wins, so the refusal never fired
and the two disagreed. Adopting the planner's behaviour is what closes the
`for`-continue hang (compile-green, runtime-stuck): neither statement carries an
await, so the region is unaffected by it and needs no resume point. Reverting
would restore the hang. The `EXPERIMENT` marker is gone; the decision stands in
its place.

### 4. `runtime.js` migrated to park/wake/resume

`__taskTick` and four other symbols (`__taskDeliver`, `__taskReportDrops`,
`__taskBufferedEvictions`, `__taskAwait`) were removed with the pull delivery;
`runtime.js` still imported them — 37 references across 5 of its 10 blocks.

- **The entry point is a re-export, not an annotation.** This compiler has no
  `@export` decorator, and the only other route (`--exportRuntime`'s hardcoded
  function list at `src/compiler.ts:432-435`) would export the resume entries
  from every module the flag touches, engine guests included. `export { … } from
  "~lib/task-rt"` in the test guest scopes the entry to the fixture. **No `src/`
  or `std/` change.**
- **The vacuous-pass guard.** `parkState` returns early when no task table is
  bound (`task-rt.ts:209`) and `__taskResume` returns immediately too — so an
  unbound guest parks nothing, announces nothing and resumes nothing, silently.
  A test that asserted a value would pass by asserting nothing (measured: the
  first probe gave `parked=[]`, `seen=0`, no error). Every host-driven case now
  calls `__taskBindTable(64)` in setup and asserts the park was observed
  **before** it resumes, so an omitted bind fails loudly.
- **Retired-mechanism cases rewritten, not weakened.** `early completions` now
  asserts the park announcement, that nothing is buffered in the guest, and that
  `__taskResume` runs the task to its terminal; the early/late/eviction
  distinction is the host's `scheduler::RecentCompletions` behaviour and is
  asserted in the engine fixtures. `dropped completions` now asserts `__taskFail`
  (the status on the awaited record, one resume, a stale id resuming nothing).
  Tick ordering becomes drain-to-empty.

`npm test` is green end to end.

## 0.9.0

### `@managed struct`

A GC-owned record with a C-compatible layout: heap-allocated, traced, and
nullable, where `struct` is borrowed and `class` guarantees no layout. The
reference **is** the fields pointer, so `host.call(foo)` receives the record's
fields with no conversion, `sizeof<Foo>()` is C's size, and `offsetof<Foo>("b")`
is the field's offset from that pointer.

```ts
@managed struct Vec3 { x: f32 = 0; y: f32 = 0; z: f32 = 0; }
const v = new Vec3();     // GC-owned
submit(v);                // the host sees the Vec3's fields
```

Three kinds, and the choice is about ownership and layout, not about syntax:

| | GC | C layout | passed to the host as |
|---|---|---|---|
| `class` | yes | no | a reference |
| `struct` | no | yes | a pointer the author supplies |
| `@managed struct` | yes | yes | the fields pointer |

A managed struct is **final** — no inheritance, no virtual dispatch — because a
subclass would put fields past the extent `sizeof` already reported. It refuses
`T[N]` fields and `COPY_STRUCT` by name (see *Known limitations*).

### Known limitations

- **`T[N]` fields in any constructed type crash the compiler** — pre-existing,
  and not specific to managed structs: field initialization cannot fill an
  extent (`makeZero` has no `FixedArray` case), so `new` on any type with an
  inline array traps the build. `@managed struct` refuses such a field by name
  rather than promise it; the fix is a separate compiler phase. Borrowed
  `struct` keeps `T[N]` as 0.8.x had it.
- **Inline arrays of GC references are untraced** (`isManaged<Other[4]>()` is
  false), so they are refused on a managed struct.
- **`COPY_STRUCT` does not accept a managed struct.** It is a raw byte copy; the
  write barrier it skips is exactly what a managed destination needs. A managed
  copy needs a method with the barrier in it, not a primitive.
- **The host must not retain a pointer past the call.** `host.call(foo)` roots
  the object across the call, so a synchronous host is safe; nothing keeps it
  alive after the call returns. `@abi.transfer` is not implemented, so this is a
  contract, not a checked property.

### `struct` stays unmanaged, permanently

The 0.9.0 flip announced in 0.8.0 is **cancelled**. `struct` means
`@unmanaged struct` today and always will. A plain `struct` no longer warns: the
TS6385 deprecation that 0.8.x emitted is removed. Code that added `@unmanaged`
to silence it keeps working unchanged, and is now redundant but valid.

### Breaking changes

None from 0.8.x. Every 0.8.x program compiles to the same bytes; `class` and
`struct` are untouched, and this release only *removes* a warning.

## 0.8.1

Republish. The 0.8.0 tarball shipped a `dist/` of five files and 488 bytes: the
publish ran without a build, so `dist/` contained only its tracked members;
`files: ["dist/"]` packs the ignored artifacts when they exist, so running the
build first is the fix. `package.json` exported `./dist/asc.js`, which was not in
the tarball. Every install failed to load:

```
ERR_MODULE_NOT_FOUND: Cannot find module .../dist/asc.js
  imported from .../bin/tensionscript.js
```

0.8.1 republishes with the built `dist/` and adds a `prepublishOnly` guard —
`npm run build && npm run publish:verify`, where `scripts/verify-dist.js`
asserts the artifacts exist and clear a sanity floor — that refuses to publish
if `dist/asc.js` or `dist/assemblyscript.js` is missing or undersized.

**No API changes from 0.8.0.** Any consumer that managed to install 0.8.0 could
not load it; 0.8.1 is a drop-in replacement.

*Diagnosis, corrected by measurement.* The first account of this said
`.gitignore` excludes `dist/` from the tarball. It does not: `files: ["dist/"]`
wins, and the ignored artifacts — `asc.js`, `assemblyscript.js`,
`*.generated.d.ts`, `*.map`, `importmap.json`, `web.js` — are packed whenever
they exist on disk. Measured with `npm pack --dry-run`, the built tree packs 13
files under `dist/` and the same tree with those artifact groups removed packs 5.
The failure was an absent build, not an exclusion rule. So `prepublishOnly`
running the build is the load-bearing half of the guard, and `publish:verify` is
the assertion that the build landed; either alone is insufficient, because a
build that emits nothing looks like one that worked until you look.

*Discipline note extension.* Verify the tarball loads, not just that the version
is on the registry. `npm view <pkg> version` proves the version exists;
`npm pack` + `tar -tzf` + install + `--version` proves it works. The guard makes
the second check unnecessary for this failure — the publish now aborts rather
than shipping an empty `dist/` — but the check is still what tells you whether
the artifact the registry serves is the one you built.

```
npm view @yabgu_gm/tensionscript version --prefer-online
npm pack @yabgu_gm/tensionscript@0.8.1
tar -tzf yabgu_gm-tensionscript-0.8.1.tgz | grep dist/asc.js
tar -tzf yabgu_gm-tensionscript-0.8.1.tgz | grep dist/assemblyscript.js
npm install -g yabgu_gm-tensionscript-0.8.1.tgz
tensionscript --version
```

After publishing 0.8.1, the maintainer should deprecate 0.8.0 so its installers
are warned:

```
npm deprecate @yabgu_gm/tensionscript@0.8.0 'Broken tarball (no dist/); install 0.8.1 or later'
```

0.8.0 cannot be unpublished after 72h; deprecation is the correct response.
0.8.1 is a drop-in replacement.

## 0.8.0

The interop bundle: the guest describes a C record in the language, and the
compiler lays it out the way C does.

### `sizeof<@unmanaged T>` is the record's size

`sizeof<T>()` on an `@unmanaged` class now returns the record's layout size:
the field offsets with inter-field padding, rounded up to the record's
alignment — C's `sizeof`. It was the pointer width (4) before variant B, and
then the offset where the last field ends, which under-sized every record whose
last field is narrower than the record's alignment (`{a: u8; arr: u32[8]; b: u8}`
is 40 bytes, not 37).

`offsetof<T>()` with no field argument is the same number; both builtins read
the layout, so they move together. A field's offset
(`offsetof<T>("field")`) is unchanged, so addressing is unchanged.

**Breaking** only for a consumer that read `sizeof` on an `@unmanaged` record
and expected the pointer width. There is no such caller in the tree — the only
in-tree `sizeof<T>()` is `sizeof<usize>()` — which is why this is a minor
release. A managed class is unaffected: `sizeof<managed T>` is still 4.

### `COPY_STRUCT`

`std/assembly/util/bytes.ts`: `COPY_STRUCT<T>(dst, src)` is
`memory.copy(dst, src, offsetof<T>())` — the struct-copy primitive, matching C's
`memcpy(dst, src, sizeof(S))` now that `offsetof<T>()` is the record's size.

`load<T>` / `store<T>` are **reference operations**, not struct copies: they
read and write one word at a `@unmanaged` reference, which is what the
allocator's block links want. The originally planned refusals for them were
dropped (`docs/interop-scope.md` §6.3, `tlsf.ts`'s six sites); `COPY_STRUCT` is
the struct-copy path.

### `struct`

`struct Foo { … }` is `@unmanaged class Foo { … }` at 0.8.0 — the same keyword
the same declaration, one decorator, no second code path. A plain `struct`
emits a deprecation warning (TS6385), because at 0.9.0 the same spelling becomes
a managed C-layout reference type.

### Post-type `@` attributes

An attribute may follow the type: `m00: f32 @abi.alias("m00")`. On the same
line it attaches to the type; after a newline it still attaches to the *next*
member, as before.

### `@abi.alias` and `abiNameOf`

`@abi.alias("name")` names a field for the other side of an ABI without moving
it; `offsetof<T>("field")` keeps taking the TypeScript name, so an alias can
never shift a byte. `abiNameOf<T>("field")` returns the alias, or the TypeScript
name when there is none. Compile-time; no runtime cost. With two aliases on one
field the first is canonical.

### `@inline` is reserved

`@inline` on a struct declaration is a hard error (AS100, "Not implemented:
value types"). Value types are a later release; the reservation refuses by name
rather than parsing and ignoring.

### `T[N]`: inline fixed-size arrays

`f32[4]`, `u32[8]`, `f32[6]` — `N` inline elements, not an `Array<T>`
reference. Usable as struct fields, with `sizeof`/`offsetof`, indexed reads and
writes, compound assignment and `++`/`--`. The layout aligns a field by its
*element's* alignment (4 for `f32[6]`, whose 24-byte size is not a power of
two), so `{a: i32; arr: f32[4]; b: i32}` is 24 bytes with `arr` at 4 and `b` at
20. At `-O3` a constant-index access is two instructions (`local.get`,
`f32.load offset=N`).

`T[N]` is what `tension-input`'s `StateRecord.keysHeld[8]` and
`PadRecord.axes[6]` were hand-addressed for.

## 0.9.0 preview

Plain `struct` becomes a **managed** C-layout reference type; the borrowed
(by-value, unmanaged) form is spelled `@unmanaged struct`.

Migration: mark every declaration that intends the borrowed form now.

```ts
// 0.8.0 -- warns (TS6385), and means @unmanaged
struct Vec3 { x: f32; y: f32; z: f32; }

// 0.9.0 -- the spelling that keeps meaning the borrowed form
@unmanaged struct Vec3 { x: f32; y: f32; z: f32; }
```

The TS6385 warning is the signal. `sizeof<managed T>` stays the reference width
(4); `sizeof<@unmanaged T>` stays C's `sizeof`.
