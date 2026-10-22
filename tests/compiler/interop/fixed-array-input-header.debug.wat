(module
 (type $0 (func))
 (type $1 (func (param i32 i32) (result i32)))
 (type $2 (func (param i32 i32) (result f32)))
 (type $3 (func (param i32) (result i32)))
 (type $4 (func (result i32)))
 (global $~lib/memory/__data_end i32 (i32.const 8))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 32776))
 (global $~lib/memory/__heap_base i32 (i32.const 32776))
 (memory $0 0)
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "readKeyWord" (func $interop/fixed-array-input-header/readKeyWord))
 (export "readAxis" (func $interop/fixed-array-input-header/readAxis))
 (export "readTail7" (func $interop/fixed-array-input-header/readTail7))
 (export "run" (func $interop/fixed-array-input-header/run))
 (export "memory" (memory $0))
 (start $~start)
 (func $start:interop/fixed-array-input-header
  i32.const 96
  i32.const 96
  i32.eq
  drop
  i32.const 48
  i32.const 48
  i32.eq
  drop
  i32.const 40
  i32.const 40
  i32.eq
  drop
  i32.const 16
  i32.const 16
  i32.eq
  drop
  i32.const 48
  i32.const 48
  i32.eq
  drop
  i32.const 56
  i32.const 56
  i32.eq
  drop
  i32.const 80
  i32.const 80
  i32.eq
  drop
  i32.const 16
  i32.const 16
  i32.eq
  drop
  i32.const 40
  i32.const 40
  i32.eq
  drop
  i32.const 4
  i32.const 4
  i32.eq
  drop
  i32.const 36
  i32.const 36
  i32.eq
  drop
  i32.const 32
  i32.const 32
  i32.eq
  drop
  i32.const 24
  i32.const 24
  i32.eq
  drop
  i32.const 96
  i32.const 96
  i32.eq
  drop
  i32.const 48
  i32.const 48
  i32.eq
  drop
 )
 (func $interop/fixed-array-input-header/readKeyWord (param $state i32) (param $word i32) (result i32)
  local.get $state
  i32.const 16
  i32.add
  local.get $word
  i32.const 2
  i32.shl
  i32.add
  i32.load
  return
 )
 (func $interop/fixed-array-input-header/readAxis (param $pad i32) (param $axis i32) (result f32)
  local.get $pad
  i32.const 16
  i32.add
  local.get $axis
  i32.const 2
  i32.shl
  i32.add
  f32.load
  return
 )
 (func $interop/fixed-array-input-header/readTail7 (param $ptr i32) (result i32)
  local.get $ptr
  i32.const 4
  i32.add
  i32.const 7
  i32.const 2
  i32.shl
  i32.add
  i32.load
  return
 )
 (func $interop/fixed-array-input-header/run (result i32)
  i32.const 96
  i32.const 48
  i32.add
  i32.const 40
  i32.add
  return
 )
 (func $~start
  call $start:interop/fixed-array-input-header
 )
)
