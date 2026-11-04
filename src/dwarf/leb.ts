/**
 * @fileoverview LEB128 and byte writing, shared by the wasm readers and the
 * DWARF encoder. Port of `tension-core/src/leb.rs` and the `cstr` helper in
 * `tension-core/src/dwarf/encode.rs`.
 * @license Apache-2.0
 */

/** A growable byte sink. Rust's `Vec<u8>` has no direct counterpart here. */
export class ByteWriter {
  buf: Uint8Array;
  len: i32 = 0;

  constructor(capacity: i32 = 64) {
    this.buf = new Uint8Array(capacity < 8 ? 8 : capacity);
  }

  private grow(extra: i32): void {
    let needed = this.len + extra;
    if (needed <= this.buf.length) return;
    let next = this.buf.length;
    while (next < needed) next *= 2;
    let wider = new Uint8Array(next);
    for (let i = 0; i < this.len; i++) wider[i] = this.buf[i];
    this.buf = wider;
  }

  push(byte: i32): void {
    this.grow(1);
    this.buf[this.len] = byte & 0xff;
    this.len += 1;
  }

  /** Appends `data[0..data.length]`. */
  bytes(data: Uint8Array): void {
    this.grow(data.length);
    for (let i = 0; i < data.length; i++) this.buf[this.len + i] = data[i];
    this.len += data.length;
  }

  /** Appends `data[start..end]`, the Rust `extend_from_slice(&slice[a..b])`. */
  slice(data: Uint8Array, start: i32, end: i32): void {
    let n = end - start;
    if (n <= 0) return;
    this.grow(n);
    for (let i = 0; i < n; i++) this.buf[this.len + i] = data[start + i];
    this.len += n;
  }

  /** Unsigned LEB128. Values here are addresses and lengths, so 32 bits suffice. */
  uleb(value: u32): void {
    let v = value;
    while (true) {
      let b = <i32>(v & 0x7f);
      v = v >>> 7;
      if (v != 0) b |= 0x80;
      this.push(b);
      if (v == 0) break;
    }
  }

  /**
   * Signed LEB128. Rust writes line deltas as `i64`; every value here is a
   * source-line difference, which fits `i32`, and SLEB128's terminating
   * condition makes the two widths encode identically for such values.
   */
  sleb(value: i32): void {
    let v = value;
    while (true) {
      let b = v & 0x7f;
      v >>= 7;
      let done = (v == 0 && (b & 0x40) == 0) || (v == -1 && (b & 0x40) != 0);
      this.push(done ? b : b | 0x80);
      if (done) break;
    }
  }

  u16le(value: u32): void {
    this.push(<i32>(value & 0xff));
    this.push(<i32>((value >>> 8) & 0xff));
  }

  u32le(value: u32): void {
    this.push(<i32>(value & 0xff));
    this.push(<i32>((value >>> 8) & 0xff));
    this.push(<i32>((value >>> 16) & 0xff));
    this.push(<i32>((value >>> 24) & 0xff));
  }

  /** A NUL-terminated UTF-8 string, the Rust `cstr`. */
  cstr(text: string): void {
    this.utf8(text);
    this.push(0);
  }

  /** UTF-8 bytes with no terminator (a wasm name, a DWARF file path). */
  utf8(text: string): void {
    let n = text.length;
    for (let i = 0; i < n; i++) {
      let code = text.charCodeAt(i);
      if (code < 0x80) {
        this.push(code);
      } else if (code < 0x800) {
        this.push(0xc0 | (code >> 6));
        this.push(0x80 | (code & 0x3f));
      } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < n) {
        // Surrogate pair: combine into one scalar.
        let low = text.charCodeAt(i + 1);
        if (low >= 0xdc00 && low <= 0xdfff) {
          let cp = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
          this.push(0xf0 | (cp >> 18));
          this.push(0x80 | ((cp >> 12) & 0x3f));
          this.push(0x80 | ((cp >> 6) & 0x3f));
          this.push(0x80 | (cp & 0x3f));
          i++;
        } else {
          this.push(0xe0 | (code >> 12));
          this.push(0x80 | ((code >> 6) & 0x3f));
          this.push(0x80 | (code & 0x3f));
        }
      } else {
        this.push(0xe0 | (code >> 12));
        this.push(0x80 | ((code >> 6) & 0x3f));
        this.push(0x80 | (code & 0x3f));
      }
    }
  }

  /** The written bytes as their own array. */
  finish(): Uint8Array {
    let out = new Uint8Array(this.len);
    for (let i = 0; i < this.len; i++) out[i] = this.buf[i];
    return out;
  }
}
