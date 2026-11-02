(module
 (type $0 (func (param i32 i32 i32)))
 (type $1 (func (param i32 i32 i32) (result i32)))
 (global $~lib/memory/__data_end i32 (i32.const 8))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 32776))
 (global $~lib/memory/__heap_base i32 (i32.const 32776))
 (memory $0 0)
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "assignScalar" (func $interop/array-star-write-scalar-assignment/assignScalar))
 (export "assignScalarAsValue" (func $interop/array-star-write-scalar-assignment/assignScalarAsValue))
 (export "compoundScalar" (func $interop/array-star-write-scalar-assignment/compoundScalar))
 (export "assignWidth1" (func $interop/array-star-write-scalar-assignment/assignWidth1))
 (export "memory" (memory $0))
 (func $interop/array-star-write-scalar-assignment/assignScalar (param $p i32) (param $i i32) (param $v i32)
  (local $a i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 4
  i32.mul
  i32.add
  local.get $v
  i32.store
 )
 (func $interop/array-star-write-scalar-assignment/assignScalarAsValue (param $p i32) (param $i i32) (param $v i32) (result i32)
  (local $a i32)
  (local $4 i32)
  local.get $p
  local.set $a
  local.get $v
  local.set $4
  local.get $a
  local.get $i
  i32.const 4
  i32.mul
  i32.add
  local.get $4
  i32.store
  local.get $4
  return
 )
 (func $interop/array-star-write-scalar-assignment/compoundScalar (param $p i32) (param $i i32) (param $v i32)
  (local $a i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 4
  i32.mul
  i32.add
  local.get $a
  local.get $i
  i32.const 4
  i32.mul
  i32.add
  i32.load
  local.get $v
  i32.add
  i32.store
 )
 (func $interop/array-star-write-scalar-assignment/assignWidth1 (param $p i32) (param $i i32) (param $v i32)
  (local $a i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 1
  i32.mul
  i32.add
  local.get $v
  i32.store8
 )
)
