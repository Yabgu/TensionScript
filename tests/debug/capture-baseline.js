#!/usr/bin/env node
// Capture the structural baseline: the DWARF the CURRENT host synthesises for a
// fixture, dumped by llvm-dwarfdump.
//
// The synthesised module is obtained from the host process (see
// lib/synth-capture.mjs) because tension-core never writes it to disk. The dumps
// are normalised for the machine they came from: the fixture's absolute path is
// replaced by <fixture>, so the committed baseline is portable.
//
// Usage: node tests/debug/capture-baseline.mjs [--only add-locals]

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveLldb } from "./lib/lldb.js";
import { resolveTensionCore } from "./lib/tension-core.js";
import { compileFixture } from "./lib/compile.js";
import { captureSynthesized } from "./lib/synth-capture.js";

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

async function main() {
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

  const lldbInfo = await resolveLldb();
  const core = resolveTensionCore({ log: (line) => console.log(line) });

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

    const synthesized = path.join(workDir, "tension-synth.wasm");
    captureSynthesized({
      lldb: lldbInfo.executable,
      core: core.binary,
      wasm,
      symbolPath: fixtureDir,
      workDir,
      outFile: synthesized,
    });

    const baselineDir = path.join(here, "baseline", name);
    fs.mkdirSync(baselineDir, { recursive: true });
    for (const [suffix, flag] of [
      ["debug-line", "--debug-line"],
      ["debug-info", "--debug-info"],
    ]) {
      const dump = normalize(dwarfSection(flag, synthesized), fixtureDir, workDir);
      const file = path.join(baselineDir, `${name}.${suffix}.txt`);
      fs.writeFileSync(file, dump);
      console.log(`wrote ${path.relative(process.cwd(), file)}`);
    }
  }
}

main().catch((error) => {
  console.error(`baseline capture: ${error.message}`);
  process.exit(1);
});
