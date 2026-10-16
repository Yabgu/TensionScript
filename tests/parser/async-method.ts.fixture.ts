class C {
  async plain(): void {
    await other();
  }
  static async statik(): void {}
  async generic<T>(): void {
    await other();
  }
  public async withAccess(): void {}
  async withBody(): i32 {
    return await value();
  }
}
namespace N {
  export async function inNamespace(): void {}
}
abstract class A {
  abstract plain(): void;
  async concrete(): void {
    await other();
  }
}
// ERROR 100: "Not implemented: Async functions" in async-method.ts(9,3+5)
// ERROR 100: "Not implemented: Async functions" in async-method.ts(12,10+5)
// ERROR 100: "Not implemented: Async functions" in async-method.ts(13,3+5)
// ERROR 100: "Not implemented: Async functions" in async-method.ts(16,10+5)
// ERROR 100: "Not implemented: Async functions" in async-method.ts(17,3+5)
// ERROR 100: "Not implemented: Async functions" in async-method.ts(23,10+5)
// ERROR 100: "Not implemented: Async functions" in async-method.ts(28,3+5)
