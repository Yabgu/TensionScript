// Compile a fixture with the canonical TensionScript build.
//
// The compiler is invoked through bin/tensionscript.js, not dist/asc.js
// directly: dist/asc.js is a library entry point that exports main() and does
// nothing when run as a script (measured at landing — `node dist/asc.js ...`
// exits 0 and writes no files). bin/tensionscript.js loads that same dist and
// passes main() the stdout/stderr it needs.
//
// Rule 2: refuse before invoking if dist/asc.js is missing or empty.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const distAsc = path.join(repoRoot, "dist", "asc.js");
const cli = path.join(repoRoot, "bin", "tensionscript.js");

export function assertCompilerBuilt() {
  if (!fs.existsSync(distAsc) || fs.statSync(distAsc).size === 0) {
    throw new Error(`dist/asc.js is missing or empty at ${distAsc}; run \`npm run build\``);
  }
}

/**
 * @param {{sourcePath: string, outDir: string, flags?: string[], optLevel?: string}} options
 * @returns {{wasm: string, map: string}}
 */
export function compileFixture({ sourcePath, outDir, flags = ["--debug", "--sourceMap"], optLevel = "O0" }) {
  assertCompilerBuilt();
  fs.mkdirSync(outDir, { recursive: true });
  const wasm = path.join(outDir, "game.wasm");
  const args = [
    cli,
    sourcePath,
    "-o",
    wasm,
    ...flags,
    "--optimizeLevel",
    String(optLevel).replace(/^-?O/i, "") || "0",
  ];
  const result = execFileSync(process.execPath, args, {
    encoding: "utf8",
    cwd: path.dirname(sourcePath),
  });
  if (result) process.stdout.write(result);

  const map = `${wasm}.map`;
  for (const artifact of [wasm, map]) {
    if (!fs.existsSync(artifact) || fs.statSync(artifact).size === 0) {
      throw new Error(`compiler produced no ${artifact} for ${sourcePath}`);
    }
  }
  return { wasm, map };
}
