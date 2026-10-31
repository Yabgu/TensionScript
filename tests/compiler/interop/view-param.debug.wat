(module
 (type $0 (func (param i32) (result i32)))
 (global $~lib/memory/__data_end i32 (i32.const 8))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 32776))
 (global $~lib/memory/__heap_base i32 (i32.const 32776))
 (memory $0 0)
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "through" (func $interop/view-param/through))
 (export "memory" (memory $0))
 (func $interop/view-param/read (param $v i32) (result i32)
  local.get $v
  i32.load
  local.get $v
  i32.load offset=4
  i32.add
  local.get $v
  f32.load offset=8
  i32.trunc_sat_f32_u
  i32.add
  return
 )
 (func $interop/view-param/through (param $ptr i32) (result i32)
  local.get $ptr
  call $interop/view-param/read
  return
 )
)
