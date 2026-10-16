// async function declarations, and the positions `await` takes inside one.
//
// Every async construct is recognized and reported as not implemented until
// the lowering lands (AS100 "Not implemented: Async functions" -- see
// ASYNC_PHASE1.md), so each case below carries that one diagnostic while the
// AST it prints back is the faithful one.

async function plain(): void {}

async function generic<T>(): void {
  await plain();
}

export async function exported(): void {
  await plain();
}

// `await` in the positions an expression can occupy: statement, argument,
// nested operand, return, binary operand, and a parenthesized access.
async function positions(): void {
  await plain();
  call(await plain());
  await call(await plain());
  await plain() + 1;
  (await plain()).value;
  await plain().value;
}

async function returns(): i32 {
  return await value();
}

// A non-async function for contrast: nothing here is async, and nothing is
// reported. `async-errors.ts` pins what happens when an `await` appears here.
function notAsync(): void {
  plain();
}
