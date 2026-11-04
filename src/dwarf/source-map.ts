/**
 * @fileoverview The source-map v3 side: a purpose-built JSON reader and the
 * mappings (base64 VLQ) decoder. Port of
 * `tension-core/src/dwarf/source_map.rs`.
 * @license Apache-2.0
 */

/** One source-map segment: wasm file offset -> source line/column. */
export class Seg {
  addr: u32;
  file: u32;
  line: u32;
  col: u32;

  constructor(addr: u32, file: u32, line: u32, col: u32) {
    this.addr = addr;
    this.file = file;
    this.line = line;
    this.col = col;
  }
}

export class SourceMap {
  sources: string[];
  segments: Seg[];

  constructor(sources: string[], segments: Seg[]) {
    this.sources = sources;
    this.segments = segments;
  }
}

function b64Val(code: i32): i32 {
  // ASCII lookup without a map allocation: the table is contiguous.
  if (code >= 65 && code <= 90) return code - 65;            // A-Z
  if (code >= 97 && code <= 122) return code - 97 + 26;      // a-z
  if (code >= 48 && code <= 57) return code - 48 + 52;       // 0-9
  if (code == 43) return 62;                                 // +
  if (code == 47) return 63;                                 // /
  return -1;
}

/** Decode one comma-free group of base64 VLQ digits. */
export function vlq(text: string): i32[] {
  let out: i32[] = [];
  let value = 0;   // i64 in Rust; every real VLQ group fits well inside i32
  let shift = 0;
  let open = false;
  for (let i = 0; i < text.length; i++) {
    let d = b64Val(text.charCodeAt(i));
    if (d < 0) throw new Error("bad base64 digit");
    open = true;
    value += (d & 31) << shift;
    if ((d & 32) != 0) {
      shift += 5;
      if (shift > 62) throw new Error("vlq group too long");
    } else {
      let neg = (value & 1) == 1;
      value >>= 1;
      out.push(neg ? -value : value);
      value = 0;
      shift = 0;
      open = false;
    }
  }
  if (open) throw new Error("truncated vlq group");
  return out;
}

/**
 * Decode `mappings`. Generated columns are absolute wasm file offsets.
 *
 * The source-map spec resets the generated column to 0 at each `;`-separated
 * line group; source line, source column and file index keep accumulating
 * across groups.
 */
export function parseMappings(mappings: string, sourceCount: i32): Seg[] {
  let segs: Seg[] = [];
  let file = 0;
  let line = 0;
  let col = 0;
  let groups = mappings.split(";");
  for (let g = 0; g < groups.length; g++) {
    let group = groups[g];
    let addr = 0;
    let parts = group.split(",");
    for (let p = 0; p < parts.length; p++) {
      let part = parts[p];
      if (part.length == 0) continue;
      let v = vlq(part);
      // A one-field segment carries a generated column and nothing else:
      // it marks code with no source position. Only 2- and 3-field
      // segments are actually malformed.
      if (v.length == 1) {
        addr += v[0];
        if (addr < 0) throw new Error("negative generated offset");
        continue;
      }
      if (v.length < 4) {
        throw new Error("segment has " + v.length.toString() + " fields, expected 1 or 4");
      }
      addr += v[0];
      file += v[1];
      line += v[2];
      col += v[3];
      if (addr < 0) throw new Error("negative generated offset");
      if (file < 0 || file >= sourceCount) {
        throw new Error("segment names source " + file.toString() + ", out of range");
      }
      segs.push(new Seg(
        <u32>addr,
        <u32>file,
        // Source maps count lines from zero; DWARF counts from one.
        <u32>(line + 1),
        <u32>(col > 0 ? col : 0)
      ));
    }
  }
  return segs;
}

const QUOTE: i32 = 34;
const BSLASH: i32 = 92;

class Json {
  b: string;
  i: i32 = 0;

  constructor(text: string) {
    this.b = text;
  }

  ws(): void {
    while (this.i < this.b.length) {
      let c = this.b.charCodeAt(this.i);
      if (c == 32 || c == 9 || c == 10 || c == 13) this.i += 1;
      else break;
    }
  }

  eat(c: i32): void {
    this.ws();
    if (this.i < this.b.length && this.b.charCodeAt(this.i) == c) {
      this.i += 1;
    } else {
      throw new Error("expected " + String.fromCharCode(c) + " at byte " + this.i.toString());
    }
  }

  /** Skip a string without materializing it: `sourcesContent` is megabytes. */
  skipString(): void {
    this.ws();
    if (this.i >= this.b.length || this.b.charCodeAt(this.i) != QUOTE) {
      throw new Error("expected string at byte " + this.i.toString());
    }
    this.i += 1;
    while (this.i < this.b.length) {
      let c = this.b.charCodeAt(this.i);
      this.i += 1;
      if (c == QUOTE) return;
      if (c == BSLASH) this.i += 1;
    }
    throw new Error("unterminated string");
  }

  /** Read 4 hex digits following a consumed `\u` escape. */
  hex4(): i32 {
    if (this.i + 4 > this.b.length) throw new Error("short u-escape");
    let hex = this.b.substring(this.i, this.i + 4);
    let n = 0;
    for (let k = 0; k < 4; k++) {
      let c = hex.charCodeAt(k);
      let d = 0;
      if (c >= 48 && c <= 57) d = c - 48;
      else if (c >= 97 && c <= 102) d = c - 97 + 10;
      else if (c >= 65 && c <= 70) d = c - 65 + 10;
      else throw new Error("bad hex");
      n = (n << 4) | d;
    }
    this.i += 4;
    return n;
  }

  string(): string {
    this.ws();
    if (this.i >= this.b.length || this.b.charCodeAt(this.i) != QUOTE) {
      throw new Error("expected string at byte " + this.i.toString());
    }
    this.i += 1;
    let out = "";
    while (this.i < this.b.length) {
      let c = this.b.charCodeAt(this.i);
      if (c == QUOTE) {
        this.i += 1;
        return out;
      }
      if (c == BSLASH) {
        this.i += 1;
        if (this.i >= this.b.length) throw new Error("truncated escape");
        let e = this.b.charCodeAt(this.i);
        this.i += 1;
        if (e == 117) {
          // JSON escapes carry UTF-16 code units: a high surrogate must be
          // followed by a `\uXXXX` low surrogate, and together they form one
          // code point.
          let n = this.hex4();
          if (n >= 0xd800 && n <= 0xdbff) {
            if (this.i + 2 <= this.b.length
              && this.b.charCodeAt(this.i) == BSLASH
              && this.b.charCodeAt(this.i + 1) == 117) {
              this.i += 2;
              let lo = this.hex4();
              if (lo < 0xdc00 || lo > 0xdfff) {
                throw new Error("high surrogate not followed by a low surrogate");
              }
              out += String.fromCharCode(n);
              out += String.fromCharCode(lo);
            } else {
              throw new Error("unpaired high surrogate");
            }
          } else if (n >= 0xdc00 && n <= 0xdfff) {
            throw new Error("unpaired low surrogate");
          } else {
            out += String.fromCharCode(n);
          }
        } else if (e == 110) out += "\n";
        else if (e == 116) out += "\t";
        else if (e == 114) out += "\r";
        else if (e == 98) out += "\b";
        else if (e == 102) out += "\f";
        else out += String.fromCharCode(e);
      } else {
        let start = this.i;
        while (this.i < this.b.length) {
          let n = this.b.charCodeAt(this.i);
          if (n == QUOTE || n == BSLASH) break;
          this.i += 1;
        }
        out += this.b.substring(start, this.i);
      }
    }
    throw new Error("unterminated string");
  }

  skipValue(): void {
    this.ws();
    if (this.i >= this.b.length) throw new Error("unexpected end of input");
    let c = this.b.charCodeAt(this.i);
    if (c == QUOTE) {
      this.skipString();
      return;
    }
    if (c == 123 || c == 91) {
      let object = c == 123;
      let close = object ? 125 : 93;
      this.i += 1;
      while (true) {
        this.ws();
        if (this.i < this.b.length && this.b.charCodeAt(this.i) == close) {
          this.i += 1;
          return;
        }
        if (object) {
          this.string();
          this.eat(58);
        }
        this.skipValue();
        this.ws();
        if (this.i >= this.b.length) throw new Error("bad container");
        let d = this.b.charCodeAt(this.i);
        if (d == 44) {
          this.i += 1;
        } else if (d == close) {
          this.i += 1;
          return;
        } else {
          throw new Error("bad container");
        }
      }
    }
    let start = this.i;
    while (this.i < this.b.length) {
      let d = this.b.charCodeAt(this.i);
      if (d == 44 || d == 93 || d == 125 || d == 32 || d == 9 || d == 10 || d == 13) break;
      this.i += 1;
    }
    if (this.i == start) throw new Error("bad value at byte " + this.i.toString());
  }
}

/** Read `sources` and `mappings` out of a source-map v3 document. */
export function parseSourceMap(json: string): SourceMap {
  let j = new Json(json);
  let sources: string[] | null = null;
  let mappings: string | null = null;
  j.eat(123);
  while (true) {
    j.ws();
    if (j.i < j.b.length && j.b.charCodeAt(j.i) == 125) break;
    let key = j.string();
    j.eat(58);
    if (key == "sources") {
      let v: string[] = [];
      j.eat(91);
      while (true) {
        j.ws();
        if (j.i < j.b.length && j.b.charCodeAt(j.i) == 93) break;
        v.push(j.string());
        j.ws();
        if (j.i < j.b.length && j.b.charCodeAt(j.i) == 44) j.i += 1;
        else break;
      }
      j.eat(93);
      sources = v;
    } else if (key == "mappings") {
      mappings = j.string();
    } else {
      j.skipValue();
    }
    j.ws();
    if (j.i < j.b.length && j.b.charCodeAt(j.i) == 44) j.i += 1;
  }
  if (sources === null) throw new Error("source map has no sources");
  if (mappings === null) throw new Error("source map has no mappings");
  let segments = parseMappings(<string>mappings, sources.length);
  return new SourceMap(sources, segments);
}
