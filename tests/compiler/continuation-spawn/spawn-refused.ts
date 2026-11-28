// **A floating spawn on the continuation backend is refused by name** (DL61 decision 7,
// asserted by DL63 — I150).
//
// The task would land in the guest's own executor ring, and nothing drives that ring once
// the entry has returned: there is no guest-side "run the ring to empty" entry for the host
// to call, and the shell's core loop has already ended. Compiling it would be a silent zero
// — a program that exits 0 having run none of the bodies it asked for — so the compiler says
// so instead, naming the backend.
//
// This file exists because the comment that claimed the assertion lived in Tension's
// `scripts/build-test-programs.mjs` and pointed at a test that did not assert it. A claim
// with no mechanism is the class of defect this project keeps losing to.
async function leaf(id: i32): i32 {
  return id;
}

async function work(id: i32): void {
  let value: i32 = await leaf(id);
  if (value < 0) return;
}

export async function main(): void {
  work(1);
}
