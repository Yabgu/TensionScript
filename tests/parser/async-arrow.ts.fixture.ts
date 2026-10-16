const parens = async (): void => {};
const typed = async (x: i32): i32 => x;
const single = async x => x;
const expression = async function(): void {};
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
// ERROR 100: "Not implemented: Async functions" in async-arrow.ts(7,16+5)
// ERROR 100: "Not implemented: Async functions" in async-arrow.ts(9,15+5)
// ERROR 100: "Not implemented: Async functions" in async-arrow.ts(11,16+5)
// ERROR 100: "Not implemented: Async functions" in async-arrow.ts(13,20+5)
// ERROR 100: "Not implemented: Async functions" in async-arrow.ts(15,15+5)
// ERROR 100: "Not implemented: Async functions" in async-arrow.ts(17,19+5)
// ERROR 100: "Not implemented: Async functions" in async-arrow.ts(21,6+5)
// ERROR 100: "Not implemented: Async functions" in async-arrow.ts(24,8+5)
// ERROR 100: "Not implemented: Async functions" in async-arrow.ts(23,16+5)
