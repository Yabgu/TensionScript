/**
 * The `String` fixture for `--wasmGc`.
 *
 * Every export answers an `i32`/`bool`: a GC `String` has no host representation
 * yet (that is the host-ABI round), so a string *return* cannot cross the boundary
 * while the *operations* over one can be measured. That is the whole reason this
 * fixture measures lengths and character codes rather than strings.
 */
class Label {
  text: string;
  n: i32;
  constructor(text: string, n: i32) { this.text = text; this.n = n; }
  size(): i32 { return this.text.length + this.n; }
  is(t: string): bool { return this.text == t; }
}

export function lengthOf(): i32 { return "hello".length; }
export function codeAt(): i32 { return "hello".charCodeAt(1); }
export function atChar(): i32 { return "hello".at(4).charCodeAt(0); }
export function charAtCode(): i32 { return "hello".charAt(0).charCodeAt(0); }
export function concatLen(): i32 { return ("ab" + "cd").length; }
export function concatCode(): i32 { return ("ab" + "cd").charCodeAt(2); }
export function eqSame(): bool { return "abc" == "abc"; }
export function eqDiff(): bool { return "abc" == "axc"; }
export function neDiff(): bool { return "abc" != "abd"; }
export function ltTrue(): bool { return "abc" < "abd"; }
export function ltFalse(): bool { return "abd" < "abc"; }
export function gtTrue(): bool { return "abd" > "abc"; }
export function eqLengths(): bool { return "ab" == "abc"; }
export function startsOk(): bool { return "hello".startsWith("hel"); }
export function startsBad(): bool { return "hello".startsWith("xyz"); }
export function indexOfLl(): i32 { return "hello".indexOf("ll"); }
export function includesOk(): bool { return "hello".includes("ell"); }
export function inclusiveComp(): i32 { return "hello".indexOf("x") + 1; }

/// The flip: a class holding a `String` is a GC struct, and it still works.
export function labelRound(): i32 {
  let a = new Label("hello", 7);
  let r = a.size();
  if (a.is("hello")) r += 100;
  if (!a.is("world")) r += 1000;
  return r;
}
