(module
 (type $0 (func (param i32 i32 i32) (result f32)))
 (type $1 (func (param i32) (result f32)))
 (memory $0 0)
 (export "sum" (func $interop/inline-struct-export-param-byval/sumAndMutate))
 (export "sumAndMutate" (func $interop/inline-struct-export-param-byval/sumAndMutate))
 (export "sumTwo" (func $interop/inline-struct-export-param-byval/sumTwo))
 (export "memory" (memory $0))
 (func $interop/inline-struct-export-param-byval/sumTwo (param $0 i32) (param $1 i32) (param $2 i32) (result f32)
  local.get $0
  f32.load
  local.get $0
  f32.load offset=4
  f32.add
  local.get $1
  f32.convert_i32_s
  f32.add
  local.get $2
  f32.load
  f32.add
  local.get $2
  f32.load offset=4
  f32.add
 )
 (func $interop/inline-struct-export-param-byval/sumAndMutate (param $0 i32) (result f32)
  local.get $0
  f32.load
  local.get $0
  f32.load offset=4
  f32.add
 )
)
