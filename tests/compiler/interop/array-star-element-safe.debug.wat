(module
 (type $0 (func (param i32) (result i32)))
 (global $~lib/memory/__data_end i32 (i32.const 8))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 32776))
 (global $~lib/memory/__heap_base i32 (i32.const 32776))
 (memory $0 0)
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "reinterpretU32AsF64" (func $interop/array-star-element-safe/reinterpretU32AsF64))
 (export "reinterpretF64AsBodyState" (func $interop/array-star-element-safe/reinterpretF64AsBodyState))
 (export "sameElement" (func $interop/array-star-element-safe/sameElement))
 (export "memory" (memory $0))
 (func $interop/array-star-element-safe/reinterpretU32AsF64 (param $p i32) (result i32)
  local.get $p
  return
 )
 (func $interop/array-star-element-safe/reinterpretF64AsBodyState (param $p i32) (result i32)
  local.get $p
  return
 )
 (func $interop/array-star-element-safe/sameElement (param $p i32) (result i32)
  (local $q i32)
  local.get $p
  local.set $q
  local.get $q
  return
 )
)
