# Debug harness

Runs TensionScript guests under lldb against `tension-core` and asserts what a
debugger sees: that a source breakpoint resolves, where it stops, and which
locals are live. It does not assert on wasm bytes — debug metadata is not
byte-stable; the contract is behaviour.

## Run

    npm install             # installs the platform lldb (optionalDependency)
    npm run build           # dist/ must exist (the harness refuses without it)
    npm run test:debug

tension-core is built from `TENSION_REPO` (default `~/work/Tension`) once and
cached under `tests/debug/.cache/`, keyed by the checkout sha and rustc version.
Flags: `--check` (default), `--update`, `--only <name>`.

## Add a sample

    cp -r examples/add-locals examples/<name>
    # edit game.ts and expect.json (keep description/compile/breakpoints)
    npm run test:debug -- --only <name> --update
    git diff tests/debug/examples/<name>/expect.json   # review, commit

A fixture is `examples/<name>/game.ts` plus `expect.json` with `description`,
`compile`, `breakpoints`, `stops`, `variables`. The guest must export
`_start_game` (or `_start`) or the host refuses it.

`npm run test:debug:unit` runs the ported byte-level encoder tests
(`tests/debug/unit/`) against the built compiler.

## Structural baseline

`node tests/debug/capture-baseline.js` writes `baseline/<name>/*.txt`: the DWARF
the host synthesises today, captured from its in-memory module and dumped by
`llvm-dwarfdump`, normalised for paths. A compiler that emits DWARF must
reproduce those dumps.
