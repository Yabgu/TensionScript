# TensionScript

**A TypeScript-shaped language for WebAssembly** — the compiler Tension's guests
are written in.

TensionScript compiles TypeScript syntax to WebAssembly using
[Binaryen](https://github.com/WebAssembly/binaryen). It is maintained for the
[Tension](https://github.com/Yabgu/Tension) engine as a fork of
[AssemblyScript](https://github.com/AssemblyScript/assemblyscript). The command
and the package are its own: it does not collide with `asc` (AssemblyScript's
compiler) or `tsc` (TypeScript's), so a project that installs both compilers
always resolves the one it named.

**Current version: 0.10.0.** The [feature showcase](docs/showcase.md) has one
section per capability, with runnable examples and the refused forms; the scoping
notes it draws from are in [`docs/`](docs/).

## Install

```sh
npm install @acakar/tensionscript
```

## Usage

The command is `tensionscript`. From an npm script, `tensionscript …` resolves to
the installed package's binary; from a shell, `npx tensionscript …` does:

```sh
npx tensionscript assembly/index.ts -o build/index.wasm --runtime incremental --target release
```

The compiler is also a library, under the package's `asc` subpath:

```js
import tensionscript from "@acakar/tensionscript/asc";
```

## Status

TensionScript is a **fork of AssemblyScript**, and it does not aim for upstream
merge: AssemblyScript's repository is a reference, not a target. The base is
pinned at `b6bda05c` (upstream's tip at fork time) and the fork is **154
commits ahead of it**, measured at `ef18ae56`. Why the fork exists, what it
shares, and how it stays current: [`docs/fork-posture.md`](docs/fork-posture.md).

### What this fork adds

- **C-model interop.** `@unmanaged struct` (a plain C-shaped record),
  `@managed struct` (a GC-owned record with the same layout), `T[N]` inline
  arrays, `@abi.alias` + `abiNameOf` (a field's C name, distinct from its
  TensionScript name), `COPY_STRUCT`, and a C-compatible `sizeof` that includes
  trailing padding. A `layout_hash` computed against the engine catches layout
  drift when a session opens. See [showcase §1](docs/showcase.md) and
  §2 for `@managed struct`.
- **Value types.** `@inline struct` gives a record value semantics: SROA locals,
  copy on assignment, flattened (SROA) parameters, sret returns through a hidden
  destination parameter, an `@external` argument temp, and an export-side byval
  mirror. One-field records are refused at every boundary — the C/WASM tool
  convention passes a one-scalar struct as the scalar itself, which would
  disagree silently. See
  [showcase §3](docs/showcase.md).
- **Memory-model overrides.** A *use* can name the model it wants
  (`v: @inline Vec3`) while the declaration keeps its own. `@managed` ↔
  `@unmanaged` is the free cell; `@inline` over a pointer declaration is the
  boundary cell (import temp copy, export byval). Three cells are refused by
  principle: a use cannot confer storage the value does not have. See
  [showcase §4](docs/showcase.md).
- **Async/await.** `await` is the marker. The scheduler contract is
  park / wake / resume with the task table owned by the guest; the shipped
  implementation is the push path (the pull path was retired in 0.7.0).
  Host-driven runtime tests cover it. See
  [showcase §5](docs/showcase.md).
- **Closures.** Capture, a synthesized environment class, and `this`/environment
  unification. The captured binding has exactly one home. `this` in an arrow
  function resolves to the nearest enclosing non-arrow receiver — TypeScript's
  rule. See [showcase §6](docs/showcase.md).
- **Lazy expressions.** `@lazy` defers an expression's evaluation to the binding's
  first read, memoized. Three forms: `@lazy f()` (deferred, synchronous),
  `@lazy await f()` (deferred, awaited at the read), and
  `@lazy await spawn(f)` (launched at the declaration, joined at the read).
  `spawn` is the eager primitive. See
  [showcase §7](docs/showcase.md).
- **Bootstrap self-compile.** The compiler compiles its own source: 229 errors
  down to 0, with the `.wast` fixpoint byte-identical across the stages.

### What the fork deliberately shares

The divergence is bounded, and the sharing is a decision rather than an accident:
the **parser structure**, the **standard library's core**, and the **Binaryen
backend** are AssemblyScript's. Where the fork extends one of those, the extension
lands with fixtures — the `@lazy` prefix arm sits inside AS's expression dispatch,
the record layout builds on AS's `Type` machinery, and std gains
`task.ts`/`task-rt.ts` rather than replacing anything.

## Differences from TypeScript

- **No exceptions.** `try`/`catch` is `AS100: Not implemented: Exceptions`.
- **No implicit `any`.** The type system is strict; a value has a type or the
  program does not compile.
- **`async` is the scheduler's contract, not `Promise`'s.** There is no
  microtask queue and no `Promise<T>`; an async call produces a `Task<T>`, and
  awaiting it parks the current task until the host resumes it.
- **Structs are C-shaped, not TypeScript classes.** `@unmanaged struct` and
  `@managed struct` have C layout and `sizeof`/`offsetof`; a class is a GC
  reference, as in AssemblyScript.

## Differences from AssemblyScript

The fork is a fork. The divergence is deliberate, it is bounded, and each change
lands with fixtures — see *What this fork adds* above for the list, and
[`docs/fork-arc-scope.md`](docs/fork-arc-scope.md) for the measurement that
established the posture. Features AssemblyScript cannot express — memory-model
overrides, the scheduler contract — are in scope here; a feature is not rejected
for lacking an AS equivalent.

## What's next

[`docs/fork-posture.md`](docs/fork-posture.md) is the frame: what this fork is,
what it deliberately shares with AssemblyScript, what it diverges on, and the
quarterly sync cadence. [`docs/showcase.md`](docs/showcase.md) is the
per-capability reference — examples, semantics, and what each feature refuses.
[`docs/fork-arc-scope.md`](docs/fork-arc-scope.md) sequences the remaining work.
Deferred and named, each with its reason in
[`docs/session-findings.md`](docs/session-findings.md):

- **Inline nesting** — an `@inline struct` as a field of another record.
- **`T[N]` fields in `@inline struct`** — deep SROA, one local per element.
- **GC-reference fields in `@inline struct`** — an SROA'd field has no address,
  and the write barrier needs one.
- **Closure capture of an `@inline` value** — needs inline nesting first.
- **`@external` return of `@inline struct`** — an ABI version.
- **SROA for top-level statics** — per-field globals, or a shadow slot.
- **`lazy-await-type-inference`** — lifting `@lazy await`'s declared-type
  requirement (`TS6399`).

The full deferred list, with the reason for each, is
[showcase §9](docs/showcase.md) and [posture §6](docs/fork-posture.md).

## Links

- Tension (the engine these guests run on): https://github.com/Yabgu/Tension
- TensionScript (this compiler): https://github.com/Yabgu/TensionScript
- Fork posture — what the fork is, what it shares, how it stays current:
  [`docs/fork-posture.md`](docs/fork-posture.md)
- Fork arc and phase sequencing:
  [`docs/fork-arc-scope.md`](docs/fork-arc-scope.md)
- Session findings — what each measurement found, and the traps:
  [`docs/session-findings.md`](docs/session-findings.md)
- Scheduler contract: [`docs/scheduler-contract.md`](docs/scheduler-contract.md)
- Changelog: [`CHANGELOG.md`](CHANGELOG.md)

## Attribution and license

Based on AssemblyScript, Apache-2.0 licensed. Original project at
https://github.com/AssemblyScript/assemblyscript.

The `NOTICE` file retains the original project's attribution, and the license is
the Apache License 2.0 (`LICENSE`).
