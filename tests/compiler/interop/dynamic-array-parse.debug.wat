(module
 (type $0 (func (param i32) (result i32)))
 (type $1 (func))
 (type $2 (func (result i32)))
 (type $3 (func (param i32 i32 i32 i32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (global $~lib/memory/__data_end i32 (i32.const 220))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 32988))
 (global $~lib/memory/__heap_base i32 (i32.const 32988))
 (memory $0 1)
 (data $0 (i32.const 12) "|\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00h\00\00\00d\00y\00n\00a\00m\00i\00c\00 \00a\00r\00r\00a\00y\00 \00l\00e\00n\00g\00t\00h\00 \00e\00x\00c\00e\00e\00d\00s\00 \00i\003\002\00.\00M\00A\00X\00 \00(\002\00,\001\004\007\00,\004\008\003\00,\006\004\007\00)\00\00\00\00\00")
 (data $1 (i32.const 140) "L\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00<\00\00\00i\00n\00t\00e\00r\00o\00p\00/\00d\00y\00n\00a\00m\00i\00c\00-\00a\00r\00r\00a\00y\00-\00p\00a\00r\00s\00e\00.\00t\00s\00")
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "explicit" (func $interop/dynamic-array-parse/explicit))
 (export "inferred" (func $interop/dynamic-array-parse/inferred))
 (export "sumN" (func $interop/dynamic-array-parse/sumN))
 (export "bothReads" (func $interop/dynamic-array-parse/bothReads))
 (export "fromPointer" (func $interop/dynamic-array-parse/fromPointer))
 (export "localBound" (func $interop/dynamic-array-parse/localBound))
 (export "fieldSize" (func $interop/dynamic-array-parse/fieldSize))
 (export "run" (func $interop/dynamic-array-parse/run))
 (export "memory" (memory $0))
 (start $~start)
 (func $start:interop/dynamic-array-parse
  i32.const 8
  i32.const 8
  i32.eq
  drop
  i32.const 0
  i32.const 0
  i32.eq
  drop
  i32.const 4
  i32.const 4
  i32.eq
  drop
 )
 (func $interop/dynamic-array-parse/explicit (param $y i32) (result i32)
  (local $n i32)
  local.get $y
  i32.load
  local.set $n
  local.get $y
  i32.load
  return
 )
 (func $interop/dynamic-array-parse/inferred (param $y i32) (result i32)
  (local $n i32)
  local.get $y
  i32.load
  local.set $n
  local.get $y
  i32.load
  return
 )
 (func $interop/dynamic-array-parse/sumN (param $y i32) (result i32)
  (local $n i32)
  (local $s i32)
  (local $i i32)
  local.get $y
  i32.load
  local.set $n
  i32.const 0
  local.set $s
  i32.const 0
  local.set $i
  loop $for-loop|0
   local.get $i
   local.get $n
   i32.lt_s
   if
    local.get $s
    i32.const 1
    i32.add
    local.set $s
    local.get $i
    i32.const 1
    i32.add
    local.set $i
    br $for-loop|0
   end
  end
  local.get $s
  return
 )
 (func $interop/dynamic-array-parse/bothReads (param $y i32) (result i32)
  (local $n i32)
  local.get $y
  i32.load
  local.set $n
  local.get $n
  i32.const 0
  i32.gt_s
  if
   local.get $y
   i32.load
   local.get $n
   i32.sub
   return
  end
  i32.const 0
  return
 )
 (func $interop/dynamic-array-parse/fromPointer (param $p i32) (result i32)
  (local $1 i32)
  (local $y i32)
  (local $n i32)
  local.get $p
  local.set $1
  local.get $1
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 60
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  local.set $y
  local.get $y
  i32.load
  local.set $n
  local.get $y
  i32.load
  return
 )
 (func $interop/dynamic-array-parse/localBound (param $p i32) (result i32)
  (local $1 i32)
  (local $y i32)
  (local $n i32)
  (local $s i32)
  (local $i i32)
  local.get $p
  local.set $1
  local.get $1
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 66
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  local.set $y
  local.get $y
  i32.load
  local.set $n
  i32.const 0
  local.set $s
  i32.const 0
  local.set $i
  loop $for-loop|0
   local.get $i
   local.get $n
   i32.lt_s
   if
    local.get $s
    i32.const 1
    i32.add
    local.set $s
    local.get $i
    i32.const 1
    i32.add
    local.set $i
    br $for-loop|0
   end
  end
  local.get $s
  local.get $y
  i32.load
  i32.add
  return
 )
 (func $interop/dynamic-array-parse/fieldSize (result i32)
  i32.const 8
  return
 )
 (func $interop/dynamic-array-parse/run (result i32)
  i32.const 8
  i32.const 8
  i32.eq
  return
 )
 (func $~start
  call $start:interop/dynamic-array-parse
 )
)
