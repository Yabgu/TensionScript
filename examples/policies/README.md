# policies

Four `TaskPolicy` implementations side by side. The default does nothing at the
call and drives at `await`; an eager policy drives the prefix at `create`; a
counting policy proves one `create` and one `await` per call; a `RemotePolicy`
posts the body to worker 1 and parks main until the reply continuation settles
the task. Run it with `node --experimental-wasm-wasmfx examples/policies/run.mjs`;
look for `lazy-body-before-await: 0` against `eager-body-at-create: 1`, the
`2/2/0` counting triple, and `remote-value: 42` with `remote-worker: 1`.
