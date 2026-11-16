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
    check("the base is an open `sub` struct with the brand first",
      /\bBase \(sub \(struct \(field \$<brand> i32\) \(field \$a/.test(wat));
    check("the derived struct repeats the base's fields as its prefix",
      /\bDerived \(sub \S*Base \(struct \(field \$<brand> i32\) \(field \$a \(mut i32\)\) \(field \$b/.test(wat),
      wat.split("\n").slice(0, 4).join("\n"));
    // **Not `ref.test`.** Structural typing makes two identically-laid-out classes
    // one wasm type, so the test is a brand compare; see section 8.
    check("instanceof reads the brand, not an rtId",
      wat.includes("$<brand>") && !wat.includes("__instanceof") && !wat.includes("ref.test"));
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


// 8 — nominal identity: the brand field ---------------------------------------
//
// The regression this exists for: `SetX` and `SetY` have identical layouts, so
// they are one wasm type and `ref.test` cannot tell them apart — which is a live
// defect in the editor's undo dispatch. `instanceof` therefore reads a **brand
// value**, not a type.
{
  const built = compile("brand.ts", "brand.wasm", ["--wasmGc"]);
  check("the brand fixture compiles with validation on", built.ok, built.output);
  if (built.ok) {
    const wat = readFileSync(join(scratch, "brand.wat"), "utf8");
    check("field 0 is an immutable i32 brand",
      /\(field \$<brand> i32\)/.test(wat) &&
          !/\(field \$<brand> \(mut i32\)\)/.test(wat),
      wat.split("\n").slice(0, 4).join("\n"));
    // The premise, asserted rather than assumed: the two classes really do
    // canonicalize into one type. If this ever stops being true the brand is
    // still correct, but the reason it is needed has changed.
    const structTypes = (wat.match(/\(type \S*Set[XY] \(sub/g) || []).length;
    check("SetX and SetY share one wasm type (the reason a brand is needed)",
      structTypes === 1, `found ${structTypes} SetX/SetY struct types`);

    const bytes = readFileSync(join(scratch, "brand.wasm"));
    const { instance } = await WebAssembly.instantiate(bytes, imports);
    const e = instance.exports;
    const p = e.probe();
    check("isCommand/isX/isY answer by brand",
      p === 11, `probe() = ${p} (expected 11 = Command|SetX|SetY)`);
    check("a SetX is NOT a SetY (the editor regression)",
      (p & 4) === 0 && (p & 16) === 0,
      `isY(SetX) bit=${(p & 4) !== 0}, isX(SetY) bit=${(p & 16) !== 0}`);
    check("a branded cast reads the right fields",
      e.idOf(e.makeX()) === 1 && e.idOf(e.makeY()) === 3,
      `idOf(x)=${e.idOf(e.makeX())} idOf(y)=${e.idOf(e.makeY())}`);
  }
}

// 9 — recursion groups -------------------------------------------------------
{
  const built = compile("cycles.ts", "cycles.wasm", ["--wasmGc"]);
  check("mutually recursive classes compile", built.ok, built.output);
  if (built.ok) {
    const wat = readFileSync(join(scratch, "cycles.wat"), "utf8");
    const groups = wat.match(/\(rec\s*\n/g) || [];
    check("three rec groups: a 3-cycle, a 2-cycle and a cycle with a base",
      groups.length === 3, `found ${groups.length} rec groups`);
    check("a three-class cycle sits in one group",
      /\(rec\s*\n\s*\(type \S*A \(sub/.test(wat) &&
          /\(rec[\s\S]{0,900}?B [\s\S]{0,900}?C /.test(wat));
    // A plain `(type ...)` at the top level is a type with no group.
    check("the acyclic pair is NOT in a group",
      /\(type \S*Node2 \(sub \(struct/.test(wat) &&
          /\(type \S*Root2 \(sub \(struct/.test(wat));
    check("a cycle member still carries its supertype",
      /\(type \S*Leaf \(sub \S*Node2 \(struct/.test(wat));

    const bytes = readFileSync(join(scratch, "cycles.wasm"));
    const { instance } = await WebAssembly.instantiate(bytes, imports);
    const e = instance.exports;
    check("two-class cycle links both ways", e.two() === 3);
    check("three-class cycle walks the ring", e.three() === 11);
    check("a cycle mixed with inheritance",
      e.mixed() === 40 && e.mixedProbe() === 3,
      `mixed()=${e.mixed()} mixedProbe()=${e.mixedProbe()}`);
    check("the acyclic pair is unaffected", e.acyclic() === 21);
  }
}

// 10 — the standing gate: every optimization level agrees, on the new fixtures --
{
  for (const fixture of ["brand", "cycles"]) {
    const answers = [];
    for (const level of ["-O0", "-O1", "-O2", "-O3"]) {
      const built = compile(`${fixture}.ts`, `${fixture}${level}.wasm`, ["--wasmGc", level]);
      check(`${fixture} ${level} compiles`,
        built.ok && !/wasm-validator|Aborted/.test(built.output), built.output);
      if (built.ok) {
        const { instance } = await WebAssembly.instantiate(
          readFileSync(join(scratch, `${fixture}${level}.wasm`)), imports);
        const out = fixture === "brand"
          ? instance.exports.probe()
          : [instance.exports.two(), instance.exports.three(),
             instance.exports.mixed(), instance.exports.acyclic()].join(",");
        answers.push(out);
      }
    }
    check(`${fixture}: -O0..-O3 all agree`,
      answers.length === 4 && answers.every((v) => v === answers[0]),
      `answers: ${answers.join(" | ")}`);
  }
}


// 11 — `StaticArray<T>` as a wasm GC array ------------------------------------
//
// The class body's members are linear-memory code and must never be emitted on
// this path: four call sites are intercepted (`new`, `a[i]`, `a[i] = v`,
// `.length`) so `StaticArray#__get`/`#__uset`/`#get:length` are never referenced.
{
  const built = compile("arrays.ts", "arr.wasm", ["--wasmGc"]);
  check("the array fixture compiles with validation on", built.ok, built.output);
  if (built.ok) {
    const wat = readFileSync(join(scratch, "arr.wat"), "utf8");
    check("an array type per element kind",
      /\(type \S*~gcarray\/i32 \(array \(mut i32\)\)\)/.test(wat) &&
          /\(type \S*~gcarray\/tests\/gc\/arrays\/Item \(array \(mut \(ref null \S*Item\)\)\)\)/.test(wat),
      wat.split("\n").slice(0, 5).join("\n"));
    check("StaticArray's linear-memory members never appear",
      !wat.includes("StaticArray<i32>#__uset") &&
          !wat.includes("StaticArray<i32>#get:length"),
      "the class body must be unreachable, so unemitted");

    const bytes = readFileSync(join(scratch, "arr.wasm"));
    const { instance } = await WebAssembly.instantiate(bytes, imports);
    const e = instance.exports;
    check("new + write + read + length on primitives",
      e.probe() === 11504, `probe() = ${e.probe()} (expected 11504)`);
    check("length is array.len, not a header read",
      e.len(e.makeN(7)) === 7);
    check("managed elements: write, read back, length",
      e.managedProbe() === 1004, `managedProbe() = ${e.managedProbe()} (expected 1004)`);
    let aborted = false;
    try { e.outOfRange(); } catch (error) { aborted = /abort/.test(String(error)); }
    check("reading past the end aborts (the stdlib's behaviour)", aborted);
    aborted = false;
    try { e.outOfRangeWrite(); } catch (error) { aborted = /abort/.test(String(error)); }
    check("writing past the end aborts", aborted);
  }
}

// 12 — the standing gate: every optimization level agrees, on the array fixture
{
  const answers = [];
  for (const level of ["-O0", "-O1", "-O2", "-O3"]) {
    const built = compile("arrays.ts", `arr${level}.wasm`, ["--wasmGc", level]);
    check(`arrays ${level} compiles`,
      built.ok && !/wasm-validator|Aborted/.test(built.output), built.output);
    if (built.ok) {
      const { instance } = await WebAssembly.instantiate(
        readFileSync(join(scratch, `arr${level}.wasm`)), imports);
      answers.push(`${instance.exports.probe()},${instance.exports.managedProbe()}`);
    }
  }
  check("arrays: -O0..-O3 all agree",
    answers.length === 4 && answers.every((v) => v === answers[0]),
    `answers: ${answers.join(" | ")}`);
}

// 13 — flag off: `StaticArray` is still linear memory -------------------------
{
  const built = compile("arrays.ts", "arr-plain.wasm", []);
  check("arrays compile without the flag", built.ok, built.output);
  if (built.ok) {
    const wat = readFileSync(join(scratch, "arr-plain.wat"), "utf8");
    check("flag off: no wasm array operations at all",
      !wat.includes("array.new") && !wat.includes("array.get") &&
          !wat.includes("array.set") && !wat.includes("array.len"));
    const { instance } = await WebAssembly.instantiate(
      readFileSync(join(scratch, "arr-plain.wasm")), imports);
    check("flag off: the same answers",
      instance.exports.probe() === 11504 &&
          instance.exports.managedProbe() === 1004,
      `probe=${instance.exports.probe()} managed=${instance.exports.managedProbe()}`);
  }
}

if (failures) {
  console.error(`\nwasm-gc: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nwasm-gc: OK");
