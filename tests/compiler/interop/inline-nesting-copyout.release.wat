(module
 (type $0 (func (result f32)))
 (type $1 (func (result i32)))
 (memory $0 1)
 (data $0 (i32.const 1036) "<")
 (data $0.1 (i32.const 1048) "\02\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00t\00l\00s\00f\00.\00t\00s")
 (data $1 (i32.const 1100) "<")
 (data $1.1 (i32.const 1112) "\02\00\00\00(\00\00\00A\00l\00l\00o\00c\00a\00t\00i\00o\00n\00 \00t\00o\00o\00 \00l\00a\00r\00g\00e")
 (export "copy_out" (func $interop/inline-nesting-copyout/copy_out))
 (export "copy_deep" (func $interop/inline-nesting-copyout/copy_deep))
 (export "copy_nested_source" (func $interop/inline-nesting-copyout/copy_nested_source))
 (export "submit_sim" (func $interop/inline-nesting-copyout/submit_sim))
 (export "memory" (memory $0))
 (func $interop/inline-nesting-copyout/submit_sim (result i32)
  i32.const 4316
  i32.const 42
  i32.store
  i32.const 4316
  f32.const 1
  f32.store
  i32.const 4316
  f32.const 2
  f32.store
  i32.const 4316
  f32.const 3
  f32.store
  i32.const 4316
  f32.const 0
  f32.store
  i32.const 4316
  f32.const 0
  f32.store
  i32.const 4316
  f32.const 0
  f32.store
  i32.const 4316
  f32.const 0
  f32.store
  i32.const 4316
  f32.const 1
  f32.store
  i32.const 4316
  f32.const 1
  f32.store
  i32.const 4316
  f32.const 1
  f32.store
  i32.const 4108
  f32.load
  i32.trunc_sat_f32_u
  i32.const 4104
  f32.load
  i32.trunc_sat_f32_u
  i32.const 4096
  i32.load
  i32.const 4100
  f32.load
  i32.trunc_sat_f32_u
  i32.add
  i32.add
  i32.add
 )
 (func $interop/inline-nesting-copyout/copy_out (result f32)
  i32.const 1036
  i32.const 7
  i32.store
  i32.const 1036
  f32.const 1.5
  f32.store
  i32.const 1036
  f32.const 2.5
  f32.store
  i32.const 1024
  i32.load
  f32.convert_i32_u
  i32.const 1028
  f32.load
  f32.add
  i32.const 1032
  f32.load
  f32.add
 )
 (func $interop/inline-nesting-copyout/copy_nested_source (result f32)
  i32.const 3076
  f32.const 1.5
  f32.store
  i32.const 3076
  f32.const 2.5
  f32.store
  i32.const 3072
  f32.load
  i32.const 3076
  f32.load
  f32.add
 )
 (func $interop/inline-nesting-copyout/copy_deep (result f32)
  i32.const 2048
  f32.const 3.140000104904175
  f32.store
  i32.const 2048
  f32.load
 )
)
