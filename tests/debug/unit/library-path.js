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
// What this test does NOT assert, and why (measured 2026-11-04):
//
//   The library flow's .debug_line file table differs from the CLI's for the
//   same fixture: the CLI's compile registers four stdlib sources
//   (~lib/rt/common.ts, ~lib/rt/tlsf.ts, ~lib/shared/typeinfo.ts,
//   ~lib/rt/itcms.ts) plus game.ts, so its rows point at file index 5; a
//   reconstructed embedder flow registers only game.ts, so its rows point at
//   file index 1. The line/address/column values are identical, and
//   .debug_info is semantically identical (llvm-dwarfdump --debug-info differs
//   only in the filename line). So this is not a difference between the two
//   emit hooks - both append exactly what synthesizeDwarf returns (asserted
//   below) - but between the two *compiles*, and the CLI-side cause was not
//   localised. Asserting CLI parity here would encode that unknown as a
//   requirement; the test asserts hook fidelity instead, which is the property
//   Prompt B's V6 left uncovered.

import assert from "assert";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { synthesizeDwarf } from "../../../dist/assemblyscript.js";
import { compileViaLibrary } from "../lib/embedder.js";

const here = path.dirname(fileURLToPath(import.meta.url));
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

console.log("library-path test: ok (3 cases)");
