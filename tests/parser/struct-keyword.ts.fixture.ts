@unmanaged
class Warns {
  x: f32;
}
@unmanaged
class Silent {
  x: f32;
}
@unmanaged
@inline
class Reserved {
  x: f32;
}
// WARNING 6385: "A plain 'struct' currently means '@unmanaged struct'; at 0.9.0 'struct' without '@unmanaged' becomes a managed C-layout reference type. Mark it '@unmanaged struct' explicitly if the borrowed form is intended." in struct-keyword.ts(9,8+5)
