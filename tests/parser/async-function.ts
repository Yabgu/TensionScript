// async function declarations, and the positions `await` takes inside one.
//
// Every async construct is recognized and its faithful AST is printed back here.
// The parser no longer diagnoses `async` itself: lowering and refusal both live
// in the `afterParse` transforms, so this fixture pins the *parse* shape and
// carries no `async` diagnostic at all.

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
