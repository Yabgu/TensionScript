(module
 (type $0 (func))
 (type $1 (func (param i32 f64)))
 (type $2 (func (param i32) (result f64)))
 (type $3 (func (param i32) (result i32)))
 (type $4 (func (result i32)))
 (global $~lib/memory/__data_end i32 (i32.const 8))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 32776))
 (global $~lib/memory/__heap_base i32 (i32.const 32776))
 (memory $0 0)
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "writeB" (func $interop/struct/writeB))
 (export "readB" (func $interop/struct/readB))
 (export "readC" (func $interop/struct/readC))
 (export "run" (func $interop/struct/run))
 (export "memory" (memory $0))
 (start $~start)
 (func $start:interop/struct
  i32.const 20
  i32.const 20
  i32.eq
  drop
  i32.const 20
  i32.const 20
  i32.eq
  drop
  i32.const 0
  i32.const 0
  i32.eq
  drop
  i32.const 8
  i32.const 8
  i32.eq
  drop
  i32.const 16
  i32.const 16
  i32.eq
  drop
  i32.const 20
  i32.const 20
  i32.eq
  drop
  i32.const 8
  i32.const 8
  i32.eq
  drop
  i32.const 20
  i32.const 20
  i32.eq
  drop
  i32.const 20
  i32.const 20
  i32.eq
  drop
  i32.const 0
  i32.const 0
  i32.eq
  drop
  i32.const 8
  i32.const 8
  i32.eq
  drop
  i32.const 16
  i32.const 16
  i32.eq
  drop
  i32.const 20
  i32.const 4
  i32.ne
  drop
 )
 (func $interop/struct/Record_#set:b (param $this i32) (param $b f64)
  local.get $this
  local.get $b
  f64.store offset=8
 )
 (func $interop/struct/writeB (param $ptr i32) (param $v f64)
  local.get $ptr
  local.get $v
  call $interop/struct/Record_#set:b
 )
 (func $interop/struct/Record_#get:b (param $this i32) (result f64)
  local.get $this
  f64.load offset=8
 )
 (func $interop/struct/readB (param $ptr i32) (result f64)
  local.get $ptr
  call $interop/struct/Record_#get:b
  return
 )
 (func $interop/struct/Record_#get:c (param $this i32) (result i32)
  local.get $this
  i32.load offset=16
 )
 (func $interop/struct/readC (param $ptr i32) (result i32)
  local.get $ptr
  call $interop/struct/Record_#get:c
  return
 )
 (func $interop/struct/run (result i32)
  i32.const 20
  i32.const 8
  i32.add
  return
 )
 (func $~start
  call $start:interop/struct
 )
)
