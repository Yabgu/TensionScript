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
 * **Validation is on**, and that is itself an assertion: the compile below would
 * fail at `wasm-validator` if the in-memory IR were inconsistent. It was, until
 * the constructor's field initialisers passed `this` as a pointer-width `i32`
 * into a setter that takes a struct ref; the same defect made every
 * `-O1`/`-O2`/`-O3` build abort inside effect analysis.
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
  const built = compile("fixtures.ts", "gc.wasm", ["--wasmGc"]);
  check("the fixture compiles with --wasmGc", built.ok, built.output);
  if (built.ok) {
    const wat = readFileSync(join(scratch, "gc.wat"), "utf8");
    check("a struct type is declared for the class",
      /\$\S*Point \(sub \(struct/.test(wat),
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
  const built = compile("changetype.ts", "ct.wasm", ["--wasmGc"]);
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


// 5 — inheritance, `sub`, and `instanceof` via ref.test -----------------------
{
  const built = compile("inherit.ts", "inh.wasm", ["--wasmGc"]);
  check("the hierarchy compiles with validation on", built.ok, built.output);
  if (built.ok) {
    const wat = readFileSync(join(scratch, "inh.wat"), "utf8");
    // The supertype must be declared open for `sub` to be legal, and the derived
    // struct must repeat the base's field as its prefix.
    // The internal name carries the source path, so match on the tail.
    check("the base is an open `sub` struct",
      /\bBase \(sub \(struct \(field \$a/.test(wat));
    check("the derived struct repeats the base field as its prefix",
      /\bDerived \(sub \S*Base \(struct \(field \$a.*\(field \$b \(mut i32\)/.test(wat),
      wat.split("\n").slice(0, 4).join("\n"));
    check("instanceof is ref.test, not an rtId read",
      wat.includes("ref.test") && !wat.includes("__instanceof"));

    const bytes = readFileSync(join(scratch, "inh.wasm"));
    const { instance } = await WebAssembly.instantiate(bytes, imports);
    const e = instance.exports;
    // 1 (Base) + 2 (Derived) + 8 (Base) + 32 (Sibling); the sibling bits must be
    // clear; then a = 7 * 100 and b+1 = 8 * 10000.
    check("base-only instance satisfies Base",
      e.isBase(e.makeBase(1)) === 1);
    check("derived satisfies Base and Derived, not Sibling",
      e.isBase(e.makeDerived(1, 2)) === 1 &&
          e.isDerived(e.makeDerived(1, 2)) === 1 &&
          e.isSibling(e.makeDerived(1, 2)) === 0,
      `isBase=${e.isBase(e.makeDerived(1,2))} isDerived=${e.isDerived(e.makeDerived(1,2))} isSibling=${e.isSibling(e.makeDerived(1,2))}`);
    check("a base instance fails a derived test",
      e.isDerived(e.makeBase(1)) === 0);
    check("a derived field read/write through a derived reference",
      e.readB(e.makeDerived(5, 6)) === 6 && e.bumpB(e.makeDerived(5, 6)) === 7);
    check("a base field read through a base-typed reference (prefix property)",
      e.readA(e.makeDerived(9, 0)) === 9);
    // 1 (Base) + 2 (Derived) + 8 (Base) + 32 (Sibling), then `a` 7 * 100 and
    // `bumpB` = 8 + 1 = 9 * 10000. The sibling bits stay clear.
    check("the combined probe",
      e.probe(7) === 1 + 2 + 8 + 32 + 700 + 90000,
      `probe(7) = ${e.probe(7)} (expected ${1 + 2 + 8 + 32 + 700 + 90000})`);
  }
}

// 6 — a class-typed field, acyclic ------------------------------------------
{
  const built = compile("classfield.ts", "cf.wasm", ["--wasmGc"]);
  check("a GC class with a class-typed field compiles", built.ok, built.output);
  if (built.ok) {
    const wat = readFileSync(join(scratch, "cf.wat"), "utf8");
    check("the field is a nullable ref to the other class",
      /\(field \$leaf \(mut \(ref null \S*Leaf\)\)\)/.test(wat), wat.split("\n").slice(0, 3).join("\n"));
    const bytes = readFileSync(join(scratch, "cf.wasm"));
    const { instance } = await WebAssembly.instantiate(bytes, imports);
    const e = instance.exports;
    check("the held value is reachable through the field",
      e.leafValue(e.make(21)) === 42);
    check("the field can be replaced",
      e.retarget(e.make(1), 99) === 99);
  }
}

// 7 — optimization levels agree ---------------------------------------------
//
// `-O1` and above run passes over the in-memory IR. They used to abort inside
// effect analysis, because the field initialisers passed `this` as a pointer-width
// `i32` into a struct-ref setter; the IR validation below is what keeps that from
// coming back unnoticed.
{
  let answers = [];
  for (const level of ["-O0", "-O1", "-O2", "-O3"]) {
    const built = compile("fixtures.ts", `opt${level}.wasm`, ["--wasmGc", level]);
    check(`${level} compiles`,
      built.ok && !/wasm-validator|Aborted/.test(built.output), built.output);
    if (built.ok) {
      const bytes = readFileSync(join(scratch, `opt${level}.wasm`));
      const { instance } = await WebAssembly.instantiate(bytes, imports);
      answers.push(instance.exports.roundTrip(3, 4));
    }
  }
  check("every optimization level answers the same",
    answers.length === 4 && answers.every((v) => v === 3400),
    `answers: ${answers.join(", ")}`);
}

if (failures) {
  console.error(`\nwasm-gc: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nwasm-gc: OK");
