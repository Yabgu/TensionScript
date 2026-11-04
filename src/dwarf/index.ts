/**
 * @fileoverview DWARF synthesis for TensionScript guests, compiler side.
 *
 * Port of `tension-core/src/dwarf/mod.rs` (`synthesize`) and the module
 * comment that explains it. The host rebuilt this from a guest's `name`
 * section and source map because `asc` emitted no DWARF; the compiler now
 * carries the same code, so a guest ships its own `.debug_*` sections.
 *
 * Address convention (measured, not assumed): a guest DWARF code address is a
 * byte offset from the start of the code section payload - address 0 is the
 * first byte of the function-count LEB.
 *
 * The encoder is a verbatim port, including the range-splitting rule: the
 * compile unit's `DW_AT_ranges` entries are intervals between line rows, not
 * whole bodies, because cranelift emits a function's natives in an order that
 * is not monotonic in wasm addresses. Its range translation only sees the
 * ranges active at an entry's start and end addresses, so a whole-body entry
 * hides any internal range that begins and ends strictly inside it, and lldb
 * drops line rows that fall in the resulting holes.
 * @license Apache-2.0
 */

import { ByteWriter } from "./leb";
import { parseSourceMap, Seg } from "./source-map";
import {
  encodeDebugAbbrev,
  encodeDebugInfo,
  encodeDebugLine,
  appendCustom,
  FunctionRange,
  Range,
} from "./encode";
import { LocalInfo, parseLayout, ValType } from "./wasm-layout";

/** What synthesis produced, for the caller's diagnostics. */
export class SynthesisResult {
  bytes: Uint8Array;
  files: i32;
  rows: i32;
  functions: i32;
  locals: i32;
  dropped: i32;

  constructor(bytes: Uint8Array, files: i32, rows: i32, functions: i32, locals: i32, dropped: i32) {
    this.bytes = bytes;
    this.files = files;
    this.rows = rows;
    this.functions = functions;
    this.locals = locals;
    this.dropped = dropped;
  }
}

/**
 * Copy `wasm` with synthesized `.debug_abbrev`, `.debug_info`, `.debug_line`
 * and `.debug_ranges` appended: line tables for source breakpoints, function
 * DIEs for the call stack, and variable DIEs for locals.
 *
 * `compDir` becomes the DWARF compile directory and the base for every
 * file-table entry. `moduleName` becomes the unit's `DW_AT_name`.
 *
 * Throws `Error` on malformed input. The Rust original returned
 * `Result<_, String>`; a throw is the idiomatic equivalent here, and the
 * caller decides whether a failed synthesis is fatal (the compiler treats it
 * as a warning and emits the undecorated module).
 */
export function synthesize(
  wasm: Uint8Array,
  sourceMapJson: string,
  compDir: string,
  moduleName: string
): Uint8Array {
  return synthesizeVerbose(wasm, sourceMapJson, compDir, moduleName).bytes;
}

/** `synthesize` plus the counts the host used to log. */
export function synthesizeVerbose(
  wasm: Uint8Array,
  sourceMapJson: string,
  compDir: string,
  moduleName: string
): SynthesisResult {
  let map = parseSourceMap(sourceMapJson);
  let layout = parseLayout(wasm);
  let base = <u32>layout.codePayloadStart;
  let endAddr = <u32>layout.codePayloadSize;

  // Source-map offsets are absolute file offsets; DWARF is payload-relative.
  let rows: Seg[] = [];
  for (let i = 0; i < map.segments.length; i++) {
    let s = map.segments[i];
    if (s.addr < base) continue;
    let addr = s.addr - base;
    if (addr > endAddr) continue;
    rows.push(new Seg(addr, s.file, s.line, s.col));
  }
  let dropped = map.segments.length - rows.length;
  stableSortByAddr(rows);
  rows = dedupByAddr(rows);

  // Body ranges, payload-relative: one line sequence per function.
  let bodyRanges: Range[] = [];
  for (let i = 0; i < layout.bodies.length; i++) {
    let body = layout.bodies[i];
    if (body.end <= body.start) continue;
    bodyRanges.push(new Range(
      <u32>(body.start - <i32>base),
      <u32>(body.end - <i32>base)
    ));
  }

  let functions: FunctionRange[] = [];
  let locals: LocalInfo[][] = [];
  for (let i = 0; i < layout.bodies.length; i++) {
    let name = layout.nameForBody(i);
    if (name === null) continue;
    let body = layout.bodies[i];
    if (body.end <= body.start) continue;
    functions.push(new FunctionRange(
      <string>name,
      <u32>(body.start - <i32>base),
      <u32>(body.end - <i32>base)
    ));
    // Only locals whose value type has a DWARF base type become variable
    // DIEs; the rest are skipped without failing the function.
    let all = layout.localsForBody(i);
    let kept: LocalInfo[] = [];
    for (let k = 0; k < all.length; k++) {
      if (all[k].ty != ValType.None) kept.push(all[k]);
    }
    locals.push(kept);
  }

  // The compile unit's DW_AT_ranges: intervals between consecutive line rows
  // (plus each body's leading and trailing edges), not whole bodies. See the
  // module comment for why.
  let rangeList = new ByteWriter(256);
  for (let i = 0; i < bodyRanges.length; i++) {
    let lo = bodyRanges[i].start;
    let hi = bodyRanges[i].end;
    let prev = lo;
    for (let r = 0; r < rows.length; r++) {
      let addr = rows[r].addr;
      if (addr < lo || addr >= hi) continue;
      if (addr > prev) {
        rangeList.u32le(prev);
        rangeList.u32le(addr);
      }
      prev = addr;
    }
    if (hi > prev) {
      rangeList.u32le(prev);
      rangeList.u32le(hi);
    }
  }
  rangeList.u32le(0); // end-of-list marker
  rangeList.u32le(0);

  let abbrev = encodeDebugAbbrev();
  let line = encodeDebugLine(compDir, map.sources, rows, bodyRanges);
  let info = encodeDebugInfo(moduleName, compDir, functions, locals);

  let out = new ByteWriter(wasm.length + abbrev.length + info.length + line.length + rangeList.len + 64);
  out.bytes(wasm);
  appendCustom(out, ".debug_abbrev", abbrev);
  appendCustom(out, ".debug_info", info);
  appendCustom(out, ".debug_line", line);
  appendCustom(out, ".debug_ranges", rangeList.finish());

  return new SynthesisResult(
    out.finish(),
    map.sources.length,
    rows.length,
    functions.length,
    countLocals(locals),
    dropped
  );
}

function countLocals(locals: LocalInfo[][]): i32 {
  let n = 0;
  for (let i = 0; i < locals.length; i++) n += locals[i].length;
  return n;
}

/** Rust's `sort_by_key(|r| r.addr)`, which is stable. */
function stableSortByAddr(rows: Seg[]): void {
  let n = rows.length;
  if (n < 2) return;
  let scratch: Seg[] = new Array<Seg>(n);
  let width = 1;
  while (width < n) {
    let i = 0;
    while (i < n) {
      let mid = i + width < n ? i + width : n;
      let end = i + 2 * width < n ? i + 2 * width : n;
      let a = i;
      let b = mid;
      let k = i;
      while (a < mid && b < end) {
        // `<` keeps equal keys in input order, which is what stable means.
        if (rows[b].addr < rows[a].addr) scratch[k++] = rows[b++];
        else scratch[k++] = rows[a++];
      }
      while (a < mid) scratch[k++] = rows[a++];
      while (b < end) scratch[k++] = rows[b++];
      i = end;
    }
    for (let j = 0; j < n; j++) rows[j] = scratch[j];
    width *= 2;
  }
}

/** Rust's `dedup_by_key(|r| r.addr)`: drop consecutive rows sharing an address. */
function dedupByAddr(rows: Seg[]): Seg[] {
  let out: Seg[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i].addr == rows[i - 1].addr) continue;
    out.push(rows[i]);
  }
  return out;
}
