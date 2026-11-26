// `guest-extension`: **the entry-extension table, and what it refuses** (DL45).
//
// A guest source may be spelled `.ten`, `.tension`, or `.ts` during the deprecation
// window. **The project's canonical spelling is `.ten` (DL46); this file asserts the
// compiler's table, whose order is still `[".tension", ".ten", ".ts"]`** because DL46 may
// not edit compiler sources. Two visible consequences, both asserted below by what the
// compiler actually does rather than by what the project wishes: the refusal lists
// `.tension` first, and `--warn-deprecated-extension` says "Rename it to '.tension'" —
// a notice that now names the *accepted* spelling rather than the canonical one. That is
// a follow-up for a round that may touch `cli/index.js`.
//
// The table lives in `cli/index.js`, which is a *CLI* concern —
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

/**
 * **The children's coverage goes to a scratch directory, not into c8's** (DL45).
 *
 * `npm run coverage` is `npx c8 -- npm test`, and c8 collects from every child that
 * inherits `NODE_V8_COVERAGE`. A compile loads the whole 20 MB compiler bundle, so one
 * child's coverage JSON is **~7.8 MB**: this test's spawns were 46 MB of corpus added to
 * a run that was already near its heap bound, and the Coverage job died of exhaustion
 * (`Ineffective mark-compacts near heap limit`, 4 084 MB, exit 134) after the last suite
 * had passed.
 *
 * **A scratch directory, not `delete` and not `""`.** Deleting it does not work: c8 (or
 * npm) re-injects the real temp directory into any descendant that has no
 * `NODE_V8_COVERAGE` at all — measured, a grandchild of a child that had deleted it
 * reported the path again. The empty string happens to write nothing on Node 26
 * (measured: 0 files) but that is a version's behaviour, not a contract, and CI runs
 * Node 24. A directory we create and delete is the one form whose meaning does not
 * depend on which Node reads it: the bytes land somewhere c8 does not read, and they are
 * removed when the test exits.
 *
 * Nothing here asserts a coverage number, and the compiler's CLI behaviour is what these
 * checks are about.
 */
const coverageScratch = mkdtempSync(join(tmpdir(), "dl45-nocov-"));
process.on("exit", () => rmSync(coverageScratch, { recursive: true, force: true }));

function childEnv() {
  return { ...process.env, NODE_V8_COVERAGE: coverageScratch };
}

/** Compiles `name` in `dir` and returns `{ status, stdout, stderr, wasm }`. */
function compile(name, extra = []) {
  const out = join(dir, `${name.replace(/\W/g, "_")}.wasm`);
  const run = spawnSync(
    process.execPath,
    [bin, join(dir, name), "-o", out, ...FLAGS, ...extra],
    { encoding: "utf8", env: childEnv() },
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
  let silent = null;
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
    if (ext === "ts") silent = result;
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

  // 3. `.ts` is silent unless asked — asserted on the build from step 1, which *is*
  // a `.ts` compile without the flag. A second identical compile would say the same
  // thing for another 10 MB of coverage corpus under `npm run coverage`.
  assert.strictEqual(silent.status, 0, "'probe.ts' must compile");
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
