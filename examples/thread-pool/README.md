# thread-pool

A pool of three workers over the carved control block. Twelve work items go into
the pool's ring, twelve tasks are posted through `pool.policy()`, and each task
pops one item, suspends once, computes `item * 1000 + item`, and publishes the
answer with its executor id. Run it with
`node --experimental-wasm-wasmfx examples/thread-pool/run.mjs`; look for twelve
distinct values (`0, 1001, …, 11011`), a sum of `66066`, and an executor bitmask
with more than one worker set — the work ran somewhere other than main and every
item came back exactly once.
