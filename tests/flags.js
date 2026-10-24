// `DecoratorFlags` — distinct bits, and what a `@managed struct` does with them.
//
// Why this exists (`docs/session-findings.md`, Gap 1). `ManagedStruct` and
// `Unsafe` were both `1 << 11` from 0.9.0 until PR #9 moved `Unsafe` to
// `1 << 13` and reserved `InlineStruct` at `1 << 12`. The collision was
// **latent** — no observable misbehaviour — and that is exactly why nothing
// caught it: PR #9's fixture (`interop/managed-struct-unsafe-flag.ts`) asserts
// that a `@managed struct` compiles clean under `--noUnsafe`, which was already
// true *with* the collision, because every `Unsafe` gate inspects a function,
// variable or index-signature element and a method's `Function` copies its
// function prototype's flags (`program.ts`), never the class's.
//
// So the collision needs a different kind of test: not "does this shape
// compile", but "are the enum's values distinct". That is what this file adds.
//
// Three assertions, none of them circular:
//
//   1. Every `DecoratorFlags` entry is a distinct bit. Catches the exact
//      collision class that existed (two names, one value) and any future one,
//      including a bit reused by a new decorator.
//   2. A `@managed struct` compiles memory operations under `--noUnsafe` with no
//      "Operation is unsafe". Catches the class-level bit leaking into the
//      function-level gates.
//   3. A bare `load<u8>(p)` under `--noUnsafe` *does* error. Catches a gate that
//      has stopped firing — without this, assertion 2 would pass vacuously for
//      a compiler that had stopped checking altogether.
//
// (2) and (3) duplicate coverage that exists as fixtures
// (`interop/managed-struct-unsafe-flag.ts` and `tests/compiler/unsafe.ts`).
// They are repeated here so the three assertions sit together and so assertion
// 2 cannot pass merely because assertion 3's gate went silent: the pair is the
// test, not either half.

import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { stdoutColors } from "../util/terminal.js";
import { DecoratorFlags } from "../dist/assemblyscript.js";

const here = dirname(fileURLToPath(import.meta.url));
const CLI = join(here, "..", "bin", "tensionscript.js");

let checks = 0;
let failures = 0;

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

// --- 1. every entry is a distinct bit --------------------------------------

console.log("the enum's bits");

{
  // `DecoratorFlags` is a TypeScript enum, so the compiled object carries both
  // directions: numeric keys ("2048") and name keys ("ManagedStruct"). Keep the
  // names; `None = 0` is a legitimate non-bit and is asserted separately.
  const names = Object.keys(DecoratorFlags).filter(
    key => typeof DecoratorFlags[key] === "number" && !/^\d+$/.test(key)
  );
  check("the enum an object with named entries", names.length > 0, true);

  const byValue = new Map();
  const collisions = [];
  for (const name of names) {
    const value = DecoratorFlags[name];
    if (value === 0) continue;                     // `None`
    if (byValue.has(value)) collisions.push([ byValue.get(value), name, value ]);
    else byValue.set(value, name);
  }
  // The assertion that would have caught `ManagedStruct` and `Unsafe` sharing
  // `1 << 11`: two names, one value.
  check("no two entries share a value", collisions, []);

  // Every non-zero entry is a single bit. A hand-written `= 3` would pass the
  // distinctness check above while being two bits wide.
  const notPowerOfTwo = names
    .filter(name => DecoratorFlags[name] !== 0)
    .filter(name => {
      const v = DecoratorFlags[name];
      return v <= 0 || (v & (v - 1)) !== 0;
    });
  check("every non-zero entry is a single bit", notPowerOfTwo, []);

  // The three the collision involved, pinned to the values PR #9 assigned.
  // A distinctness check alone would let a future refactor renumber all three
  // consistently and still break any consumer that serialized a flag.
  check("ManagedStruct is 1 << 11", DecoratorFlags.ManagedStruct, 1 << 11);
  check("InlineStruct is 1 << 12", DecoratorFlags.InlineStruct, 1 << 12);
  check("Unsafe is 1 << 13", DecoratorFlags.Unsafe, 1 << 13);
  check("ManagedStruct and Unsafe are distinct",
    DecoratorFlags.ManagedStruct !== DecoratorFlags.Unsafe, true);
}

// --- 2 and 3: the gates the flags feed -------------------------------------

/** Compiles `source` under `--noUnsafe`; answers the compiler's stderr. */
function compileNoUnsafe(source) {
  const dir = mkdtempSync(join(tmpdir(), "flags-"));
  try {
    writeFileSync(join(dir, "probe.ts"), source);
    try {
      execFileSync(process.execPath, [
        CLI, "probe.ts", "-o", "probe.wasm", "--runtime", "incremental", "--noUnsafe", "--noColors"
      ], { stdio: "pipe", cwd: dir });
      return "";
    } catch (error) {
      return String(error.stderr ?? "") + String(error.stdout ?? "");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log("the gates the flags feed");

{
  // 2. A `@managed struct` doing everything an `Unsafe` gate could plausibly
  // inspect: construction, a method call, a field read and write, a mutating
  // method, and a global write of a record type.
  const managed = compileNoUnsafe(`
@managed struct M { x: u32 = 0; y: u64 = 0; bump(): void { this.x += 1; } }
@managed struct Other { x: u32 = 0; }
let G: Other = new Other();

export function exercise(): u32 {
  let m: M = new M();
  m.x = 5;
  m.y = 7;
  m.bump();
  return m.x;
}
export function globalWrite(): u32 {
  G = new Other();
  G.x = 9;
  return G.x;
}
`);
  check("a @managed struct reports no unsafe operation under --noUnsafe",
    managed.includes("Operation is unsafe"), false);
  check("  ...and it compiles at all (no other error)",
    managed.trim(), "");

  // 3. The control: the gate still fires. Without this, assertion 2 would pass
  // for a compiler that had stopped checking entirely.
  const bare = compileNoUnsafe(`
export function f(p: usize): u8 { return load<u8>(p); }
`);
  check("a bare load under --noUnsafe is still refused",
    bare.includes("Operation is unsafe"), true);
}

console.log();
if (failures) {
  process.exitCode = 1;
  console.log(stdoutColors.red("ERROR: ") + failures + " of " + checks + " flag checks failed");
} else {
  console.log("[ " + stdoutColors.white("SUCCESS") + " ] " + checks + " checks");
}
