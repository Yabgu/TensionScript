// Every async/await form the language refuses, and the diagnostic it gets.
//
// The codes are TypeScript's where this fork's message inventory has them:
// 1308 for an `await` outside an async function, 1042 for an `async` in a
// position TypeScript refuses with that code (a statement position, a class
// declaration, a field, an accessor, a constructor). Where TypeScript's code
// is absent from the inventory -- 1029 for modifier order, 1089 for a
// constructor, 1070 for a type member, 2304 for the identifier path a reserved
// keyword cannot take -- 1042 stands in, which is the general refusual for the
// same input class.

await atModuleScope();

function notAsync(): void {
  await inside();
}

async function outer(): void {
  function inner(): void {
    await inside();
  }
}

async;

async class K {}

class Rejected {
  async field: i32 = 1;
  async get accessor(): i32 {
    return 1;
  }
  async constructor() {}
  async static misordered(): void {}
}

async
function afterLineTerminator(): void {}

async function missingOperand(): void {
  await;
}
