#!/usr/bin/env node
// The debug harness: compile each fixture, run it under lldb against
// standalone Wasmtime, and compare what was observed with expect.json.
//
// Usage:
//   node tests/debug/runner.js                 # same as --check
//   node tests/debug/runner.js --update        # rewrite expect.json from a run
//   node tests/debug/runner.js --only add-locals
//
// Exit 0 when every fixture passes. A fixture that cannot be run at all (no
// compiler, no lldb, no Wasmtime) fails with one message, not a stack trace.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveLldb, lldbBuildString, describeLldb } from "./lib/lldb.js";
import { resolveWasmtime, describeWasmtime } from "./lib/wasmtime.js";
import { compileFixture } from "./lib/compile.js";
import { runUnderLldb } from "./lib/run-lldb.js";
import { compare, observedToExpect } from "./lib/compare.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { mode: "check", only: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--check") args.mode = "check";
    else if (arg === "--update") args.mode = "update";
    else if (arg === "--only") args.only = argv[++i];
    else throw new Error(`unknown argument ${arg}`);
  }
  return args;
}

function discover(examplesRoot) {
  if (!fs.existsSync(examplesRoot)) return [];
  return fs
    .readdirSync(examplesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(examplesRoot, name, "expect.json")))
    .sort();
}

function readExpect(file) {
  const expect = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const key of ["description", "compile", "breakpoints"]) {
    if (expect[key] == null) throw new Error(`${file}: missing required key "${key}"`);
  }
  return expect;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const examplesRoot = path.join(here, "examples");
  const names = discover(examplesRoot).filter((name) => !args.only || name === args.only);
  if (names.length === 0) {
    throw new Error(
      args.only ? `no fixture named "${args.only}"` : `no fixtures under ${examplesRoot}`
    );
  }

  const lldbInfo = await resolveLldb();
  const lldbBuild = lldbBuildString(lldbInfo.executable);
  console.log(`debug harness: ${describeLldb(lldbInfo, lldbBuild)}`);

  const wasmtime = await resolveWasmtime({
    log: (line) => console.log(`debug harness: ${line}`),
  });
  console.log(`debug harness: ${describeWasmtime(wasmtime)}`);

  let failures = 0;
  for (const name of names) {
    const fixtureDir = path.join(examplesRoot, name);
    const expectPath = path.join(fixtureDir, "expect.json");
    const expect = readExpect(expectPath);
    if (expect.skip) {
      console.log(`SKIP ${name}: ${expect.description}`);
      continue;
    }

    const workDir = path.join(here, ".cache", name);
    const { wasm } = compileFixture({
      sourcePath: path.join(fixtureDir, "game.ts"),
      outDir: workDir,
      flags: expect.compile.flags ?? ["--debug", "--sourceMap"],
      optLevel: expect.compile.optLevel ?? "O0",
    });

    const observed = runUnderLldb({
      lldb: lldbInfo.executable,
      wasmtime: wasmtime.executable,
      wasm,
      symbolPath: fixtureDir,
      breakpoints: expect.breakpoints,
      workDir,
    });

    for (const [index, stop] of observed.stops.entries()) {
      console.log(`  stop ${index + 1}: ${stop.file}:${stop.line} (${stop.reason})`);
      for (const variable of stop.variables) {
        console.log(`  var ${variable.name}: ${variable.type} = ${variable.value}`);
      }
    }
    if (!observed.resolved) console.log(`  no stop: the breakpoint never resolved`);

    if (args.mode === "update") {
      if (!observed.resolved) {
        throw new Error(`${name}: breakpoint never resolved; refusing to write an empty baseline`);
      }
      const observedExpect = observedToExpect(observed);
      const next = { ...expect, ...observedExpect };
      fs.writeFileSync(expectPath, `${JSON.stringify(next, null, 2)}\n`);
      console.log(`UPDATE ${name}: ${observed.stops.length} stop(s), ${observedExpect.variables.length} variable(s)`);
      continue;
    }

    const result = compare(observed, expect);
    for (const note of result.notes) console.log(`  note: ${note}`);
    if (result.pass) {
      console.log(`PASS ${name}: ${observed.stops.length} stop(s), ${expect.variables?.length ?? 0} variable(s)`);
    } else {
      failures++;
      console.error(`FAIL ${name}: ${expect.description}`);
      for (const diff of result.diffs) console.error(`  ${diff}`);
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} fixture(s) failed`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`debug harness: ${error.message}`);
  process.exit(1);
});
