// The assertion for `stackful-fiber-section`: the artifact says which backend
// built it, **in bytes** (DL36 Phase B).
//
// Why bytes and not a `.wat`: the text format has no syntax for a custom section,
// so the disassembly the rest of this suite compares drops it. The claim this
// round makes — `tension.stackful-backend` = `fiber` — is exactly the part of the
// artifact a `.wat` golden cannot carry.
//
// Why at import time: the harness imports a fixture's `.js` before it decides
// whether to instantiate (`tests/compiler.js`), and a fiber build cannot be
// instantiated on a Node without wasmfx enabled — it declares the continuation
// types. The assertion therefore has to happen here, where it does: top-level
// await, no instantiation, and a failure is a rejected import, which fails the
// test.
//
// The compiler is asked to write a **real file** at a temporary path and the
// assertion reads that file back, so this is not an assertion about a buffer a
// second code path handed us: it is the bytes the compiler emitted.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import * as asc from "../../dist/asc.js";
import { customSectionsOf, importsOf } from "./stackful-wasm.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const sources = {
  "stackful-fiber-section.ts": readFileSync(join(here, "stackful-fiber-section.ts"), "utf8"),
  "stackful-fiber-record.ts": readFileSync(join(here, "stackful-fiber-record.ts"), "utf8"),
};
/** The entry, and the one module it re-exports — the *existing* fixture. */
const entry = "stackful-fiber-section.ts";

/** The flags both builds share — the same ones the fixture's `.json` names. */
const COMMON = [
  "--runtime", "incremental",
  "--enable", "stack-switching",
  "--enable", "threads",
  "--sharedMemory",
  "--importMemory",
  "--initialMemory", "2",
  "--maximumMemory", "256",
  "--optimizeLevel", "0",
];

/**
 * Compiles `program` in `backend` mode, lets the compiler write the artifact to
 * `outPath`, and answers the file's bytes. `.wat` and `.map` writes are dropped:
 * this test is about one file.
 */
async function emit(backend, outPath) {
  const { error } = await asc.main(
    [entry, "--outFile", outPath, ...COMMON, `--stackful-backend=${backend}`],
    {
      // The two files the program is made of, by basename: the entry, and the
      // fixture it re-exports. Nothing else is readable, so a missing dependency
      // is a compile error rather than a silent fallback to a file on disk.
      readFile: (name) => {
        for (const [file, text] of Object.entries(sources)) {
          if (name === file || name.endsWith(`/${file}`)) return text;
        }
        return null;
      },
      // **The compiler writes the artifact**, and `--outFile` is why it is a real
      // file rather than a buffer: the assertion below reads what was emitted.
      writeFile: (name, contents) => {
        if (name.endsWith(".wasm")) writeFileSync(name, contents);
      },
      listFiles: () => [entry],
    },
  );
  if (error) throw Error(`${backend} compile failed: ${error.message}`);
  return readFileSync(outPath);
}

const dir = mkdtempSync(join(tmpdir(), "dl36-fiber-"));
try {
  // ── the claim ─────────────────────────────────────────────────────────────
  const fiberWasm = join(dir, "fiber.wasm");
  const bytes = await emit("fiber", fiberWasm);
  if (bytes.length === 0) throw Error("the compiler emitted an empty .wasm");

  const sections = customSectionsOf(bytes, "tension.stackful-backend");
  if (sections.length !== 1) {
    throw Error(
      `expected exactly one tension.stackful-backend section in the emitted .wasm, ` +
      `found ${sections.length}`,
    );
  }
  // The exact bytes, compared as bytes: 66 69 62 65 72 is `fiber` and nothing else.
  const expected = Buffer.from([0x66, 0x69, 0x62, 0x65, 0x72]);
  const actual = Buffer.from(sections[0]);
  if (!actual.equals(expected)) {
    throw Error(
      `tension.stackful-backend says ${actual.toString("hex")} ` +
      `(${JSON.stringify(actual.toString("utf8"))}), expected ${expected.toString("hex")} ` +
      `(${JSON.stringify(expected.toString("utf8"))})`,
    );
  }

  // ── the control, in the same test ─────────────────────────────────────────
  //
  // Without it this test passes if **every** build carried the section, which
  // would make the flag's absence meaningless and "absent means continuation" a
  // claim the suite never checks.
  const plainWasm = join(dir, "continuation.wasm");
  const plain = await emit("continuation", plainWasm);
  const plainSections = customSectionsOf(plain, "tension.stackful-backend");
  if (plainSections.length !== 0) {
    throw Error(
      `the default build carries ${plainSections.length} tension.stackful-backend ` +
      `section(s), so its absence would not mean "continuation"`,
    );
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
