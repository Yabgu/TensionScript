# Roadmap

Deferred features, durable findings, and the workflow this repository now uses
— one line each, with the reason it is not built yet. What shipped is in
[`../CHANGELOG.md`](../CHANGELOG.md); what each feature does is in
[`showcase.md`](showcase.md).

This page replaces the per-phase scoping documents (`*-scope.md`,
`session-findings.md`). Those recorded the measurements a phase rested on; this
keeps the conclusions and drops the working papers. Where a reason names a
number, the number is a measurement, and the fixture that pins it is in
`tests/`.

## Workflow

TensionScript work uses the **PR pattern**:

- Branch per phase, commit locally.
- Push the branch — do **not** push `main` directly.
- Open a PR. The `pull_request` trigger runs CI, and the PR view shows it.
- Merge only when the PR's checks are green.

The direct-to-main push at `ecafc016` was a one-time policy deviation and is the
**last** direct push. From that point, every TensionScript change goes through a
PR.

**Why.** The `pull_request` trigger surfaces the checks in the PR view directly,
so CI is verifiable without `gh api commits/<sha>/check-runs` — which returned
404 for both repositories in this environment even while git over SSH worked and
the token was valid, i.e. an SSO authorization gap rather than a workflow fault.
The PR view is the review surface, the CI status surface, and the durable link
for the change.

The engine adoption in the Tension repository already uses PRs — unchanged.

## Deferred language features

- **`Array<@inline struct>` (the span-equivalent shape)** — a value array needs
  elements stored inline in the heap with copy-out reads; `Array<T>` currently
  holds elements at `elementType` stride and hands out references. Deferred
  until a consumer needs it.
- **Inline nesting inside an `@inline` value (SROA flattening)** — a plain
  struct inside a plain struct is refused by name (`AS100`, "sub-phase B"): the
  outer is one WASM local per field, so the inner would have to be flattened
  into the same leaves. 14 sites, each the same three-line recursion over an
  existing structure; deferred until a value-type consumer needs it. An
  `@inline` field inside an **`@unmanaged`/`@managed`** record already works.
- **`T[N]` fields in an `@inline` struct** — deep SROA: N locals per array
  field, plus a `makeZero` arm for `FixedArray` (which asserts today).
- **GC-reference fields in an `@inline` struct** — an SROA'd field has no
  address, and the write barrier's `__link` needs one. The implementable
  options are a mixed representation or a refusal; refused for now.
- **Closure capture of an `@inline` value** — needs an inline-in-heap
  environment field, which is the deferred case above. Capture is refused by
  name rather than silently aliasing.
- **`@external` return of an `@inline` struct** — an ABI version: the host would
  have to write `sizeof<T>` bytes into a slot it never allocated. The last
  refused boundary case.
- **SROA for top-level statics** — a global is one `i32` slot; a value needs one
  per field, so per-field WASM globals or a shadow slot.
- **`Span<T>` / `ref struct`** — stack-only view types; they depend on
  `stackalloc`, which is a separate feature.
- **`lazy-await-type-inference`** — `@lazy await` requires a declared type
  (`TS6399`). Lifting it needs a post-resolution transform hook (none exists —
  `applyInTreeTransforms` is `afterParse` only) or return-type inference for
  calls.
- **`w3-await-context-walk`** — the unawaited-`spawn` warning fires only where
  the Task is certainly discarded (statement position); `let t = spawn(f)` never
  awaited needs an await-context walk the transform does not have.
- **`lazy-captured-binding-deferred`** — a captured `@lazy` binding takes the
  eager path with `TS6398`: the right answer, evaluated early. The deferred path
  needs the same post-resolution hook.
- **`--sretStackSize`** — the 4 KB stack limit is shared by sret and the
  `@external` temp, so one option would cover both, and it would be structurally
  identical to `stackSize`.
- **`unmanaged-single-field-tool-convention`** — ratified *accept*: a one-scalar
  `@unmanaged struct` passes as a pointer where BasicCABI passes the scalar. The
  engine's adapter reads records through `guest_read(ptr, len)`, so changing it
  would break a live ABI. Revisit only if a C-authored consumer appears.
- **`--create=false` in the compiler test harness** — `tests/util/options.js`'s
  boolean parser reads it as `true`, so there is no "compare only" on the
  command line; passing it regenerates fixtures from whatever build is present.

## Engine adoption

The engine-side plan — phases, gates, and the byte-identical proofs — lives in
the Tension repository (`docs/engine-adoption-plan.md`). Items that are this
compiler's to solve:

- **Wire records with sized enums** — a narrower enum only saves bytes where an
  enum is *stored*, and the guest has zero enum-typed record fields and zero
  enum arrays. The wire records that carry `kind`/`state`/`flags` as `u32` are a
  different question: shrinking a field moves the layout, so the C side has to
  agree first. Type safety, not a byte win.
- **`@external` sized-enum boundary** — prediction only, unverified: whether the
  host's enum width matches a sized guest enum at the boundary has not been
  measured.
- **`@abi.align(N)` on the engine's transform records** — the attribute now
  exists; whether the GPU path actually needs 16-byte alignment on `MotionUpdate`
  / `BoneUpdate` / `Renderable` / `Transformf` / `Aabbf` is unmeasured. Applying
  it does not move `layout_hash` (those records are not in the manifest).

## Durable findings

- **Run the self-compile before merge.** `tsc` and esbuild both miss
  AS200-class errors that the compiler itself catches; `npm run bootstrap:debug`
  is the gate that sees them.
- **A site list is never final.** Pre-work enumerations are the first pass and
  fixtures are the second; every phase found at least one site the list missed.
- **A post-type attribute is accepted and ignored unless something reads it.**
  The parser attaches every same-line `@name` to `type.attributes`, and only the
  consumer decides whether it means anything — so an unconsumed attribute
  compiles clean and does nothing. Memory-model and alignment attributes in that
  position are therefore refused by name (`TS6392`, `TS6410`) rather than
  silently dropped.
- **`@unmanaged` fields are pointers.** A record's size and alignment do not
  transfer into a containing record unless the field is *inline*; alignment
  crosses into a record only by inlining the aligned thing.
- **`layout_hash` (engine) folds field names beside offsets.** The nine records
  it lists are name-frozen permanently — renaming a field there is a schema
  change, not a tidy.
- **Beware the vacuous probe.** A probe that cannot find its input can still
  look successful: a missing `dist/` yields `ERR_MODULE_NOT_FOUND` and an empty
  grep reads like a clean result. Confirm the artifact exists, and read the
  output, before believing the number.
- **State the counting rule beside the count.** Declaration counts differ by
  whether comment mentions, plain `struct`, and decorator placement are counted;
  the same tree can be "35" and "46" and both be right under different rules.
- **A check that cannot fail is not a check.** Every fixture here is written so
  that reverting the change makes it fail; a byte-comparison gate is only
  meaningful because in-place builds reproduce.

## Open defects

- **SROA value-return corruption (blocks the engine's `Quat`-as-value conversion).**
  An `@inline` struct local whose name is reused across scopes — two sibling
  loops, the arms of an `if`, or plain shadowing — aborts compilation with
  `duplicate local name` at `compileSroaLocal` (`compiler.ts:12259`). Renaming
  the local makes the identical program compile, so the SROA local appears to be
  named without its scope — a **hypothesis, not a diagnosis**: the naming code
  has not been read. Separately, a method returning a plain struct corrupts
  memory under sustained load in the engine (fault at ~1,500 frames, `0xb7b50008`
  — a float used as a pointer). **Related to but not the same as that
  corruption; both touch SROA local handling, and a common cause is unproven.**
  Reproducer: `tests/benches/value-return-reductions.ts` and
  `run-reductions.sh` (the crash); the engine's
  `tension-framework/tests/benches/quat-value-bench.ts` (the corruption).
