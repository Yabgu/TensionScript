// A reader for the DWARF a wasm module carries, written against the bytes.
//
// # Why this parses rather than shells out
//
// The census is a **gate**: it has to answer the same way on a machine with no
// debugger, no `llvm-dwarfdump` and no `llvm` at all, and its output is
// committed and diffed. A tool that shells out answers with whatever that tool's
// version decided to print, and a manifest built from it drifts when the tool
// updates. So this reads `.debug_*` custom sections directly — magic and
// version, then `(id, size)` pairs — and the only witness it consults is the
// module.
//
// What it does **not** read is `.wasm.map`. That file is the compiler's own
// opinion of where things are; the debugger never opens it, and the whole point
// of the census is to describe what the debugger *is* given.
//
// # The DWARF this fork emits
//
// Measured on the pinned compiler: **version 4**, 32-bit addresses, 32-bit
// section offsets, and `.debug_abbrev` / `.debug_info` / `.debug_line` /
// `.debug_ranges`. That is not an accident — `src/dwarf/encode.ts` writes v4 by
// hand — so this reader implements v4 and refuses anything else by name instead
// of guessing at a form table it has not implemented. A version bump is then a
// loud failure in the census rather than a quietly wrong number.
//
// # What it answers
//
// - `compileUnits()` — one entry per `DW_TAG_compile_unit`, with its name, its
//   address ranges, and its statement list offset.
// - `lineTable(unit)` — the sequences of the line program at that offset, as
//   rows of `{address, file, line, column, isEnd}`.
// - `lineFiles(unit)` — the file table the line program indexes, so a row's
//   `file` number becomes a path.

const FORMAT_NAMED = {
  // DWARF v4 forms, by code. Only the ones a producer can emit here are
  // listed; an unknown form is a named error, not a zero, because a silently
  // skipped form desynchronises every field after it.
  address: 0x01,
  block2: 0x03,
  block4: 0x04,
  data2: 0x05,
  data4: 0x06,
  data8: 0x07,
  string: 0x08,
  block: 0x09,
  block1: 0x0a,
  data1: 0x0b,
  flag: 0x0c,
  sdata: 0x0d,
  strp: 0x0e,
  udata: 0x0f,
  refAddr: 0x10,
  ref1: 0x11,
  ref2: 0x12,
  ref4: 0x13,
  ref8: 0x14,
  refUdata: 0x15,
  indirect: 0x16,
  secOffset: 0x17,
  exprloc: 0x18,
  flagPresent: 0x19,
  refSig8: 0x20,
};

// `DW_TAG_compile_unit`, in a producer that writes one CU per module.
const TAG_COMPILE_UNIT = 0x11;
// `DW_TAG_subprogram`: the unit a *function* claims, which is the attribution a
// debugger asks for first.
const TAG_SUBPROGRAM = 0x2e;
// `DW_TAG_inlined_subroutine`: a range inside its caller, with the same claim.
const TAG_INLINED_SUBROUTINE = 0x1d;

// Attributes this file names. Everything else is read and dropped, because
// skipping a form needs its width and nothing else, but these are the ones a
// census needs.
const AT_NAME = 0x03;
const AT_STMT_LIST = 0x10;
const AT_LOW_PC = 0x11;
const AT_HIGH_PC = 0x12;
const AT_COMP_DIR = 0x1b;
const AT_RANGES = 0x55;
const AT_DECL_FILE = 0x3a;
const AT_DECL_LINE = 0x3b;

/** A section, or an empty view — a module without DWARF has neither. */
function sectionOf(sections, name) {
  return sections.get(name) ?? new Uint8Array(0);
}

/**
 * The custom sections of a wasm module, by name.
 *
 * The walk is the one `main.rs::declares_start_section` does: magic and
 * version, then `(id, size)` pairs with LEB sizes. A truncated file answers
 * what it managed to read, which is what "does this module carry `.debug_info`"
 * wants — it asks about presence, and a half-file is absent.
 */
export function customSections(bytes) {
  const sections = new Map();
  if (bytes.length < 8 || bytes[0] !== 0x00 || bytes[1] !== 0x61 || bytes[2] !== 0x73 || bytes[3] !== 0x6d) {
    return sections;
  }
  let at = 8;
  while (at < bytes.length) {
    const id = bytes[at++];
    let size;
    try {
      [size, at] = uleb(bytes, at);
    } catch {
      break;
    }
    const end = at + size;
    if (end > bytes.length) break;
    if (id === 0) {
      let nameLength;
      let nameAt;
      try {
        [nameLength, nameAt] = uleb(bytes, at);
      } catch {
        break;
      }
      const name = Buffer.from(bytes.subarray(nameAt, nameAt + nameLength)).toString("utf8");
      sections.set(name, bytes.subarray(nameAt + nameLength, end));
    }
    at = end;
  }
  return sections;
}

function uleb(bytes, at) {
  let result = 0;
  let shift = 0;
  for (;;) {
    if (at >= bytes.length) throw new Error("uleb: past the end of the section");
    const byte = bytes[at++];
    result += (byte & 0x7f) * 2 ** shift;
    shift += 7;
    if ((byte & 0x80) === 0) return [result, at];
    if (shift > 63) throw new Error("uleb: more than 63 bits");
  }
}

function sleb(bytes, at) {
  let result = 0;
  let shift = 0;
  let byte;
  do {
    if (at >= bytes.length) throw new Error("sleb: past the end of the section");
    byte = bytes[at++];
    result |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  if (shift < 32 && (byte & 0x40)) result |= -(1 << shift);
  return [result, at];
}

function u16(bytes, at) {
  return [bytes[at] | (bytes[at + 1] << 8), at + 2];
}

function u32(bytes, at) {
  return [
    (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0,
    at + 4,
  ];
}

function cstring(bytes, at) {
  let end = at;
  while (end < bytes.length && bytes[end] !== 0) ++end;
  return [Buffer.from(bytes.subarray(at, end)).toString("utf8"), end + 1];
}

/** `.debug_abbrev`: offset → the declaration, per unit's abbrev offset. */
function parseAbbrev(bytes, base) {
  const table = new Map();
  let at = base;
  for (;;) {
    let code;
    [code, at] = uleb(bytes, at);
    if (code === 0) break;
    let tag;
    [tag, at] = uleb(bytes, at);
    const hasChildren = bytes[at++] === 1;
    const attributes = [];
    for (;;) {
      let name;
      let form;
      [name, at] = uleb(bytes, at);
      [form, at] = uleb(bytes, at);
      if (name === 0 && form === 0) break;
      let implicitConst = null;
      if (form === 0x21) {
        // `DW_FORM_implicit_const` carries its value in the declaration.
        [implicitConst, at] = sleb(bytes, at);
      }
      attributes.push({ name, form, implicitConst });
    }
    table.set(code, { tag, hasChildren, attributes });
  }
  return table;
}

/** Skips one attribute's value, answering it when the caller asked for it. */
function readForm(bytes, at, form, implicitConst, addressSize, offsetSize) {
  switch (form) {
    case FORMAT_NAMED.address: {
      const value = addressSize === 8
        ? Number(Buffer.from(bytes.subarray(at, at + 8)).readBigUInt64LE())
        : u32(bytes, at)[0];
      return [value, at + addressSize];
    }
    case FORMAT_NAMED.block2: {
      const length = u16(bytes, at)[0];
      return [null, at + 2 + length];
    }
    case FORMAT_NAMED.block4: {
      const length = u32(bytes, at)[0];
      return [null, at + 4 + length];
    }
    case FORMAT_NAMED.block: {
      let length;
      [length, at] = uleb(bytes, at);
      return [null, at + length];
    }
    case FORMAT_NAMED.block1: {
      const length = bytes[at];
      return [null, at + 1 + length];
    }
    case FORMAT_NAMED.data1:
      return [bytes[at], at + 1];
    case FORMAT_NAMED.flag:
      return [bytes[at], at + 1];
    case FORMAT_NAMED.flagPresent:
      return [1, at];
    case FORMAT_NAMED.data2:
      return [u16(bytes, at)[0], at + 2];
    case FORMAT_NAMED.data4:
      return [u32(bytes, at)[0], at + 4];
    case FORMAT_NAMED.data8:
      return [Number(Buffer.from(bytes.subarray(at, at + 8)).readBigUInt64LE()), at + 8];
    case FORMAT_NAMED.sdata:
      return sleb(bytes, at);
    case FORMAT_NAMED.udata:
      return uleb(bytes, at);
    case FORMAT_NAMED.string:
      return cstring(bytes, at);
    case FORMAT_NAMED.strp: {
      const offset = offsetSize === 8
        ? Number(Buffer.from(bytes.subarray(at, at + 8)).readBigUInt64LE())
        : u32(bytes, at)[0];
      return [offset, at + offsetSize];
    }
    case FORMAT_NAMED.refAddr:
      return [null, at + addressSize];
    case FORMAT_NAMED.ref1:
      return [bytes[at], at + 1];
    case FORMAT_NAMED.ref2:
      return [u16(bytes, at)[0], at + 2];
    case FORMAT_NAMED.ref4:
      return [u32(bytes, at)[0], at + 4];
    case FORMAT_NAMED.ref8:
      return [Number(Buffer.from(bytes.subarray(at, at + 8)).readBigUInt64LE()), at + 8];
    case FORMAT_NAMED.refUdata:
      return uleb(bytes, at);
    case FORMAT_NAMED.refSig8:
      return [Number(Buffer.from(bytes.subarray(at, at + 8)).readBigUInt64LE()), at + 8];
    case FORMAT_NAMED.secOffset: {
      const value = offsetSize === 8
        ? Number(Buffer.from(bytes.subarray(at, at + 8)).readBigUInt64LE())
        : u32(bytes, at)[0];
      return [value, at + offsetSize];
    }
    case FORMAT_NAMED.exprloc: {
      let length;
      [length, at] = uleb(bytes, at);
      return [null, at + length];
    }
    case FORMAT_NAMED.indirect:
      throw new Error("DW_FORM_indirect is not implemented (the census reads what this compiler emits)");
    case 0x21: // DW_FORM_implicit_const: no bytes in the unit; the value is in the abbreviation.
      return [implicitConst, at];
    default:
      throw new Error(`unimplemented DWARF form 0x${form.toString(16)}`);
  }
}

/** `.debug_ranges`: a CU's ranges as `[low, high)` pairs. */
function parseRanges(bytes, base, addressSize) {
  const ranges = [];
  let at = base;
  const max = 2 ** (addressSize * 8) - 1;
  for (;;) {
    const low = addressSize === 8
      ? Number(Buffer.from(bytes.subarray(at, at + 8)).readBigUInt64LE())
      : u32(bytes, at)[0];
    at += addressSize;
    const high = addressSize === 8
      ? Number(Buffer.from(bytes.subarray(at, at + 8)).readBigUInt64LE())
      : u32(bytes, at)[0];
    at += addressSize;
    if (low === 0 && high === 0) break;
    if (low === max) {
      // A base-address selection entry: `high` is the base the following pairs
      // are relative to. This compiler does not emit them; a silent skip would
      // shift every range after it, so say so instead.
      throw new Error("DWARF base-address selection in .debug_ranges is not implemented");
    }
    ranges.push([low, high]);
    if (at > bytes.length) break;
  }
  return ranges;
}

/** The `/`-separated last two components, which is what a breakpoint names. */
export function tailPath(path) {
  const parts = String(path).split(/[\\/]/).filter(Boolean);
  return parts.slice(-2).join("/");
}

/**
 * Read a module's DWARF, or answer `null` when it carries none.
 *
 * @param {Uint8Array} bytes the module
 * @returns {null | {
 *   version: number,
 *   addressSize: number,
 *   units: Array<{
 *     offset: number,
 *     name: string,
 *     compDir: string,
 *     lowPc: number | null,
 *     highPc: number | null,
 *     ranges: Array<[number, number]>,
 *     stmtList: number | null,
 *   }>,
 *   line: (unit: object) => {files: string[], sequences: Array<{address: number, rows: Array<{address: number, file: number, line: number, column: number, isEnd: boolean}>}>},
 *   declLines: (unitIndex: number) => Array<{file: number, line: number}>,
 *   ranges: Array<[number, number]>,
 * }}
 */
export function readDwarf(bytes) {
  const sections = customSections(bytes);
  const info = sectionOf(sections, ".debug_info");
  if (info.length === 0) return null;
  const abbrev = sectionOf(sections, ".debug_abbrev");
  const line = sectionOf(sections, ".debug_line");
  const ranges = sectionOf(sections, ".debug_ranges");
  const str = sectionOf(sections, ".debug_str");

  const units = [];
  // `declLines` is filled while walking, because the DIEs that carry
  // `DW_AT_decl_line` are the same walk and a second pass would need the abbrev
  // table again for no new information.
  const declByUnit = [];

  let at = 0;
  while (at + 11 <= info.length) {
    let unitLength;
    [unitLength, at] = u32(info, at);
    if (unitLength === 0) break;
    const unitEnd = at + unitLength;
    let version;
    [version, at] = u16(info, at);
    if (version !== 4) {
      throw new Error(
        `.debug_info is DWARF version ${version}; the census implements version 4, which is what ` +
          "src/dwarf/encode.ts writes. A producer change must be met with a reader change, not a guess."
      );
    }
    let abbrevOffset;
    [abbrevOffset, at] = u32(info, at);
    const addressSize = info[at++];
    const offsetSize = 4;
    const abbrevs = parseAbbrev(abbrev, abbrevOffset);

    const unit = {
      offset: at,
      name: "",
      compDir: "",
      lowPc: null,
      highPc: null,
      ranges: [],
      stmtList: null,
    };
    const declLines = [];
    const subprograms = [];
    let sawCompileUnit = false;

    // The DIE tree, depth-first, with the depth in the abbreviation driving the
    // `null` codes that close a subtree.
    const stack = [];
    while (at < unitEnd) {
      let code;
      [code, at] = uleb(info, at);
      if (code === 0) {
        stack.pop();
        if (stack.length === 0 && sawCompileUnit) break;
        continue;
      }
      const abbreviation = abbrevs.get(code);
      if (!abbreviation) throw new Error(`unknown abbreviation code ${code} at .debug_info+${at}`);
      const attributes = new Map();
      for (const { name, form, implicitConst } of abbreviation.attributes) {
        let value;
        [value, at] = readForm(info, at, form, implicitConst, addressSize, offsetSize);
        attributes.set(name, value);
      }
      if (abbreviation.tag === TAG_COMPILE_UNIT) {
        sawCompileUnit = true;
        stack.push(code);
        const nameValue = attributes.get(AT_NAME);
        unit.name = typeof nameValue === "string" ? nameValue : "";
        const compDir = attributes.get(AT_COMP_DIR);
        unit.compDir = typeof compDir === "string" ? compDir : "";
        unit.stmtList = attributes.get(AT_STMT_LIST) ?? null;
        const lowPc = attributes.get(AT_LOW_PC);
        const highPc = attributes.get(AT_HIGH_PC);
        if (typeof lowPc === "number") unit.lowPc = lowPc;
        if (typeof highPc === "number") unit.highPc = highPc;
        const rangesOffset = attributes.get(AT_RANGES);
        if (typeof rangesOffset === "number") {
          unit.ranges = parseRanges(ranges, rangesOffset, addressSize);
        }
        continue;
      }
      // A function's own claim on an address range. This is the attribution a
      // debugger asks for before it asks the unit: an address inside a
      // subprogram is a line in that function, whether or not the unit's range
      // list happens to cover the same bytes.
      if (abbreviation.tag == TAG_SUBPROGRAM || abbreviation.tag == TAG_INLINED_SUBROUTINE) {
        const low = attributes.get(AT_LOW_PC);
        const high = attributes.get(AT_HIGH_PC);
        if (typeof low === "number" && typeof high === "number" && high > low) {
          subprograms.push([low, high]);
        }
      }
      // Every other DIE: remember its decl position, and descend if it has
      // children. `attributes` is dropped afterwards — the census asks about
      // lines, not about variables.
      const declLine = attributes.get(AT_DECL_LINE);
      if (typeof declLine === "number" && declLine > 0) {
        const declFile = attributes.get(AT_DECL_FILE);
        declLines.push({
          file: typeof declFile === "number" ? declFile : 1,
          line: declLine,
        });
      }
      if (abbreviation.hasChildren) stack.push(code);
    }
    at = unitEnd;
    unit.subprograms = subprograms;
    units.push(unit);
    declByUnit.push(declLines);
  }

  return {
    version: 4,
    addressSize: units.length > 0 ? 4 : 4,
    units,
    declLines: (index) => declByUnit[index] ?? [],
    line: (unit) => parseLineTable(line, unit, str),
  };
}

/**
 * The line program at `unit.stmtList`, as sequences of rows.
 *
 * A **sequence** is a run of rows between `DW_LNE_set_address` and
 * `DW_LNE_end_sequence`: the unit a debugger indexes by address. Rows are
 * returned in program order with their computed address and file, which is what
 * lets the census say "line N has these byte spans" rather than "line N
 * appears".
 */
function parseLineTable(bytes, unit, str) {
  if (unit.stmtList == null || bytes.length === 0) return { files: [], sequences: [] };
  let at = unit.stmtList;
  let unitLength;
  [unitLength, at] = u32(bytes, at);
  if (unitLength === 0) return { files: [], sequences: [] };
  const unitEnd = at + unitLength;
  let version;
  [version, at] = u16(bytes, at);
  if (version !== 4) {
    throw new Error(`.debug_line is version ${version}; the census implements version 4`);
  }
  let headerLength;
  [headerLength, at] = u32(bytes, at);
  const programStart = at + headerLength;
  const minimumInstructionLength = bytes[at++];
  const maximumOperationsPerInstruction = bytes[at++];
  const defaultIsStmt = bytes[at++];
  const lineBase = (bytes[at++] << 24) >> 24; // signed
  const lineRange = bytes[at++];
  const opcodeBase = bytes[at++];
  const standardLengths = [];
  for (let i = 1; i < opcodeBase; ++i) standardLengths[i] = bytes[at++];

  // Include directories, then file names — both null-terminated lists.
  const directories = [];
  for (;;) {
    const [value, next] = cstring(bytes, at);
    at = next;
    if (value === "") break;
    directories.push(value);
  }
  const files = [];
  for (;;) {
    const [name, next] = cstring(bytes, at);
    at = next;
    if (name === "") break;
    let dirIndex;
    [dirIndex, at] = uleb(bytes, at);
    // `mtime` and `length` are part of the entry and nothing here reads them;
    // the cursor still has to pass over both.
    at = uleb(bytes, at)[1];
    at = uleb(bytes, at)[1];
    const directory = dirIndex === 0 ? "" : directories[dirIndex - 1] ?? "";
    files.push(directory && !name.includes("/") && !name.includes("\\") ? `${directory}/${name}` : name);
  }

  const sequences = [];
  let rows = [];
  let address = 0;
  let file = 1;
  let lineNumber = 1;
  let column = 0;
  // `DW_LNS_advance_pc` scales by the minimum instruction length, so a producer
  // that emits one opcode per instruction can state byte deltas directly. This
  // one emits `minimumInstructionLength = 1`.
  const operationAdvance = (operations) =>
    minimumInstructionLength * ((maximumOperationsPerInstruction * 0 + operations) | 0);
  void defaultIsStmt;
  void str;

  let cursor = programStart;
  while (cursor < unitEnd) {
    const opcode = bytes[cursor++];
    if (opcode >= opcodeBase) {
      const adjusted = opcode - opcodeBase;
      const advance = Math.floor(adjusted / lineRange);
      address += operationAdvance(advance);
      lineNumber += lineBase + (adjusted % lineRange);
      rows.push({ address, file, line: lineNumber, column, isEnd: false });
      continue;
    }
    if (opcode === 0) {
      let length;
      [length, cursor] = uleb(bytes, cursor);
      const subEnd = cursor + length;
      const sub = bytes[cursor++];
      if (sub === 1) {
        // `DW_LNE_end_sequence`: the sequence's last address is the row that
        // ends it, and that row has no line of its own.
        rows.push({ address, file, line: lineNumber, column, isEnd: true });
        sequences.push({ address: rows[0]?.address ?? address, rows });
        rows = [];
        address = 0;
        file = 1;
        lineNumber = 1;
        column = 0;
      } else if (sub === 2) {
        address = u32(bytes, cursor)[0];
      } else if (sub === 3) {
        // `DW_LNE_define_file` — this producer does not emit it, and a file
        // table that grows mid-program would break the numbering every earlier
        // row used.
        throw new Error("DW_LNE_define_file is not implemented");
      }
      cursor = subEnd;
      continue;
    }
    switch (opcode) {
      case 1: // copy
        rows.push({ address, file, line: lineNumber, column, isEnd: false });
        break;
      case 2: {
        let advance;
        [advance, cursor] = uleb(bytes, cursor);
        address += operationAdvance(advance);
        break;
      }
      case 3: {
        let delta;
        [delta, cursor] = sleb(bytes, cursor);
        lineNumber += delta;
        break;
      }
      case 4: {
        let value;
        [value, cursor] = uleb(bytes, cursor);
        file = value;
        break;
      }
      case 5: {
        let value;
        [value, cursor] = uleb(bytes, cursor);
        column = value;
        break;
      }
      case 6: // negate_stmt
      case 7: // set_basic_block
      case 10: // set_prologue_end
      case 11: // set_epilogue_begin
        break;
      case 8: {
        const adjusted = 255 - opcodeBase;
        address += operationAdvance(Math.floor(adjusted / lineRange));
        break;
      }
      case 9: {
        const advance = u16(bytes, cursor)[0];
        cursor += 2;
        address += advance;
        break;
      }
      case 12: {
        let value;
        [value, cursor] = uleb(bytes, cursor);
        void value;
        break;
      }
      default: {
        // A standard opcode past the ones named above: skip the operand count
        // the header declared for it.
        const count = standardLengths[opcode] ?? 0;
        for (let i = 0; i < count; ++i) cursor = uleb(bytes, cursor)[1];
        break;
      }
    }
  }
  return { files, sequences };
}
