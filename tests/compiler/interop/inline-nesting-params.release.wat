(module
 (type $0 (func (result f32)))
 (type $1 (func (param i32) (result f32)))
 (memory $0 1)
 (data $0 (i32.const 1036) "<")
 (data $0.1 (i32.const 1048) "\02\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00t\00l\00s\00f\00.\00t\00s")
 (data $1 (i32.const 1100) "<")
 (data $1.1 (i32.const 1112) "\02\00\00\00(\00\00\00A\00l\00l\00o\00c\00a\00t\00i\00o\00n\00 \00t\00o\00o\00 \00l\00a\00r\00g\00e")
 (export "call_flat" (func $interop/inline-nesting-params/call_flat))
 (export "call_nested" (func $interop/inline-nesting-params/call_nested))
 (export "call_deep" (func $interop/inline-nesting-params/call_deep))
 (export "submit_exported" (func $interop/inline-nesting-params/submit_exported))
 (export "memory" (memory $0))
 (func $interop/inline-nesting-params/submit_exported (param $0 i32) (result f32)
  local.get $0
  i32.load
  f32.convert_i32_u
  local.get $0
  i32.load offset=4
  local.tee $0
  f32.load
  f32.add
  local.get $0
  f32.load offset=4
  f32.add
 )
 (func $interop/inline-nesting-params/call_nested (result f32)
  f32.const 11
 )
 (func $interop/inline-nesting-params/call_flat (result f32)
  f32.const 8.5
 )
 (func $interop/inline-nesting-params/call_deep (result f32)
  f32.const 3.140000104904175
 )
)
