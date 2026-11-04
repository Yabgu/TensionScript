/**
 * @fileoverview Parsing the guest module: the section walk, code bodies, the
 * `name` section, and everything synthesis needs from all of it. Port of
 * `tension-core/src/dwarf/wasm.rs`.
 *
 * D8 measured the alternative — taking function and local names from the
 * compiler's in-memory state — and rejected it: Binaryen owns the emitted
 * function and local indices (it renames through its own passes), and the
 * compiler's `FunctionRef`/`Local` keys are not the emitted index space. The
 * emitted `name` section is the only faithful source, so it is parsed here
 * exactly as the host parses it.
 * @license Apache-2.0
 */

/** A cursor over bytes, the Rust `Reader`. */
export class Reader {
  b: Uint8Array;
  i: i32;

  constructor(b: Uint8Array, i: i32) {
    this.b = b;
    this.i = i;
  }

  u8(): i32 {
    if (this.i >= this.b.length) throw new Error("truncated byte");
    let v = this.b[this.i];
    this.i += 1;
    return v;
  }

  uleb(): u32 {
    // Shift capped before each step, so an over-long encoding is refused
    // instead of wrapping silently (leb.rs read_uleb).
    let result = 0;
    let shift = 0;
    while (true) {
      if (this.i >= this.b.length) throw new Error("truncated uleb");
      let byte = this.b[this.i];
      this.i += 1;
      if (shift >= 32) throw new Error("uleb too long");
      // `<<` on a u8 left operand narrows before the shift in AssemblyScript,
      // so widen the digit explicitly. The TypeScript build needs the same
      // expression to stay a plain number.
      let digit = <u32>(byte & 0x7f);
      result = result | (digit << <u32>shift);
      if ((byte & 0x80) == 0) return result >>> 0;
      shift += 7;
    }
  }

  name(): string {
    let n = this.uleb();
    let start = this.i;
    let end = start + <i32>n;
    if (end > this.b.length) throw new Error("truncated name");
    let out = "";
    for (let k = start; k < end; k++) out += String.fromCharCode(this.b[k]);
    this.i = end;
    return out;
  }
}

/**
 * A wasm value type we can describe to a debugger. `None` is the Rust
 * `Option<ValType>::None` — everything else (`v128`, reference types) has no
 * DWARF base type here and is left undescribed.
 */
export enum ValType {
  None = -1,
  I32 = 0,
  I64 = 1,
  F32 = 2,
  F64 = 3,
}

export function valTypeFromByte(b: i32): ValType {
  if (b == 0x7f) return ValType.I32;
  if (b == 0x7e) return ValType.I64;
  if (b == 0x7d) return ValType.F32;
  if (b == 0x7c) return ValType.F64;
  return ValType.None;
}

export function valTypeName(ty: ValType): string {
  if (ty == ValType.I32) return "i32";
  if (ty == ValType.I64) return "i64";
  if (ty == ValType.F32) return "f32";
  return "f64";
}

/** `DW_AT_encoding`: signed integer or IEEE float. */
export function valTypeEncoding(ty: ValType): i32 {
  return ty == ValType.I32 || ty == ValType.I64 ? 0x05 : 0x04;
}

export function valTypeByteSize(ty: ValType): i32 {
  return ty == ValType.I32 || ty == ValType.F32 ? 4 : 8;
}

/** A body's `[start, end)` file offsets. */
export class BodyRange {
  start: i32;
  end: i32;

  constructor(start: i32, end: i32) {
    this.start = start;
    this.end = end;
  }
}

/** One `(count, valtype)` local-declaration group. */
export class LocalDecl {
  count: u32;
  ty: i32;

  constructor(count: u32, ty: i32) {
    this.count = count;
    this.ty = ty;
  }
}

/** A local in index order: name, index, value type (null when undescribable). */
export class LocalInfo {
  name: string;
  index: u32;
  ty: ValType;

  constructor(name: string, index: u32, ty: ValType) {
    this.name = name;
    this.index = index;
    this.ty = ty;
  }
}

/** A `name` section entry. */
export class NamedEntry {
  index: u32;
  name: string;

  constructor(index: u32, name: string) {
    this.index = index;
    this.name = name;
  }
}

/** A local-name entry: function index, local index, name. */
export class LocalNameEntry {
  func: u32;
  index: u32;
  name: string;

  constructor(func: u32, index: u32, name: string) {
    this.func = func;
    this.index = index;
    this.name = name;
  }
}

/** A `(params, results)` function type, as valtype bytes. */
export class FuncType {
  params: i32[];
  results: i32[];

  constructor(params: i32[], results: i32[]) {
    this.params = params;
    this.results = results;
  }
}

/** What the synthesizer must learn from the guest module itself. */
export class Layout {
  /** File offset of the code section payload: DWARF address 0. */
  codePayloadStart: i32 = 0;
  /** Payload size; also the exclusive end of the address space. */
  codePayloadSize: i32 = 0;
  /** Body content `[start, end)` in file offsets, one per defined function. */
  bodies: BodyRange[] = [];
  /** Body local declarations, parallel to `bodies`. */
  bodyDecls: LocalDecl[][] = [];
  /** Functions declared in the import section; the index space starts there. */
  importedFuncs: u32 = 0;
  /** `name` section function names by function index. */
  names: NamedEntry[] = [];
  /** `name` section local names: function index, local index, name. */
  localNames: LocalNameEntry[] = [];
  /** Function type indices from the function section, one per defined function. */
  funcTypes: u32[] = [];
  /** Function types from the type section. */
  types: FuncType[] = [];

  /** Name of the function defined by body `i`, if the guest kept names. */
  nameForBody(body: i32): string | null {
    let want = this.importedFuncs + <u32>body;
    for (let i = 0; i < this.names.length; i++) {
      if (this.names[i].index == want) return this.names[i].name;
    }
    return null;
  }

  /**
   * A guest local in index order: the function's parameters first, then the
   * body's declarations. `name` is what `asc --debug` kept in the `name`
   * section (subsection 2) when present, else a fallback.
   */
  localsForBody(body: i32): LocalInfo[] {
    let func = this.importedFuncs + <u32>body;
    let out: LocalInfo[] = [];

    let paramTypes: i32[] = [];
    if (body < this.funcTypes.length) {
      let typeIndex = this.funcTypes[body];
      if (<i32>typeIndex < this.types.length) paramTypes = this.types[typeIndex].params;
    }
    for (let i = 0; i < paramTypes.length; i++) {
      let named = this.localName(func, <u32>i);
      let name = named !== null ? <string>named : "param" + i.toString();
      out.push(new LocalInfo(name, <u32>i, valTypeFromByte(paramTypes[i])));
    }

    let index = <u32>paramTypes.length;
    let decls: LocalDecl[] = body < this.bodyDecls.length ? this.bodyDecls[body] : [];
    for (let g = 0; g < decls.length; g++) {
      let group = decls[g];
      for (let k: u32 = 0; k < group.count; k++) {
        let named = this.localName(func, index);
        let name = named !== null ? <string>named : "local" + index.toString();
        out.push(new LocalInfo(name, index, valTypeFromByte(group.ty)));
        index += 1;
      }
    }
    return out;
  }

  private localName(func: u32, index: u32): string | null {
    for (let i = 0; i < this.localNames.length; i++) {
      let entry = this.localNames[i];
      if (entry.func == func && entry.index == index) return entry.name;
    }
    return null;
  }
}

function sectionReader(sec: Uint8Array): Reader {
  return new Reader(sec, 0);
}

function readLimits(r: Reader): void {
  let flags = r.uleb();
  r.uleb();
  if ((flags & 0x01) != 0) r.uleb();
}

function countImportedFuncs(sec: Uint8Array): u32 {
  let r = sectionReader(sec);
  let n = r.uleb();
  let funcs: u32 = 0;
  for (let i: u32 = 0; i < n; i++) {
    r.name();
    r.name();
    let kind = r.u8();
    if (kind == 0x00) {
      r.uleb();
      funcs += 1;
    } else if (kind == 0x01) {
      r.u8();
      readLimits(r);
    } else if (kind == 0x02) {
      readLimits(r);
    } else if (kind == 0x03) {
      r.u8();
      r.u8();
    } else {
      throw new Error("unknown import kind");
    }
  }
  return funcs;
}

function readTypes(sec: Uint8Array): FuncType[] {
  let r = sectionReader(sec);
  let n = r.uleb();
  let out: FuncType[] = [];
  for (let i: u32 = 0; i < n; i++) {
    let form = r.u8();
    if (form != 0x60) throw new Error("type form is not a function type");
    let np = r.uleb();
    let params: i32[] = [];
    for (let k: u32 = 0; k < np; k++) params.push(r.u8());
    let nr = r.uleb();
    let results: i32[] = [];
    for (let k: u32 = 0; k < nr; k++) results.push(r.u8());
    out.push(new FuncType(params, results));
  }
  return out;
}

function readFunctionTypes(sec: Uint8Array): u32[] {
  let r = sectionReader(sec);
  let n = r.uleb();
  let out: u32[] = [];
  for (let i: u32 = 0; i < n; i++) out.push(r.uleb());
  return out;
}

/** The two parallel arrays `readCodeBodies` produces. */
export class CodeBodies {
  bodies: BodyRange[] = [];
  decls: LocalDecl[][] = [];
}

function readCodeBodies(sec: Uint8Array, base: i32): CodeBodies {
  let out = new CodeBodies();
  let r = sectionReader(sec);
  let n = r.uleb();
  for (let i: u32 = 0; i < n; i++) {
    let size = r.uleb();
    let start = r.i;
    let end = start + <i32>size;
    if (end > sec.length) throw new Error("function body extends past the code section");
    // The body opens with its local-declaration groups; the rest is code.
    let b = new Reader(sec, start);
    let groups = b.uleb();
    let decls: LocalDecl[] = [];
    for (let g: u32 = 0; g < groups; g++) {
      let count = b.uleb();
      let ty = b.u8();
      decls.push(new LocalDecl(count, ty));
    }
    out.bodies.push(new BodyRange(base + start, base + end));
    out.decls.push(decls);
    r.i = end;
  }
  return out;
}

function readNameSubsections(
  sec: Uint8Array,
  names: NamedEntry[],
  localNames: LocalNameEntry[]
): void {
  let r = sectionReader(sec);
  while (r.i < sec.length) {
    let id = r.u8();
    let size = r.uleb();
    let end = r.i + <i32>size;
    if (end > sec.length) throw new Error("name subsection extends past its section");
    if (id == 1) {
      let c = new Reader(sec, r.i);
      let n = c.uleb();
      for (let i: u32 = 0; i < n; i++) {
        let idx = c.uleb();
        let name = c.name();
        names.push(new NamedEntry(idx, name));
      }
    } else if (id == 2) {
      let c = new Reader(sec, r.i);
      let n = c.uleb();
      for (let i: u32 = 0; i < n; i++) {
        let func = c.uleb();
        let m = c.uleb();
        for (let k: u32 = 0; k < m; k++) {
          let idx = c.uleb();
          let name = c.name();
          localNames.push(new LocalNameEntry(func, idx, name));
        }
      }
    }
    r.i = end;
  }
}

/** Walk the module and collect everything synthesis needs. */
export function parseLayout(wasm: Uint8Array): Layout {
  if (wasm.length < 8
    || wasm[0] != 0x00 || wasm[1] != 0x61 || wasm[2] != 0x73 || wasm[3] != 0x6d) {
    throw new Error("not a wasm module");
  }
  let out = new Layout();

  let foundCode = false;
  let r = new Reader(wasm, 8);
  while (r.i < wasm.length) {
    let id = r.u8();
    let size = r.uleb();
    let payload = r.i;
    let end = payload + <i32>size;
    if (end > wasm.length) throw new Error("section extends past end of module");
    let sec = wasm.subarray(payload, end);
    if (id == 1) {
      out.types = readTypes(sec);
    } else if (id == 2) {
      out.importedFuncs = countImportedFuncs(sec);
    } else if (id == 3) {
      out.funcTypes = readFunctionTypes(sec);
    } else if (id == 10) {
      foundCode = true;
      out.codePayloadStart = payload;
      out.codePayloadSize = <i32>size;
      let code = readCodeBodies(sec, payload);
      out.bodies = code.bodies;
      out.bodyDecls = code.decls;
    } else if (id == 0) {
      let c = new Reader(wasm, payload);
      let name = c.name();
      if (name == "name") {
        readNameSubsections(wasm.subarray(c.i, end), out.names, out.localNames);
      }
    }
    r.i = end;
  }
  if (!foundCode) throw new Error("module has no code section");
  return out;
}
