#!/usr/bin/env node
// Capture the structural baseline: the DWARF the compiler emits for a fixture,
// dumped by llvm-dwarfdump.
//
// The module on disk *is* the DWARF-bearing module now: the compiler appends
// .debug_abbrev / .debug_info / .debug_line / .debug_ranges when --debug and
// --sourceMap are both set. So this is just compile -> dwarfdump -> write;
// there is no host, no lldb, and no in-memory peek (the previous capture read
// the engine's synthesised copy out of a running process, which is no longer
// where the DWARF comes from).
//
// The dumps are normalised for the machine they came from: the fixture's
// absolute path becomes <fixture>, so the committed baseline is portable.
//
// Usage: node tests/debug/capture-baseline.js [--only add-locals]

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileFixture } from "./lib/compile.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function dwarfSection(flag, wasm) {
  const result = spawnSync("llvm-dwarfdump", [flag, wasm], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`llvm-dwarfdump ${flag} failed: ${result.stderr}`);
  }
  return result.stdout;
}

function normalize(text, fixtureDir, workDir) {
  return text
    .replace(/^.*\.wasm:/gm, "<module>:")
    .split(workDir).join("<work>")
    .split(fixtureDir).join("<fixture>")
    .replace(/\/tmp\/[^\s"'`]+/g, "<path>")
    .replace(/[A-Za-z]:\\[^\s"'`]+/g, "<path>");
}

function main() {
  const index = process.argv.indexOf("--only");
  const only = index >= 0 ? process.argv[index + 1] : null;

  const examplesRoot = path.join(here, "examples");
  const names = fs
    .readdirSync(examplesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(examplesRoot, name, "expect.json")))
    .filter((name) => !only || name === only)
    .sort();

  for (const name of names) {
    const fixtureDir = path.join(examplesRoot, name);
    const expect = JSON.parse(fs.readFileSync(path.join(fixtureDir, "expect.json"), "utf8"));
    const workDir = path.join(here, ".cache", name);
    const { wasm } = compileFixture({
      sourcePath: path.join(fixtureDir, "game.ts"),
      outDir: workDir,
      flags: expect.compile.flags ?? ["--debug", "--sourceMap"],
      optLevel: expect.compile.optLevel ?? "O0",
    });

    // The compiled module carries the sections; dump it directly.
    if (!Buffer.from(fs.readFileSync(wasm)).includes(".debug_line")) {
      throw new Error(
        `${wasm} carries no .debug_line; the compiler did not emit DWARF for ${name}`
      );
    }

    const baselineDir = path.join(here, "baseline", name);
    fs.mkdirSync(baselineDir, { recursive: true });
    for (const [suffix, flag] of [
      ["debug-line", "--debug-line"],
      ["debug-info", "--debug-info"],
    ]) {
      const dump = normalize(dwarfSection(flag, wasm), fixtureDir, workDir);
      const file = path.join(baselineDir, `${name}.${suffix}.txt`);
      fs.writeFileSync(file, dump);
      console.log(`wrote ${path.relative(process.cwd(), file)}`);
    }
  }
}

try {
  main();
} catch (error) {
  console.error(`baseline capture: ${error.message}`);
  process.exit(1);
}
