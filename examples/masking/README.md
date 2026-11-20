# masking

The three mask outcomes in one program. A main-only task posted to a worker is
refused at admission and counted; the same task with a mask that allows the
worker runs exactly once; a task that reaches a worker under a main-only mask
parks anyway, and the park counts a violation in that store without breaking the
continuation. Run it with `node --experimental-wasm-wasmfx examples/masking/run.mjs`
and look for `admission-refusals: 1`, `allowed-runs: 1`, and
`park-violations: 1` — the asymmetry between admission (which can tell the
caller no) and the park (which cannot refuse without corrupting the protocol).
