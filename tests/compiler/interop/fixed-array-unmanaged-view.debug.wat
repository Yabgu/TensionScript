(module
 (type $0 (func (param i32 i32) (result i32)))
 (type $1 (func (param i32) (result i32)))
 (type $2 (func (param i32 i32 i32)))
 (type $3 (func))
 (type $4 (func (param i32 i32) (result i64)))
 (type $5 (func (param i32 i32 i64)))
 (type $6 (func (param i32 i32)))
 (global $interop/fixed-array-unmanaged-view/GLOBAL_BASE i32 (i32.const 4096))
 (global $interop/fixed-array-unmanaged-view/g i32 (i32.const 4096))
 (global $~lib/memory/__data_end i32 (i32.const 8))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 32776))
 (global $~lib/memory/__heap_base i32 (i32.const 32776))
 (memory $0 0)
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "readU32" (func $interop/fixed-array-unmanaged-view/readU32))
 (export "readAt3" (func $interop/fixed-array-unmanaged-view/readAt3))
 (export "readU8" (func $interop/fixed-array-unmanaged-view/readU8))
 (export "readU64" (func $interop/fixed-array-unmanaged-view/readU64))
 (export "readI32" (func $interop/fixed-array-unmanaged-view/readI32))
 (export "readRecordX" (func $interop/fixed-array-unmanaged-view/readRecordX))
 (export "readRecordY" (func $interop/fixed-array-unmanaged-view/readRecordY))
 (export "writeU32" (func $interop/fixed-array-unmanaged-view/writeU32))
 (export "writeU64" (func $interop/fixed-array-unmanaged-view/writeU64))
 (export "writeRecordX" (func $interop/fixed-array-unmanaged-view/writeRecordX))
 (export "readViaParam" (func $interop/fixed-array-unmanaged-view/readViaParam))
 (export "passThrough" (func $interop/fixed-array-unmanaged-view/passThrough))
 (export "globalRead" (func $interop/fixed-array-unmanaged-view/globalRead))
 (export "fieldRead" (func $interop/fixed-array-unmanaged-view/fieldRead))
 (export "fieldWrite" (func $interop/fixed-array-unmanaged-view/fieldWrite))
 (export "memory" (memory $0))
 (start $~start)
 (func $start:interop/fixed-array-unmanaged-view
  i32.const 4
  i32.const 4
  i32.eq
  drop
  i32.const 4
  i32.const 4
  i32.eq
  drop
  i32.const 4
  i32.const 4
  i32.eq
  drop
  i32.const 4
  i32.const 4
  i32.eq
  drop
  i32.const 16
  i32.const 16
  i32.eq
  drop
  i32.const 2
  i32.const 2
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
  i32.const 4
  i32.const 4
  i32.eq
  drop
  i32.const 4
  i32.const 4
  i32.eq
  drop
 )
 (func $interop/fixed-array-unmanaged-view/readU32 (param $p i32) (param $i i32) (result i32)
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
 (func $interop/fixed-array-unmanaged-view/readAt3 (param $p i32) (result i32)
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
 (func $interop/fixed-array-unmanaged-view/readU8 (param $p i32) (param $i i32) (result i32)
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
 (func $interop/fixed-array-unmanaged-view/readU64 (param $p i32) (param $i i32) (result i64)
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
 (func $interop/fixed-array-unmanaged-view/readI32 (param $p i32) (param $i i32) (result i32)
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
 (func $interop/fixed-array-unmanaged-view/Pair#get:a (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $interop/fixed-array-unmanaged-view/readRecordX (param $p i32) (param $i i32) (result i32)
  (local $a i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 8
  i32.mul
  i32.add
  call $interop/fixed-array-unmanaged-view/Pair#get:a
  return
 )
 (func $interop/fixed-array-unmanaged-view/Pair#get:b (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $interop/fixed-array-unmanaged-view/readRecordY (param $p i32) (param $i i32) (result i32)
  (local $a i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 8
  i32.mul
  i32.add
  call $interop/fixed-array-unmanaged-view/Pair#get:b
  return
 )
 (func $interop/fixed-array-unmanaged-view/writeU32 (param $p i32) (param $i i32) (param $v i32)
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
 (func $interop/fixed-array-unmanaged-view/writeU64 (param $p i32) (param $i i32) (param $v i64)
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
 (func $interop/fixed-array-unmanaged-view/Pair#set:a (param $this i32) (param $a i32)
  local.get $this
  local.get $a
  i32.store
 )
 (func $interop/fixed-array-unmanaged-view/writeRecordX (param $p i32) (param $i i32) (param $v i32)
  (local $a i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 8
  i32.mul
  i32.add
  local.get $v
  call $interop/fixed-array-unmanaged-view/Pair#set:a
 )
 (func $interop/fixed-array-unmanaged-view/readViaParam (param $a i32) (param $i i32) (result i32)
  local.get $a
  local.get $i
  i32.const 2
  i32.shl
  i32.add
  i32.load
  return
 )
 (func $interop/fixed-array-unmanaged-view/passThrough (param $p i32) (result i32)
  local.get $p
  return
 )
 (func $interop/fixed-array-unmanaged-view/globalRead (param $i i32) (result i32)
  global.get $interop/fixed-array-unmanaged-view/g
  local.get $i
  i32.const 2
  i32.shl
  i32.add
  i32.load
  return
 )
 (func $interop/fixed-array-unmanaged-view/fieldRead (param $o i32) (param $i i32) (result i32)
  (local $h i32)
  local.get $o
  local.set $h
  local.get $h
  i32.const 4
  i32.add
  local.get $i
  i32.const 2
  i32.shl
  i32.add
  i32.load
  return
 )
 (func $interop/fixed-array-unmanaged-view/fieldWrite (param $o i32) (param $i i32) (param $v i32)
  (local $h i32)
  local.get $o
  local.set $h
  local.get $h
  i32.const 4
  i32.add
  local.get $i
  i32.const 2
  i32.shl
  i32.add
  local.get $v
  i32.store
 )
 (func $~start
  call $start:interop/fixed-array-unmanaged-view
 )
)
