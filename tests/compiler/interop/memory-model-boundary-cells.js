// Plays the host on both sides of the boundary, and **checks the contract** the
// wat can only describe.
//
// The wat proves the shape: a temp is materialised, its fields are copied from
// the incoming pointer, and the callee's locals hold the copy. This file proves
// the *semantics* that shape is for:
//
//   - an `@inline` parameter is a **copy**, so host writes afterwards change
//     nothing the guest already read;
//   - an `@unmanaged` parameter is a **borrow**, so the same write is visible;
//   - the two are indistinguishable on the wire (both `(param i32)`), which is
//     why the difference has to be asserted rather than typed.
//
// The imports below record what the guest handed them: the copy case must hand
// over a temp (an address that is *not* the record's), and the borrow case must
// hand over the record's own address.

let linked = null;
const memory = () => linked.exports.memory;

// Where the guest's call-temp region starts. The compiler reserves it statically
// (`~sretStackPointer` is bumped from a fixed base), and the fixture's own data
// ends far below it, so "is this address inside the record's region" is enough
// to tell a temp from a borrow.
const RECORD_AT = 60000;
const RECORD_AT_W = 60032;

let seen = null;

export function preInstantiate(imports) {
  const record = (at) => {
    const i32 = new Int32Array(memory().buffer);
    return i32[at / 4] + i32[at / 4 + 1];
  };
  // The guest copied the record into a temp before calling: we get the temp's
  // address. Writing through it is legal for the call, and it cannot reach the
  // record — but the guest's copy is already taken, so nothing it does after
  // this can observe the change either.
  const takeCopy = (at) => {
    seen = { at, value: record(at) };
    const i32 = new Int32Array(memory().buffer);
    i32[at / 4] = 0;
    i32[at / 4 + 1] = 0;
    return seen.value;
  };
  // The guest lent us the record's own address. Reads are live: if we write, the
  // guest sees it.
  const takeBorrow = (at) => {
    seen = { at, value: record(at) };
    return seen.value;
  };
  imports.host = {
    takeCopyOfU: takeCopy,
    takeBorrowOfU: takeBorrow,
    takeCopyOfM: takeCopy,
    takeBorrowOfM: takeBorrow,
    takeSameModelU: takeBorrow
  };
}

export function postInstantiate(instance) {
  linked = instance;
  if (memory().buffer.byteLength < 70000) memory().grow(2);
  const i32 = () => new Int32Array(memory().buffer);

  const check = (what, actual, expected) => {
    if (actual !== expected) {
      throw new Error(`${what}: expected ${expected}, got ${actual}`);
    }
  };

  // --- import side: the copy hands over a temp, the borrow hands over the record ---
  i32()[RECORD_AT / 4] = 20;
  i32()[RECORD_AT / 4 + 1] = 22;
  check("import copy: the value crossed", instance.exports.importCopyU(RECORD_AT), 42);
  check(
    "import copy: the guest handed over a temp, not the record",
    seen.at === RECORD_AT ? "record" : "temp",
    "temp"
  );

  i32()[RECORD_AT / 4] = 20;
  i32()[RECORD_AT / 4 + 1] = 22;
  check("import borrow: the value crossed", instance.exports.importBorrowU(RECORD_AT), 42);
  check(
    "import borrow: the guest handed over the record itself",
    seen.at === RECORD_AT ? "record" : "temp",
    "record"
  );

  // The same two for the `@managed` declaration.
  i32()[RECORD_AT / 4] = 20;
  i32()[RECORD_AT / 4 + 1] = 22;
  check("import copy over @managed: the value crossed", instance.exports.importCopyM(RECORD_AT), 42);
  check(
    "import copy over @managed: a temp, not the record",
    seen.at === RECORD_AT ? "record" : "temp",
    "temp"
  );

  i32()[RECORD_AT / 4] = 20;
  i32()[RECORD_AT / 4 + 1] = 22;
  check("import borrow of @managed: the value crossed", instance.exports.importBorrowM(RECORD_AT), 42);
  check(
    "import borrow of @managed: the record itself",
    seen.at === RECORD_AT ? "record" : "temp",
    "record"
  );

  // The same-model control: `@unmanaged` over an `@unmanaged` declaration must
  // behave exactly like the plain declaration — a borrow, not a copy.
  i32()[RECORD_AT / 4] = 20;
  i32()[RECORD_AT / 4 + 1] = 22;
  check("same-model control: the value crossed", instance.exports.importSameModelU(RECORD_AT), 42);
  check(
    "same-model control: still a borrow",
    seen.at === RECORD_AT ? "record" : "temp",
    "record"
  );

  // --- export side: the prologue copies at entry ---
  i32()[RECORD_AT / 4] = 1;
  i32()[RECORD_AT / 4 + 1] = 2;
  check("export copy: value at entry", instance.exports.exportCopyU(RECORD_AT), 3);
  i32()[RECORD_AT / 4] = 10;
  i32()[RECORD_AT / 4 + 1] = 20;
  check("export copy: re-read after a host write", instance.exports.exportCopyU(RECORD_AT), 30);
  check("export borrow: the same bytes, a live view", instance.exports.exportBorrowU(RECORD_AT), 30);
  check("same-model control: behaves like the plain export", instance.exports.sameModelU(RECORD_AT), 30);

  i32()[RECORD_AT / 4] = 1;
  i32()[RECORD_AT / 4 + 1] = 2;
  check("export copy over @managed: value at entry", instance.exports.exportCopyM(RECORD_AT), 3);
  i32()[RECORD_AT / 4] = 10;
  i32()[RECORD_AT / 4 + 1] = 20;
  check("export copy over @managed: re-read", instance.exports.exportCopyM(RECORD_AT), 30);
  check("export borrow of @managed", instance.exports.exportBorrowM(RECORD_AT), 30);
  check("same-model control over @managed", instance.exports.sameModelM(RECORD_AT), 30);

  // --- guest -> export: the caller materialises the temp ---
  i32()[RECORD_AT / 4] = 10;
  i32()[RECORD_AT / 4 + 1] = 20;
  check("guest call to a byval export", instance.exports.callExportCopyUFromLocal(RECORD_AT), 30);

  // A managed temporary reaching a by-value parameter: copied, and **not**
  // rooted (the operand is the temp's address). The fixture's own values are
  // 20 + 22.
  check(
    "guest call with a managed temporary",
    instance.exports.callExportCopyUFromTemporary(),
    42
  );
  check(
    "guest call with a managed temporary, @managed parameter",
    instance.exports.callExportCopyMFromTemporary(),
    42
  );
  check(
    "nested call argument: the outer temp survived",
    instance.exports.callImportCopyUFromTemporary(),
    42
  );
}
