(module
 (type $0 (func (param i32) (result f32)))
 (type $1 (func (param i32 i32 i32) (result f32)))
 (global $~lib/memory/__data_end i32 (i32.const 8))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 32776))
 (global $~lib/memory/__heap_base i32 (i32.const 32776))
 (memory $0 0)
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "sum" (func $interop/inline-struct-export-param-byval/sum))
 (export "sumAndMutate" (func $interop/inline-struct-export-param-byval/sumAndMutate))
 (export "sumTwo" (func $interop/inline-struct-export-param-byval/sumTwo))
 (export "memory" (memory $0))
 (func $interop/inline-struct-export-param-byval/sum (param $v$byval i32) (result f32)
  (local $v$a f32)
  (local $v$b f32)
  local.get $v$byval
  f32.load
  local.set $v$a
  local.get $v$byval
  f32.load offset=4
  local.set $v$b
  local.get $v$a
  local.get $v$b
  f32.add
  return
 )
 (func $interop/inline-struct-export-param-byval/sumAndMutate (param $v$byval i32) (result f32)
  (local $v$a f32)
  (local $v$b f32)
  (local $total f32)
  local.get $v$byval
  f32.load
  local.set $v$a
  local.get $v$byval
  f32.load offset=4
  local.set $v$b
  local.get $v$a
  local.get $v$b
  f32.add
  local.set $total
  f32.const 0
  local.set $v$a
  f32.const 0
  local.set $v$b
  local.get $total
  return
 )
 (func $interop/inline-struct-export-param-byval/sumTwo (param $v$byval i32) (param $k i32) (param $w$byval i32) (result f32)
  (local $v$a f32)
  (local $v$b f32)
  (local $w$a f32)
  (local $w$b f32)
  local.get $v$byval
  f32.load
  local.set $v$a
  local.get $v$byval
  f32.load offset=4
  local.set $v$b
  local.get $w$byval
  f32.load
  local.set $w$a
  local.get $w$byval
  f32.load offset=4
  local.set $w$b
  local.get $v$a
  local.get $v$b
  f32.add
  local.get $k
  f32.convert_i32_s
  f32.add
  local.get $w$a
  f32.add
  local.get $w$b
  f32.add
  return
 )
)
