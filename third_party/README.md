# third_party — vendored dependencies

## `binaryen/` — the compiler's Binaryen, with the stack-switching C API

**What it is.** Binaryen compiles wasm, and this compiler reaches it only through
Binaryen's C API, compiled to wasm by emscripten. Upstream's C API has no
constructors for `cont.new`, `suspend` or `resume` — the C++ `Builder` methods exist
(`src/wasm-builder.h`), but nothing exposes them — so a compiler that wants to emit
stack switching through the JS API cannot. `cont.new` has to be *built*, not parsed
from text, for the async work to have anywhere to land.

**The fork.** <https://github.com/Yabgu/binaryen>, branch
`c-api-stack-switching`, tagged **`tension-v131.0.0`** and pinned at commit
`1c8a87655dd22830bf5714e7bd209bf13f660f07`. That commit is the last upstream commit
of 2026-07-21, which is what `binaryen@131.0.0-nightly.20260721` — the npm package
this tree used before — was cut from, so the rebuilt artifact is comparable to the
one it replaced. The branch adds six C functions and one JS surface over them:

| addition | why it is not optional |
| --- | --- |
| `BinaryenContNew` | `cont.new $ct (ref.func $f)` |
| `BinaryenSuspend` | `suspend $tag args` |
| `BinaryenResume` | `resume $ct`, no handler |
| `BinaryenResumeWithHandlers` | `(on $tag $label)` — the form every real `resume` needs, and which `BinaryenResume`'s signature cannot express |
| `BinaryenResumeThrow` | `resume_throw`, the cancellation path |
| `TypeBuilderSetContinuation` | the C API could not name `(cont $ft)` at all, so `cont.new` had no type to take |

**How it is built.** `scripts/build-binaryen.js` runs `emcmake cmake` **out of tree**
(at `third_party/binaryen-out/build`, never inside this directory — a generated file
in a submodule makes `git status` lie forever), builds the `binaryen_js` target, and
bundles emscripten's factory module into one already-loaded ESM file. The output is
`third_party/binaryen-out/binaryen.js`, gitignored: 14 MB that follows from a
gitlink, built on demand by `npm run build` (through `prebuild`) and by
`npm run binaryen:build`.

`dist/` ships it as `dist/binaryen.js`, beside `asc.js`, which imports `./binaryen.js`.
That is what keeps the packed tarball self-contained with no npm dependency — and it
is why it is a sibling file rather than inlined into `asc.js`: inlining was measured
at 1.64× startup cost (472 ms → 772 ms) and broke a compile outright, while the
sibling file costs nothing over the old npm package.

**Requires** emscripten 7.0.0 (commit `777e6e5d`) to *build*, and nothing to *run*.

**Delete this when TensionScript can compile itself.** The whole reason this exists
is that the compiler's Binaryen is only reachable through its JS API. Once the
compiler can emit wasm that calls Binaryen directly — a C interop rather than a
`binaryen.js` — the fork has no reason to exist, and neither does this directory.
