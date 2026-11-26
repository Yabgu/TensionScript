// Structural unit tests for the DWARF encoder, ported from the Rust tests in
// tension-core/src/dwarf/mod.rs (the two that encode the range-splitting rule
// and the dropped-address rule) plus a DIE-shape assertion.
//
// These run against the built compiler (dist/assemblyscript.js), so they test
// the artifact that ships. Byte-level assertions are appropriate *here*: a
// unit test of a byte encoder asserts bytes. The behavioural gate lives in
// ../runner.js and does not.

import assert from "assert";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { synthesizeDwarf } from "../../../dist/assemblyscript.js";

const here = path.dirname(fileURLToPath(import.meta.url));

// --- a module shaped like a guest -------------------------------------------

function uleb(value) {
  let out = [];
  let v = value;
  for (;;) {
    let b = v & 0x7f;
    v >>>= 7;
    if (v) b |= 0x80;
    out.push(b);
    if (!v) return out;
  }
}

function section(id, payload) {
  return [id, ...uleb(payload.length), ...payload];
}

function lenPrefixed(bytes) {
  return [...uleb(bytes.length), ...bytes];
}

const wasmHeader = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];

/**
 * The Rust tests' `synthetic_guest`: one import, one defined function, a
 * `name` section naming it `game/_start_game`.
 */
function syntheticGuest() {
  let wasm = [...wasmHeader];

  // One function type: `() -> ()`.
  wasm.push(...section(1, [...uleb(1), 0x60, ...uleb(0), ...uleb(0)]));

  // One import: env.print, function, type 0.
  let imports = [...uleb(1), ...lenPrefixed([...Buffer.from("env")]), ...lenPrefixed([...Buffer.from("print")]), 0x00, ...uleb(0)];
  wasm.push(...section(2, imports));

  // One defined function using type 0.
  wasm.push(...section(3, [...uleb(1), ...uleb(0)]));

  // One body: no local declarations, `end`.
  let body = [0x00, 0x0b];
  wasm.push(...section(10, [...uleb(1), ...lenPrefixed(body)]));

  // `name` subsection 1: function index 1 -> "game/_start_game".
  let sub = [...uleb(1), ...uleb(1), ...lenPrefixed([...Buffer.from("game/_start_game")])];
  let nameSec = [...uleb(4), ...Buffer.from("name"), 0x01, ...lenPrefixed(sub)];
  wasm.push(...section(0, nameSec));

  return Uint8Array.from(wasm);
}

/** A guest with three named locals `a`, `b`, `sum` in one function. */
function localsGuest() {
  let wasm = [...wasmHeader];

  // Type: `(i32, i32) -> ()`.
  wasm.push(...section(1, [...uleb(1), 0x60, ...uleb(2), 0x7f, 0x7e, ...uleb(0)]));

  // One import: env.abort, function, type 0.
  let imports = [...uleb(1), ...lenPrefixed([...Buffer.from("env")]), ...lenPrefixed([...Buffer.from("abort")]), 0x00, ...uleb(0)];
  wasm.push(...section(2, imports));

  wasm.push(...section(3, [...uleb(1), ...uleb(0)]));

  // Body: one declared i32 local, then `end` -> locals 0,1 params, 2 declared.
  let body = [...uleb(1), 1, 0x7f, 0x0b];
  wasm.push(...section(10, [...uleb(1), ...lenPrefixed(body)]));

  // Name subsection 1 (function) and 2 (locals a, b, sum).
  let fnNames = [...uleb(1), ...uleb(1), ...lenPrefixed([...Buffer.from("game/f")])];
  let locNames = [...uleb(1), ...uleb(1), ...uleb(3)];
  for (const [index, name] of [[0, "a"], [1, "b"], [2, "sum"]]) {
    locNames.push(...uleb(index), ...lenPrefixed([...Buffer.from(name)]));
  }
  let nameSec = [
    ...uleb(4), ...Buffer.from("name"),
    0x01, ...lenPrefixed(fnNames),
    0x02, ...lenPrefixed(locNames),
  ];
  wasm.push(...section(0, nameSec));

  return Uint8Array.from(wasm);
}

// --- helpers ----------------------------------------------------------------

/** File offset of the code section payload: DWARF address 0. */
function codePayloadStart(wasm) {
  let i = 8;
  while (i < wasm.length) {
    let id = wasm[i++];
    let size = 0;
    let shift = 0;
    for (;;) {
      let byte = wasm[i++];
      size |= (byte & 0x7f) << shift;
      if (!(byte & 0x80)) break;
      shift += 7;
    }
    if (id === 10) return i;
    i += size;
  }
  throw new Error("no code section");
}

function customPayload(wasm, want) {
  let i = 8;
  while (i < wasm.length) {
    let id = wasm[i++];
    let size = 0;
    let shift = 0;
    for (;;) {
      let byte = wasm[i++];
      size |= (byte & 0x7f) << shift;
      if (!(byte & 0x80)) break;
      shift += 7;
    }
    let end = i + size;
    if (id === 0) {
      let nameLen = 0;
      let s = 0;
      let j = i;
      for (;;) {
        let byte = wasm[j++];
        nameLen |= (byte & 0x7f) << s;
        if (!(byte & 0x80)) break;
        s += 7;
      }
      let name = Buffer.from(wasm.slice(j, j + nameLen)).toString("utf8");
      if (name === want) return wasm.slice(j + nameLen, end);
    }
    i = end;
  }
  throw new Error(`no custom section ${want}`);
}

/** Base64 VLQ, the inverse of the reader's decoder. */
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function vlqEncode(value) {
  let v = value < 0 ? ((-value) << 1) | 1 : value << 1;
  let out = "";
  for (;;) {
    let digit = v & 31;
    v >>>= 5;
    if (v) digit |= 32;
    out += B64[digit];
    if (!v) return out;
  }
}

function sourceMap(mappings) {
  return JSON.stringify({ version: 3, sources: ["game.ts"], mappings });
}

function contains(haystack, needle) {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let k = 0; k < needle.length; k++) {
      if (haystack[i + k] !== needle[k]) continue outer;
    }
    return true;
  }
  return false;
}

function u32le(value) {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

// --- tests ------------------------------------------------------------------

// Port of `source_map_addresses_outside_the_code_section_are_dropped`
// (mod.rs:619-650): an in-range mapping becomes a line row, an out-of-range one
// is dropped rather than remapped, and the line program records line 5 at
// payload address 2.
//
// The sequence is asserted **byte for byte**, marker included:
//
//   00 05 02 <addr>        DW_LNE_set_address 2
//   03 04                  DW_LNS_advance_line +4   (line 1 -> 5)
//   0a                     DW_LNS_set_prologue_end  (the sequence's first row)
//   01                     DW_LNS_copy
//   00 01 01               DW_LNE_end_sequence
//
// The marker byte is part of the assertion rather than dropped from it: this
// is the only unit test that pins the emitted line program's shape, and a fix
// that adds an opcode without a test noticing is how the next reader concludes
// it was never there.
{
  let wasm = syntheticGuest();
  let start = codePayloadStart(wasm);
  let mappings = `${vlqEncode(start + 2)}AIA,${vlqEncode(100 - 2)}AAA`;
  let out = synthesizeDwarf(wasm, sourceMap(mappings), "/tmp", "game.wasm");

  let line = customPayload(out, ".debug_line");
  let seq = [0x00, 0x05, 0x02, 0x02, 0x00, 0x00, 0x00, 0x03, 0x04, 0x0a, 0x01, 0x00, 0x01, 0x01];
  assert.ok(contains(line, seq), "line program records source line 5 at payload address 2, prologue end marked");

  let bogus = [0x00, 0x05, 0x02, 0x64, 0x00, 0x00, 0x00]; // set_address 100
  assert.ok(!contains(line, bogus), "no sequence starts at the dropped address");
}

// Port of `cu_ranges_split_bodies_at_row_boundaries` (mod.rs:652-682): two rows
// inside one body produce two interval entries, never the whole-body entry.
{
  let wasm = syntheticGuest();
  let start = codePayloadStart(wasm);
  let mappings = `${vlqEncode(start + 2)}AIA,${vlqEncode(1)}AIA`;
  let out = synthesizeDwarf(wasm, sourceMap(mappings), "/tmp", "game.wasm");

  let ranges = Array.from(customPayload(out, ".debug_ranges"));
  let expect = [...u32le(2), ...u32le(3), ...u32le(3), ...u32le(4), 0, 0, 0, 0, 0, 0, 0, 0];
  assert.deepStrictEqual(ranges, expect, "CU ranges are [2,3),[3,4), not [2,4)");
}

// DIE shape: a compile unit naming the module and compile directory, a
// subprogram, and one DW_TAG_variable per local with the wasm location
// expression `DW_OP_WASM_location 0x00 <index> DW_OP_stack_value`.
{
  let wasm = localsGuest();
  let start = codePayloadStart(wasm);
  let out = synthesizeDwarf(wasm, sourceMap(`${vlqEncode(start + 2)}AIA`), "/build/root", "game.wasm");

  let info = Array.from(customPayload(out, ".debug_info"));
  assert.ok(contains(info, [...Buffer.from("game.wasm"), 0]), "unit DW_AT_name");
  assert.ok(contains(info, [...Buffer.from("/build/root"), 0]), "unit DW_AT_comp_dir");
  assert.ok(contains(info, [...Buffer.from("game/f"), 0]), "subprogram name");

  for (const [name, index] of [["a", 0], ["b", 1], ["sum", 2]]) {
    // Variable DIE: abbrev 5, `name\0`, 4-byte DW_FORM_ref4 type offset, then
    // DW_FORM_exprloc (length + `ed 00 <index> 9f`).
    let head = [0x05, ...Buffer.from(name), 0];
    let found = false;
    for (let i = 0; i + head.length + 9 <= info.length && !found; i++) {
      if (!contains(info.slice(i, i + head.length), head)) continue;
      let at = i + head.length + 4;
      found = info[at] === 0x04
        && info[at + 1] === 0xed
        && info[at + 2] === 0x00
        && info[at + 3] === index
        && info[at + 4] === 0x9f;
    }
    assert.ok(found, `variable \`${name}\` at wasm local index ${index}`);
  }
}

// The degradation rule: an undescribable type form stops the *type* reader,
// not the synthesis. Line tables come from the source map and the code bodies,
// so a module the reader cannot fully describe still ships `.debug_line`, and
// therefore still supports a `.ts` breakpoint — with no variable DIEs, because
// a function's parameter count would otherwise be a guess.
{
  let wasm = [...wasmHeader];

  // Type 0 is a function type; type 1 is a form this reader does not know.
  wasm.push(...section(1, [...uleb(2), 0x60, ...uleb(2), 0x7f, 0x7e, ...uleb(0), 0x7a]));

  // One import: env.abort, function, type 0.
  let imports = [...uleb(1), ...lenPrefixed([...Buffer.from("env")]), ...lenPrefixed([...Buffer.from("abort")]), 0x00, ...uleb(0)];
  wasm.push(...section(2, imports));

  wasm.push(...section(3, [...uleb(1), ...uleb(0)]));

  // Body: one declared i32 local, then `end`.
  let body = [...uleb(1), 1, 0x7f, 0x0b];
  wasm.push(...section(10, [...uleb(1), ...lenPrefixed(body)]));

  let fnNames = [...uleb(1), ...uleb(1), ...lenPrefixed([...Buffer.from("game/f")])];
  let locNames = [...uleb(1), ...uleb(1), ...uleb(1), ...uleb(2), ...lenPrefixed([...Buffer.from("sum")])];
  let nameSec = [
    ...uleb(4), ...Buffer.from("name"),
    0x01, ...lenPrefixed(fnNames),
    0x02, ...lenPrefixed(locNames),
  ];
  wasm.push(...section(0, nameSec));

  wasm = Uint8Array.from(wasm);
  const start = codePayloadStart(wasm);
  const out = synthesizeDwarf(wasm, sourceMap(`${vlqEncode(start + 2)}AIA`), "/tmp", "game.wasm");

  for (const name of [".debug_abbrev", ".debug_info", ".debug_line", ".debug_ranges"]) {
    assert.ok(customPayload(out, name).length > 0, `${name} is still emitted`);
  }
  let info = Array.from(customPayload(out, ".debug_info"));
  assert.ok(contains(info, [...Buffer.from("game/f"), 0]), "the subprogram DIE survives");
  assert.ok(!contains(info, [...Buffer.from("sum"), 0]), "no variable DIE, since the type list is incomplete");
}

// --- a real stack-switching module ------------------------------------------
//
// Every other case here builds its module byte by byte, so none of them can
// reach the reader this round fixed: it is only a *compiler-emitted*
// stack-switching module that carries continuation types (`0x5d`) and
// reference value types (`0x63 <s33>`) in its type section. The assertion is
// the one this round exists to make impossible to regress: such an artifact
// ships `.debug_info` and `.debug_line` at all. The lldb fixture in
// ../examples/await-locals proves the tables are usable; this proves they are
// emitted, without needing a debugger.
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dwarf-async-"));
  try {
    const source = path.join(dir, "game.ts");
    const wasmPath = path.join(dir, "game.wasm");
    // One suspension, one value: `inner` is awaited so `work` parks and
    // resumes. Nothing here is asked to run — only to compile.
    fs.writeFileSync(source, [
      "async function inner(v: i32): i32 {",
      "  await 1;",
      "  return v + 1;",
      "}",
      "async function work(x: i32): i32 {",
      "  let before: i32 = x + 1;",
      "  let r = await inner(before);",
      "  return before + r;",
      "}",
      "export async function main(): i32 {",
      "  return await work(10);",
      "}",
      "export function _start_game(): void {}",
      "",
    ].join("\n"));

    const output = execFileSync(process.execPath, [
      path.resolve(here, "..", "..", "..", "bin", "tensionscript.js"),
      "game.ts", "-o", "game.wasm",
      "--debug", "--sourceMap", "--enable", "stack-switching", "--stackful-backend", "continuation",
    ], { encoding: "utf8", cwd: dir, stdio: "pipe" });
    assert.ok(
      !/DWARF emission failed/.test(output),
      "the compiler reported no DWARF emission failure"
    );

    const wasm = fs.readFileSync(wasmPath);
    // The module really is a stack-switching one: its type section holds a
    // continuation type, which is what the reader used to reject. Asserted
    // from an independent walk of the type section, so a compiler change that
    // stopped emitting continuations could not quietly weaken this case.
    const forms = typeForms(wasm);
    assert.ok(forms.includes(0x5d), `the type section holds a continuation type (forms: ${forms.map(hex).join(" ")})`);
    assert.ok(forms.includes(0x60), "and function types besides");

    for (const name of [".debug_abbrev", ".debug_info", ".debug_line", ".debug_ranges"]) {
      assert.ok(
        customPayload(wasm, name).length > 0,
        `the stack-switching artifact carries a non-empty ${name}`
      );
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function hex(byte) {
  return `0x${byte.toString(16)}`;
}

/**
 * The type-index-order list of type forms in the module's type section, from
 * an independent walk of the bytes (not the compiler's reader), so the
 * assertion above states a fact about the artifact: function (`0x60`),
 * continuation (`0x5d`), struct (`0x5f`), array (`0x5e`).
 */
function typeForms(wasm) {
  let payload = -1;
  let size = 0;
  {
    let i = 8;
    while (i < wasm.length) {
      const id = wasm[i++];
      let len = 0;
      let shift = 0;
      for (;;) {
        const byte = wasm[i++];
        len |= (byte & 0x7f) << shift;
        if (!(byte & 0x80)) break;
        shift += 7;
      }
      if (id === 1) {
        payload = i;
        size = len;
        break;
      }
      i += len;
    }
  }
  if (payload < 0) throw new Error("no type section");

  const end = payload + size;
  let at = payload;
  const uleb = () => {
    let value = 0;
    let shift = 0;
    for (;;) {
      const byte = wasm[at++];
      value |= (byte & 0x7f) << shift;
      if (!(byte & 0x80)) return value;
      shift += 7;
    }
  };
  const valType = () => {
    const byte = wasm[at++];
    // `ref null ht` / `ref ht`: a signed LEB heap type follows.
    if (byte === 0x63 || byte === 0x64) {
      for (;;) {
        if (!(wasm[at++] & 0x80)) break;
      }
    }
  };
  const field = () => {
    valType();
    at++; // mutability
  };

  const forms = [];
  const compType = () => {
    const form = wasm[at++];
    forms.push(form);
    if (form === 0x60) {
      const np = uleb();
      for (let k = 0; k < np; k++) valType();
      const nr = uleb();
      for (let k = 0; k < nr; k++) valType();
    } else if (form === 0x5d) {
      uleb(); // the continuation's function type index; no subtype byte
    } else if (form === 0x5f) {
      const n = uleb();
      for (let k = 0; k < n; k++) field();
    } else if (form === 0x5e) {
      field();
    } else {
      throw new Error(`unexpected type form ${hex(form)} at ${at - 1}`);
    }
  };
  const subType = () => {
    const form = wasm[at++];
    if (form === 0x50 || form === 0x4f) {
      const supers = uleb();
      for (let k = 0; k < supers; k++) uleb();
      compType();
    } else {
      at--; // the subtype's comptype is the byte already read
      compType();
    }
  };

  const count = uleb();
  for (let t = 0; t < count && at < end; t++) {
    if (wasm[at] === 0x4e) {
      at++;
      const members = uleb();
      for (let m = 0; m < members; m++) subType();
    } else {
      subType();
    }
  }
  return forms;
}

console.log("dwarf unit tests: ok (5 cases)");
