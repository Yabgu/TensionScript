(module
 (type $0 (func (param i32 f64)))
 (type $1 (func (result i32)))
 (type $2 (func (param i32) (result i32)))
 (type $3 (func (param i32) (result f64)))
 (memory $0 0)
 (export "writeB" (func $interop/struct/writeB))
 (export "readB" (func $interop/struct/readB))
 (export "readC" (func $interop/struct/readC))
 (export "run" (func $interop/struct/run))
 (export "memory" (memory $0))
 (func $interop/struct/writeB (param $0 i32) (param $1 f64)
  local.get $0
  local.get $1
  f64.store offset=8
 )
 (func $interop/struct/run (result i32)
  i32.const 32
 )
 (func $interop/struct/readC (param $0 i32) (result i32)
  local.get $0
  i32.load offset=16
 )
 (func $interop/struct/readB (param $0 i32) (result f64)
  local.get $0
  f64.load offset=8
 )
)
