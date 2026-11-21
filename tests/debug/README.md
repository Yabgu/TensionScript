# Debug harness

Runs TensionScript guests under lldb against standalone Wasmtime and asserts
what a debugger sees: that a source breakpoint resolves, where it stops, and
which locals are live. It does not assert on wasm bytes — debug metadata is not
byte-stable; the contract is behaviour.

The harness needs only this repo plus an lldb (installed from npm) and a pinned
Wasmtime (downloaded on first use). It does not build or run the Tension engine.

## Run

    npm install             # installs the platform lldb (optionalDependency)
    npm run build           # dist/ must exist (the harness refuses without it)
    npm run test:debug

Wasmtime is pinned in `wasmtime.version` and `package.json`'s `config.wasmtime`,
fetched from the official release tarball with a SHA-256 check, and cached under
`tests/debug/.cache/wasmtime-<version>/`. Flags: `--check` (default),
`--update`, `--only <name>`.

The pin is **24.0.13**, not the newest release. Measured on `add-locals`:
24.0.13 reproduces the committed `expect.json` exactly; 44 and 48 resolve a
line-10 breakpoint into `add`; 50.0.1 at `-O0` resolves the line but loses `i`.
Bump only with the same measurement, and say what changed.

A fixture that the default consumer cannot run names its own Wasmtime in
`expect.json`. `await-locals` pins **50.0.2**: 24.0.13 cannot parse a
continuation type at all (`invalid leading byte (0x5d) for type`) and has no
`-W stack-switching` option, so a stack-switching guest cannot run on the
default pin — and the default cannot move without changing what `add-locals`
asserts. Both versions are in `lib/wasmtime.js`, each platform's tarball pinned
by SHA-256.

## Add a sample

    cp -r examples/add-locals examples/<name>
    # edit game.ts and expect.json (keep description/compile/breakpoints)
    npm run test:debug -- --only <name> --update
    git diff tests/debug/examples/<name>/expect.json   # review, commit

A fixture is `examples/<name>/game.ts` plus `expect.json` with `description`,
`compile`, `breakpoints`, `stops`, `variables`. The guest must export the entry
point the runner invokes (`_start_game`), or Wasmtime refuses it.

Optional keys, all defaulted for a plain fixture:

- `invoke` — the export named to Wasmtime. Default `_start_game`.
- `wasmtime.version` / `wasmtime.args` — a consumer other than the pin, and the
  `-W` options the guest needs before the `--invoke` (`await-locals` needs
  `-W stack-switching=y` and, because its runtime allocates, `-W
  unknown-imports-trap=y` for the `env.abort` import it never takes).
- `maxStops` — how many stops the driver takes before it leaves the process
  stopped. Default 20. `await-locals` uses 1: continuing past a stop inside a
  resumed continuation frame makes lldb (20.1.4-codelldb, with the jit-loader
  plugin) report extra SIGTRAP/SIGSEGV stops at the same line, which are not
  what the fixture asserts. A breakpoint in a *sync* function of the same
  module continues to a clean exit, so this is the consumer's handling of the
  suspended stack, not the line table.

`npm run test:debug:unit` runs the byte-level encoder tests
(`tests/debug/unit/`) against the built compiler.

## Structural baseline

`node tests/debug/capture-baseline.js` writes `baseline/<name>/*.txt`:
compile the fixture, dump its `.debug_line`/`.debug_info` with
`llvm-dwarfdump`, normalise paths. The DWARF is in the wasm on disk, so there is
no host and no in-memory peek.

## The line census, and its ratchet

`tests/debug/census.js` counts the two ways a debug build can fail a source
breakpoint, per file and in total:

- **`unreachable_lines`** — a line the DWARF *mentions* but gives no address
  range (every row for it has zero span). The "breakpoint pending forever" class.
- **`unpaired_addresses`** — a line-table address inside no compile unit's range.
  The `unable to resolve a line table file address … back to a compile unit`
  class.

It reads `.debug_info`, `.debug_abbrev`, `.debug_line` and `.debug_ranges` from
the module itself, never `.wasm.map` — the debugger does not open a source map,
so a manifest built from one would measure the compiler against its own opinion.
Output is deterministic (files by path, lines by number, addresses by value), so
the manifest can be committed and diffed.

    node tests/debug/census.js <module.wasm | dir> ...            # manifest out
    node tests/debug/census.js --out <file> <module...>           # write it
    node tests/debug/census.js --check <file> <module...>         # ratchet
    npm run test:debug:census                                     # the gate

`census-manifest.txt` is the committed manifest, and it is measured against the
**unpatched** compiler: 24 modules, `unreachable_lines 153`,
`unpaired_addresses 0`. The artifacts are the ones the engine repository's
conformance matrix builds (`scripts/build-test-programs.mjs --debug` in the
Tension checkout), so the gate needs that tree:

    TENSION_DEBUG_ARTIFACTS=<tension>/tension-core/tests/programs/build/debug \
      npm run test:debug:census

No artifacts and no `TENSION_DEBUG_ARTIFACTS` is an **error**, not a skip: a
census that silently measures nothing is the hole it exists to find.

### The ratchet rule

**Counts may improve freely. Any line that worsens needs a one-line reason in
the commit that lands it.**

Concretely, `--check` fails on: a line that became unreachable, a line whose
byte span shrank, a new unreachable line, an address that became unpaired, or a
total that went up. Improvements are printed and allowed. So a compiler change
that trades one hole for another cannot land quietly, and one that closes holes
cannot be stalled by a stale manifest — regenerate with `--out` and read the
diff.

The reason goes in the commit message, one line per worsened entry, because the
diff shows *which* entries moved and only the author knows *why*. "Regenerated"
is not a reason.
