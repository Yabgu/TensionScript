async function work(x: i32): i32 { return x * 10; }
export function discarded(): void {
  spawn(work(3));        // W3: launched, Task discarded
}
export function awaited(): i32 {
  let t = spawn(work(3));  // marker stripped; the binding holds the Task
  return 1;
}
