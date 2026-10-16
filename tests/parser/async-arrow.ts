// Async arrows and async function expressions.
//
// Four shapes: a parenthesized arrow, an arrow with a return type, a single
// non-parenthesized parameter, and the two function-expression forms. All are
// recognized and reported as not implemented (AS100).

const parens = async (): void => {};

const typed = async (x: i32): i32 => x;

const single = async x => x;

const expression = async function (): void {};

const named = async function named(): void {};

const withAwait = async (): void => {
  await other();
};

call(async () => {});

const nested = async (): void => {
  call(async () => {
    await other();
  });
};
