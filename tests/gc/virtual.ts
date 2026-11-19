// Virtual dispatch under `--wasmGc`: the override stub's dispatch key.
//
// The stub used to read the pointer-ABI object header (`*(this - 8)` → rtId).
// Under wasm GC there is no header and `this` is a reference, so it reads the
// brand field instead, and each case is an exact brand equality — an extender
// inheriting the override has its own brand and gets its own case.
//
// Every function here returns an arithmetic result, so the harness can assert
// the value and not merely that the module validated.

abstract class Shape {
  abstract area(): i32;
}

class Sq extends Shape {
  area(): i32 { return 4; }
}

class Re extends Shape {
  area(): i32 { return 6; }
}

// Three levels, an extender that adds a fourth, and a second override branch.
class Base {
  m(x: i32): i32 { return x + 0; }
}

class A extends Base {
  m(x: i32): i32 { return x + 1; }
}

class B extends A {}

class D extends B {}

class C extends Base {
  m(x: i32): i32 { return x + 2; }
}

// An interface, with implementers through an abstract class: the receiver is
// interface-typed and the concrete class's brand must still select the case.
interface Named {
  name(): i32;
}

abstract class Animal implements Named {
  abstract name(): i32;
}

class Dog extends Animal {
  name(): i32 { return 100; }
}

class Cat extends Animal {
  name(): i32 { return 200; }
}

export function shapes(): i32 {
  let a: Shape = new Sq();
  let b: Shape = new Re();
  return a.area() * 10 + b.area(); // 46
}

export function hierarchy(): i32 {
  let a: Base = new A();
  let b: Base = new B();
  let d: Base = new D();
  let c: Base = new C();
  return a.m(10) * 1000 + b.m(10) * 100 + d.m(10) * 10 + c.m(10); // 12222
}

export function iface(): i32 {
  let d: Named = new Dog();
  let c: Named = new Cat();
  return d.name() + c.name(); // 300
}
