# async-main

Async/await on a bare instance: no threads, no shared memory, no scheduler
import. The program suspends six times on the Task path — once per iteration of a
loop and three more in a chain — and the final value depends on every suspension
resuming in the frame it left. Run it with
`node scripts/run-wasmfx.js examples/async-main/run.mjs` (the script picks this Node's wasmfx flag); look for the
carried local advancing across the loop (`11, 12, 13`), six suspensions, and
`final` equal to `status`. This is the program the Tension round runs as a host
test, so its transcript is part of the contract.
