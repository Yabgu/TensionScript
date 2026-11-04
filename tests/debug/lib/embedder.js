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
 * @param {string} options.compDir  DW_AT_comp_dir when DWARF is emitted
 * @param {string} options.moduleName  DW_AT_name for the compile unit
 * @returns {{output: Uint8Array, sourceMap: string|null}}
 */
export function compileViaLibrary({
  sourcePath,
  sourceMapUrl = "./game.wasm.map",
  debugInfo = true,
  appendDwarf = debugInfo,
  compDir = ".",
  moduleName = "game.wasm",
}) {
  const options = asc.newOptions();
  asc.setDebugInfo(options, debugInfo);
  asc.setSourceMap(options, true);
  asc.setCompDir(options, compDir);
  asc.setOptimizeLevelHints(options, 0, 0);

  const program = asc.newProgram(options);
  for (const key of Object.keys(cli.libraryFiles)) {
    if (key.includes("/")) continue; // sub-directories are imported on demand
    asc.parse(program, cli.libraryFiles[key], `~lib/${key}.ts`, false);
  }
  asc.parse(program, fs.readFileSync(sourcePath, "utf8"), path.basename(sourcePath), true);

  for (let guard = 0; guard < 2000; guard++) {
    const file = asc.nextFile(program);
    if (file == null) break;
    const resolved = resolveLib(file);
    asc.parse(program, fs.readFileSync(resolved, "utf8"), file, false);
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
