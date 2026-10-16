# TensionScript

**A TypeScript-shaped language for WebAssembly** — the compiler Tension's guests
are written in.

TensionScript compiles TypeScript syntax to WebAssembly using
[Binaryen](https://github.com/WebAssembly/binaryen). It is maintained for the
[Tension](https://github.com/Yabgu/Tension) engine as a fork of
[AssemblyScript](https://github.com/AssemblyScript/assemblyscript). The command
and the package are its own: it does not collide with `asc` (AssemblyScript's
compiler) or `tsc` (TypeScript's), so a project that installs both compilers
always resolves the one it named.

## Install

```sh
npm install @yabgu_gm/tensionscript
```

## Usage

The command is `tensionscript`. From an npm script, `tensionscript …` resolves to
the installed package's binary; from a shell, `npx tensionscript …` does:

```sh
npx tensionscript assembly/index.ts -o build/index.wasm --runtime incremental --target release
```

The compiler is also a library, under the package's `asc` subpath:

```js
import tensionscript from "@yabgu_gm/tensionscript/asc";
```

## Status

Forked from AssemblyScript. What this fork changes:

* **`this` in arrow functions — landed.** An arrow resolves `this` to the
  receiver of the nearest enclosing non-arrow function, which is TypeScript's
  rule, instead of to the enclosing function element. The receiver travels with
  the function value in its environment and is delivered at each indirect call.
* **async/await — pending.**
* **closures — pending.**

Everything else tracks the upstream project it was forked from; the divergence is
deliberate and each change lands with tests.

## Links

* Tension (the engine these guests run on): https://github.com/Yabgu/Tension
* TensionScript (this compiler): https://github.com/Yabgu/TensionScript

## Attribution and license

Based on AssemblyScript, Apache-2.0 licensed. Original project at
https://github.com/AssemblyScript/assemblyscript.

The `NOTICE` file retains the original project's attribution, and the license is
the Apache License 2.0 (`LICENSE`).
