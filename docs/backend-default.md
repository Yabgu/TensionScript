# The stackful backend: `auto`, the config, and what an artifact declares

## What `auto` means

`--stackful-backend` defaults to **`auto`**, and `auto` resolves to **fiber** on every
target. Fiber is the portable lowering: a suspension is a call to the host's park import,
the artifact carries no wasm proposal, and one artifact serves Linux, Windows and macOS.

`continuation` remains — it is Linux-only by construction (I16: the wasm feature
declaration is module-wide, and wasmtime refuses such a module off x86-64
Linux/macOS before it executes) — and is chosen explicitly.

`promise` also remains, and is a third thing rather than a flavour of the other two: a
**library module** (an `await` in a function, no exported `main`/entry) has no root for a
stackful shell to resume, so it compiles only this way. `auto` never selects it.

| value | what it emits | target class |
|---|---|---|
| `auto` (default) | the fiber shell — no `cont`, no tags, a host park | `portable` |
| `fiber` | the same artifact as `auto` | `portable` |
| `continuation` | `cont.new`/`suspend`/`resume`, a `$ct` type, three tags | `linux-only` |
| `promise` | `__asyncPump` state machines | `portable` |

## Precedence: flag > config > default

1. **`--stackful-backend=<value>`** always wins. It never disappears.
2. **`asconfig.json`** fills it when the flag is absent. The file is the one the compiler
   already knew how to find — `--config <path>`, defaulting to `asconfig.json` in the base
   directory — so this round added **no new config mechanism**:

   ```json
   { "options": { "stackfulBackend": "continuation" } }
   ```

   or per target:

   ```json
   { "targets": { "release": { "options": { "stackfulBackend": "continuation" } } } }
   ```

3. **`auto`** applies when neither says anything.

Measured, three runs of one guest:

| where the value came from | artifact |
|---|---|
| nothing | `backend=fiber`, 313 B |
| `asconfig.json` | `backend=continuation`, 23,618 B |
| `asconfig.json` **and** `--stackful-backend=fiber` | `backend=fiber`, 313 B — the flag wins |

**Choosing `continuation` enables `--enable stack-switching` for you.** A user who asked
for the backend asked for everything it needs; the flag is still accepted and changes
nothing.

## What the artifact declares

Two custom sections, both written by the compiler:

```
tension.stackful-backend   "fiber" or "promise"; absent means continuation
tension.requires           backend=<word>
                           target=<portable|linux-only>
                           features=<comma list, or empty>
```

`tension.stackful-backend` predates this round and every existing reader reads it, so it
stays. Its encoding is "absence means continuation", which is why `promise` is now written
explicitly — a promise module that wrote nothing would be read as a continuation one.

`tension.requires` is the capability declaration. Only **features a host must configure
before loading** are listed (`stack-switching`, `shared-memory`); bulk memory and sign
extension are universally on and cannot be refused, so listing them would be noise.

Example, from `tension-core/tests/programs/build/count.wasm`:

```
backend=continuation
target=linux-only
features=stack-switching,shared-memory
```

## What the host does with it

`tension-core` reads `tension.requires` **before instantiating** and refuses a mismatch by
name, exit 2, carrying both sides:

```
tension-core: this guest requires `target `linux-only` (this host is `windows`), feature
`stack-switching`` (it declares backend `continuation`, target `linux-only`, features
[stack-switching]) and this host provides backend `continuation` on `windows`,
stack-switching off, shared-memory on — refusing by name, nothing was run
```

A guest whose two sections disagree is refused too, because that artifact is not one the
compiler wrote:

```
tension-core: this guest's `tension.requires` says backend `continuation` but its
`tension.stackful-backend` says `fiber` — refusing by name, the artifact is inconsistent
and nothing was run
```

**Before this round** a continuation artifact on a host without the feature failed inside
wasmtime, naming neither side:

```
Error: failed to parse WebAssembly module
Caused by:
    cannot define continuation types when stack switching is disabled (at offset 0x26)
```

## A note for anyone whose build stopped compiling

A program with an `await` and **no exported `main` or entry export** is a library module:
fiber and continuation both refuse it (`the stackful backend requires an exported main`),
because a shell resumes one function and there is none. Add `--stackful-backend=promise`,
or export an entry. The programs that need this in this tree are named in
`scripts/build-test-programs.mjs` (`PROMISE_FLAGS`).
