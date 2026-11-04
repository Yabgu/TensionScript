/**
 * @fileoverview The DWARF 4 encoder: abbreviations, the line program,
 * `.debug_info` DIEs, and the custom-section wrapper. Port of
 * `tension-core/src/dwarf/encode.rs`.
 * @license Apache-2.0
 */

import { ByteWriter } from "./leb";
import { Seg } from "./source-map";
import {
  LocalInfo,
  ValType,
  valTypeByteSize,
  valTypeEncoding,
  valTypeName,
} from "./wasm-layout";

const DW_TAG_COMPILE_UNIT: u32 = 0x11;
const DW_TAG_SUBPROGRAM: u32 = 0x2e;
const DW_TAG_BASE_TYPE: u32 = 0x24;
const DW_TAG_VARIABLE: u32 = 0x34;
const DW_AT_NAME: u32 = 0x03;
const DW_AT_STMT_LIST: u32 = 0x10;
const DW_AT_LOW_PC: u32 = 0x11;
const DW_AT_HIGH_PC: u32 = 0x12;
const DW_AT_COMP_DIR: u32 = 0x1b;
const DW_AT_RANGES: u32 = 0x55;
const DW_AT_EXTERNAL: u32 = 0x3f;
const DW_AT_TYPE: u32 = 0x49;
const DW_AT_LOCATION: u32 = 0x02;
const DW_AT_ENCODING: u32 = 0x3e;
const DW_AT_BYTE_SIZE: u32 = 0x0b;
const DW_FORM_ADDR: u32 = 0x01;
const DW_FORM_STRING: u32 = 0x08;
const DW_FORM_SEC_OFFSET: u32 = 0x17;
const DW_FORM_FLAG_PRESENT: u32 = 0x19;
const DW_FORM_DATA1: u32 = 0x0b;
const DW_FORM_REF4: u32 = 0x13;
const DW_FORM_EXPRLOC: u32 = 0x18;

/**
 * The WebAssembly location operators from DWARF 5's wasm extension, which
 * wasmtime's transform understands: `DW_OP_WASM_location 0x00 <local index>`
 * is the location of a local, and a trailing `DW_OP_stack_value` marks the
 * expression as producing the value itself (what cranelift rewrites into
 * `DW_OP_regN` / `DW_OP_fbreg` per address range).
 */
const DW_OP_WASM_LOCATION: i32 = 0xed;
const DW_OP_STACK_VALUE: i32 = 0x9f;

/** DWARF 4, DWARF32. Wasmtime's transform consumes the shape LLVM emits for wasm. */
const DWARF_VERSION: u32 = 4;

/** One subprogram: its name and payload-relative `[lo, hi)` address. */
export class FunctionRange {
  name: string;
  lo: u32;
  hi: u32;

  constructor(name: string, lo: u32, hi: u32) {
    this.name = name;
    this.lo = lo;
    this.hi = hi;
  }
}

/** A payload-relative `[start, end)` interval. */
export class Range {
  start: u32;
  end: u32;

  constructor(start: u32, end: u32) {
    this.start = start;
    this.end = end;
  }
}

function attr(out: ByteWriter, name: u32, form: u32): void {
  out.uleb(name);
  out.uleb(form);
}

/**
 * Abbrev 1: compile unit. Abbrev 2: subprogram. Abbrev 3: subprogram with
 * children. Abbrev 4: base type. Abbrev 5: variable. No `strp`, so no
 * `.debug_str`; type references are `DW_FORM_ref4` within the unit.
 */
export function encodeDebugAbbrev(): Uint8Array {
  let a = new ByteWriter(256);
  a.uleb(1);
  a.uleb(DW_TAG_COMPILE_UNIT);
  a.uleb(1); // has children
  attr(a, DW_AT_NAME, DW_FORM_STRING);
  attr(a, DW_AT_COMP_DIR, DW_FORM_STRING);
  attr(a, DW_AT_STMT_LIST, DW_FORM_SEC_OFFSET);
  // The unit's own extent must be a range list: wasmtime's transform rewrites
  // `DW_AT_ranges` entries to native addresses, but leaves a unit's
  // `DW_AT_low_pc`/`DW_AT_high_pc` untouched - a unit stuck at wasm address 0
  // covers no JIT code, and a debugger cannot map a line-table address back
  // to it.
  attr(a, DW_AT_RANGES, DW_FORM_SEC_OFFSET);
  a.uleb(0);
  a.uleb(0);

  a.uleb(2);
  a.uleb(DW_TAG_SUBPROGRAM);
  a.uleb(0); // no children
  attr(a, DW_AT_NAME, DW_FORM_STRING);
  attr(a, DW_AT_LOW_PC, DW_FORM_ADDR);
  attr(a, DW_AT_HIGH_PC, DW_FORM_ADDR);
  attr(a, DW_AT_EXTERNAL, DW_FORM_FLAG_PRESENT);
  a.uleb(0);
  a.uleb(0);

  // Same subprogram, but with children: the local variable DIEs hang off it.
  a.uleb(3);
  a.uleb(DW_TAG_SUBPROGRAM);
  a.uleb(1); // has children
  attr(a, DW_AT_NAME, DW_FORM_STRING);
  attr(a, DW_AT_LOW_PC, DW_FORM_ADDR);
  attr(a, DW_AT_HIGH_PC, DW_FORM_ADDR);
  attr(a, DW_AT_EXTERNAL, DW_FORM_FLAG_PRESENT);
  a.uleb(0);
  a.uleb(0);

  a.uleb(4);
  a.uleb(DW_TAG_BASE_TYPE);
  a.uleb(0); // no children
  attr(a, DW_AT_NAME, DW_FORM_STRING);
  attr(a, DW_AT_ENCODING, DW_FORM_DATA1);
  attr(a, DW_AT_BYTE_SIZE, DW_FORM_DATA1);
  a.uleb(0);
  a.uleb(0);

  a.uleb(5);
  a.uleb(DW_TAG_VARIABLE);
  a.uleb(0); // no children
  attr(a, DW_AT_NAME, DW_FORM_STRING);
  attr(a, DW_AT_TYPE, DW_FORM_REF4);
  attr(a, DW_AT_LOCATION, DW_FORM_EXPRLOC);
  a.uleb(0);
  a.uleb(0);
  a.push(0);
  return a.finish();
}

/**
 * Turn an AssemblyScript source-map path into one the symbol root resolves.
 * `asc` writes library sources as `~lib/...`, which no debugger understands.
 *
 * The Rust original also probes the filesystem and prefers
 * `node_modules/assemblyscript/std/assembly/...` when that directory exists.
 * The compiler has no filesystem access, so the probe collapses to the
 * fallback branch - which is what the host produced for the baseline fixture
 * (neither probed path exists in a TensionScript project: the package ships
 * its stdlib as `@yabgu_gm/tensionscript/std/assembly`).
 */
export function sourcePath(raw: string, compDir: string): string {
  if (raw.length >= 5 && raw.substring(0, 5) == "~lib/") {
    return "node_modules/" + raw.substring(5);
  }
  return raw;
}

/**
 * A DWARF v4 line program. `rows` must be sorted ascending by address.
 * `ranges` are the payload-relative body ranges, one line sequence each.
 */
export function encodeDebugLine(
  compDir: string,
  sources: string[],
  rows: Seg[],
  ranges: Range[]
): Uint8Array {
  let prologue = new ByteWriter(512);
  prologue.push(1);  // minimum_instruction_length
  prologue.push(1);  // maximum_operations_per_instruction
  prologue.push(1);  // default_is_stmt
  prologue.push(-5); // line_base
  prologue.push(14); // line_range
  prologue.push(13); // opcode_base
  // standard_opcode_lengths for opcodes 1..12. Push them one at a time:
  // AssemblyScript's Uint8Array constructor takes a length, not an array.
  let opcodeLengths = [0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0];
  for (let i = 0; i < opcodeLengths.length; i++) prologue.push(opcodeLengths[i]);
  prologue.cstr(compDir);
  prologue.push(0); // end of include_directories
  for (let i = 0; i < sources.length; i++) {
    prologue.cstr(sourcePath(sources[i], compDir));
    prologue.uleb(1); // directory index
    prologue.uleb(0); // mtime
    prologue.uleb(0); // length
  }
  prologue.push(0); // end of file_names

  let prog = new ByteWriter(1024);
  // One sequence per function. wasmtime's `clone_line_program` picks a
  // sequence's function from its *first* row and attributes every following
  // row of that sequence to that same function; a single module-wide
  // sequence would hand every row to one function and drop all the rest.
  // Rows that fall outside every body (padding, LEB headers) are skipped:
  // their addresses have no function to be attributed to.
  for (let r = 0; r < ranges.length; r++) {
    let start = ranges[r].start;
    let end = ranges[r].end;
    let first = partitionPoint(rows, start);
    let last = partitionPoint(rows, end);
    if (first >= last) continue;

    let seqStart = rows[first].addr;
    prog.push(0); // extended opcode
    prog.push(5); // length: opcode + 4-byte address
    prog.push(2); // DW_LNE_set_address
    prog.u32le(seqStart);

    let pc = seqStart;
    let line: u32 = 1;
    let file: u32 = 1;
    let col: u32 = 0;
    for (let i = first; i < last; i++) {
      let row = rows[i];
      if (row.addr != pc) {
        prog.push(2); // DW_LNS_advance_pc
        prog.uleb(row.addr - pc);
        pc = row.addr;
      }
      if (row.file + 1 != file) {
        prog.push(4); // DW_LNS_set_file
        prog.uleb(row.file + 1);
        file = row.file + 1;
      }
      if (row.line != line) {
        prog.push(3); // DW_LNS_advance_line
        prog.sleb(<i32>row.line - <i32>line);
        line = row.line;
      }
      if (row.col != col) {
        prog.push(5); // DW_LNS_set_column
        prog.uleb(row.col);
        col = row.col;
      }
      prog.push(1); // DW_LNS_copy
    }
    prog.push(0); // extended opcode
    prog.push(1); // length
    prog.push(1); // DW_LNE_end_sequence
  }

  let out = new ByteWriter(1024);
  let progBytes = prog.finish();
  let unitLength = 2 + 4 + prologue.len + progBytes.length;
  out.u32le(<u32>unitLength);
  out.u16le(DWARF_VERSION);
  out.u32le(<u32>prologue.len);
  out.bytes(prologue.finish());
  out.bytes(progBytes);
  return out.finish();
}

/** Rust's `partition_point(|r| r.addr < at)`. */
function partitionPoint(rows: Seg[], at: u32): i32 {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    let mid = (lo + hi) >>> 1;
    if (rows[mid].addr < at) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * One `DW_TAG_subprogram` per defined function the name section knows about,
 * and one `DW_TAG_variable` child per wasm local whose type we can describe.
 * `locals` is parallel to `functions`.
 */
export function encodeDebugInfo(
  moduleName: string,
  compDir: string,
  functions: FunctionRange[],
  locals: LocalInfo[][]
): Uint8Array {
  let cu = new ByteWriter(64);
  cu.uleb(1); // abbrev 1: compile unit
  cu.cstr(moduleName);
  cu.cstr(compDir);
  cu.u32le(0); // DW_AT_stmt_list
  cu.u32le(0); // DW_AT_ranges -> .debug_ranges[0]

  // The unit header precedes the CU DIE; `DW_FORM_ref4` offsets are measured
  // from its first byte, so every base type's unit offset is known up front.
  // Base types are the unit's first children, before the subprograms that
  // reference them.
  let unitHeaderLen = 4 + 2 + 4 + 1;
  let baseOrder: ValType[] = [ValType.I32, ValType.I64, ValType.F32, ValType.F64];
  let typeOffsets: u32[] = [0, 0, 0, 0];
  let children = new ByteWriter(1024);
  let offset = unitHeaderLen + cu.len;
  for (let i = 0; i < baseOrder.length; i++) {
    let ty = baseOrder[i];
    typeOffsets[i] = <u32>offset;
    let die = new ByteWriter(32);
    die.uleb(4); // abbrev 4: base type
    die.cstr(valTypeName(ty));
    die.push(valTypeEncoding(ty));
    die.push(valTypeByteSize(ty));
    let bytes = die.finish();
    offset += bytes.length;
    children.bytes(bytes);
  }

  for (let f = 0; f < functions.length; f++) {
    let fn = functions[f];
    let vars: LocalInfo[] = f < locals.length ? locals[f] : [];
    if (vars.length == 0) {
      children.uleb(2); // abbrev 2: subprogram, no children
      children.cstr(fn.name);
      children.u32le(fn.lo);
      children.u32le(fn.hi);
    } else {
      children.uleb(3); // abbrev 3: subprogram with children
      children.cstr(fn.name);
      children.u32le(fn.lo);
      children.u32le(fn.hi);
      for (let v = 0; v < vars.length; v++) {
        let variable = vars[v];
        // `DW_OP_WASM_location 0x00 <local index> DW_OP_stack_value`:
        // the value of wasm local `index`, wherever cranelift holds it.
        let expr = new ByteWriter(16);
        expr.push(DW_OP_WASM_LOCATION);
        expr.push(0x00);
        expr.uleb(variable.index);
        expr.push(DW_OP_STACK_VALUE);
        let exprBytes = expr.finish();

        children.uleb(5); // abbrev 5: variable
        children.cstr(variable.name);
        children.u32le(typeOffsets[typeIndex(variable.ty)]);
        children.uleb(<u32>exprBytes.length);
        children.bytes(exprBytes);
      }
      children.push(0); // end of the subprogram's children
    }
  }
  children.push(0); // end of the compile unit's children

  let childBytes = children.finish();
  let out = new ByteWriter(1024 + childBytes.length);
  out.u32le(<u32>(2 + 4 + 1 + cu.len + childBytes.length));
  out.u16le(DWARF_VERSION);
  out.u32le(0); // abbrev offset
  out.push(4);  // address_size
  out.bytes(cu.finish());
  out.bytes(childBytes);
  return out.finish();
}

/** Position of a `ValType` in the base-type DIE order, for `typeOffsets`. */
export function typeIndex(ty: ValType): i32 {
  if (ty == ValType.I32) return 0;
  if (ty == ValType.I64) return 1;
  if (ty == ValType.F32) return 2;
  return 3;
}

/**
 * Append a custom section to `out`: id, size, name length, name, payload -
 * where `size` counts everything after itself.
 */
export function appendCustom(out: ByteWriter, name: string, payload: Uint8Array): void {
  // The section body is `name-len, name, payload`; `size` counts every byte of
  // that body, including the name-length LEB itself.
  let sec = new ByteWriter(name.length + payload.length + 16);
  sec.uleb(<u32>name.length);
  sec.utf8(name);
  sec.bytes(payload);
  let body = sec.finish();

  out.push(0); // custom section id
  out.uleb(<u32>body.length);
  out.bytes(body);
}
