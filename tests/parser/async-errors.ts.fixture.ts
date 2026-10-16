await atModuleScope();
function notAsync(): void {
  await inside();
}
async function outer(): void {
  function inner(): void {
    await inside();
  };
}
class Rejected {
  field: i32 = 1;
  get accessor(): i32 {
    return 1;
  }
  constructor() {}
  misordered(): void {}
}
async function missingOperand(): void {}
// ERROR 1308: "'await' expressions are only allowed within async functions and at the top levels of modules." in async-errors.ts(12,1+5)
// ERROR 1308: "'await' expressions are only allowed within async functions and at the top levels of modules." in async-errors.ts(15,3+5)
// ERROR 1308: "'await' expressions are only allowed within async functions and at the top levels of modules." in async-errors.ts(20,5+5)
// ERROR 100: "Not implemented: Async functions" in async-errors.ts(18,1+5)
// ERROR 1042: "'async' modifier cannot be used here." in async-errors.ts(24,1+5)
// ERROR 1042: "'async' modifier cannot be used here." in async-errors.ts(29,3+5)
// ERROR 1042: "'async' modifier cannot be used here." in async-errors.ts(30,3+5)
// ERROR 1042: "'async' modifier cannot be used here." in async-errors.ts(33,3+5)
// ERROR 1042: "'async' modifier cannot be used here." in async-errors.ts(34,3+5)
// ERROR 1042: "'async' modifier cannot be used here." in async-errors.ts(37,1+5)
// ERROR 1109: "Expression expected." in async-errors.ts(41,8+1)
// ERROR 100: "Not implemented: Async functions" in async-errors.ts(40,1+5)
