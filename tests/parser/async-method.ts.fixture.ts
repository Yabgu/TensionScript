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
