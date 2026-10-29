# Fork posture

What this fork is, what it shares, what it diverges on, and how it stays
current. This is the decision, not a history. Every number carries the commit it
was read at, because these counts move — a stale one is how the README came to
claim it tracked upstream.

---

## 1. What this fork is

TensionScript is a **fork of AssemblyScript**, published as
`@yabgu_gm/tensionscript@0.10.0`, and the guest language for the
[Tension](https://github.com/Yabgu/Tension) engine: game logic compiles to
WebAssembly, and the engine's C side reads the records the guest declares.

**Base: AssemblyScript `b6bda05c`** — upstream's tip at fork time ("chore: Update
Binaryen and other dependencies (#3035)", 2026-07-21), and an ancestor of this
tree at `ef18ae56` (2026-10-27). The fork is not built against upstream; the base
is a reference point.

## 2. Why it is a fork

Six things are in scope here that are not patches upstream would take, because
they restructure the type system or the async contract rather than extend it.
The user-facing reference for each is [`showcase.md`](showcase.md).

- **The C-model interop taxonomy.** `@unmanaged`, `@managed` and `@inline`
  structs split one record declaration into three memory models over a
  C-compatible layout, with `T[N]` inline arrays, `@abi.alias`, `COPY_STRUCT` and
  a `sizeof` that includes trailing padding. No other WASM-target language
  exposes that choice. See [showcase §1](showcase.md)–[§4](showcase.md).
- **The scheduler contract.** Async is the engine's, not JavaScript's:
  `park`/`wake`/`resume` over a push-path host loop, `Task` in place of
  `Promise`. See [showcase §5](showcase.md),
  [`scheduler-contract.md`](scheduler-contract.md).
- **Sized enums.** `enum Foo: u8 { … }` makes an enum *be* its storage class, so
  the `AS200` class — an `i32` enum that cannot enter a `u8` field without a cast
  — becomes unrepresentable. See [showcase §8](showcase.md).
- **`@lazy` expressions.** Three forms (`@lazy f()`, `@lazy await f()`,
  `@lazy await spawn(f)`) deferring evaluation to first read. See
  [showcase §7](showcase.md).
- **Closures and async/await**, lowered here rather than by a user-installed
  transform. See [showcase §5](showcase.md), [§6](showcase.md).
- **The bootstrap self-compile.** `npm run bootstrap:debug` compiles `src/` with
  this compiler, twice, and requires the two `.wast` outputs to be byte-identical:
  **229 ordering errors → 0**. It is the only
  gate that enforces this language's typing rules on this compiler's source —
  `tsc` and `esbuild` have both accepted code the self-compile refused.

## 3. What it deliberately shares

The sharing is a decision, not a residue, and it is bounded:

- **The parser's structure.** `parseEnumDeclaration`, `parseExpressionStart` and
  the tokenizer are AssemblyScript's, extended in place — the sized-enum arm is
  one `':'` + `parseType` inside an existing function, not a new parser.
- **The standard library's core.** `std/assembly/rt/*`, the collections and the
  math are upstream's, carried with the fork.
- **The Binaryen backend.** Emission is AssemblyScript's `module.ts`; this fork
  changes what is emitted, not how.
- **The test discipline.** The `tests/compiler` harness is upstream's, and each
  fixture carries a committed `.wat` snapshot, so a change that alters emitted
  code has to show itself as a diff. That is what makes a backward-compat claim
  measurable rather than asserted — this fork's sized-enum phase proved
  compatibility by leaving 305 pre-existing snapshots byte-identical.

## 4. What it does not share

- **Not the tracking claim.** `README.md` once said *"everything else tracks the
  upstream project it was forked from"*. Measurable false; corrected in #31, and
  this file supersedes it.
- **Not the merge.** 34 files and **+14,464 / −153** in `src/` + `std/` against
  `b6bda05c` (measured at `ef18ae56`, 2026-10-27). A merge of that shape is a
  rewrite wearing a merge's name.
- **Not the count, as a constant.** **154 commits ahead of the base** at
  `ef18ae56` (2026-10-27), against **117** recorded at `c3be16fc`. Both are right
  for their commit, which is why the number is never quoted as a standing fact.
- **Not the compatibility claim.** The fork does not claim AssemblyScript
  compatibility. It claims fork-internal compatibility: a program that compiles
  on 0.9.0 compiles unchanged on 0.10.0.

## 5. The sync cadence

- **The base stays pinned** at `b6bda05c` with the date it was checked. There is
  one remote (`origin`); upstream is read with
  `git ls-remote https://github.com/AssemblyScript/assemblyscript main` rather
  than tracked, so "how far behind" is a documented query, not an empty one.
- **Quarterly review.** Once a quarter: what landed upstream, what conflicts with
  a divergence here, what is worth cherry-picking, and what is refused by name.
  The unit of sync is the **cherry-pick**, not the merge — the base is an
  ancestor, so that stays available.
- **Each review is recorded** as a CHANGELOG entry naming the upstream range and
  what was taken or refused; if enough accumulate they move to
  `docs/upstream-reviews/`, with the same entry format. **No review is recorded
  yet** — the base has not moved since the fork, so the first entry will name the
  range from `b6bda05c` and state what it found.
- **The discipline.** Measure the change against this tree before deciding, and
  cite the fixture or the source for every claim. A feature is not refused for
  lacking an upstream equivalent, and not adopted for having one.

## 6. Deferred items and their frame

Nothing is deferred without a reason, and nothing is claimed without a citation.
The list is [`roadmap.md`](roadmap.md); the user-facing view is
[showcase §9](showcase.md).

- **Inline nesting** — a field of a value type has no address of its own.
- **`T[N]` fields in `@inline struct`** — deep SROA: N locals per array field.
- **GC-reference fields in `@inline struct`** — the write barrier needs an
  address; an SROA'd field lives in a local.
- **Closure capture of an `@inline` value** — needs inline nesting first.
- **`@external` return of `@inline struct`** — an ABI version: the host would
  have to write `sizeof<T>` bytes into a slot it never allocated.
- **SROA for top-level statics** — a global is one `i32` slot.
- **`const borrow`** — not defined in either repository; recorded so the absence
  is visible rather than silently dropped.
- **`lazy-await-type-inference`** — a memo cell that crosses a suspension must be
  a declared type (`TS6399`).
- **`w3-await-context-walk`** — "is this `spawn` ever awaited" needs an
  await-context walk the transform does not have.
- **`lazy-captured-binding-deferred`** — a captured `@lazy` binding takes the
  eager path (`TS6398`): correct answer, early evaluation.
- **`wire-records-with-sized-enums`** *(engine)* — the C side's enum width must
  be measured in the Tension repository first; `layout_hash` is not verifiable
  from this tree.
- **`sized-enum-external-boundary`** — an `@external` signature taking a sized
  enum is unprobed; `(param i32)` promotion is the prediction, not a measurement.

## 7. The posture

TensionScript is a fork. It tracks AssemblyScript's parser and standard library
where that is useful, and it does not aim for upstream merge: upstream's
repository is a reference, not a target. Features this language needs and
AssemblyScript cannot express — the memory-model split, the scheduler contract,
sized enums, `@lazy` — are in scope here, and a feature is not refused for
lacking an upstream equivalent. Where the fork tracks upstream, it names the
commit; where it diverges, it says so with a fixture or a measurement, and the
divergence is deliberate.

No apology for being a fork, and no claim that this is what upstream should have
done. This is what the fork is, what it is for, and how it stays current.
