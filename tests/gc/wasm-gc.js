/**
 * @fileoverview The `--wasm-gc` slice: one flat class emitted as a wasm GC struct.
 *
 * Four checks, and what each one is evidence *of* matters more than that it
 * passes:
 *
 * 1. **The shape runs.** A class is constructed, a field read, a field written
 *    through a setter, read back, passed as an argument and returned — and the
 *    value that comes out is the arithmetic the source says. Executed in Node's
 *    own WebAssembly engine, which is an independent implementation from both
 *    Binaryen and wasmtime.
 * 2. **The emitted code is wasm GC, and not the old allocation.** The text form
 *    must contain `struct.new`/`struct.get`/`struct.set` and must not call
 *    `__new` for this class — that is the mechanism a collector needs, stated as
 *    a structural fact rather than an intention.
 * 3. **`changetype<usize>` on an instance is refused**, with a diagnostic that
 *    says why. A wasm GC reference has no address; without this check the module
 *    would fail later with `type mismatch: expected i32, found (ref $type)`.
 * 4. **The flag off changes nothing.** Same fixture, no flag: the old shape
 *    (`__new` + a store at a constant offset) and the same answers.
 *
 * **Not asserted here: collection itself.** Forcing a GC needs a host API that
 * neither Node nor the CLI exposes (`Store::gc` is a wasmtime embedding call).
 * The equivalent proof for these struct types — 100,000 allocations collected,
 * capacity 0 → 65,536 bytes, plus a moving-collector run — was made in the
 * engine that will run them, and a struct type is a struct type wherever it is
 * declared. Claiming it here would need that host, so this file says so instead
 * of asserting something weaker and calling it the same thing.
 *
 * **A measured caveat.** Binaryen 131's in-memory `validate()` rejects these
 * modules (`local.get must have proper type` in a constructor body) while its
 * own `wasm-opt --enable-gc` and Node both accept the written binary. The
 * compiler therefore needs `--noValidate` for `--wasmGc` until that is resolved;
 * the modules this file loads are the ones the compiler wrote, so the binary —
 * not the in-memory verdict — is what is under test.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const cli = join(root, "bin", "tensionscript.js");
const scratch = mkdtempSync(join(tmpdir(), "tension-gc-"));

let failures = 0;

/// The `env` imports a compiled program can carry: `abort` and `trace` come from
/// the standard library, `seed` from the math runtime. None is exercised by these
/// fixtures, so the stubs only have to exist.
const imports = {
  env: {
    abort: () => { throw new Error("guest called abort"); },
    trace: () => {},
    seed: () => 0,
  },
};

function compile(entry, out, extraArgs) {
  const args = [cli, join(here, entry), "--outFile", join(scratch, out),
    "--textFile", join(scratch, out.replace(/\.wasm$/, ".wat")),
    ...extraArgs];
  try {
    return { ok: true, output: execFileSync(process.execPath, args, { encoding: "utf8", stdio: "pipe" }) };
  } catch (error) {
    return { ok: false, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

function check(name, condition, detail) {
  if (condition) {
    console.log(`ok      ${name}`);
  } else {
    console.log(`not ok  ${name}${detail ? `\n          ${detail}` : ""}`);
    ++failures;
  }
}

// 1 + 2 --------------------------------------------------------------------
{
  const built = compile("fixtures.ts", "gc.wasm", ["--wasmGc", "--noValidate"]);
  check("the fixture compiles with --wasmGc", built.ok, built.output);
  if (built.ok) {
    const wat = readFileSync(join(scratch, "gc.wat"), "utf8");
    check("a struct type is declared for the class",
      /\(type \$[^ )]*Point[^ )]* \(struct/.test(wat),
      wat.split("\n").slice(0, 4).join("\n"));
    check("field read is struct.get, not a load at an offset",
      wat.includes("struct.get") && !/i32\.load offset=\d+\n/.test(wat));
    check("field write is struct.set", wat.includes("struct.set"));
    check("construction is struct.new", wat.includes("struct.new"));
    check("the class does not go through the guest allocator",
      !/call \$~lib\/rt\/itcms\/__new/.test(wat.split("func $gc/Point#constructor")[1] ?? ""));

    const bytes = readFileSync(join(scratch, "gc.wasm"));
    const { instance } = await WebAssembly.instantiate(bytes, imports);
    // make(3,4) -> {x:3,y:4}; before=3; setY(40); 3*1000 + 40*10 + 3 - 3
    check("construct, read, write, read back, pass, return",
      instance.exports.roundTrip(3, 4) === 3400,
      `roundTrip(3,4) = ${instance.exports.roundTrip(3, 4)} (expected 3400)`);
    check("the class reference crosses the host boundary as a value",
      instance.exports.getX(instance.exports.make(7, 9)) === 7);
  }
}

// 3 ------------------------------------------------------------------------
{
  const built = compile("changetype.ts", "ct.wasm", ["--wasmGc", "--noValidate"]);
  check("changetype<usize> of an instance is refused", !built.ok, built.output);
  check("the refusal says a GC reference has no address",
    /has no address/.test(built.output), built.output.split("\n")[0]);
}

// 4 ------------------------------------------------------------------------
{
  const built = compile("fixtures.ts", "plain.wasm", []);
  check("the same fixture compiles without the flag", built.ok, built.output);
  if (built.ok) {
    const wat = readFileSync(join(scratch, "plain.wat"), "utf8");
    check("flag off: no wasm GC expressions are emitted",
      !wat.includes("struct.new") && !wat.includes("struct.get"));
    check("flag off: the allocation is the guest allocator",
      /call \$~lib\/rt\/itcms\/__new/.test(wat));
    const bytes = readFileSync(join(scratch, "plain.wasm"));
    const { instance } = await WebAssembly.instantiate(bytes, imports);
    check("flag off: the same answers",
      instance.exports.roundTrip(3, 4) === 3400,
      `roundTrip(3,4) = ${instance.exports.roundTrip(3, 4)} (expected 3400)`);
  }
}

if (failures) {
  console.error(`\nwasm-gc: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nwasm-gc: OK");
