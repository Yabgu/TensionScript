// Every optimization level is part of the async contract.
//
// A module that uses continuations must compile at -O0, -O1, -O2 and -O3, not
// only at the level the fixtures happen to use. Two defects were measured here
// before this test existed, and each one aborted the compiler on a three-line
// async module:
//
//   -O1  `BinaryenResumeWithHandlers` built one sent type fewer than it built
//        handlers, so `dce` read past the end of an arena vector while walking
//        the resume's branch targets (`index < usedElements`, mixed_arena.h).
//   -O2  the slot-allocation code handed one `i32.add` node to two parents;
//        `local-cse` refuses a shared node (`!(requests && original)`,
//        LocalCSE.cpp). Binaryen's IR is a tree, not a DAG.
//   -O3  GUFA does not model continuations (its `handleResume` asserts the
//        handler block's type is non-empty), so the compiler skips that pass
//        for stack-switching modules. A compile at -O3 is the assertion.
//
// Run: npm run test:optimize (or `node tests/async/optimize.js`).

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const CLI = join(here, "..", "..", "bin", "tensionscript.js");

let failures = 0;
let checks = 0;

function check(name, ok, detail = "") {
  ++checks;
  if (ok) {
    console.log(`  ok  ${name}`);
  } else {
    ++failures;
    console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ""}`);
  }
}

// One `await` in a parameterized-free body: the handler form of `resume` is
// what the transform emits, and it is the shape both defects lived in.
const source = `async function leaf(): i32 {
  await 1;
  return 7;
}

export function main(): i32 {
  return 0;
}
`;

const dir = mkdtempSync(join(tmpdir(), "ts-optimize-"));
try {
  const src = join(dir, "tiny.ts");
  writeFileSync(src, source);

  for (const level of [0, 1, 2, 3]) {
    const out = join(dir, `tiny-o${level}.wasm`);
    let ok = true;
    let detail = "";
    try {
      execFileSync(
        process.execPath,
        [
          CLI, src, "-o", out,
          "--runtime", "incremental",
          "--target", "release",
          "--enable", "stack-switching", "--stackful-backend", "continuation",
          "--exportStart", "__start",
          "--optimizeLevel", String(level),
        ],
        { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
      );
    } catch (error) {
      ok = false;
      const stderr = String(error.stderr ?? "");
      const abort = /Assertion failed: ([^\n]*)/.exec(stderr);
      detail = abort ? `compiler aborted: ${abort[1]}` : stderr.trim().split("\n").slice(-3).join(" | ");
    }
    if (ok) {
      const bytes = readFileSync(out);
      ok = bytes.length >= 8 && bytes[0] === 0 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d;
      if (!ok) detail = "the artifact is not a wasm module";
    }
    check(`-O${level} compiles the async module`, ok, detail);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failures) {
  console.log(`\n[ FAILURE ] ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\n[ SUCCESS ] ${checks} checks`);
