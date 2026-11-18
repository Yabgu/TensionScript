// The allocation route: `__new(size, idof<String>())` becomes `array.new`, and
// `memory.copy` between two GC arrays becomes `array.copy`.
//
// `substring` and `slice` are the two methods this proves. Both are ordinary
// stdlib bodies — no `std/assembly` file is edited for them — and both allocate,
// copy and return. They fail before this round with
// `local.set's value type must be correct` at the `__new` call.
//
// Every export answers `i32`/`bool`: a GC `String` still has no host
// representation, so a string crosses the boundary as a length or a comparison.

export function subLen(): i32 { return "hello".substring(1, 4).length; }
export function subEq(): bool { return "hello".substring(1, 4) == "ell"; }
export function subCode(): i32 { return "hello".substring(1, 4).charCodeAt(0); }
export function subWhole(): bool { return "abc".substring(0) == "abc"; }
export function subEmpty(): i32 { return "abc".substring(1, 1).length; }
export function subOffset(): bool { return "abcdef".substring(2, 5) == "cde"; }

export function sliceEq(): bool { return "hello".slice(1, 3) == "el"; }
export function sliceLen(): i32 { return "hello".slice(1, 3).length; }
export function sliceNeg(): bool { return "hello".slice(-3, -1) == "ll"; }
export function slicePast(): bool { return "abc".slice(1, 99) == "bc"; }

export function substrEq(): bool { return "hello".substr(1, 3) == "ell"; }

/// A `String` parameter, so the copy runs over an argument rather than a literal.
/// Not exported: a GC `String` cannot cross the host boundary yet (that is the
/// host-ABI round), so it is reached through `probe` instead.
function cut(s: string, from: i32, to: i32): i32 { return s.substring(from, to).length; }

/// Bit 1 substring, 2 slice, 4 substr, 8 the parameterised copy, 16 `slice`
/// arithmetic that must clamp rather than read past the end.
export function probe(): i32 {
  let acc = 0;
  if (subEq()) acc |= 1;
  if (sliceEq()) acc |= 2;
  if (substrEq()) acc |= 4;
  if (cut("abcdef", 2, 4) == 2) acc |= 8;
  if (slicePast()) acc |= 16;
  return acc;
}
