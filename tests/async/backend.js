// Round AS1: the async backend is a declared contract.
//
// Three statements and one rule:
//
//   1. A build has exactly one backend: the lowering chosen at
//      `src/transforms.ts` (`hasAwait && Feature.StackSwitching`).
//   2. A policy declares which backend its methods are written against, in a
//      literal the compiler reads (`TaskPolicy.backend`).
//   3. The artifact records the backend it was built for, in `tension.async`,
//      so a host on another platform refuses before instantiating.
//
//   The rule: a call site's policy must name the build's backend; the absent
//   policy *is* the build's backend, and is portable by construction.
//
// The assertions live here, not in the compiled programs: each source is a
// probe, and this harness reads the section, the diagnostic, or both.
//
// Run: npm run test:backend (or `node tests/async/backend.js`).

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const CLI = join(here, "..", "..", "bin", "tensionscript.js");

let failures = 0;
let checks = 0;

function check(name, actual, expected) {
  ++checks;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok  ${name}`);
  } else {
    ++failures;
    console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
  }
}

/** Compiles `source`, optionally with `--enable stack-switching`. */
function compile(source, { stack = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "async-backend-"));
  const tsPath = join(dir, "probe.ts");
  const wasmPath = join(dir, "probe.wasm");
  writeFileSync(tsPath, source);
  const args = [
    CLI, "probe.ts", "-o", "probe.wasm",
    "--runtime", "stub", "--noColors",
  ];
  if (stack) args.push("--enable", "stack-switching");
  try {
    execFileSync(process.execPath, args, { stdio: "pipe", cwd: dir });
  } catch (error) {
    const output = `${error.stderr ?? ""}${error.stdout ?? ""}`;
    rmSync(dir, { recursive: true, force: true });
    return { error: output };
  }
  const bytes = readFileSync(wasmPath);
  return {
    bytes,
    /** Parses `tension.async` out of the binary, or answers null. */
    section: readAsyncSection(bytes),
    dispose() { rmSync(dir, { recursive: true, force: true }); },
  };
}

/** Reads an unsigned LEB128 at `offset`; answers [value, nextOffset]. */
function readLebU32(bytes, offset) {
  let value = 0;
  let shift = 0;
  while (true) {
    const byte = bytes[offset++];
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return [value >>> 0, offset];
    shift += 7;
  }
}

/** Reads the section's fixed little-endian u32; answers [value, nextOffset]. */
function readU32(bytes, offset) {
  const value = (bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)) >>> 0;
  return [value, offset + 4];
}

/**
 * Walks the wasm sections and answers the parsed `tension.async` contents, or
 * null when the section is absent.
 *
 * Layout under test (`src/compiler.ts`, `emitAsyncBackendSection`):
 * version u8, backend u8, flags u8, count u32, then count × (u32, UTF-8).
 */
function readAsyncSection(bytes) {
  if (bytes.length < 8 ||
      bytes[0] !== 0x00 || bytes[1] !== 0x61 ||
      bytes[2] !== 0x73 || bytes[3] !== 0x6d) {
    throw new Error("not a wasm binary");
  }
  let offset = 8;
  while (offset < bytes.length) {
    const id = bytes[offset++];
    let size;
    [size, offset] = readLebU32(bytes, offset);
    const end = offset + size;
    if (id === 0) {
      let nameLength;
      [nameLength, offset] = readLebU32(bytes, offset);
      const name = Buffer.from(bytes.subarray(offset, offset + nameLength)).toString("utf8");
      offset += nameLength;
      if (name === "tension.async") {
        const version = bytes[offset];
        const backend = bytes[offset + 1];
        const flags = bytes[offset + 2];
        const count = Buffer.from(bytes.subarray(offset + 3, offset + 7))
          .readUInt32LE(0);
        let cursor = offset + 7;
        const names = [];
        for (let i = 0; i < count; ++i) {
          let length;
          [length, cursor] = readU32(bytes, cursor);
          names.push(Buffer.from(bytes.subarray(cursor, cursor + length)).toString("utf8"));
          cursor += length;
        }
        return { version, backend, flags, count, names };
      }
    }
    offset = end;
  }
  return null;
}

// A straight-line program: the promise lowering refuses `if`/`for`/`while`/
// `try` (`reasonFor`), so every await probe here stays branch-free.
const AWAIT_SOURCE = `
async function leaf(): i32 { return 1; }
export async function main(): i32 {
  let v: i32 = await leaf();
  return v;
}
`;

// ---------------------------------------------------------------------------
// 1. A stack build of an await program: version 1, backend 1, may suspend.
// ---------------------------------------------------------------------------

console.log("\n# 1  a continuations build records itself");
{
  const built = compile(AWAIT_SOURCE, { stack: true });
  check("the probe compiles", built.error === undefined, true);
  if (!built.error) {
    try {
      const section = built.section;
      check("tension.async is present", section !== null, true);
      if (section) {
        check("version is 1", section.version, 1);
        check("backend is continuations (1)", section.backend, 1);
        check("flags bit 0 says may suspend", (section.flags & 1) === 1, true);
        check("no policy classes were named", section.count, 0);
        check("...and the list is empty", section.names, []);
      }
    } finally {
      built.dispose();
    }
  }
}

// ---------------------------------------------------------------------------
// 2. The same source without the flag: backend 2, and it still compiles.
// ---------------------------------------------------------------------------

console.log("\n# 2  a promise build records itself");
{
  const built = compile(AWAIT_SOURCE, { stack: false });
  check("the probe compiles", built.error === undefined, true);
  if (!built.error) {
    try {
      const section = built.section;
      check("tension.async is present", section !== null, true);
      if (section) {
        check("version is 1", section.version, 1);
        check("backend is promise (2)", section.backend, 2);
        check("flags bit 0 says may suspend", (section.flags & 1) === 1, true);
        check("no policy classes were named", section.count, 0);
      }
    } finally {
      built.dispose();
    }
  }
}

// ---------------------------------------------------------------------------
// 3. No await: no section at all. Absence is the contract for "runs anywhere".
// ---------------------------------------------------------------------------

console.log("\n# 3  an await-free program carries no section");
{
  const built = compile(`
export function main(): i32 { return 42; }
`, { stack: true });
  check("the probe compiles", built.error === undefined, true);
  if (!built.error) {
    try {
      check("tension.async is absent", built.section, null);
    } finally {
      built.dispose();
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Names: deduped in first-use order, from `on` sites whose class is visible.
// ---------------------------------------------------------------------------

console.log("\n# 4  policy classes are named, deduped, in first-use order");
{
  const source = `
import { TaskPolicy, TaskBase } from "~lib/task";

class A extends TaskPolicy {
  create(task: TaskBase): void {}
  await(task: TaskBase): void { __inlineAwait(task); }
}
class B extends TaskPolicy {
  create(task: TaskBase): void {}
  await(task: TaskBase): void { __inlineAwait(task); }
}

async function inner(): i32 { return 1; }
async function leaf(): i32 { return (await inner()) + 1; }

export async function main(): i32 {
  let a = new A();
  let b = new B();
  let t1 = leaf() on a;   // A first
  let t2 = leaf() on a;   // A again: deduped
  let t3 = leaf() on b;   // B second
  return (await t1) + (await t2) + (await t3);
}
`;
  const built = compile(source, { stack: true });
  check("the probe compiles", built.error === undefined, true);
  if (!built.error) {
    try {
      const section = built.section;
      check("tension.async is present", section !== null, true);
      if (section) {
        check("count is 2", section.count, 2);
        check("names are deduped in first-use order", section.names, ["A", "B"]);
      }
    } finally {
      built.dispose();
    }
  }
}

// ---------------------------------------------------------------------------
// 5. A policy written for the promise backend, built for continuations.
// ---------------------------------------------------------------------------

console.log("\n# 5  a mismatched policy is refused by name");
{
  const source = `
import { TaskPolicy, TaskBase, AsyncBackend } from "~lib/task";

class P extends TaskPolicy {
  readonly backend: AsyncBackend = AsyncBackend.Promise;
  create(task: TaskBase): void {}
  await(task: TaskBase): void { __inlineAwait(task); }
}

async function inner(): i32 { return 1; }
async function leaf(): i32 { return (await inner()) + 1; }

export async function main(): i32 {
  let p = new P();
  let t = leaf() on p;
  return await t;
}
`;
  const built = compile(source, { stack: true });
  check("the build is refused", built.error !== undefined, true);
  if (built.error) {
    check("the diagnostic names the class", /Policy 'P'/.test(built.error), true);
    check("...the backend it wants", /promise backend/.test(built.error), true);
    check("...the backend this build has", /continuations backend/.test(built.error), true);
    check("...and the way out", /--enable stack-switching/.test(built.error), true);
  }
}

// ---------------------------------------------------------------------------
// 6. A promise build refuses `on`, and says why.
// ---------------------------------------------------------------------------

console.log("\n# 6  a promise build refuses `on` by name");
{
  const source = `
async function leaf(): i32 { return 1; }
export async function main(): i32 {
  let t = leaf() on inlinePolicy();
  return await t;
}
`;
  const built = compile(source, { stack: false });
  check("the build is refused", built.error !== undefined, true);
  if (built.error) {
    check("the reason names the continuations backend",
      /`on <policy>` needs the continuations backend/.test(built.error), true);
    check("the reason names the flag",
      /--enable stack-switching/.test(built.error), true);
    check("the reason offers the alternative",
      /drop the `on`/.test(built.error), true);
  }
}

// ---------------------------------------------------------------------------
// 7. A `TaskPolicy`-typed variable is portable: statically invisible, no name.
// ---------------------------------------------------------------------------

console.log("\n# 7  a policy held as TaskPolicy is not statically visible");
{
  const source = `
import { TaskPolicy, TaskBase } from "~lib/task";

class A extends TaskPolicy {
  create(task: TaskBase): void {}
  await(task: TaskBase): void { __inlineAwait(task); }
}

async function inner(): i32 { return 1; }
async function leaf(): i32 { return (await inner()) + 1; }

export async function main(): i32 {
  let policy: TaskPolicy = new A();
  let t = leaf() on policy;
  return await t;
}
`;
  const built = compile(source, { stack: true });
  check("the probe compiles", built.error === undefined, true);
  if (!built.error) {
    try {
      const section = built.section;
      check("tension.async is present", section !== null, true);
      if (section) {
        check("backend is continuations (1)", section.backend, 1);
        check("count is 0", section.count, 0);
      }
    } finally {
      built.dispose();
    }
  }
}

// ---------------------------------------------------------------------------

console.log();
if (failures) {
  console.log(`ERROR: ${failures} of ${checks} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`[ SUCCESS ] ${checks} checks`);
}
