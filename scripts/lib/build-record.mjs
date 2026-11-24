// The record a build writes beside its artifact: **what it was built from.**
//
// The rebuild chain used to answer "is `dist/assemblyscript.js` current?" with an
// mtime comparison, and DL36 showed what that costs one layer down: five guests
// had moved while the control read "0 bytes moved", because an mtime cannot say
// *which compiler* produced a file. This is the same discipline applied to the
// compiler's own bundle (I86): a content hash over the **inputs**, written by the
// build that consumed them, compared by the check that asks.
//
// # The canonical form, and why it is a hash of names and contents
//
// Files sorted by repo-relative POSIX path; for each, `<path>\0<sha256>\n`; then
// sha256 over that stream. Names are in it because a rename is a change; contents
// because an edit is. Order is fixed so two machines agree, and **mtimes are
// nowhere in it** — that is the whole point.
//
// # What is in the input set
//
// `src/`, `cli/` and `std/` — the three trees `npm run build` reads to produce
// `dist/assemblyscript.js` — plus `package.json` and `tsconfig-base.json`, which
// the bundle's own build and the d.ts step read. `third_party/binaryen-out` is
// copied in rather than built from these, and is pinned by its own submodule.
//
// `dist/` itself is never an input: a record that hashed its own artifact could
// never be checked after a rebuild, which is the one moment it is needed.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

/** The record beside a built artifact: `<artifact>.build.json`. */
export function recordPath(artifact) {
  return `${artifact}.build.json`;
}

/** The trees and files the compiler bundle is built from, relative to the repo. */
export const COMPILER_INPUTS = {
  dirs: ["src", "cli", "std"],
  files: ["package.json", "tsconfig-base.json"],
};

/**
 * Canonical digest of `root`'s compiler inputs.
 *
 * `{ hash, files }` — the digest and how many files went into it, so a record can
 * say "191 files" instead of an opaque hex string.
 */
export function compilerInputDigest(root) {
  const entries = [];
  const walk = (relativeDir) => {
    const dir = join(root, relativeDir);
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const childRel = `${relativeDir}/${entry.name}`;
      if (entry.isDirectory()) {
        // `node_modules` and build output inside a source tree are not inputs.
        if (entry.name === "node_modules" || entry.name === "build") continue;
        walk(childRel);
      } else if (entry.isFile()) {
        entries.push(childRel);
      }
    }
  };
  for (const dir of COMPILER_INPUTS.dirs) walk(dir);
  for (const file of COMPILER_INPUTS.files) {
    if (existsSync(join(root, file))) entries.push(file);
  }
  entries.sort();
  const stream = createHash("sha256");
  for (const rel of entries) {
    const digest = createHash("sha256").update(readFileSync(join(root, rel))).digest("hex");
    stream.update(`${rel}\0${digest}\n`);
  }
  return { hash: stream.digest("hex"), files: entries.length };
}

/**
 * Writes the record beside `artifact`.
 *
 * Called by the build **after** the artifact exists — `scripts/build.js`, which is
 * what produces `dist/assemblyscript.js`. A record written anywhere else would be
 * a claim about someone else's build.
 */
export function writeCompilerRecord(root, artifact) {
  const { hash, files } = compilerInputDigest(root);
  const record = {
    // Bumped when the *meaning* of `inputs` changes, so an old record is not read
    // as if it answered the new question.
    format: 1,
    inputs: hash,
    inputFiles: files,
    inputsDescription: [...COMPILER_INPUTS.dirs, ...COMPILER_INPUTS.files].join(", "),
    artifact: relative(root, artifact).split("\\").join("/"),
    built: new Date().toISOString(),
  };
  writeFileSync(recordPath(artifact), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

/** The record beside `artifact`, or `null` when there is none or it is unreadable. */
export function readCompilerRecord(artifact) {
  const path = recordPath(artifact);
  if (!existsSync(path)) return null;
  try {
    const record = JSON.parse(readFileSync(path, "utf8"));
    return record && typeof record === "object" ? record : null;
  } catch {
    return null;
  }
}
