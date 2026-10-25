(module
 (type $0 (func (param i32) (result i32)))
 (type $1 (func (param i32 i32) (result i32)))
 (type $2 (func (param i32 i32 i32 i32)))
 (type $3 (func))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (global $~lib/memory/__data_end i32 (i32.const 8))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 32776))
 (global $~lib/memory/__heap_base i32 (i32.const 32776))
 (memory $0 0)
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "readU" (func $interop/inline-struct-export-param-shapes/readU))
 (export "readUWithScalar" (func $interop/inline-struct-export-param-shapes/readUWithScalar))
 (export "memory" (memory $0))
 (export "readM" (func $export:interop/inline-struct-export-param-shapes/readM))
 (func $interop/inline-struct-export-param-shapes/U#get:a (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $interop/inline-struct-export-param-shapes/U#get:b (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $interop/inline-struct-export-param-shapes/readU (param $u i32) (result i32)
  local.get $u
  call $interop/inline-struct-export-param-shapes/U#get:a
  i32.const 100
  i32.mul
  local.get $u
  call $interop/inline-struct-export-param-shapes/U#get:b
  i32.add
  return
 )
 (func $interop/inline-struct-export-param-shapes/M#get:a (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $interop/inline-struct-export-param-shapes/M#get:b (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $interop/inline-struct-export-param-shapes/readUWithScalar (param $u i32) (param $k i32) (result i32)
  local.get $u
  call $interop/inline-struct-export-param-shapes/U#get:a
  i32.const 100
  i32.mul
  local.get $u
  call $interop/inline-struct-export-param-shapes/U#get:b
  i32.add
  local.get $k
  i32.add
  return
 )
 (func $~stack_check
  global.get $~lib/memory/__stack_pointer
  global.get $~lib/memory/__data_end
  i32.lt_s
  if
   i32.const 32800
   i32.const 32848
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
 )
 (func $interop/inline-struct-export-param-shapes/readM (param $m i32) (result i32)
  (local $1 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $m
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store
  local.get $1
  call $interop/inline-struct-export-param-shapes/M#get:a
  i32.const 100
  i32.mul
  local.get $m
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store
  local.get $1
  call $interop/inline-struct-export-param-shapes/M#get:b
  i32.add
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
  return
 )
 (func $export:interop/inline-struct-export-param-shapes/readM (param $0 i32) (result i32)
  (local $1 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $0
  call $interop/inline-struct-export-param-shapes/readM
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
)
