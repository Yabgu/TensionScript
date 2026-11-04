# Debug harness

Runs TensionScript guests under lldb against the `tension-core` interpreter and
asserts what a debugger can actually see: that a source breakpoint resolves,
where it stops, and which locals are live.

The compiler's job is to emit DWARF; this harness is the gate that proves it.
It does not assert on wasm bytes — debug metadata is not byte-stable, and the
contract being tested is behaviour.

## Run

```sh
npm install           # installs the platform lldb package (optionalDependency)
npm run test:debug    # compile each fixture, run it under lldb, compare
```

`tension-core` is built from `TENSION_REPO` (default `~/work/Tension`) on first
use and cached under `tests/debug/.cache/`, keyed by the checkout's git sha and
by `rustc --version`.

Flags: `--check` (default), `--update`, `--only <name>`.

## Add a sample

```sh
cp -r examples/add-locals examples/<new-name>
# edit game.ts and expect.json (keep description/compile/breakpoints)
npm run test:debug -- --only <new-name> --update
git diff tests/debug/examples/<new-name>/expect.json   # review, then commit
```

A fixture is `examples/<name>/game.ts` plus `expect.json`:

```json
{
  "description": "what this proves",
  "skip": false,
  "compile": { "flags": ["--debug", "--sourceMap"], "optLevel": "O0" },
  "breakpoints": [{ "file": "game.ts", "line": 3 }],
  "stops": [{ "file": "game.ts", "line": 3, "reason": "breakpoint 1.1" }],
  "variables": [{ "name": "sum", "type": "int", "value": "5" }]
}
```

The guest must export `_start_game` (or `_start`) or the host refuses it.

## Structural baseline

`node tests/debug/capture-baseline.js` writes `baseline/<name>/*.txt`: the
DWARF the host synthesises today, dumped by `llvm-dwarfdump` and normalised for
paths. It captures the host's in-memory module (the host never writes it to
disk). A compiler that emits DWARF must reproduce these dumps.
