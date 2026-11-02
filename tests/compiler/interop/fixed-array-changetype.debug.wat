(module
 (type $0 (func (param i32 i32) (result i32)))
 (type $1 (func (param i32) (result i32)))
 (type $2 (func))
 (type $3 (func (param i32 i32) (result i64)))
 (type $4 (func (param i32 i32 i32)))
 (type $5 (func (param i32 i32 i64)))
 (type $6 (func (param i32 i32)))
 (global $interop/fixed-array-changetype/GLOBAL_BASE i32 (i32.const 4096))
 (global $interop/fixed-array-changetype/g i32 (i32.const 4096))
 (global $~lib/memory/__data_end i32 (i32.const 8))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 32776))
 (global $~lib/memory/__heap_base i32 (i32.const 32776))
 (memory $0 0)
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "readU32" (func $interop/fixed-array-changetype/readU32))
 (export "readAt3" (func $interop/fixed-array-changetype/readAt3))
 (export "readU8" (func $interop/fixed-array-changetype/readU8))
 (export "readU64" (func $interop/fixed-array-changetype/readU64))
 (export "readI32" (func $interop/fixed-array-changetype/readI32))
 (export "writeU32" (func $interop/fixed-array-changetype/writeU32))
 (export "writeU64" (func $interop/fixed-array-changetype/writeU64))
 (export "readViaParam" (func $interop/fixed-array-changetype/readViaParam))
 (export "passThrough" (func $interop/fixed-array-changetype/passThrough))
 (export "globalRead" (func $interop/fixed-array-changetype/globalRead))
 (export "fieldRead" (func $interop/fixed-array-changetype/fieldRead))
 (export "fieldWrite" (func $interop/fixed-array-changetype/fieldWrite))
 (export "memory" (memory $0))
 (start $~start)
 (func $start:interop/fixed-array-changetype
  i32.const 16
  i32.const 16
  i32.eq
  drop
  i32.const 2
  i32.const 2
  i32.eq
  drop
  i32.const 16
  i32.const 16
  i32.eq
  drop
  i32.const 16
  i32.const 16
  i32.eq
  drop
  i32.const 24
  i32.const 24
  i32.eq
  drop
  i32.const 4
  i32.const 4
  i32.eq
  drop
 )
 (func $interop/fixed-array-changetype/readU32 (param $p i32) (param $i i32) (result i32)
  (local $a i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 2
  i32.shl
  i32.add
  i32.load
  return
 )
 (func $interop/fixed-array-changetype/readAt3 (param $p i32) (result i32)
  (local $a i32)
  local.get $p
  local.set $a
  local.get $a
  i32.const 3
  i32.const 2
  i32.shl
  i32.add
  i32.load
  return
 )
 (func $interop/fixed-array-changetype/readU8 (param $p i32) (param $i i32) (result i32)
  (local $a i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 0
  i32.shl
  i32.add
  i32.load8_u
  return
 )
 (func $interop/fixed-array-changetype/readU64 (param $p i32) (param $i i32) (result i64)
  (local $a i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 3
  i32.shl
  i32.add
  i64.load
  return
 )
 (func $interop/fixed-array-changetype/readI32 (param $p i32) (param $i i32) (result i32)
  (local $a i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 2
  i32.shl
  i32.add
  i32.load
  return
 )
 (func $interop/fixed-array-changetype/writeU32 (param $p i32) (param $i i32) (param $v i32)
  (local $a i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 2
  i32.shl
  i32.add
  local.get $v
  i32.store
 )
 (func $interop/fixed-array-changetype/writeU64 (param $p i32) (param $i i32) (param $v i64)
  (local $a i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 3
  i32.shl
  i32.add
  local.get $v
  i64.store
 )
 (func $interop/fixed-array-changetype/readViaParam (param $a i32) (param $i i32) (result i32)
  local.get $a
  local.get $i
  i32.const 2
  i32.shl
  i32.add
  i32.load
  return
 )
 (func $interop/fixed-array-changetype/passThrough (param $p i32) (result i32)
  local.get $p
  return
 )
 (func $interop/fixed-array-changetype/globalRead (param $i i32) (result i32)
  global.get $interop/fixed-array-changetype/g
  local.get $i
  i32.const 2
  i32.shl
  i32.add
  i32.load
  return
 )
 (func $interop/fixed-array-changetype/fieldRead (param $o i32) (result i32)
  (local $h i32)
  local.get $o
  local.set $h
  local.get $h
  i32.const 4
  i32.add
  i32.const 1
  i32.const 2
  i32.shl
  i32.add
  i32.load
  return
 )
 (func $interop/fixed-array-changetype/fieldWrite (param $o i32) (param $v i32)
  (local $h i32)
  local.get $o
  local.set $h
  local.get $h
  i32.const 4
  i32.add
  i32.const 1
  i32.const 2
  i32.shl
  i32.add
  local.get $v
  i32.store
 )
 (func $~start
  call $start:interop/fixed-array-changetype
 )
)
