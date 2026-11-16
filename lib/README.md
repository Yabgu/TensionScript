Library
=======

Additional packages provided by the main package.

| Package                            | Description
|------------------------------------|-------------------------
| [@assemblyscript/loader](./loader) | Module loader utility
| [@assemblyscript/rtrace](./rtrace) | Runtime tracing utility
| binaryen | Binaryen proxy

The two `@assemblyscript/*` entries are **vendored from AssemblyScript at base
`b6bda05c` and are not published by this fork.** `lib/rtrace/package.json` is
byte-identical to upstream's at that commit; `lib/loader/package.json` differs by
exactly two strings, its `asbuild:default` and `asbuild:legacy` scripts, which
name `../../bin/tensionscript.js` where upstream names `../../bin/asc`. Their
package names, `author` and repository fields are upstream's on purpose: they
describe the packages upstream publishes, and nothing here republishes them.
`package.json`'s `files` array confirms it — it ships `lib/binaryen.js` and
`lib/binaryen.d.ts` and neither directory. Read
[`docs/fork-posture.md`](../docs/fork-posture.md) §1 for the fork's own package.

The Binaryen proxy herein is imported accross the code base and forwards the
`binaryen` npm package by default. It can be modified to use a custom build,
for example for testing purposes.
