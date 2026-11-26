// `guest-extension`: **the entry-extension table, and what it refuses** (DL45).
//
// A guest source may be spelled `.tension` (canonical), `.ten`, or `.ts` during the
// deprecation window. The table lives in `cli/index.js`, which is a *CLI* concern —
// the `asc.main` API takes a source string and never resolves a path — so this test
// spawns the bin rather than importing it. That is also what a user does.
//
// Four assertions, each one a way the table could be wrong:
//
//   1. All three spellings compile, to **identical bytes**. If a spelling changed
//      codegen, the name reached the emitter.
//   2. A fourth spelling is **refused by name**, with the accepted list in the
//      message. Before DL45 it was silently rewritten — `count.ten` became
//      `count.ten.ts`, and the error named a file nobody had written.
//   3. `.ts` is **silent by default**. Several suites in this repository assert the
//      exact bytes of a compile's stdout, and a notice that fired unconditionally
//      would be noise in every one of them.
//   4. The notice appears with `--warn-deprecated-extension`, on stderr, so a tree
//      that is renaming can see what is left.
import assert from "assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const bin = join(root, "bin", "tensionscript.js");

// A guest with no imports: the test is about path resolution, and a dependency
// would make it a test about resolution order among two things.
const SOURCE = `
export function add(a: i32, b: i32): i32 {
  return a + b;
}
export function entry(): i32 {
  return add(2, 3);
}
`;

const dir = mkdtempSync(join(tmpdir(), "dl45-ext-"));
const FLAGS = ["--runtime", "incremental", "--target", "release", "--optimizeLevel", "0"];

/** Compiles `name` in `dir` and returns `{ status, stdout, stderr, wasm }`. */
function compile(name, extra = []) {
  const out = join(dir, `${name.replace(/\W/g, "_")}.wasm`);
  const run = spawnSync(
    process.execPath,
    [bin, join(dir, name), "-o", out, ...FLAGS, ...extra],
    { encoding: "utf8" },
  );
  let wasm = null;
  try {
    wasm = readFileSync(out);
  } catch {
    wasm = null;
  }
  return { status: run.status, stdout: run.stdout ?? "", stderr: run.stderr ?? "", wasm };
}

try {
  // 1. Three spellings, one artifact.
  const bytes = {};
  for (const ext of ["tension", "ten", "ts"]) {
    const name = `probe.${ext}`;
    writeFileSync(join(dir, name), SOURCE);
    const result = compile(name);
    assert.strictEqual(
      result.status,
      0,
      `'${name}' must compile; stderr was:\n${result.stderr}`,
    );
    assert.ok(result.wasm !== null && result.wasm.length > 0, `'${name}' produced no artifact`);
    bytes[ext] = result.wasm;
  }
  assert.ok(
    bytes.tension.equals(bytes.ten) && bytes.tension.equals(bytes.ts),
    "the three accepted spellings produced different bytes — the extension reached the emitter",
  );

  // 2. A spelling outside the table is refused, by name, with the list.
  writeFileSync(join(dir, "probe.code"), SOURCE);
  const refused = compile("probe.code");
  assert.notStrictEqual(refused.status, 0, "'.code' must not compile");
  assert.match(refused.stdout + refused.stderr, /\.code/, "the refusal must name the extension given");
  assert.match(
    refused.stdout + refused.stderr,
    /\.tension, \.ten, \.ts/,
    "the refusal must list what is accepted",
  );
  assert.strictEqual(refused.wasm, null, "a refused compile must not write an artifact");

  // 3. `.ts` is silent unless asked.
  const silent = compile("probe.ts");
  assert.strictEqual(silent.status, 0);
  assert.doesNotMatch(
    silent.stdout + silent.stderr,
    /deprecated/i,
    "a '.ts' entry must not warn unless --warn-deprecated-extension was given",
  );

  // 4. …and speaks when asked, on stderr.
  const warned = compile("probe.ts", ["--warn-deprecated-extension"]);
  assert.strictEqual(warned.status, 0, "the notice must not fail the compile");
  assert.match(warned.stderr, /deprecated guest extension '\.ts'/, "stderr must carry the notice");
  assert.match(warned.stderr, /Rename it to '\.tension'/, "the notice must name the replacement");
  assert.doesNotMatch(warned.stdout, /deprecated/i, "the notice must not touch stdout");

  // 5. A missing file is reported as spelled, not with an extension appended.
  const missing = compile("absent.tension");
  assert.notStrictEqual(missing.status, 0);
  assert.match(
    missing.stdout + missing.stderr,
    /absent\.tension/,
    "the not-found message must name the file as given",
  );
  assert.doesNotMatch(
    missing.stdout + missing.stderr,
    /absent\.tension\.ts/,
    "the not-found message must not invent an extension",
  );

  console.log("[ SUCCESS ] guest-extension: 5 checks");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
