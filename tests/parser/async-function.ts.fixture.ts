async function plain(): void {}
async function generic<T>(): void {
  await plain();
}
export async function exported(): void {
  await plain();
}
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
function notAsync(): void {
  plain();
}
// ERROR 100: "Not implemented: Async functions" in async-function.ts(8,1+5)
// ERROR 100: "Not implemented: Async functions" in async-function.ts(10,1+5)
// ERROR 100: "Not implemented: Async functions" in async-function.ts(14,8+5)
// ERROR 100: "Not implemented: Async functions" in async-function.ts(20,1+5)
// ERROR 100: "Not implemented: Async functions" in async-function.ts(29,1+5)
