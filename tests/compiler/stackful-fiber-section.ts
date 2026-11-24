// The fiber backend's **artifact record**, asserted on the bytes of a real
// emitted `.wasm` (DL36 Phase B).
//
// The program is not new: it is the fixture DL35 wrote for the same backend, and
// this file re-exports it so the test has a name of its own without a second copy
// of the program. What is under test is not what this program computes but **what
// the compiler wrote beside it** — `tension.stackful-backend`, whose payload must
// be exactly `fiber`.
//
// The assertion lives in `stackful-fiber-section.js`, which compiles this source
// in fiber mode to a temporary `.wasm` and reads the section out of that file.
export { main } from "./stackful-fiber-record";
