// `@inline` over a **pointer declaration** at a boundary — the two cells 10.0b
// ships, each beside the same record without the override.
//
// The override asks for a **copy** where the declaration promises a **borrow**:
//
//   borrow  `f(v: U)`            one `(param i32)`, the caller's pointer, no copy
//   copy    `f(v: @inline U)`    one `(param i32)`, the address of a temp the
//                                guest fills from that pointer, field by field
//
// The wire shape is the same `i32` in both cases — which is exactly why the
// difference has to be pinned in the WAT rather than in a type. The two are
// indistinguishable to the host until it writes through the pointer and the
// write does not come back.
//
// Four cells, each with its control: the import (the guest materialises the
// temp, the host gets a private copy) and the export (the host materialises the
// value, the prologue copies it into SROA locals).
//
// **The same-model controls** (`sameModelU`, `sameModelM`) are the other half of
// the claim: an override that names the declaration's own model must emit
// *exactly* what the plain declaration emits. Without them the feature could
// quietly change ordinary code and every cell above would still look right.

@unmanaged struct U {
  a: i32;
  b: i32;
}

@managed struct M {
  a: i32;
  b: i32;
}

// --- imports: the guest fills a temp from a pointer --------------------------------

@external("host", "takeCopyOfU")
declare function takeCopyOfU(v: @inline U): i32;

@external("host", "takeBorrowOfU")
declare function takeBorrowOfU(v: U): i32;

@external("host", "takeCopyOfM")
declare function takeCopyOfM(v: @inline M): i32;

@external("host", "takeBorrowOfM")
declare function takeBorrowOfM(v: M): i32;

export function importCopyU(u: U): i32 {
  return takeCopyOfU(u);
}

export function importBorrowU(u: U): i32 {
  return takeBorrowOfU(u);
}

export function importCopyM(m: M): i32 {
  return takeCopyOfM(m);
}

export function importBorrowM(m: M): i32 {
  return takeBorrowOfM(m);
}

// --- exports: the host fills a pointer, the prologue copies it ----------------------

export function exportCopyU(v: @inline U): i32 {
  return v.a + v.b;
}

export function exportBorrowU(v: U): i32 {
  return v.a + v.b;
}

export function exportCopyM(v: @inline M): i32 {
  return v.a + v.b;
}

export function exportBorrowM(v: M): i32 {
  return v.a + v.b;
}

// --- same-model controls: the override names what the declaration already says ----

export function sameModelU(v: @unmanaged U): i32 {
  return v.a + v.b;
}

export function sameModelM(v: @managed M): i32 {
  return v.a + v.b;
}

@external("host", "takeSameModelU")
declare function takeSameModelU(v: @unmanaged U): i32;

export function importSameModelU(u: U): i32 {
  return takeSameModelU(u);
}

// --- guest calls to the exports: the caller materialises the temp -------------------
//
// An export is callable from guest code, and there the byval parameter is fed by
// the same temp an `@external` call uses. Without this path the export's shape
// would only be reachable from the host.

function makeU(): U {
  let u = new U();
  u.a = 20;
  u.b = 22;
  return u;
}

function makeM(): M {
  let m = new M();
  m.a = 20;
  m.b = 22;
  return m;
}

export function callExportCopyUFromLocal(u: U): i32 {
  return exportCopyU(u);
}

// A managed temporary reaching a by-value parameter: the operand the caller
// passes is now the temp's address, so **nothing may be rooted for it** — a
// stack slot holding that address would hand the collector a header-less word.
// The copy itself is complete before the call node runs.
export function callExportCopyUFromTemporary(): i32 {
  return exportCopyU(changetype<U>(makeM()));
}

export function callExportCopyMFromTemporary(): i32 {
  return exportCopyM(makeM());
}

// The nested-call argument, which is the shape that found the temp's lifetime
// bug: the mark/bump/guard has to be published *after* the arguments are
// compiled, because a nested `compileCallDirect` resets the side channel on
// entry. Here the outer temp must still be guarded.
export function callImportCopyUFromTemporary(): i32 {
  return takeCopyOfU(changetype<U>(makeM()));
}
