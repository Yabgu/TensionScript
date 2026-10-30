(module
 (type $0 (func (result f32)))
 (memory $0 1)
 (data $0 (i32.const 1036) "<")
 (data $0.1 (i32.const 1048) "\02\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00t\00l\00s\00f\00.\00t\00s")
 (data $1 (i32.const 1100) "<")
 (data $1.1 (i32.const 1112) "\02\00\00\00(\00\00\00A\00l\00l\00o\00c\00a\00t\00i\00o\00n\00 \00t\00o\00o\00 \00l\00a\00r\00g\00e")
 (export "only_x" (func $interop/inline-nesting-nested/only_x))
 (export "only_y" (func $interop/inline-nesting-nested/only_y))
 (export "memory" (memory $0))
 (func $interop/inline-nesting-nested/only_y (result f32)
  f32.const 9.5
 )
 (func $interop/inline-nesting-nested/only_x (result f32)
  f32.const 1.5
 )
)
