(module
 (type $0 (func (param i32 i32 i32)))
 (type $1 (func (param i32 i32 i32) (result i32)))
 (memory $0 0)
 (export "assignScalar" (func $interop/array-star-write-scalar-assignment/assignScalar))
 (export "assignScalarAsValue" (func $interop/array-star-write-scalar-assignment/assignScalarAsValue))
 (export "compoundScalar" (func $interop/array-star-write-scalar-assignment/compoundScalar))
 (export "assignWidth1" (func $interop/array-star-write-scalar-assignment/assignWidth1))
 (export "memory" (memory $0))
 (func $interop/array-star-write-scalar-assignment/compoundScalar (param $0 i32) (param $1 i32) (param $2 i32)
  local.get $0
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  local.tee $0
  local.get $0
  i32.load
  local.get $2
  i32.add
  i32.store
 )
 (func $interop/array-star-write-scalar-assignment/assignWidth1 (param $0 i32) (param $1 i32) (param $2 i32)
  local.get $0
  local.get $1
  i32.add
  local.get $2
  i32.store8
 )
 (func $interop/array-star-write-scalar-assignment/assignScalarAsValue (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  local.get $0
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  local.get $2
  i32.store
  local.get $2
 )
 (func $interop/array-star-write-scalar-assignment/assignScalar (param $0 i32) (param $1 i32) (param $2 i32)
  local.get $0
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  local.get $2
  i32.store
 )
)
