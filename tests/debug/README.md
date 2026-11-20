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
