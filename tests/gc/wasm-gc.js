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
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

/**
 * Compiles with this repo's CLI and returns **both** streams.
 *
 * `spawnSync`, not `execFileSync`: the latter hands back stdout on success and
 * discards stderr, and the compiler writes its diagnostics to stderr. That is fine
 * for a check that only asks "did it fail", and useless for one that asks "what did
 * it say" — measured: the coverage assertions saw `(no coverage line)` for a build
 * that printed one.
 */
function compile(entry, out, extraArgs, env) {
  // A checked-in fixture lives beside the harness; a generated one (the field-kind
  // table) is written into the scratch dir at test time. Resolve by existence rather
  // than by a flag, so both callers read the same.
  const source = existsSync(join(here, entry)) ? join(here, entry) : join(scratch, entry);
  const args = [cli, source, "--outFile", join(scratch, out),
    "--textFile", join(scratch, out.replace(/\.wasm$/, ".wat")),
    ...extraArgs];
  const result = spawnSync(process.execPath, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: env ? { ...process.env, ...env } : process.env,
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

function check(name, condition, detail) {
  if (condition) {
    console.log(`ok      ${name}`);
  } else {
    console.log(`not ok  ${name}${detail ? `\n          ${detail}` : ""}`);
    ++failures;
  }
}

/**
 * A check that is **known to fail**, and says so out loud.
 *
 * Used only where a defect is established and the fix is a design decision this
 * round did not take. Two properties matter and both are enforced here:
 *
 * - It is **not skipped**. A quietly disabled test is worse than no test, so the
 *   line prints `xfail`, the reason travels with it, and the closing line of the
 *   run names the count.
 * - It **fails the suite if it starts passing** (`XPASS`), because that means the
 *   defect is gone and the marking is now a lie.
 */
const expectedFailures = [];
function xfail(name, condition, reason, detail) {
  if (condition) {
    console.log(`not ok  XPASS: ${name}\n          expected failure now passes — remove the xfail (${reason})`);
    ++failures;
    return;
  }
  console.log(`xfail   ${name}${detail ? `\n          ${detail}` : ""}\n          known: ${reason}`);
  expectedFailures.push(name);
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


// 14 — the flag folds, and the dead arm is never compiled ---------------------
//
// The mechanism a `std/assembly` branch on `ASC_WASM_GC` would rest on. Proven by
// putting code in the dead arm that cannot compile under the active flag, in both
// directions: a GC class's address under `--wasmGc`, and the linear pointer idiom
// without it. If the dead arm were compiled, this fixture would not build.
{
  const gcOn = compile("fold.ts", "fold-gc.wasm", ["--wasmGc"]);
  check("flag on: the linear arm's changetype is never diagnosed", gcOn.ok, gcOn.output);
  const gcOff = compile("fold.ts", "fold-off.wasm", []);
  check("flag off: the GC arm is never diagnosed", gcOff.ok, gcOff.output);
}


// 15 — dynamic `Array<T>` on the GC heap --------------------------------------
{
  const built = compile("dynarray.ts", "dyn.wasm", ["--wasmGc"]);
  check("the dynamic-array fixture compiles with validation on", built.ok, built.output);
  if (built.ok) {
    const wat = readFileSync(join(scratch, "dyn.wat"), "utf8");
    check("Array<T> is a struct with brand, data and length_",
      /\(type \S*Array<i32> \(sub \(struct \(field \$<brand> i32\) \(field \$data \(mut \(ref null \S*gcarray\/i32\)\)\) \(field \$length_ \(mut i32\)\)\)\)\)/.test(wat),
      wat.split("\n").slice(0, 5).join("\n"));
    check("growth copies with array.copy",
      wat.includes("array.copy"), "growth must copy, not drop, the old elements");
    check("the stdlib Array body is never emitted",
      !wat.includes("Array<i32>#__uset") && !wat.includes("~lib/array/Array<i32>#push"));

    const { instance } = await WebAssembly.instantiate(readFileSync(join(scratch, "dyn.wasm")), imports);
    const e = instance.exports;
    check("100 pushes across several growths, read back, pop shrinks",
      e.prim() === 9904950, `prim() = ${e.prim()} (expected 9904950)`);
    check("growth preserves references (40 managed elements)",
      e.grown() === 40040, `grown() = ${e.grown()} (expected 40040)`);
    check("length is the used count, not the capacity",
      e.freshLength() === 0, `freshLength() = ${e.freshLength()} (a fresh array has capacity 8)`);
    let aborted = false;
    try { e.readPastLength(); } catch (error) { aborted = /abort/.test(String(error)); }
    check("capacity is unobservable: read past length aborts", aborted);
    aborted = false;
    try { e.writePastLength(); } catch (error) { aborted = /abort/.test(String(error)); }
    check("capacity is unobservable: write past length aborts", aborted);
    aborted = false;
    try { e.popEmpty(); } catch (error) { aborted = /abort/.test(String(error)); }
    check("popping an empty array aborts", aborted);
  }
}

// 16 — the standing gate on the dynamic-array fixture
{
  const answers = [];
  for (const level of ["-O0", "-O1", "-O2", "-O3"]) {
    const built = compile("dynarray.ts", `dyn${level}.wasm`, ["--wasmGc", level]);
    check(`dynarray ${level} compiles`, built.ok && !/wasm-validator|Aborted/.test(built.output), built.output);
    if (built.ok) {
      const { instance } = await WebAssembly.instantiate(readFileSync(join(scratch, `dyn${level}.wasm`)), imports);
      answers.push(`${instance.exports.prim()},${instance.exports.grown()}`);
    }
  }
  check("dynarray: -O0..-O3 all agree",
    answers.length === 4 && answers.every((v) => v === answers[0]),
    `answers: ${answers.join(" | ")}`);
}

// 17 — flag off: Array is still linear memory
{
  const built = compile("dynarray.ts", "dyn-plain.wasm", []);
  check("dynarray compiles without the flag", built.ok, built.output);
  if (built.ok) {
    const wat = readFileSync(join(scratch, "dyn-plain.wat"), "utf8");
    check("flag off: no wasm GC struct or array for Array", !wat.includes("$length_"));
    const { instance } = await WebAssembly.instantiate(readFileSync(join(scratch, "dyn-plain.wasm")), imports);
    check("flag off: the same answers",
      instance.exports.prim() === 9904950 && instance.exports.grown() === 40040,
      `prim=${instance.exports.prim()} grown=${instance.exports.grown()}`);
  }
}


// 18 — module-scope globals with non-constant initialisers --------------------
//
// `const app = new Editor()` is in every app; four `new AtlasFrame(...)` are in
// stiff-boxes. A GC `struct.new` is not a wasm global's init expression, so the
// global is zeroed and assigned in the start function.
{
  const built = compile("globalinit.ts", "gi.wasm", ["--wasmGc"]);
  check("globals with non-constant initialisers compile", built.ok, built.output);
  if (built.ok) {
    const wat = readFileSync(join(scratch, "gi.wat"), "utf8");
    check("the global is zeroed, not initialised in place",
      /global \S*(GROUND|RAMP)[^\n]*\(ref\.null/.test(wat),
      wat.split("\n").filter((l) => l.includes("global $")).slice(0, 3).join("\n"));
    check("the start function assigns it",
      /func \$start:[^\n]*\n[\s\S]{0,200}global\.set \S*(GROUND|RAMP)/.test(wat));

    const { instance } = await WebAssembly.instantiate(readFileSync(join(scratch, "gi.wasm")), imports);
    const e = instance.exports;
    check("a GC-struct global holds the object it was given",
      e.groundX() === 0 && e.rampX() === 64,
      `groundX=${e.groundX()} rampX=${e.rampX()}`);
    check("a class held by a global may have a String field (pointer fallback)",
      e.namedLen() === 8, `namedLen=${e.namedLen()} (expect 8)`);
  }
}

// 19 — the `length` setter ---------------------------------------------------
{
  const built = compile("dynarray.ts", "dyn2.wasm", ["--wasmGc"]);
  if (built.ok) {
    const { instance } = await WebAssembly.instantiate(readFileSync(join(scratch, "dyn2.wasm")), imports);
    const e = instance.exports;
    check("length setter: grows within capacity, allows the slot, truncates",
      e.setLength() === 5091, `setLength() = ${e.setLength()} (expect 5091)`);
    check("length setter: grows past capacity",
      e.setLengthGrows() === 10007, `setLengthGrows() = ${e.setLengthGrows()} (expect 10007)`);
  } else {
    check("length setter fixture compiles", false, built.output);
  }
}

// 20 — `String` as `(array (mut i16))` ---------------------------------------
//
// The gate for every real program: a `String` field made a class ineligible, and
// `gcUniform` is all-or-nothing, so one string anywhere put the whole module back
// on the pointer ABI. The measured facts here are (a) a string is a wasm array at
// a two-byte element width, (b) the comparison surface — `==`, `<`, `startsWith`,
// `indexOf`, `includes` — answers correctly through the one chokepoint they all
// share, and (c) a class holding a `String` is now a GC struct.
{
  const built = compile("strings.ts", "str.wasm", ["--wasmGc"]);
  check("the string fixture compiles with validation on", built.ok, built.output);
  if (built.ok) {
    const wat = readFileSync(join(scratch, "str.wat"), "utf8");
    // Two bytes per character, not four: packedness is what keeps a `u16` array a
    // different *type* from an `i32` array, so `String` is not structurally a
    // `StaticArray<i32>`.
    check("a String is an (array (mut i16))", /\(type \S*~gcarray\/u16 \(array \(mut i16\)\)\)/.test(wat),
      wat.split("\n").slice(0, 4).join("\n"));
    check("length is array.len", wat.includes("array.len"));
    check("a class holding a String is a GC struct",
      /\$tests\/gc\/strings\/Label \(sub \(struct .*ref null \S*~gcarray\/u16/.test(wat),
      (wat.match(/\(type \S*Label[^\n]*/) ?? ["absent"])[0]);

    const { instance } = await WebAssembly.instantiate(
      readFileSync(join(scratch, "str.wasm")), imports);
    const e = instance.exports;
    const want = {
      lengthOf: 5, codeAt: 101, atChar: 111, charAtCode: 104,
      concatLen: 4, concatCode: 99,
      eqSame: 1, eqDiff: 0, neDiff: 1, ltTrue: 1, ltFalse: 0, gtTrue: 1, eqLengths: 0,
      startsOk: 1, startsBad: 0, indexOfLl: 2, includesOk: 1, inclusiveComp: 0,
      labelRound: 1112,
    };
    for (const name of Object.keys(want)) {
      const got = e[name]();
      check(`strings: ${name}() = ${want[name]}`, got === want[name], `got ${got}`);
    }
  }
}

// 21 — the string fixture at every optimization level ------------------------
{
  const answers = [];
  for (const level of ["-O0", "-O1", "-O2", "-O3"]) {
    const built = compile("strings.ts", `str${level}.wasm`, ["--wasmGc", level]);
    check(`strings ${level} compiles`,
      built.ok && !/wasm-validator|Aborted/.test(built.output), built.output);
    if (built.ok) {
      const { instance } = await WebAssembly.instantiate(
        readFileSync(join(scratch, `str${level}.wasm`)), imports);
      const e = instance.exports;
      answers.push([e.lengthOf(), e.codeAt(), e.concatLen(), e.eqDiff(), e.ltTrue(),
        e.startsBad(), e.indexOfLl(), e.labelRound()].join(","));
    }
  }
  check("strings: -O0..-O3 all agree", new Set(answers).size === 1, answers.join(" | "));
}

// 22 — the flag off still leaves String in linear memory ---------------------
{
  const built = compile("strings.ts", "strplain.wasm", []);
  check("the string fixture compiles without the flag", built.ok, built.output);
  if (built.ok) {
    const wat = readFileSync(join(scratch, "strplain.wat"), "utf8");
    check("flag off: no wasm GC array for String", !/array.new|array.get|array.len/.test(wat),
      wat.split("\n").slice(0, 4).join("\n"));
    const { instance } = await WebAssembly.instantiate(
      readFileSync(join(scratch, "strplain.wasm")), imports);
    const e = instance.exports;
    check("flag off: the same answers",
      e.lengthOf() === 5 && e.codeAt() === 101 && e.concatLen() === 4 &&
      e.eqDiff() === 0 && e.ltTrue() === 1 && e.startsBad() === 0 &&
      e.indexOfLl() === 2 && e.labelRound() === 1112);
  }
}

// 23 — the allocation route: `__new` -> `array.new`, `memory.copy` -> `array.copy`
//
// `substring` and `slice` are ordinary stdlib bodies — no file under
// `std/assembly` is edited for them. Before this round both failed at
// `local.set's value type must be correct` on the `__new` call, because `__new`
// answers a `usize` and a wasm array has no address.
{
  const built = compile("alloc.ts", "alloc.wasm", ["--wasmGc"]);
  check("the allocation fixture compiles with validation on", built.ok, built.output);
  if (built.ok) {
    const wat = readFileSync(join(scratch, "alloc.wat"), "utf8");
    check("the guest allocator is not called at all: `__new` became `array.new`",
      !/call \$~lib\/rt\/itcms\/__new/.test(wat),
      (wat.match(/.*~lib\/rt\/itcms\/__new.*/) ?? ["absent"])[0]);
    check("`memory.copy` between two GC arrays became `array.copy`",
      /array\.copy \$~gcarray\/u16 \$~gcarray\/u16/.test(wat));
    check("the byte length is shifted down to an element count",
      /i32\.shr_u\n\s*array\.new \$~gcarray\/u16/.test(wat),
      (wat.match(/array\.new \$~gcarray\/u16/) ?? ["absent"])[0]);

    const { instance } = await WebAssembly.instantiate(
      readFileSync(join(scratch, "alloc.wasm")), imports);
    const e = instance.exports;
    const want = {
      subLen: 3, subEq: 1, subCode: 101, subWhole: 1, subEmpty: 0,
      subOffset: 1, sliceEq: 1, sliceLen: 2, sliceNeg: 1, slicePast: 1,
      substrEq: 1, probe: 31,
    };
    for (const name of Object.keys(want)) {
      const got = e[name]();
      check(`alloc: ${name}() = ${want[name]}`, got === want[name], `got ${got}`);
    }
  }
}

// 24 — every optimization level agrees on the allocation fixture --------------
{
  const answers = [];
  for (const level of ["-O0", "-O1", "-O2", "-O3"]) {
    const built = compile("alloc.ts", `alc${level}.wasm`, ["--wasmGc", level]);
    check(`alloc ${level} compiles`,
      built.ok && !/wasm-validator|Aborted/.test(built.output), built.output);
    if (built.ok) {
      const { instance } = await WebAssembly.instantiate(
        readFileSync(join(scratch, `alc${level}.wasm`)), imports);
      answers.push(`${instance.exports.probe()},${instance.exports.subLen()},${instance.exports.sliceNeg()}`);
    }
  }
  check("alloc: -O0..-O3 all agree", new Set(answers).size === 1, answers.join(" | "));
}

// 25 — flag off: `String` stays in linear memory and answers the same ---------
{
  const built = compile("alloc.ts", "allocplain.wasm", []);
  check("the allocation fixture compiles without the flag", built.ok, built.output);
  if (built.ok) {
    const wat = readFileSync(join(scratch, "allocplain.wat"), "utf8");
    check("flag off: no wasm GC array in the allocation fixture",
      !/array\.new|array\.copy|array\.get/.test(wat));
    const { instance } = await WebAssembly.instantiate(
      readFileSync(join(scratch, "allocplain.wasm")), imports);
    check("flag off: the same answers", instance.exports.probe() === 31);
  }
}

// 26 — `changetype<usize>` of a GC array is a diagnostic ----------------------
//
// The hole this closes was measured: `String#replaceAll` builds exactly this
// shape, compiled, and answered a length of 4 where the source says 6.
{
  const built = compile("changetype-array.ts", "cta.wasm", ["--wasmGc"]);
  check("changetype<usize> of a String is refused", !built.ok, built.output);
  check("the refusal names the array and the reason",
    /changetype<usize> of a wasm GC array \(String\): a wasm GC reference has no address/.test(built.output),
    built.output.split("\n")[0]);
}

// 27 — the re-used-`ExpressionRef` guard is clean on every GC fixture ---------
//
// `TENSION_REF_GUARD=1` aborts at the site when a tracked node (a GC builtin's
// result, or a constant) is handed to two operands. It found the GC11 defect in
// one run when that defect was deliberately reintroduced; here it asserts the
// tree is clean, which is what makes it usable rather than noisy.
{
  for (const fixture of ["fixtures", "brand", "arrays", "dynarray", "strings", "alloc", "cycles", "inherit", "classfield", "globalinit"]) {
    const built = compile(`${fixture}.ts`, `grd-${fixture}.wasm`, ["--wasmGc"],
      { TENSION_REF_GUARD: "1" });
    check(`ref guard: ${fixture} builds with no re-used ExpressionRef`,
      built.ok && !/re-used ExpressionRef/.test(built.output),
      (built.output.match(/re-used ExpressionRef[^\n]*/) ?? [""])[0]);
  }
}

// 28 — compound assignment and in/decrement on a GC array element -----------
//
// Four separate places decide a store (`compileAssignment`, the binary compounds,
// the postfix operators, the prefix operators) and only the first was covered, so
// `a[i] += v`, `a[i]++` and `--a[i]` resolved `Array#__set` — whose body is
// `changetype<usize>(this)` into `ensureCapacity`, which cannot exist under the
// flag. These fixtures are the regression: a store to the wrong index, or one that
// writes the old value, changes every answer.
{
  const built = compile("elemwrite.ts", "elemwrite.wasm", ["--wasmGc"]);
  check("the element-write fixture compiles with validation on", built.ok, built.output);
  if (built.ok) {
    const { instance } = await WebAssembly.instantiate(
      readFileSync(join(scratch, "elemwrite.wasm")), imports);
    const e = instance.exports;
    const want = {
      plusEquals: 15, compounds: 8, postIncStatement: 9,
      postIncValue: 506, preDecValue: 8, compoundAfterGrowth: 164,
      staticArrayCompound: 10, managedPostInc: 42,
    };
    for (const name of Object.keys(want)) {
      const got = e[name]();
      check(`elemwrite: ${name}() = ${want[name]}`, got === want[name], `got ${got}`);
    }
  }
}

// 29 — the collector's bookkeeping is not emitted ----------------------------
//
// `__link`/`__pin`/`__unpin`/`__visit_members` maintain the guest collector's
// remembered set, pins and typeinfo walk. Under wasm GC the engine traces, so they
// lower to nothing — and they must, because each takes a `usize` and every call site
// passes `changetype<usize>(aRef)`.
{
  const built = compile("elemwrite.ts", "ew-link.wasm", ["--wasmGc"]);
  if (built.ok) {
    const wat = readFileSync(join(scratch, "ew-link.wat"), "utf8");
    check("no collector bookkeeping is called under the flag",
      !/call \$~lib\/rt\/itcms\/(__link|__pin|__unpin|__visit_members)/.test(wat),
      (wat.match(/.*~lib\/rt\/itcms\/__(link|pin|unpin|visit_members).*/) ?? ["absent"])[0]);
  }
  // Flag off it is still there: this is a lowering, not a deletion.
  const plain = compile("elemwrite.ts", "ew-linkplain.wasm", []);
  if (plain.ok) {
    const wat = readFileSync(join(scratch, "ew-linkplain.wat"), "utf8");
    check("flag off: the collector bookkeeping is still emitted",
      /call \$~lib\/rt\/itcms\/__link/.test(wat));
  }
}

// 30 — `if (nullableRef)` is truthiness, not the reference -------------------
//
// A class or array type's `kind` is `Usize`, so a `String | null` condition used to
// be answered as the expression itself — correct for the pointer ABI, where a
// pointer *is* an `i32`, and a ref-typed condition under GC. Measured: it crashed
// the compiler with `AssertionError` in `evaluateCondition`, on the `if (out)`
// shape `String#replaceAll` uses.
{
  const built = compile("truthiness.ts", "truth.wasm", ["--wasmGc"]);
  check("the truthiness fixture compiles", built.ok, built.output);
  if (built.ok) {
    const { instance } = await WebAssembly.instantiate(
      readFileSync(join(scratch, "truth.wasm")), imports);
    check("a null string is falsy and a present one is truthy",
      instance.exports.probe() === 29,
      `probe() = ${instance.exports.probe()} (expect 29)`);
  }
}

// 31 — the coverage report, in all three cases ---------------------------------
//
// The flag promises to move managed classes to another representation, so it has to
// say what it did — and it has to say it in the case that matters, a program where
// nothing migrated. That case used to be silent because the report sat behind the
// latch (`--wasmGc && gcUniform`), which is exactly false when coverage is zero:
// `examples/2d/hello-sprites` compiled to 180,791 bytes with zero struct types and
// not one diagnostic.
{
  // (a) uniform -> INFO 6413, `N of N`.
  const uniform = compile("coverage-uniform.ts", "covu.wasm", ["--wasmGc"]);
  check("uniform program reports INFO 6413", /INFO TS6413: wasm-gc: /.test(uniform.output),
    uniform.output.split("\n").find((l) => /TS641/.test(l)) ?? "(no coverage line)");
  const uniformLine = (uniform.output.match(/INFO TS6413: wasm-gc: [^\n]*/) ?? [""])[0];
  check("uniform program says N of N, with N > 1",
    /\b(\d+) of \1 managed class/.test(uniformLine) && !/\b0 of 0\b/.test(uniformLine),
    uniformLine);
  if (uniform.ok) {
    const { instance } = await WebAssembly.instantiate(
      readFileSync(join(scratch, "covu.wasm")), imports);
    check("uniform program still answers", instance.exports.probe() === 13);
  }

  // (b) not uniform -> WARNING 6414, naming the dominant reason.
  const blocked = compile("coverage.ts", "covb.wasm", ["--wasmGc"]);
  check("non-uniform program reports WARNING 6414",
    /WARNING TS6414: wasm-gc: no class migrated - /.test(blocked.output),
    blocked.output.split("\n").find((l) => /TS641/.test(l)) ?? "(no coverage line)");
  const blockedLine = (blocked.output.match(/WARNING TS6414: [^\n]*/) ?? [""])[0];
  check("non-uniform program says 0 of N and names the cause",
    /0 of \d+ managed class/.test(blockedLine) && /holding an? ArrayBuffer/.test(blockedLine),
    blockedLine);
  if (blocked.ok) {
    const { instance } = await WebAssembly.instantiate(
      readFileSync(join(scratch, "covb.wasm")), imports);
    check("non-uniform program still answers", instance.exports.reportBlocked() === 7,
      `reportBlocked() = ${instance.exports.reportBlocked()} (expect 7)`);
  }

  // (c) flag off -> no coverage diagnostic of any kind, and the same answers.
  const plain = compile("coverage.ts", "covp.wasm", []);
  check("flag off: no coverage diagnostic at all", !/TS641[34]/.test(plain.output),
    plain.output.split("\n").find((l) => /TS641/.test(l)) ?? "(none, as required)");
  if (plain.ok) {
    const { instance } = await WebAssembly.instantiate(
      readFileSync(join(scratch, "covp.wasm")), imports);
    check("flag off: the same answers", instance.exports.reportBlocked() === 7,
      `reportBlocked() = ${instance.exports.reportBlocked()} (expect 7)`);
  }
}

// 32 — the latch is a fixed point, not a discovery order ----------------------
//
// `ordering-late.ts` types an `Array<i32>` at module scope *before* the class that
// turns out ineligible exists; `ordering-early.ts` is the same program with the two
// swapped. If the answer were decided at the first `isGcClass` query it would be
// `true` in the first file and flip to `false` after `Array` had been emitted as a
// GC struct — the mixed module GC10 refuses, and a crash before that refusal
// existed. Both files must report the *same* line, which is what makes the answer
// independent of source order.
{
  const late = compile("ordering-late.ts", "ordl.wasm", ["--wasmGc"]);
  const early = compile("ordering-early.ts", "orde.wasm", ["--wasmGc"]);
  check("both discovery orders compile", late.ok && early.ok,
    `${late.ok ? "" : late.output.slice(0, 200)} ${early.ok ? "" : early.output.slice(0, 200)}`);
  const line = (r) => ((r.output.match(/(?:INFO TS6413|WARNING TS6414): [^\n]*/) ?? [""])[0]);
  check("both discovery orders report the same coverage",
    line(late).length > 0 && line(late) === line(early),
    `late: ${line(late)} | early: ${line(early)}`);
  if (late.ok && early.ok) {
    const l = (await WebAssembly.instantiate(readFileSync(join(scratch, "ordl.wasm")), imports)).instance;
    const e = (await WebAssembly.instantiate(readFileSync(join(scratch, "orde.wasm")), imports)).instance;
    check("both discovery orders answer", l.exports.probe() === 42 && e.exports.probe() === 42,
      `late=${l.exports.probe()} early=${e.exports.probe()} (expect 42 both)`);
  }
}

// 33 — TypedArray views as GC structs: the synthesised layout -----------------
//
// The rule is the user's: a byte buffer holds no GC references, so its storage needs
// no tracing, so it may stay in **linear memory** and be addressable while the *view*
// becomes a GC struct of scalars. `{ <brand>, buffer, dataStart, byteLength }`, and
// `buffer` is stored as an `i32` address rather than a reference — the one field
// whose declared type is deliberately not its stored type.
{
  const built = compile("typedarray.ts", "ta.wasm", ["--wasmGc"]);
  check("the typed-array fixture compiles with validation on", built.ok, built.output);
  if (built.ok) {
    const wat = readFileSync(join(scratch, "ta.wat"), "utf8");
    // **Asserted on the shape, not on the type's name.** `ArrayBufferView` and
    // `DataView` declare identical layouts, so wasm canonicalises them into ONE
    // type — whichever was built first supplies the name (measured: the printed
    // supertype reads `$~lib/dataview/DataView`). That is the GC4 structural-identity
    // hazard, and it is benign here for the reason the brand field exists: dispatch
    // is a value compare, never `ref.test`.
    check("a buffer view is a struct of scalars",
      /\(type \S+ \(sub \(struct \(field \$<brand> i32\) \(field \$buffer \(mut i32\)\) \(field \$dataStart \(mut i32\)\) \(field \$byteLength \(mut i32\)\)\)\)\)/.test(wat),
      (wat.match(/\(type \S+ \(sub \(struct[^\n]*/) ?? ["absent"])[0]);
    // The typed arrays declare nothing of their own, so they canonicalise onto that
    // same struct type rather than each getting a named one — asserted as the fact it
    // is, because a reader who expects twelve named types will otherwise think the
    // migration failed. `viewBrands` is what proves dispatch still separates them.
    check("no view pays for a linear header any more: no __new for a view class",
      !/call \$~lib\/rt\/itcms\/__new\b/.test(wat.split("(func $~lib/typedarray/Int32Array#constructor")[1] ?? ""),
      (wat.match(/.*__new.*/) ?? ["absent"])[0]);
    check("views share one canonical struct type (declared fields are identical)",
      (wat.match(/\(type \S+ \(sub \(struct \(field \$<brand> i32\) \(field \$buffer/g) ?? []).length === 1,
      `${(wat.match(/\(type \S+ \(sub \(struct \(field \$<brand> i32\) \(field \$buffer/g) ?? []).length} such types`);
    // A wasm GC struct is traced by the engine, so the guest scanner must not be
    // asked to walk one: `compileVisitMembers` used to emit `call $C~visit` for every
    // managed class, and `Array<i32>~visit` reads `this.buffer` — a field the
    // synthesised layout does not have (measured: TS2339 on `array.ts:524`).
    check("no visitor is emitted for a GC struct",
      !/call \$~lib\/(array|arraybuffer|typedarray|dataview)\/[^ ]*~visit/.test(wat),
      (wat.match(/call \$~lib\/(array|arraybuffer|typedarray|dataview)\/[^ ]*~visit/) ?? ["absent"])[0]);
    check("the view is not allocated by the guest allocator",
      !/call \$~lib\/rt\/itcms\/__new\b[^\n]*\n[^\n]*Uint8Array/.test(wat) && wat.includes("struct.new"));

    const { instance } = await WebAssembly.instantiate(
      readFileSync(join(scratch, "ta.wasm")), imports);
    const e = instance.exports;
    const want = {
      writeRead: 211,            // elements land at dataStart + i
      byteOffsetAndLength: 8,    // byteOffset survives as a derived i32
      wideElements: 1002,        // two bytes per element
      floatElements: 15,         // f64 elements
      payloadSharedWithBuffer: 119, // load<u32>(dataStart) sees what the view wrote
      dataView: 85,              // DataView: same shape, not an ArrayBufferView
      isView: 1,                 // ArrayBuffer.isView -> brand subtree, non-empty
      viewBrands: 1,             // sibling views have distinct brands
      viaClass: 1003,            // a class HOLDING a view is a GC struct
      stdlibOnPayload: 18,       // FILL/SORT still work through dataStart
    };
    for (const name of Object.keys(want)) {
      const got = e[name]();
      check(`typedarray: ${name}() = ${want[name]}`, got === want[name], `got ${got}`);
    }
  }
}

// 34 — the view fixture at every optimisation level ---------------------------
{
  const answers = [];
  for (const level of ["-O0", "-O1", "-O2", "-O3"]) {
    const built = compile("typedarray.ts", `ta${level}.wasm`, ["--wasmGc", level]);
    check(`typedarray ${level} compiles`,
      built.ok && !/wasm-validator|Aborted/.test(built.output), built.output);
    if (built.ok) {
      const { instance } = await WebAssembly.instantiate(
        readFileSync(join(scratch, `ta${level}.wasm`)), imports);
      const e = instance.exports;
      answers.push([e.writeRead(), e.payloadSharedWithBuffer(), e.dataView(),
        e.viaClass(), e.stdlibOnPayload()].join(","));
    }
  }
  check("typedarray: -O0..-O3 all agree", new Set(answers).size === 1, answers.join(" | "));
}

// 35 — flag off: a typed array is still a pointer-shaped view ----------------
//
// The synthesised layout exists only in the compiler, so `std/` is untouched and the
// flag-off module keeps the linear `{ buffer, dataStart, byteLength }` block.
{
  const built = compile("typedarray.ts", "taplain.wasm", []);
  check("the typed-array fixture compiles without the flag", built.ok, built.output);
  if (built.ok) {
    const wat = readFileSync(join(scratch, "taplain.wat"), "utf8");
    check("flag off: no GC array or struct for a view",
      !/array\.new|array\.get|struct\.new \$~lib\/arraybuffer\/ArrayBufferView/.test(wat),
      (wat.match(/.*(array\.new|struct\.new \$~lib\/arraybuffer).*/) ?? ["absent"])[0]);
    const { instance } = await WebAssembly.instantiate(
      readFileSync(join(scratch, "taplain.wasm")), imports);
    const e = instance.exports;
    check("flag off: the same answers",
      e.writeRead() === 211 && e.dataView() === 85 && e.viaClass() === 1003 &&
      e.payloadSharedWithBuffer() === 119);
  }
}

// 36 — a GC reference still cannot be turned into an address ----------------
//
// The guarantee the design rests on: the payload stays in linear memory *because* a
// blob holds no references, and the only way to smuggle one in would be
// `changetype<usize>(aGCReference)`. A view is now exactly the object most likely to
// tempt that ("the data is right there"), so this is the test that keeps it refused.
{
  const built = compile("changetype-view.ts", "ctv.wasm", ["--wasmGc"]);
  check("changetype<usize> of a TypedArray view is refused", !built.ok, built.output);
  check("the refusal names the view and the reason",
    /changetype<usize> of a wasm GC class instance \(Uint8Array\): a wasm GC reference has no address/.test(built.output),
    built.output.split("\n").find((l) => /AS100/.test(l)) ?? "(no diagnostic)");
}

// 37 — the report cannot claim what emission cannot deliver -------------------
//
// The invariant, and it is the point of the section: **no class may be reported on
// the GC ABI unless its struct type can actually be built.** The two oracles used to
// answer from different predicates — eligibility switched on `TypeKind`, and a
// signature type's kind *is* `usizeType.kind` (with the `Value` bit cleared), so
// `cb: (x: i32) => void` was called numeric and therefore storable, while emission
// tested `isInternalReference` and hit `assert(false)`. Measured: `1 of 1 managed
// class on the GC ABI`, then the compiler died at `gcFieldTypeRef` the moment an
// instance was constructed.
//
// So: one fixture per field kind, written into the scratch dir from the table below.
// Each must either (a) report coverage and carry a `(struct …)` type for the class, or
// (b) refuse with a named reason. Neither may crash, and (a) and (b) may not overlap.
{
  const kinds = [
    ["a value", "n: i32 = 0;", true],
    ["a float", "f: f64 = 0;", true],
    ["a string", "s: string = \"\";", true],
    ["a class", "o: Inner = new Inner();", true],
    ["a nullable class", "o: Inner | null = null;", true],
    ["a StaticArray", "a: StaticArray<i32> = new StaticArray<i32>(1);", true],
    ["a dynamic Array", "a: Array<i32> = new Array<i32>(0);", true],
    ["a TypedArray", "t: Uint8Array = new Uint8Array(1);", true],
    ["an ArrayBuffer", "b: ArrayBuffer = new ArrayBuffer(1);", false],
    ["a function value", "cb: (x: i32) => void;", false],
    ["a Map", "m: Map<i32, i32> = new Map<i32, i32>();", false],
    ["an inline value array", "v: @inline [u32 * 4];", false, 6415],
  ];
  for (const [label, field, storable, permanentCode] of kinds) {
    const name = `kind-${label.replace(/[^a-z]+/gi, "-").toLowerCase()}`;
    writeFileSync(join(scratch, `${name}.ts`),
      `class Inner { x: i32 = 0; }\n` +
      `class Holder { ${field} }\n` +
      `export function run(): i32 { let h = new Holder(); return 1; }\n`);
    const built = compile(`${name}.ts`, `${name}.wasm`, ["--wasmGc"]);
    const out = built.output;
    const crashed = /AssertionError|at gcFieldTypeRef|at fillGcStructType/.test(out);
    check(`field kind: ${label} does not crash the compiler`, !crashed,
      out.split("\n").find((l) => /AssertionError|gcFieldTypeRef/.test(l)) ?? "");

    const info = (out.match(/INFO TS6413: wasm-gc: (\d+) of (\d+)/) ?? []);
    const claimsGc = info.length > 0 && info[1] !== "0";
    const warned = /WARNING TS6414: /.test(out);
    check(`field kind: ${label} is reported consistently`,
      !(claimsGc && warned) && (claimsGc || warned),
      `claimsGc=${claimsGc} warned=${warned}`);

    if (storable) {
      check(`field kind: ${label} is on the GC ABI`, claimsGc && built.ok, out.split("\n")[0]);
      if (built.ok) {
        const wat = readFileSync(join(scratch, `${name}.wat`), "utf8");
        // The report said a struct exists; the module has to contain one.
        check(`field kind: ${label} really emits a struct`,
          /Holder \(sub \(struct/.test(wat),
          (wat.match(/\(type \S*Holder[^\n]*/) ?? ["absent"])[0]);
      }
    } else {
      check(`field kind: ${label} is refused by name`, warned && !claimsGc, out.split("\n")[0]);
      if (permanentCode) {
        check(`field kind: ${label} is refused as permanent (TS6415)`,
          new RegExp(`WARNING TS6415: `).test(out), out.split("\n")[0]);
      } else {
        check(`field kind: ${label} is not called permanent`,
          !/WARNING TS6415: /.test(out),
          out.split("\n").find((l) => /TS6415/.test(l)) ?? "(none)");
      }
    }
  }
}

// 38 — a function-typed field: refused, not asserted --------------------------
//
// The exact repro from the round's brief, in both forms. `f1` never constructs the
// class and used to answer `1 of 1 managed class on the GC ABI` — a report that
// lied. `f2` constructs it and used to kill the compiler. Both must name the cause.
{
  // `cb` is **initialised**, unlike the brief's repro: an uninitialised field is
  // `TS2564` under strict property initialisation and fails flag-off too, which would
  // make the fixture evidence about something else. A closure is the same field kind
  // and is the shape a program actually writes.
  writeFileSync(join(scratch, "fnfield-never.ts"),
    `class H { cb: (x: i32) => void = (x: i32): void => {}; n: i32 = 0; }\n` +
    `export function run(): i32 { return 1; }\n`);
  writeFileSync(join(scratch, "fnfield-construct.ts"),
    `class H { cb: (x: i32) => void = (x: i32): void => {}; n: i32 = 0; }\n` +
    `export function run(): i32 { let h = new H(); return 1; }\n`);

  for (const [file, what] of [["fnfield-never", "never constructed"], ["fnfield-construct", "constructed"]]) {
    const built = compile(`${file}.ts`, `${file}.wasm`, ["--wasmGc"]);
    check(`function field (${what}): no INFO claiming the class is GC`,
      !/INFO TS6413: wasm-gc: [1-9]/.test(built.output), built.output.split("\n")[0]);
    check(`function field (${what}): no compiler crash`,
      !/AssertionError|gcFieldTypeRef/.test(built.output), built.output.split("\n")[0]);
    check(`function field (${what}): the refusal names a function value`,
      /WARNING TS6414: .*holding a function value/.test(built.output),
      built.output.split("\n").find((l) => /TS6414/.test(l)) ?? "(none)");
    check(`function field (${what}): it still compiles on the pointer ABI`, built.ok);
  }
}

// 39 — permanent versus fixable, in one report -------------------------------
//
// The taxonomy is the user's: an `@inline [T * N]` is a C-compatible **value**, so a
// class holding one can never be a GC struct — listing it beside `Map` sends a reader
// to "fix" the C ABI. The two lists must be separate in the text, and the permanent
// one carries its own diagnostic.
{
  writeFileSync(join(scratch, "mixed-reasons.ts"),
    `class ValueHolder { v: @inline [u32 * 4]; }\n` +
    `class MapHolder { m: Map<i32, i32> = new Map<i32, i32>(); }\n` +
    `export function run(): i32 { let a = new ValueHolder(); let b = new MapHolder(); return 1; }\n`);
  const built = compile("mixed-reasons.ts", "mixr.wasm", ["--wasmGc"]);
  const line = (built.output.match(/WARNING TS6414: [^\n]*/) ?? [""])[0];
  check("the report separates permanent obstacles from fixable ones",
    /permanent, not a work item/.test(line) && /holding a value array/.test(line) &&
    /holding a Map/.test(line),
    line);
  check("the fixable list leads, the permanent one follows",
    line.indexOf("holding a Map") < line.indexOf("permanent, not a work item"), line);
  check("permanently refused classes get their own diagnostic (TS6415)",
    /WARNING TS6415: wasm-gc: \d+ class/.test(built.output),
    built.output.split("\n").find((l) => /TS6415/.test(l)) ?? "(none)");
  check("the permanent class is not counted as a fixable reason",
    !/^: 1 holding a value array/.test(line.slice(line.indexOf(": "))) &&
    /1 holding a Map/.test(line), line);
}

// 40 — the ladder: values must be LIVE, not merely CURRENT --------------------
//
// The gap GC18 closed. Every runtime assertion before that section read its values
// immediately after writing them, so a collection never fell between a write and its
// read — the suite proved values *current*. This writes two bytes into a payload held
// by a module-scope `Box`, allocates, and reads them back.
//
// GC18 marked the third rung an expected failure: under `--wasmGc` the payload of a
// live handle was swept and its bytes reused. GC19 replaced the flag's linear
// allocator with a **never-free arena**, so a payload is never handed to another
// allocation, and all three rungs pass. The `xfail` mechanism stays in this file —
// it is how a known defect is kept visible instead of skipped — but there is no
// entry using it now, which the closing line reports.
{
  const built = compile("linearheap.ts", "lh.wasm", ["--wasmGc"]);
  check("the linear-heap fixture compiles", built.ok, built.output);
  if (built.ok) {
    const { instance } = await WebAssembly.instantiate(
      readFileSync(join(scratch, "lh.wasm")), imports);
    const e = instance.exports;
    check("ladder rung 1 (no churn): 42 + 7 reads back as 49", e.noChurn() === 49,
      `got ${e.noChurn()}`);
    check("ladder rung 2 (8 allocations, below the threshold): still 49", e.eight() === 49,
      `got ${e.eight()}`);
    check("ladder rung 3 (200k allocations): the live payload still reads 49",
      e.many() === 49, `got ${e.many()} after 200000 allocations of 64 bytes`);
    check("a payload survives an explicit collection", e.writeThenCollect() === 49,
      `got ${e.writeThenCollect()}`);
  }
}

// 41 — the same fixture without the flag: the control ------------------------
//
// If this section failed too, §40 would be evidence about the fixture and not about
// the flag. It passes, on the same source and the same driver.
{
  const built = compile("linearheap.ts", "lhoff.wasm", []);
  check("the linear-heap fixture compiles without the flag", built.ok, built.output);
  if (built.ok) {
    const { instance } = await WebAssembly.instantiate(
      readFileSync(join(scratch, "lhoff.wasm")), imports);
    const e = instance.exports;
    check("flag off: rung 1", e.noChurn() === 49, `got ${e.noChurn()}`);
    check("flag off: rung 2", e.eight() === 49, `got ${e.eight()}`);
    check("flag off: rung 3 (200k allocations) still 49", e.many() === 49,
      `got ${e.many()}`);
  }
}

// 42 — the trade, stated as a test: never-free means growth ----------------
//
// GC18's measurement was that flag-on and flag-off reuse the same addresses at the
// same rate (18 181 and 19 999 of 200 000) — because both ran `itcms` over `tlsf`, and
// reuse is what a collector does. The arena removes exactly that: no address is ever
// handed out twice under the flag, and linear memory grows to hold what would
// otherwise have been reclaimed.
//
// This is the cost, asserted rather than promised: the flagged run allocates ~19 MB
// for 200 000 payloads and its memory grows accordingly, while the flag-off run stays
// at one page because `itcms` reclaims.
{
  const on = compile("linearheap.ts", "lhro.wasm", ["--wasmGc"]);
  const off = compile("linearheap.ts", "lhro2.wasm", []);
  if (on.ok && off.ok) {
    const a = (await WebAssembly.instantiate(readFileSync(join(scratch, "lhro.wasm")), imports)).instance.exports;
    const b = (await WebAssembly.instantiate(readFileSync(join(scratch, "lhro2.wasm")), imports)).instance.exports;
    const onReuse = a.firstAddressReuse(200000);
    const offReuse = b.firstAddressReuse(200000);
    const onPages = a.pages();
    const offPages = b.pages();
    check("no address is reused under the flag, so no payload is ever overwritten",
      onReuse === 0, `${onReuse} of 199 999 allocations returned the first address`);
    check("the flag-off run still reclaims (it runs the collector)", offReuse > 5000,
      `${offReuse} reuses`);
    check("...and the flagged run's memory grew instead of reusing",
      onPages > offPages * 10 && onPages > 150, `on ${onPages} pages, off ${offPages} pages`);
  } else {
    check("both reuse probes compile", false, `${on.ok ? "" : on.output.slice(0, 200)}${off.ok ? "" : off.output.slice(0, 200)}`);
  }
}

// 43 — `__collect` reachability, and what an explicit collection does ---------
//
// The brief asked for an explicit collection between the write and the read. It is
// reachable: with no local `declare`, `__collect()` resolves to the runtime's own
// function and the module imports nothing for it. And the value survives it — because
// one collection frees the payload but nothing has reused the bytes yet, so this is
// **not** a reproduction of the defect. Recorded so nobody mistakes a green check here
// for a working root set; the ladder is the reproduction.
{
  const built = compile("linearheap.ts", "lhc.wasm", ["--wasmGc"]);
  if (built.ok) {
    const mod = new WebAssembly.Module(readFileSync(join(scratch, "lhc.wasm")));
    const imported = WebAssembly.Module.imports(mod).map((i) => `${i.module}.${i.name}`);
    check("`__collect` is the runtime's function, not a host import",
      !imported.some((name) => /__collect$/.test(name)), imported.join(", ") || "(none)");
    // `instantiate(module, imports)` resolves to an **Instance**, not to
    // `{module, instance}` — the pair form is for the bytes overload. Measured.
    const instance = await WebAssembly.instantiate(mod, imports);
    check("a payload survives one explicit collection (nothing has reused it yet)",
      instance.exports.writeThenCollect() === 49,
      `got ${instance.exports.writeThenCollect()}`);
  }
}

// 44 — the value family is one category, in every spelling --------------------
//
// The user's taxonomy: `[T*N]`, `T[N]` and `@inline [T*N]` are the *same* storage — a
// C-compatible value with no address — so all three are permanent, and the tests say so
// in all three spellings rather than only the one a fixture happened to use. The fourth
// line is the boundary: `@unmanaged [T*N]` is an **address**, which is storable in
// principle, so it is a fixable refusal and must not be called permanent.
{
  const spellings = [
    ["[u32 * 4]", "bracket-mult"],
    ["u32[4]", "bracket-count"],
    ["@inline [u32 * 4]", "inline-bracket"],
  ];
  for (const [decl, slug] of spellings) {
    const name = `value-${slug}`;
    writeFileSync(join(scratch, `${name}.ts`),
      `class Holder { v: ${decl}; }\n` +
      `export function run(): i32 { let h = new Holder(); return 1; }\n`);
    const built = compile(`${name}.ts`, `${name}.wasm`, ["--wasmGc"]);
    check(`value field ${decl}: refused as permanent (TS6415)`,
      /WARNING TS6415: wasm-gc: \d+ class can never be on the GC ABI/.test(built.output),
      built.output.split("\n").find((l) => /TS641/.test(l)) ?? "(none)");
    check(`value field ${decl}: named as a value array, not as an unknown kind`,
      /holding a value array/.test(built.output),
      built.output.split("\n").find((l) => /TS6415/.test(l)) ?? "(none)");
  }
  // The boundary. An address is not a value.
  writeFileSync(join(scratch, "value-unmanaged.ts"),
    `class Holder { v: @unmanaged [u32 * 4]; }\n` +
    `export function run(): i32 { let h = new Holder(); return 1; }\n`);
  const unmanaged = compile("value-unmanaged.ts", "value-unmanaged.wasm", ["--wasmGc"]);
  check("@unmanaged [u32 * 4] is a fixable refusal, not a permanent one",
    /WARNING TS6414: /im.test(unmanaged.output) && !/TS6415/.test(unmanaged.output),
    unmanaged.output.split("\n").find((l) => /TS641/.test(l)) ?? "(none)");
  check("@unmanaged [u32 * 4] is named as an array address",
    /holding an array address/.test(unmanaged.output),
    unmanaged.output.split("\n").find((l) => /TS6414/.test(l)) ?? "(none)");
}

// 45 — the split report's arithmetic ----------------------------------------
//
// A report that splits is only useful if the parts add up. One program with one class
// in each of the four buckets — permanent, fixable, blocked, eligible — must name all
// four, and the four counts must equal the class total. Measured: `0 of 4 … 1 holding a
// Map; permanent, not a work item: 1 holding a value array (…) (and 1 blocked …, 1
// eligible …)`.
{
  writeFileSync(join(scratch, "buckets.ts"),
    `class Perm { v: @inline [u32 * 4]; }\n` +
    `class Fix { m: Map<i32, i32> = new Map<i32, i32>(); }\n` +
    `class Blocked { p: Perm = new Perm(); }\n` +
    `class Free { x: i32 = 0; }\n` +
    `export function run(): i32 { let a = new Perm(); let b = new Fix(); let c = new Blocked(); let d = new Free(); return 1; }\n`);
  const built = compile("buckets.ts", "buckets.wasm", ["--wasmGc"]);
  const line = (built.output.match(/WARNING TS6414: [^\n]*/) ?? [""])[0];
  const fixable = (line.match(/^WARNING TS6414: wasm-gc: no class migrated - 0 of \d+ managed class(?:es)? on the GC ABI - the program is not uniform: (\d+)/) ?? [])[1];
  const permanent = (line.match(/permanent, not a work item: (\d+)/) ?? [])[1];
  const blocked = (line.match(/(\d+) blocked by a class that is not GC/) ?? [])[1];
  const eligible = (line.match(/(\d+) eligible, held back/) ?? [])[1];
  const total = (line.match(/0 of (\d+) managed class/) ?? [])[1];
  check("every bucket is named in one line",
    !!fixable && !!permanent && !!blocked && !!eligible && !!total, line);
  if (fixable && permanent && blocked && eligible && total) {
    const sum = +fixable + +permanent + +blocked + +eligible;
    check("the four buckets sum to the class total", sum === +total,
      `${fixable} + ${permanent} + ${blocked} + ${eligible} = ${sum}, total ${total}`);
    check("the permanent class is not counted among the fixable reasons",
      /1 holding a Map/.test(line) && !/^$/.test(fixable), line);
  }
  check("a permanently refused class is reported as permanent, never as a reason",
    /WARNING TS6415: wasm-gc: 1 class can never be on the GC ABI/.test(built.output),
    built.output.split("\n").find((l) => /TS6415/.test(l)) ?? "(none)");
}

// 46 — the arena at every optimisation level --------------------------------
//
// The `-O0..-O3` gate exists because a re-used `ExpressionRef` used to be correct at
// `-O0` and wrong above it, and GC18 found the opposite shape — a defect whose *wrong
// digits* varied by level (60 at `-O0`/`-O1`, 55 at `-O2`/`-O3`). The arena removes
// both questions: every rung is 49, at every level, and the growth is not an artifact
// of optimisation either.
{
  const answers = [];
  const pages = [];
  for (const level of ["-O0", "-O1", "-O2", "-O3"]) {
    const built = compile("linearheap.ts", `lho${level}.wasm`, ["--wasmGc", level]);
    check(`linearheap ${level} compiles`, built.ok, built.output);
    if (!built.ok) continue;
    const { instance } = await WebAssembly.instantiate(
      readFileSync(join(scratch, `lho${level}.wasm`)), imports);
    const e = instance.exports;
    answers.push([e.noChurn(), e.eight(), e.many(), e.writeThenCollect()].join(","));
    pages.push(e.firstAddressReuse(20000) === 0 ? "no-reuse" : "REUSE");
  }
  check("linearheap: every rung answers 49 at -O0..-O3",
    new Set(answers).size === 1 && answers[0] === "49,49,49,49", answers.join(" | "));
  check("linearheap: no address is reused at any level",
    pages.every((v) => v === "no-reuse"), pages.join(", "));
}

if (failures) {
  console.error(`\nwasm-gc: ${failures} check(s) failed`);
  process.exit(1);
}
if (expectedFailures.length) {
  console.log(`\nwasm-gc: OK (${expectedFailures.length} expected failure(s): the linear heap is`);
  console.log("  unrooted under --wasmGc, so a live payload is swept and reused — GC18;");
  console.log("  see docs/memory-model.md)");
} else {
  console.log("\nwasm-gc: OK");
}
