// The publish gate: refuse to publish without a built `dist/`.
//
// 0.8.0 shipped an empty `dist/`. The publish ran from a tree that had been
// cleaned, `files: ["dist/"]` packaged whatever happened to be there, and the
// four compiled artifacts (`asc.js`, `assemblyscript.js`, and their
// `.generated.d.ts` companions) are the gitignored ones a build produces and a
// fresh checkout does not have. The tarball's `package.json` still exported
// `./dist/asc.js`, so every install failed to load:
//
//     ERR_MODULE_NOT_FOUND: Cannot find module .../dist/asc.js
//       imported from .../bin/tensionscript.js
//
// `prepublishOnly` runs `npm run build` first, which is what produces these
// files. This script is the second half: it asserts the build produced them,
// because a build that emits nothing looks the same as one that worked until
// you look. Neither half is sufficient alone — a build alone does not prove the
// artifacts landed, and a check alone cannot see files nobody built.
//
// The size floors are sanity floors, not exact sizes. The failure being caught
// is an empty or truncated artifact, and a compiler bundle clears the floor by
// an order of magnitude: measured at 0.8.1, `asc.js` is 915 KB and
// `assemblyscript.js` is 854 KB.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// `path` is the artifact the published package exports; `why` is what breaks
// without it, so the message names a consequence rather than a filename.
const artifacts = [
  {
    path: "dist/asc.js",
    floor: 100 * 1024,
    why: "the compiler's library entry point (package.json exports \"./asc\")"
  },
  {
    path: "dist/assemblyscript.js",
    floor: 500 * 1024,
    why: "the package's main entry point (package.json exports \".\")"
  },
  {
    path: "dist/asc.d.ts",
    floor: 0,
    why: "the \"./asc\" type declarations"
  },
  {
    path: "dist/assemblyscript.d.ts",
    floor: 0,
    why: "the \".\" type declarations"
  }
];

const problems = [];
const summary = [];

for (const artifact of artifacts) {
  const file = path.join(root, artifact.path);
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    problems.push(
      `${artifact.path} is missing — ${artifact.why}. ` +
      `Run \`npm run build\` before publishing.`
    );
    continue;
  }
  if (!stat.isFile()) {
    problems.push(`${artifact.path} is not a regular file.`);
    continue;
  }
  if (stat.size <= artifact.floor) {
    problems.push(
      `${artifact.path} is ${stat.size} bytes, under the ${artifact.floor}-byte ` +
      `floor — it exists but is empty or truncated. ${artifact.why} would not load.`
    );
    continue;
  }
  summary.push(
    `${artifact.path} ${
      stat.size < 1024 ? `${stat.size} B` : `${(stat.size / 1024).toFixed(0)} KB`
    }`
  );
}

if (problems.length) {
  console.error("publish aborted: dist/ is not a publishable build");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    "\nThis is the 0.8.0 failure: the tarball's package.json exported " +
    "dist/asc.js and dist/asc.js was not in the tarball."
  );
  process.exit(1);
}

console.log(`dist/ is publishable: ${summary.join(", ")}`);
