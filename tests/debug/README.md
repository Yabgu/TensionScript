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

## Add a sample

    cp -r examples/add-locals examples/<name>
    # edit game.ts and expect.json (keep description/compile/breakpoints)
    npm run test:debug -- --only <name> --update
    git diff tests/debug/examples/<name>/expect.json   # review, commit

A fixture is `examples/<name>/game.ts` plus `expect.json` with `description`,
`compile`, `breakpoints`, `stops`, `variables`. The guest must export the entry
point the runner invokes (`_start_game`), or Wasmtime refuses it.

`npm run test:debug:unit` runs the byte-level encoder tests
(`tests/debug/unit/`) against the built compiler.

## Structural baseline

`node tests/debug/capture-baseline.js` writes `baseline/<name>/*.txt`:
compile the fixture, dump its `.debug_line`/`.debug_info` with
`llvm-dwarfdump`, normalise paths. The DWARF is in the wasm on disk, so there is
no host and no in-memory peek.
