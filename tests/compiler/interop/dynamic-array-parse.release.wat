(module
 (type $0 (func (param i32) (result i32)))
 (type $1 (func (result i32)))
 (type $2 (func (param i32 i32 i32 i32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (memory $0 1)
 (data $0 (i32.const 1036) "|")
 (data $0.1 (i32.const 1048) "\02\00\00\00h\00\00\00d\00y\00n\00a\00m\00i\00c\00 \00a\00r\00r\00a\00y\00 \00l\00e\00n\00g\00t\00h\00 \00e\00x\00c\00e\00e\00d\00s\00 \00i\003\002\00.\00M\00A\00X\00 \00(\002\00,\001\004\007\00,\004\008\003\00,\006\004\007\00)")
 (data $1 (i32.const 1164) "L")
 (data $1.1 (i32.const 1176) "\02\00\00\00<\00\00\00i\00n\00t\00e\00r\00o\00p\00/\00d\00y\00n\00a\00m\00i\00c\00-\00a\00r\00r\00a\00y\00-\00p\00a\00r\00s\00e\00.\00t\00s")
 (export "explicit" (func $interop/dynamic-array-parse/explicit))
 (export "inferred" (func $interop/dynamic-array-parse/explicit))
 (export "sumN" (func $interop/dynamic-array-parse/sumN))
 (export "bothReads" (func $interop/dynamic-array-parse/bothReads))
 (export "fromPointer" (func $interop/dynamic-array-parse/fromPointer))
 (export "localBound" (func $interop/dynamic-array-parse/localBound))
 (export "fieldSize" (func $interop/dynamic-array-parse/fieldSize))
 (export "run" (func $interop/dynamic-array-parse/run))
 (export "memory" (memory $0))
 (func $interop/dynamic-array-parse/explicit (param $0 i32) (result i32)
  local.get $0
  i32.load
 )
 (func $interop/dynamic-array-parse/sumN (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  local.get $0
  i32.load
  local.set $0
  loop $for-loop|0
   local.get $0
   local.get $1
   i32.gt_s
   if
    local.get $2
    i32.const 1
    i32.add
    local.set $2
    local.get $1
    i32.const 1
    i32.add
    local.set $1
    br $for-loop|0
   end
  end
  local.get $2
 )
 (func $interop/dynamic-array-parse/run (result i32)
  i32.const 1
 )
 (func $interop/dynamic-array-parse/localBound (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 66
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.load
  local.set $3
  loop $for-loop|0
   local.get $1
   local.get $3
   i32.lt_s
   if
    local.get $2
    i32.const 1
    i32.add
    local.set $2
    local.get $1
    i32.const 1
    i32.add
    local.set $1
    br $for-loop|0
   end
  end
  local.get $2
  local.get $0
  i32.load
  i32.add
 )
 (func $interop/dynamic-array-parse/fromPointer (param $0 i32) (result i32)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 60
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.load
 )
 (func $interop/dynamic-array-parse/fieldSize (result i32)
  i32.const 8
 )
 (func $interop/dynamic-array-parse/bothReads (param $0 i32) (result i32)
  local.get $0
  i32.load
  i32.const 0
  i32.gt_s
  if
   i32.const 0
   return
  end
  i32.const 0
 )
)
