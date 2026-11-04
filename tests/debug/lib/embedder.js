// The embedder flow: compile a source file through the *library* entry point
// (Program -> Compiler -> Module#toBinary), without the CLI.
//
// Why this exists: `asc.main` does this setup internally and does not export
// it, so until now only the CLI path was testable - which left `Module#toBinary`
// (the library emit hook) uncovered. `cli.libraryFiles` is the bundled stdlib
// map the CLI itself parses from (cli/index.js:537-545), so an embedder can
// rebuild the same flow with public API only.
//
// Steps, and why each is needed:
//   * parse the stdlib's top-level modules from `libraryFiles` - the same set
//     the CLI pre-loads; sub-directories are pulled on demand below;
//   * parse the entry file as an entry;
//   * drain the import backlog with `nextFile`, resolving `~lib/...` names
//     against the tree (this is what `getFile` does in the CLI);
//   * `initializeProgram`, then `compile`;
//   * `optimize(module, 0, 0, debugInfo, false)` - the CLI calls this at
//     cli/index.js:874 before emitting. It is what sets Binaryen's debug-info
//     flag, which is what makes the emitted module carry a `name` section for
//     the DWARF synthesis to read function and local names from. Skipping it
//     produces a module with no `name` section and therefore DWARF with no
//     subprogram or variable DIEs.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as asc from "../../../dist/assemblyscript.js";
import * as cli from "../../../dist/asc.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** The CLI spells runtimes as lowercase flags; the compiler as an enum. */
const RUNTIME_KINDS = {
  stub: 0,
  minimal: 1,
  incremental: 2,
};

/** Resolve a `~lib/...` name the way the CLI's `getFile` does. */
function resolveLib(internalPath) {
  const rest = internalPath.startsWith("~lib/") ? internalPath.slice(5) : internalPath;
  const forms = /\.(ts|d\.ts)$/.test(rest)
    ? [rest]
    : [`${rest}.ts`, `${rest}/index.ts`, `${rest}.d.ts`];
  for (const form of forms) {
    for (const base of ["std/assembly", "std/portable", ""]) {
      const candidate = path.join(repoRoot, base, form);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  throw new Error(`cannot resolve stdlib import ${internalPath}`);
}

/**
 * Compile `sourcePath` through the library path.
 *
 * @param {object} options
 * @param {string} options.sourcePath  absolute path to the entry .ts
 * @param {string} options.sourceMapUrl  the URL written into the module
 * @param {boolean} options.debugInfo  a debug build: sets Binaryen's debug-info
 *   flag, which is what makes the module carry a `name` section
 * @param {boolean} [options.appendDwarf]  whether `toBinary` appends DWARF;
 *   defaults to `debugInfo`. Setting it false emits the same module as a debug
 *   build without the append - which is how the hook's output can be compared
 *   against a hand-rolled `synthesizeDwarf` call on identical inputs.
 * @param {string} options.compDir  DW_AT_comp_dir when DWARF is emitted; it
 *   reaches the emitter as `toBinary`'s positional argument, not through the
 *   Options object
 * @param {string} options.moduleName  DW_AT_name for the compile unit
 * @param {string} [options.runtime]  "stub" | "minimal" | "incremental"; the
 *   CLI's default is "incremental"
 * @param {number} [options.stackSize]  0 means "the CLI's default for this
 *   runtime" (32768 for incremental, 0 otherwise)
 * @returns {{output: Uint8Array, sourceMap: string|null}}  `sourceMap` is the
 *   v3 map as JSON text; its `sources` array is the file table
 */
export function compileViaLibrary({
  sourcePath,
  sourceMapUrl = "./game.wasm.map",
  debugInfo = true,
  appendDwarf = debugInfo,
  compDir = ".",
  moduleName = "game.wasm",
  runtime = "incremental",
  stackSize = 0,
}) {
  const options = asc.newOptions();
  asc.setDebugInfo(options, debugInfo);
  asc.setSourceMap(options, true);
  asc.setOptimizeLevelHints(options, 0, 0);

  // The CLI's runtime and stack defaults (cli/index.js:299-338). Both matter
  // beyond optimisation: the runtime entry below is what makes the stdlib's
  // files enter the source map, and a non-zero stack is what makes the
  // compiler emit `~lib/memory`'s three globals.
  const runtimeKind = RUNTIME_KINDS[runtime];
  if (runtimeKind === undefined) {
    throw new Error(`unknown runtime ${JSON.stringify(runtime)}; expected stub, minimal or incremental`);
  }
  asc.setRuntime(options, runtimeKind);
  const stack = stackSize || (runtimeKind === asc.Runtime.Incremental ? asc.DEFAULT_STACK_SIZE : 0);
  asc.setStackSize(options, stack);

  const program = asc.newProgram(options);
  for (const key of Object.keys(cli.libraryFiles)) {
    if (key.includes("/")) continue; // sub-directories are imported on demand
    asc.parse(program, cli.libraryFiles[key], `~lib/${key}.ts`, false);
  }

  // The runtime as an *entry file*, before the user's (cli/index.js:705-719:
  // "Include runtime before entry files so its setup runs first"). This is the
  // step whose absence made the helper unable to compile anything that
  // allocates: without it the runtime's implementation is never reached, so
  // `__link` has no definition and none of its sources enter the file table.
  const runtimeKey = `rt/index-${runtime}`;
  const runtimeText = cli.libraryFiles[runtimeKey];
  if (runtimeText == null) {
    throw new Error(`no bundled runtime entry ${runtimeKey} in cli.libraryFiles`);
  }
  asc.parse(program, runtimeText, `~lib/${runtimeKey}.ts`, true);

  asc.parse(program, fs.readFileSync(sourcePath, "utf8"), path.basename(sourcePath), true);

  for (let guard = 0; guard < 2000; guard++) {
    const file = asc.nextFile(program);
    if (file == null) break;
    const resolved = resolveLib(file);
    // The CLI records the resolved path with its extension (cli/index.js:680
    // parses `file.sourcePath`, which `getFile` builds as `path + ".ts"`).
    // Recording the bare specifier instead puts a differently-shaped name in
    // the source map's file table.
    const recorded = /\.(ts|d\.ts)$/.test(file) ? file : `${file}.ts`;
    asc.parse(program, fs.readFileSync(resolved, "utf8"), recorded, false);
  }

  asc.initializeProgram(program);
  const module = asc.compile(program);

  let diagnostic;
  const errors = [];
  while ((diagnostic = asc.nextDiagnostic(program))) {
    if (asc.isError(diagnostic)) errors.push(asc.getDiagnosticMessage(diagnostic));
  }
  if (errors.length) throw new Error(`compile failed:\n${errors.join("\n")}`);

  asc.optimize(module, 0, 0, debugInfo, false);
  return module.toBinary(sourceMapUrl, appendDwarf, compDir, moduleName);
}
