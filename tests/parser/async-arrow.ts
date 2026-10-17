// Async arrows and async function expressions.
//
// Four shapes: a parenthesized arrow, an arrow with a return type, a single
// non-parenthesized parameter, and the two function-expression forms. All are
// recognized, and the AST is printed back here; the parser reports nothing for
// `async` -- the lowering transform refuses or lowers each shape by name.

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
