// Structural unit tests for the DWARF encoder, ported from the Rust tests in
// tension-core/src/dwarf/mod.rs (the two that encode the range-splitting rule
// and the dropped-address rule) plus a DIE-shape assertion.
//
// These run against the built compiler (dist/assemblyscript.js), so they test
// the artifact that ships. Byte-level assertions are appropriate *here*: a
// unit test of a byte encoder asserts bytes. The behavioural gate lives in
// ../runner.js and does not.

import assert from "assert";

import { synthesizeDwarf } from "../../../dist/assemblyscript.js";

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
{
  let wasm = syntheticGuest();
  let start = codePayloadStart(wasm);
  let mappings = `${vlqEncode(start + 2)}AIA,${vlqEncode(100 - 2)}AAA`;
  let out = synthesizeDwarf(wasm, sourceMap(mappings), "/tmp", "game.wasm");

  let line = customPayload(out, ".debug_line");
  let seq = [0x00, 0x05, 0x02, 0x02, 0x00, 0x00, 0x00, 0x03, 0x04, 0x01, 0x00, 0x01, 0x01];
  assert.ok(contains(line, seq), "line program records source line 5 at payload address 2");

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

console.log("dwarf unit tests: ok (3 cases)");
