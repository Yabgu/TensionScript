// The library emit path: `Module#toBinary`, driven by an embedder.
//
// This closes the one untested path from Prompt B (V6): the CLI emits through
// Binaryen's own `emitBinary`, while library embedders emit through
// `Module#toBinary`. Both call `synthesizeDwarf`, but through different
// wrappers, and only the CLI path had a test.
//
// Byte-level assertions are appropriate here: this is a unit test of a byte
// encoder (rule 4 exempts end-to-end behaviour gates, not this). The
// behavioural gate is ../runner.js.
//
// Five blocks: sections, comp_dir, hook fidelity, allocating programs, and
// whole-module parity with the CLI.
//
// The last two exist because the first three passed while the helper was still
// incomplete. Measured 2026-11-04: the library flow's file table held one
// source where the CLI's held five, because the helper never parsed the
// runtime entry (`~lib/rt/index-incremental.ts`, cli/index.js:705-719) - and
// the same omission made the helper throw "Missing standard library component:
// __link" on any program that allocates. `add-locals` needs no allocation, so
// nothing caught it. The allocating block is that catcher; the parity block
// pins the whole module against the CLI.

import assert from "assert";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { synthesizeDwarf } from "../../../dist/assemblyscript.js";
import { compileViaLibrary } from "../lib/embedder.js";

const here = path.dirname(fileURLToPath(import.meta.url));
/** The CLI entry point, used by the parity block to compile the same fixture. */
const CLI = path.resolve(here, "..", "..", "..", "bin", "tensionscript.js");
const fixture = path.resolve(here, "..", "examples", "add-locals", "game.ts");
/** The value handed to the library hook as `compDir`. */
const PASSED_COMP_DIR = "/opt/q3-test";
/** What the emitted DWARF must record. Kept separate so the assertion can be
 *  revert-tested by changing only one of the two. */
const EXPECTED_COMP_DIR = "/opt/q3-test";

/** The custom sections a synthesised module carries, in order. */
function customSectionNames(wasm) {
  const bytes = Buffer.from(wasm);
  const names = [];
  let i = 8;
  const uleb = () => {
    let value = 0;
    let shift = 0;
    for (;;) {
      const byte = bytes[i++];
      value |= (byte & 0x7f) << shift;
      if (!(byte & 0x80)) return value;
      shift += 7;
    }
  };
  while (i < bytes.length) {
    const id = bytes[i++];
    const size = uleb();
    const end = i + size;
    if (id === 0) {
      const nameLen = uleb();
      names.push(bytes.subarray(i, i + nameLen).toString("utf8"));
    }
    i = end;
  }
  return names;
}

// --- 1. the library path emits all four DWARF sections ----------------------

const built = compileViaLibrary({
  sourcePath: fixture,
  compDir: PASSED_COMP_DIR,
  moduleName: "library-path.wasm",
});

{
  const names = customSectionNames(built.output);
  for (const section of [".debug_abbrev", ".debug_info", ".debug_line", ".debug_ranges"]) {
    assert.ok(names.includes(section), `library output must carry ${section}; got ${names.join(", ")}`);
  }
  assert.ok(names.includes("name"), "the emitted module must carry a name section");
}

// --- 2. DW_AT_comp_dir is the value passed in, not the working directory -----

{
  const dump = dwarfInfo(built.output);
  assert.ok(
    dump.includes(`DW_AT_comp_dir\t("${EXPECTED_COMP_DIR}")`),
    `expected DW_AT_comp_dir ${EXPECTED_COMP_DIR}, dump was:\n${dump.slice(0, 600)}`
  );
  assert.ok(
    !dump.includes(`DW_AT_comp_dir\t("${process.cwd()}")`),
    "comp_dir must not fall back to the working directory when one was passed"
  );
}

// --- 3. the hook appends exactly what synthesizeDwarf produces --------------

{
  // Emit the same module *without* DWARF, then append it by hand. If the hook
  // is a faithful wrapper, the two byte sequences are identical - that is the
  // property the CLI never exercised.
  const plain = compileViaLibrary({
    sourcePath: fixture,
    compDir: PASSED_COMP_DIR,
    moduleName: "library-path.wasm",
    debugInfo: true,
    appendDwarf: false,
  });
  assert.ok(
    !customSectionNames(plain.output).includes(".debug_info"),
    "with the append off the module must carry no DWARF"
  );

  const appended = synthesizeDwarf(
    plain.output,
    plain.sourceMap,
    PASSED_COMP_DIR,
    "library-path.wasm"
  );

  assert.deepStrictEqual(
    Buffer.from(appended),
    Buffer.from(built.output),
    "Module#toBinary must append exactly synthesizeDwarf's output for the same module and map"
  );
}

/**
 * `llvm-dwarfdump --debug-info` for a module, via a temp file.
 *
 * The alternative - parsing `.debug_info` here - would duplicate the encoder's
 * DIE grammar in the test, which is the thing under test.
 */
function dwarfInfo(wasm) {
  const file = path.join(os.tmpdir(), `ts-library-path-${process.pid}.wasm`);
  fs.writeFileSync(file, wasm);
  try {
    return execFileSync("llvm-dwarfdump", ["--debug-info", file], { encoding: "utf8" });
  } finally {
    fs.unlinkSync(file);
  }
}

// --- 4. allocating programs compile, and the runtime enters the file table ---

{
  // Inline, not a committed fixture: this is a library-compile test, not a
  // debug-behaviour fixture. `new Array<i32>` is the smallest construct that
  // needs the runtime's allocator; without the runtime entry parsed as an
  // entry, the compile throws `Missing standard library component: __link`.
  const source = [
    "export function _start_game(): void {",
    "  let items: i32[] = new Array<i32>(3);",
    "  items[0] = 1;",
    "  items[1] = 2;",
    "  items[2] = items[0] + items[1];",
    "}",
    "",
  ].join("\n");
  const allocPath = path.join(os.tmpdir(), `ts-library-alloc-${process.pid}.ts`);
  fs.writeFileSync(allocPath, source);
  let alloc;
  try {
    alloc = compileViaLibrary({
      sourcePath: allocPath,
      compDir: PASSED_COMP_DIR,
      moduleName: "alloc.wasm",
    });
  } finally {
    fs.unlinkSync(allocPath);
  }

  const sources = sourcesOf(alloc);
  assert.ok(
    sources.some((entry) => entry.startsWith("~lib/rt/")),
    `an allocating program must pull runtime sources into the file table; got ${JSON.stringify(sources)}`
  );
  assert.ok(
    sources.some((entry) => entry.includes("ts-library-alloc")),
    `the entry file must be in the file table; got ${JSON.stringify(sources)}`
  );
}

// --- 5. the whole module matches the CLI's, byte for byte -------------------

{
  // Same fixture, same compDir, same module name and map URL, both paths.
  // Anything the helper does differently shows up here - it is the strongest
  // statement available without crossing into the behaviour harness.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ts-library-parity-"));
  const outFile = path.join(dir, "add-locals.wasm");
  try {
    execFileSync(
      process.execPath,
      [CLI, "game.ts", "-o", outFile, "--debug", "--sourceMap",
        "--optimizeLevel", "0", "--compDir", PASSED_COMP_DIR],
      { cwd: path.dirname(fixture), encoding: "utf8" }
    );
    const fromCli = fs.readFileSync(outFile);

    const fromLibrary = compileViaLibrary({
      sourcePath: fixture,
      sourceMapUrl: "./add-locals.wasm.map",
      compDir: PASSED_COMP_DIR,
      moduleName: "add-locals.wasm",
    });

    const cliSources = JSON.parse(fs.readFileSync(`${outFile}.map`, "utf8")).sources;
    const libSources = sourcesOf(fromLibrary);
    assert.deepStrictEqual(
      libSources,
      cliSources,
      "the library path's file table must match the CLI's"
    );
    console.log(
      `  parity: cli ${fromCli.length} B / lib ${fromLibrary.output.length} B, sources ${cliSources.length}`
    );
    assert.deepStrictEqual(
      Buffer.from(fromLibrary.output),
      Buffer.from(fromCli),
      "the library path must emit the same module as the CLI for the same fixture and compDir"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** The `sources` array of a compiled module's source map. */
function sourcesOf(binary) {
  assert.ok(typeof binary.sourceMap === "string" && binary.sourceMap.length > 0,
    "the compile must produce a source map");
  return JSON.parse(binary.sourceMap).sources;
}

console.log("library-path test: ok (5 cases)");
