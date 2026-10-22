(module
 (type $0 (func (result i32)))
 (type $1 (func (param i32) (result i32)))
 (type $2 (func (param i32 i32) (result i32)))
 (type $3 (func (param i32 i32) (result f32)))
 (memory $0 0)
 (export "readKeyWord" (func $interop/fixed-array-input-header/readKeyWord))
 (export "readAxis" (func $interop/fixed-array-input-header/readAxis))
 (export "readTail7" (func $interop/fixed-array-input-header/readTail7))
 (export "run" (func $interop/fixed-array-input-header/run))
 (export "memory" (memory $0))
 (func $interop/fixed-array-input-header/run (result i32)
  i32.const 184
 )
 (func $interop/fixed-array-input-header/readTail7 (param $0 i32) (result i32)
  local.get $0
  i32.load offset=32
 )
 (func $interop/fixed-array-input-header/readKeyWord (param $0 i32) (param $1 i32) (result i32)
  local.get $0
  i32.const 16
  i32.add
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  i32.load
 )
 (func $interop/fixed-array-input-header/readAxis (param $0 i32) (param $1 i32) (result f32)
  local.get $0
  i32.const 16
  i32.add
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  f32.load
 )
)
