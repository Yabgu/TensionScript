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
