// The fiber backend's artifact carries **no continuation machinery** (DL37, I85).
//
// The program is the DL35 fixture, re-exported so this test has a name of its own
// without a second copy of the program. What is under test is not what it
// computes but what the compiler left out of the module: a `fiber` build's
// suspension is a call the host handles, so the artifact must declare no
// `(cont …)` type and no tag section — otherwise an engine with stack switching
// compiled out refuses to *parse* it, which is exactly the Windows blocker I16
// was waiting on.
//
// The assertions live in `stackful-fiber-pruned.js`, and they are made twice: on
// this fixture's fiber build (nothing there), and on its continuation build
// (both there), because an assertion that cannot fail is not evidence.
export { main } from "./stackful-fiber-record";
