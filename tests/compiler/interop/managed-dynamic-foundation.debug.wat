(module
 (type $0 (func (param i32) (result i32)))
 (type $1 (func (result i32)))
 (type $2 (func (param i32 i32 i32 i32)))
 (type $3 (func))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (global $~lib/memory/__data_end i32 (i32.const 8))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 32776))
 (global $~lib/memory/__heap_base i32 (i32.const 32776))
 (memory $0 0)
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "run" (func $interop/managed-dynamic-foundation/run))
 (export "memory" (memory $0))
 (export "lengthOf" (func $export:interop/managed-dynamic-foundation/lengthOf))
 (export "isNull" (func $export:interop/managed-dynamic-foundation/isNull))
 (export "lengthU32" (func $export:interop/managed-dynamic-foundation/lengthU32))
 (export "dataPtrOf" (func $export:interop/managed-dynamic-foundation/dataPtrOf))
 (export "through" (func $export:interop/managed-dynamic-foundation/through))
 (func $~lib/dynamicarray/DynamicArray<interop/managed-dynamic-foundation/BodyState>#get:length (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $interop/managed-dynamic-foundation/isNull (param $y i32) (result i32)
  (local $n i32)
  local.get $y
  i32.load
  local.set $n
  local.get $y
  i32.const 0
  i32.eq
  return
 )
 (func $~lib/dynamicarray/DynamicArray<u32>#get:length (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/dynamicarray/DynamicArray<u32>#get:dataPtr (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $interop/managed-dynamic-foundation/run (result i32)
  i32.const 16
  i32.const 16
  i32.eq
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
 (func $interop/managed-dynamic-foundation/lengthOf (param $y i32) (result i32)
  (local $n i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $y
  i32.load
  local.set $n
  local.get $y
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $~lib/dynamicarray/DynamicArray<interop/managed-dynamic-foundation/BodyState>#get:length
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
  return
 )
 (func $interop/managed-dynamic-foundation/lengthU32 (param $y i32) (result i32)
  (local $n i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $y
  i32.load
  local.set $n
  local.get $y
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $~lib/dynamicarray/DynamicArray<u32>#get:length
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
  return
 )
 (func $interop/managed-dynamic-foundation/dataPtrOf (param $y i32) (result i32)
  (local $n i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $y
  i32.load
  local.set $n
  local.get $y
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $~lib/dynamicarray/DynamicArray<u32>#get:dataPtr
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
  return
 )
 (func $interop/managed-dynamic-foundation/pass (param $y i32) (result i32)
  (local $n i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $y
  i32.load
  local.set $n
  local.get $y
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $~lib/dynamicarray/DynamicArray<u32>#get:length
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
  return
 )
 (func $interop/managed-dynamic-foundation/through (param $y i32) (result i32)
  (local $n i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $y
  i32.load
  local.set $n
  local.get $y
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $interop/managed-dynamic-foundation/pass
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
  return
 )
 (func $export:interop/managed-dynamic-foundation/lengthOf (param $0 i32) (result i32)
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
  call $interop/managed-dynamic-foundation/lengthOf
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
 (func $export:interop/managed-dynamic-foundation/isNull (param $0 i32) (result i32)
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
  call $interop/managed-dynamic-foundation/isNull
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
 (func $export:interop/managed-dynamic-foundation/lengthU32 (param $0 i32) (result i32)
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
  call $interop/managed-dynamic-foundation/lengthU32
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
 (func $export:interop/managed-dynamic-foundation/dataPtrOf (param $0 i32) (result i32)
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
  call $interop/managed-dynamic-foundation/dataPtrOf
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
 (func $export:interop/managed-dynamic-foundation/through (param $0 i32) (result i32)
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
  call $interop/managed-dynamic-foundation/through
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
)
