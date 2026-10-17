(module
 (type $0 (func (param i32 i32)))
 (type $1 (func (param i32) (result i32)))
 (type $2 (func (param i32 i32) (result i32)))
 (type $3 (func (param i32)))
 (type $4 (func))
 (type $5 (func (param i32 i32 i32)))
 (type $6 (func (result i32)))
 (type $7 (func (param i32 i32 i32) (result i32)))
 (type $8 (func (param i32 i32 i32 i32)))
 (type $9 (func (param i32 f32)))
 (type $10 (func (param i32 i64 i32) (result i32)))
 (type $11 (func (param i32 i32 i64) (result i32)))
 (type $12 (func (param i32 i32) (result i64)))
 (type $13 (func (param i64) (result i32)))
 (type $14 (func (param i32) (result i64)))
 (type $15 (func (param i32 i64)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (global $async-closure-value/sink (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/total (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/threshold (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/state (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/visitCount (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/pinSpace (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/iter (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/toSpace (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/white (mut i32) (i32.const 0))
 (global $~lib/shared/runtime/Runtime.Stub i32 (i32.const 0))
 (global $~lib/shared/runtime/Runtime.Minimal i32 (i32.const 1))
 (global $~lib/shared/runtime/Runtime.Incremental i32 (i32.const 2))
 (global $~lib/rt/itcms/fromSpace (mut i32) (i32.const 0))
 (global $~lib/rt/tlsf/ROOT (mut i32) (i32.const 0))
 (global $~lib/native/ASC_LOW_MEMORY_LIMIT i32 (i32.const 0))
 (global $~lib/task-rt/recordFactory (mut i32) (i32.const 0))
 (global $~lib/task-rt/families (mut i32) (i32.const 0))
 (global $~lib/task-rt/waitingByKey (mut i32) (i32.const 0))
 (global $~lib/task-rt/waiters (mut i32) (i32.const 0))
 (global $~lib/task-rt/ready (mut i32) (i32.const 0))
 (global $~env (mut i32) (i32.const 0))
 (global $~argumentsLength (mut i32) (i32.const 0))
 (global $~lib/native/ASC_RUNTIME i32 (i32.const 2))
 (global $~lib/rt/__rtti_base i32 (i32.const 992))
 (global $~lib/memory/__data_end i32 (i32.const 1072))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 33840))
 (global $~lib/memory/__heap_base i32 (i32.const 33840))
 (memory $0 1)
 (data $0 (i32.const 12) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00(\00\00\00A\00l\00l\00o\00c\00a\00t\00i\00o\00n\00 \00t\00o\00o\00 \00l\00a\00r\00g\00e\00\00\00\00\00")
 (data $1 (i32.const 76) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00 \00\00\00~\00l\00i\00b\00/\00r\00t\00/\00i\00t\00c\00m\00s\00.\00t\00s\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $2 (i32.const 144) "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $3 (i32.const 176) "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $4 (i32.const 204) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00$\00\00\00I\00n\00d\00e\00x\00 \00o\00u\00t\00 \00o\00f\00 \00r\00a\00n\00g\00e\00\00\00\00\00\00\00\00\00")
 (data $5 (i32.const 268) ",\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00\14\00\00\00~\00l\00i\00b\00/\00r\00t\00.\00t\00s\00\00\00\00\00\00\00\00\00")
 (data $6 (i32.const 320) "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $7 (i32.const 348) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00t\00l\00s\00f\00.\00t\00s\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $8 (i32.const 412) "|\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00^\00\00\00U\00n\00e\00x\00p\00e\00c\00t\00e\00d\00 \00\'\00n\00u\00l\00l\00\'\00 \00(\00n\00o\00t\00 \00a\00s\00s\00i\00g\00n\00e\00d\00 \00o\00r\00 \00f\00a\00i\00l\00e\00d\00 \00c\00a\00s\00t\00)\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $9 (i32.const 540) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00,\00\00\00a\00s\00y\00n\00c\00-\00c\00l\00o\00s\00u\00r\00e\00-\00v\00a\00l\00u\00e\00.\00t\00s\00")
 (data $10 (i32.const 604) ",\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00\18\00\00\00~\00l\00i\00b\00/\00t\00a\00s\00k\00.\00t\00s\00\00\00\00\00")
 (data $11 (i32.const 652) ",\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00\1c\00\00\00I\00n\00v\00a\00l\00i\00d\00 \00l\00e\00n\00g\00t\00h\00")
 (data $12 (i32.const 700) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00&\00\00\00~\00l\00i\00b\00/\00a\00r\00r\00a\00y\00b\00u\00f\00f\00e\00r\00.\00t\00s\00\00\00\00\00\00\00")
 (data $13 (i32.const 764) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00$\00\00\00K\00e\00y\00 \00d\00o\00e\00s\00 \00n\00o\00t\00 \00e\00x\00i\00s\00t\00\00\00\00\00\00\00\00\00")
 (data $14 (i32.const 828) ",\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00\16\00\00\00~\00l\00i\00b\00/\00m\00a\00p\00.\00t\00s\00\00\00\00\00\00\00")
 (data $15 (i32.const 876) ",\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00\1a\00\00\00~\00l\00i\00b\00/\00a\00r\00r\00a\00y\00.\00t\00s\00\00\00")
 (data $16 (i32.const 924) "\1c\00\00\00\00\00\00\00\00\00\00\00\10\00\00\00\08\00\00\00\01\00\00\00\00\00\00\00\00\00\00\00")
 (data $17 (i32.const 956) "\1c\00\00\00\00\00\00\00\00\00\00\00\12\00\00\00\08\00\00\00\03\00\00\00\00\00\00\00\00\00\00\00")
 (data $18 (i32.const 992) "\13\00\00\00 \00\00\00 \00\00\00 \00\00\00\00\00\00\00\00\00\00\00 \00\00\00\00\00\00\00\00\00\00\00 \00\00\00 \00\00\00\10\t\12\00\10A\14\00\02A\00\00\10A\82\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (table $0 4 4 funcref)
 (elem $0 (i32.const 1) $async-closure-value/inner$resume $async-closure-value/outer$resume~inner $async-closure-value/outer$resume)
 (export "main" (func $async-closure-value/main))
 (export "memory" (memory $0))
 (start $~start)
 (func $~lib/rt/itcms/Object#set:nextWithColor (param $this i32) (param $nextWithColor i32)
  local.get $this
  local.get $nextWithColor
  i32.store offset=4
 )
 (func $~lib/rt/itcms/Object#set:prev (param $this i32) (param $prev i32)
  local.get $this
  local.get $prev
  i32.store offset=8
 )
 (func $~lib/rt/itcms/initLazy (param $space i32) (result i32)
  local.get $space
  local.get $space
  call $~lib/rt/itcms/Object#set:nextWithColor
  local.get $space
  local.get $space
  call $~lib/rt/itcms/Object#set:prev
  local.get $space
  return
 )
 (func $~lib/rt/itcms/Object#get:nextWithColor (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/rt/itcms/Object#get:next (param $this i32) (result i32)
  local.get $this
  call $~lib/rt/itcms/Object#get:nextWithColor
  i32.const 3
  i32.const -1
  i32.xor
  i32.and
  return
 )
 (func $~lib/rt/itcms/Object#get:color (param $this i32) (result i32)
  local.get $this
  call $~lib/rt/itcms/Object#get:nextWithColor
  i32.const 3
  i32.and
  return
 )
 (func $~lib/rt/itcms/visitRoots (param $cookie i32)
  (local $pn i32)
  (local $iter i32)
  local.get $cookie
  call $~lib/rt/__visit_globals
  global.get $~lib/rt/itcms/pinSpace
  local.set $pn
  local.get $pn
  call $~lib/rt/itcms/Object#get:next
  local.set $iter
  loop $while-continue|0
   local.get $iter
   local.get $pn
   i32.ne
   if
    i32.const 1
    drop
    local.get $iter
    call $~lib/rt/itcms/Object#get:color
    i32.const 3
    i32.eq
    i32.eqz
    if
     i32.const 0
     i32.const 96
     i32.const 160
     i32.const 16
     call $~lib/builtins/abort
     unreachable
    end
    local.get $iter
    i32.const 20
    i32.add
    local.get $cookie
    call $~lib/rt/__visit_members
    local.get $iter
    call $~lib/rt/itcms/Object#get:next
    local.set $iter
    br $while-continue|0
   end
  end
 )
 (func $~lib/rt/itcms/Object#set:color (param $this i32) (param $color i32)
  local.get $this
  local.get $this
  call $~lib/rt/itcms/Object#get:nextWithColor
  i32.const 3
  i32.const -1
  i32.xor
  i32.and
  local.get $color
  i32.or
  call $~lib/rt/itcms/Object#set:nextWithColor
 )
 (func $~lib/rt/itcms/Object#get:prev (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $~lib/rt/itcms/Object#set:next (param $this i32) (param $obj i32)
  local.get $this
  local.get $obj
  local.get $this
  call $~lib/rt/itcms/Object#get:nextWithColor
  i32.const 3
  i32.and
  i32.or
  call $~lib/rt/itcms/Object#set:nextWithColor
 )
 (func $~lib/rt/itcms/Object#unlink (param $this i32)
  (local $next i32)
  (local $prev i32)
  local.get $this
  call $~lib/rt/itcms/Object#get:next
  local.set $next
  local.get $next
  i32.const 0
  i32.eq
  if
   i32.const 1
   drop
   local.get $this
   call $~lib/rt/itcms/Object#get:prev
   i32.const 0
   i32.eq
   if (result i32)
    local.get $this
    global.get $~lib/memory/__heap_base
    i32.lt_u
   else
    i32.const 0
   end
   i32.eqz
   if
    i32.const 0
    i32.const 96
    i32.const 128
    i32.const 18
    call $~lib/builtins/abort
    unreachable
   end
   return
  end
  local.get $this
  call $~lib/rt/itcms/Object#get:prev
  local.set $prev
  i32.const 1
  drop
  local.get $prev
  i32.eqz
  if
   i32.const 0
   i32.const 96
   i32.const 132
   i32.const 16
   call $~lib/builtins/abort
   unreachable
  end
  local.get $next
  local.get $prev
  call $~lib/rt/itcms/Object#set:prev
  local.get $prev
  local.get $next
  call $~lib/rt/itcms/Object#set:next
 )
 (func $~lib/rt/itcms/Object#get:rtId (param $this i32) (result i32)
  local.get $this
  i32.load offset=12
 )
 (func $~lib/shared/typeinfo/Typeinfo#get:flags (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/rt/__typeinfo (param $id i32) (result i32)
  (local $ptr i32)
  global.get $~lib/rt/__rtti_base
  local.set $ptr
  local.get $id
  local.get $ptr
  i32.load
  i32.gt_u
  if
   i32.const 224
   i32.const 288
   i32.const 21
   i32.const 28
   call $~lib/builtins/abort
   unreachable
  end
  local.get $ptr
  i32.const 4
  i32.add
  local.get $id
  i32.const 4
  i32.mul
  i32.add
  call $~lib/shared/typeinfo/Typeinfo#get:flags
  return
 )
 (func $~lib/rt/itcms/Object#get:isPointerfree (param $this i32) (result i32)
  (local $rtId i32)
  local.get $this
  call $~lib/rt/itcms/Object#get:rtId
  local.set $rtId
  local.get $rtId
  i32.const 2
  i32.le_u
  if (result i32)
   i32.const 1
  else
   local.get $rtId
   call $~lib/rt/__typeinfo
   i32.const 32
   i32.and
   i32.const 0
   i32.ne
  end
  return
 )
 (func $~lib/rt/itcms/Object#linkTo (param $this i32) (param $list i32) (param $withColor i32)
  (local $prev i32)
  local.get $list
  call $~lib/rt/itcms/Object#get:prev
  local.set $prev
  local.get $this
  local.get $list
  local.get $withColor
  i32.or
  call $~lib/rt/itcms/Object#set:nextWithColor
  local.get $this
  local.get $prev
  call $~lib/rt/itcms/Object#set:prev
  local.get $prev
  local.get $this
  call $~lib/rt/itcms/Object#set:next
  local.get $list
  local.get $this
  call $~lib/rt/itcms/Object#set:prev
 )
 (func $~lib/rt/itcms/Object#makeGray (param $this i32)
  (local $1 i32)
  local.get $this
  global.get $~lib/rt/itcms/iter
  i32.eq
  if
   local.get $this
   call $~lib/rt/itcms/Object#get:prev
   local.tee $1
   i32.eqz
   if (result i32)
    i32.const 0
    i32.const 96
    i32.const 148
    i32.const 30
    call $~lib/builtins/abort
    unreachable
   else
    local.get $1
   end
   global.set $~lib/rt/itcms/iter
  end
  local.get $this
  call $~lib/rt/itcms/Object#unlink
  local.get $this
  global.get $~lib/rt/itcms/toSpace
  local.get $this
  call $~lib/rt/itcms/Object#get:isPointerfree
  if (result i32)
   global.get $~lib/rt/itcms/white
   i32.eqz
  else
   i32.const 2
  end
  call $~lib/rt/itcms/Object#linkTo
 )
 (func $~lib/rt/itcms/__visit (param $ptr i32) (param $cookie i32)
  (local $obj i32)
  local.get $ptr
  i32.eqz
  if
   return
  end
  local.get $ptr
  i32.const 20
  i32.sub
  local.set $obj
  i32.const 0
  drop
  local.get $obj
  call $~lib/rt/itcms/Object#get:color
  global.get $~lib/rt/itcms/white
  i32.eq
  if
   local.get $obj
   call $~lib/rt/itcms/Object#makeGray
   global.get $~lib/rt/itcms/visitCount
   i32.const 1
   i32.add
   global.set $~lib/rt/itcms/visitCount
  end
 )
 (func $~lib/rt/itcms/visitStack (param $cookie i32)
  (local $ptr i32)
  global.get $~lib/memory/__stack_pointer
  local.set $ptr
  loop $while-continue|0
   local.get $ptr
   global.get $~lib/memory/__heap_base
   i32.lt_u
   if
    local.get $ptr
    i32.load
    local.get $cookie
    call $~lib/rt/itcms/__visit
    local.get $ptr
    i32.const 4
    i32.add
    local.set $ptr
    br $while-continue|0
   end
  end
 )
 (func $~lib/rt/common/BLOCK#get:mmInfo (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/rt/itcms/Object#get:size (param $this i32) (result i32)
  i32.const 4
  local.get $this
  call $~lib/rt/common/BLOCK#get:mmInfo
  i32.const 3
  i32.const -1
  i32.xor
  i32.and
  i32.add
  return
 )
 (func $~lib/rt/tlsf/Root#set:flMap (param $this i32) (param $flMap i32)
  local.get $this
  local.get $flMap
  i32.store
 )
 (func $~lib/rt/common/BLOCK#set:mmInfo (param $this i32) (param $mmInfo i32)
  local.get $this
  local.get $mmInfo
  i32.store
 )
 (func $~lib/rt/tlsf/Block#set:prev (param $this i32) (param $prev i32)
  local.get $this
  local.get $prev
  i32.store offset=4
 )
 (func $~lib/rt/tlsf/Block#set:next (param $this i32) (param $next i32)
  local.get $this
  local.get $next
  i32.store offset=8
 )
 (func $~lib/rt/tlsf/Block#get:prev (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/rt/tlsf/Block#get:next (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $~lib/rt/tlsf/Root#get:flMap (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/rt/tlsf/removeBlock (param $root i32) (param $block i32)
  (local $blockInfo i32)
  (local $size i32)
  (local $fl i32)
  (local $sl i32)
  (local $6 i32)
  (local $7 i32)
  (local $boundedSize i32)
  (local $prev i32)
  (local $next i32)
  (local $root|11 i32)
  (local $fl|12 i32)
  (local $sl|13 i32)
  (local $root|14 i32)
  (local $fl|15 i32)
  (local $sl|16 i32)
  (local $head i32)
  (local $root|18 i32)
  (local $fl|19 i32)
  (local $slMap i32)
  (local $root|21 i32)
  (local $fl|22 i32)
  (local $slMap|23 i32)
  local.get $block
  call $~lib/rt/common/BLOCK#get:mmInfo
  local.set $blockInfo
  i32.const 1
  drop
  local.get $blockInfo
  i32.const 1
  i32.and
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 268
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $blockInfo
  i32.const 3
  i32.const -1
  i32.xor
  i32.and
  local.set $size
  i32.const 1
  drop
  local.get $size
  i32.const 12
  i32.ge_u
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 270
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $size
  i32.const 256
  i32.lt_u
  if
   i32.const 0
   local.set $fl
   local.get $size
   i32.const 4
   i32.shr_u
   local.set $sl
  else
   local.get $size
   local.tee $6
   i32.const 1073741820
   local.tee $7
   local.get $6
   local.get $7
   i32.lt_u
   select
   local.set $boundedSize
   i32.const 31
   local.get $boundedSize
   i32.clz
   i32.sub
   local.set $fl
   local.get $boundedSize
   local.get $fl
   i32.const 4
   i32.sub
   i32.shr_u
   i32.const 1
   i32.const 4
   i32.shl
   i32.xor
   local.set $sl
   local.get $fl
   i32.const 8
   i32.const 1
   i32.sub
   i32.sub
   local.set $fl
  end
  i32.const 1
  drop
  local.get $fl
  i32.const 23
  i32.lt_u
  if (result i32)
   local.get $sl
   i32.const 16
   i32.lt_u
  else
   i32.const 0
  end
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 284
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $block
  call $~lib/rt/tlsf/Block#get:prev
  local.set $prev
  local.get $block
  call $~lib/rt/tlsf/Block#get:next
  local.set $next
  local.get $prev
  if
   local.get $prev
   local.get $next
   call $~lib/rt/tlsf/Block#set:next
  end
  local.get $next
  if
   local.get $next
   local.get $prev
   call $~lib/rt/tlsf/Block#set:prev
  end
  local.get $block
  block $~lib/rt/tlsf/GETHEAD|inlined.0 (result i32)
   local.get $root
   local.set $root|11
   local.get $fl
   local.set $fl|12
   local.get $sl
   local.set $sl|13
   local.get $root|11
   local.get $fl|12
   i32.const 4
   i32.shl
   local.get $sl|13
   i32.add
   i32.const 2
   i32.shl
   i32.add
   i32.load offset=96
   br $~lib/rt/tlsf/GETHEAD|inlined.0
  end
  i32.eq
  if
   local.get $root
   local.set $root|14
   local.get $fl
   local.set $fl|15
   local.get $sl
   local.set $sl|16
   local.get $next
   local.set $head
   local.get $root|14
   local.get $fl|15
   i32.const 4
   i32.shl
   local.get $sl|16
   i32.add
   i32.const 2
   i32.shl
   i32.add
   local.get $head
   i32.store offset=96
   local.get $next
   i32.eqz
   if
    block $~lib/rt/tlsf/GETSL|inlined.0 (result i32)
     local.get $root
     local.set $root|18
     local.get $fl
     local.set $fl|19
     local.get $root|18
     local.get $fl|19
     i32.const 2
     i32.shl
     i32.add
     i32.load offset=4
     br $~lib/rt/tlsf/GETSL|inlined.0
    end
    local.set $slMap
    local.get $root
    local.set $root|21
    local.get $fl
    local.set $fl|22
    local.get $slMap
    i32.const 1
    local.get $sl
    i32.shl
    i32.const -1
    i32.xor
    i32.and
    local.tee $slMap
    local.set $slMap|23
    local.get $root|21
    local.get $fl|22
    i32.const 2
    i32.shl
    i32.add
    local.get $slMap|23
    i32.store offset=4
    local.get $slMap
    i32.eqz
    if
     local.get $root
     local.get $root
     call $~lib/rt/tlsf/Root#get:flMap
     i32.const 1
     local.get $fl
     i32.shl
     i32.const -1
     i32.xor
     i32.and
     call $~lib/rt/tlsf/Root#set:flMap
    end
   end
  end
 )
 (func $~lib/rt/tlsf/insertBlock (param $root i32) (param $block i32)
  (local $blockInfo i32)
  (local $block|3 i32)
  (local $right i32)
  (local $rightInfo i32)
  (local $block|6 i32)
  (local $block|7 i32)
  (local $left i32)
  (local $leftInfo i32)
  (local $size i32)
  (local $fl i32)
  (local $sl i32)
  (local $13 i32)
  (local $14 i32)
  (local $boundedSize i32)
  (local $root|16 i32)
  (local $fl|17 i32)
  (local $sl|18 i32)
  (local $head i32)
  (local $root|20 i32)
  (local $fl|21 i32)
  (local $sl|22 i32)
  (local $head|23 i32)
  (local $root|24 i32)
  (local $fl|25 i32)
  (local $root|26 i32)
  (local $fl|27 i32)
  (local $slMap i32)
  i32.const 1
  drop
  local.get $block
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 201
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $block
  call $~lib/rt/common/BLOCK#get:mmInfo
  local.set $blockInfo
  i32.const 1
  drop
  local.get $blockInfo
  i32.const 1
  i32.and
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 203
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  block $~lib/rt/tlsf/GETRIGHT|inlined.0 (result i32)
   local.get $block
   local.set $block|3
   local.get $block|3
   i32.const 4
   i32.add
   local.get $block|3
   call $~lib/rt/common/BLOCK#get:mmInfo
   i32.const 3
   i32.const -1
   i32.xor
   i32.and
   i32.add
   br $~lib/rt/tlsf/GETRIGHT|inlined.0
  end
  local.set $right
  local.get $right
  call $~lib/rt/common/BLOCK#get:mmInfo
  local.set $rightInfo
  local.get $rightInfo
  i32.const 1
  i32.and
  if
   local.get $root
   local.get $right
   call $~lib/rt/tlsf/removeBlock
   local.get $block
   local.get $blockInfo
   i32.const 4
   i32.add
   local.get $rightInfo
   i32.const 3
   i32.const -1
   i32.xor
   i32.and
   i32.add
   local.tee $blockInfo
   call $~lib/rt/common/BLOCK#set:mmInfo
   block $~lib/rt/tlsf/GETRIGHT|inlined.1 (result i32)
    local.get $block
    local.set $block|6
    local.get $block|6
    i32.const 4
    i32.add
    local.get $block|6
    call $~lib/rt/common/BLOCK#get:mmInfo
    i32.const 3
    i32.const -1
    i32.xor
    i32.and
    i32.add
    br $~lib/rt/tlsf/GETRIGHT|inlined.1
   end
   local.set $right
   local.get $right
   call $~lib/rt/common/BLOCK#get:mmInfo
   local.set $rightInfo
  end
  local.get $blockInfo
  i32.const 2
  i32.and
  if
   block $~lib/rt/tlsf/GETFREELEFT|inlined.0 (result i32)
    local.get $block
    local.set $block|7
    local.get $block|7
    i32.const 4
    i32.sub
    i32.load
    br $~lib/rt/tlsf/GETFREELEFT|inlined.0
   end
   local.set $left
   local.get $left
   call $~lib/rt/common/BLOCK#get:mmInfo
   local.set $leftInfo
   i32.const 1
   drop
   local.get $leftInfo
   i32.const 1
   i32.and
   i32.eqz
   if
    i32.const 0
    i32.const 368
    i32.const 221
    i32.const 16
    call $~lib/builtins/abort
    unreachable
   end
   local.get $root
   local.get $left
   call $~lib/rt/tlsf/removeBlock
   local.get $left
   local.set $block
   local.get $block
   local.get $leftInfo
   i32.const 4
   i32.add
   local.get $blockInfo
   i32.const 3
   i32.const -1
   i32.xor
   i32.and
   i32.add
   local.tee $blockInfo
   call $~lib/rt/common/BLOCK#set:mmInfo
  end
  local.get $right
  local.get $rightInfo
  i32.const 2
  i32.or
  call $~lib/rt/common/BLOCK#set:mmInfo
  local.get $blockInfo
  i32.const 3
  i32.const -1
  i32.xor
  i32.and
  local.set $size
  i32.const 1
  drop
  local.get $size
  i32.const 12
  i32.ge_u
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 233
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  i32.const 1
  drop
  local.get $block
  i32.const 4
  i32.add
  local.get $size
  i32.add
  local.get $right
  i32.eq
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 234
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $right
  i32.const 4
  i32.sub
  local.get $block
  i32.store
  local.get $size
  i32.const 256
  i32.lt_u
  if
   i32.const 0
   local.set $fl
   local.get $size
   i32.const 4
   i32.shr_u
   local.set $sl
  else
   local.get $size
   local.tee $13
   i32.const 1073741820
   local.tee $14
   local.get $13
   local.get $14
   i32.lt_u
   select
   local.set $boundedSize
   i32.const 31
   local.get $boundedSize
   i32.clz
   i32.sub
   local.set $fl
   local.get $boundedSize
   local.get $fl
   i32.const 4
   i32.sub
   i32.shr_u
   i32.const 1
   i32.const 4
   i32.shl
   i32.xor
   local.set $sl
   local.get $fl
   i32.const 8
   i32.const 1
   i32.sub
   i32.sub
   local.set $fl
  end
  i32.const 1
  drop
  local.get $fl
  i32.const 23
  i32.lt_u
  if (result i32)
   local.get $sl
   i32.const 16
   i32.lt_u
  else
   i32.const 0
  end
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 251
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  block $~lib/rt/tlsf/GETHEAD|inlined.1 (result i32)
   local.get $root
   local.set $root|16
   local.get $fl
   local.set $fl|17
   local.get $sl
   local.set $sl|18
   local.get $root|16
   local.get $fl|17
   i32.const 4
   i32.shl
   local.get $sl|18
   i32.add
   i32.const 2
   i32.shl
   i32.add
   i32.load offset=96
   br $~lib/rt/tlsf/GETHEAD|inlined.1
  end
  local.set $head
  local.get $block
  i32.const 0
  call $~lib/rt/tlsf/Block#set:prev
  local.get $block
  local.get $head
  call $~lib/rt/tlsf/Block#set:next
  local.get $head
  if
   local.get $head
   local.get $block
   call $~lib/rt/tlsf/Block#set:prev
  end
  local.get $root
  local.set $root|20
  local.get $fl
  local.set $fl|21
  local.get $sl
  local.set $sl|22
  local.get $block
  local.set $head|23
  local.get $root|20
  local.get $fl|21
  i32.const 4
  i32.shl
  local.get $sl|22
  i32.add
  i32.const 2
  i32.shl
  i32.add
  local.get $head|23
  i32.store offset=96
  local.get $root
  local.get $root
  call $~lib/rt/tlsf/Root#get:flMap
  i32.const 1
  local.get $fl
  i32.shl
  i32.or
  call $~lib/rt/tlsf/Root#set:flMap
  local.get $root
  local.set $root|26
  local.get $fl
  local.set $fl|27
  block $~lib/rt/tlsf/GETSL|inlined.1 (result i32)
   local.get $root
   local.set $root|24
   local.get $fl
   local.set $fl|25
   local.get $root|24
   local.get $fl|25
   i32.const 2
   i32.shl
   i32.add
   i32.load offset=4
   br $~lib/rt/tlsf/GETSL|inlined.1
  end
  i32.const 1
  local.get $sl
  i32.shl
  i32.or
  local.set $slMap
  local.get $root|26
  local.get $fl|27
  i32.const 2
  i32.shl
  i32.add
  local.get $slMap
  i32.store offset=4
 )
 (func $~lib/rt/tlsf/addMemory (param $root i32) (param $start i32) (param $endU64 i64) (result i32)
  (local $end i32)
  (local $root|4 i32)
  (local $tail i32)
  (local $tailInfo i32)
  (local $size i32)
  (local $leftSize i32)
  (local $left i32)
  (local $root|10 i32)
  (local $tail|11 i32)
  local.get $endU64
  i32.wrap_i64
  local.set $end
  i32.const 1
  drop
  local.get $start
  i64.extend_i32_u
  local.get $endU64
  i64.le_u
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 382
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $start
  i32.const 4
  i32.add
  i32.const 15
  i32.add
  i32.const 15
  i32.const -1
  i32.xor
  i32.and
  i32.const 4
  i32.sub
  local.set $start
  local.get $end
  i32.const 15
  i32.const -1
  i32.xor
  i32.and
  local.set $end
  block $~lib/rt/tlsf/GETTAIL|inlined.0 (result i32)
   local.get $root
   local.set $root|4
   local.get $root|4
   i32.load offset=1568
   br $~lib/rt/tlsf/GETTAIL|inlined.0
  end
  local.set $tail
  i32.const 0
  local.set $tailInfo
  local.get $tail
  if
   i32.const 1
   drop
   local.get $start
   local.get $tail
   i32.const 4
   i32.add
   i32.ge_u
   i32.eqz
   if
    i32.const 0
    i32.const 368
    i32.const 389
    i32.const 16
    call $~lib/builtins/abort
    unreachable
   end
   local.get $start
   i32.const 16
   i32.sub
   local.get $tail
   i32.eq
   if
    local.get $start
    i32.const 16
    i32.sub
    local.set $start
    local.get $tail
    call $~lib/rt/common/BLOCK#get:mmInfo
    local.set $tailInfo
   else
   end
  else
   i32.const 1
   drop
   local.get $start
   local.get $root
   i32.const 1572
   i32.add
   i32.ge_u
   i32.eqz
   if
    i32.const 0
    i32.const 368
    i32.const 402
    i32.const 5
    call $~lib/builtins/abort
    unreachable
   end
  end
  local.get $end
  local.get $start
  i32.sub
  local.set $size
  local.get $size
  i32.const 4
  i32.const 12
  i32.add
  i32.const 4
  i32.add
  i32.lt_u
  if
   i32.const 0
   return
  end
  local.get $size
  i32.const 2
  i32.const 4
  i32.mul
  i32.sub
  local.set $leftSize
  local.get $start
  local.set $left
  local.get $left
  local.get $leftSize
  i32.const 1
  i32.or
  local.get $tailInfo
  i32.const 2
  i32.and
  i32.or
  call $~lib/rt/common/BLOCK#set:mmInfo
  local.get $left
  i32.const 0
  call $~lib/rt/tlsf/Block#set:prev
  local.get $left
  i32.const 0
  call $~lib/rt/tlsf/Block#set:next
  local.get $start
  i32.const 4
  i32.add
  local.get $leftSize
  i32.add
  local.set $tail
  local.get $tail
  i32.const 0
  i32.const 2
  i32.or
  call $~lib/rt/common/BLOCK#set:mmInfo
  local.get $root
  local.set $root|10
  local.get $tail
  local.set $tail|11
  local.get $root|10
  local.get $tail|11
  i32.store offset=1568
  local.get $root
  local.get $left
  call $~lib/rt/tlsf/insertBlock
  i32.const 1
  return
 )
 (func $~lib/rt/tlsf/initialize
  (local $rootOffset i32)
  (local $pagesBefore i32)
  (local $pagesNeeded i32)
  (local $root i32)
  (local $root|4 i32)
  (local $tail i32)
  (local $fl i32)
  (local $root|7 i32)
  (local $fl|8 i32)
  (local $slMap i32)
  (local $sl i32)
  (local $root|11 i32)
  (local $fl|12 i32)
  (local $sl|13 i32)
  (local $head i32)
  (local $memStart i32)
  i32.const 0
  drop
  global.get $~lib/memory/__heap_base
  i32.const 15
  i32.add
  i32.const 15
  i32.const -1
  i32.xor
  i32.and
  local.set $rootOffset
  memory.size
  local.set $pagesBefore
  local.get $rootOffset
  i32.const 1572
  i32.add
  i32.const 65535
  i32.add
  i32.const 65535
  i32.const -1
  i32.xor
  i32.and
  i32.const 16
  i32.shr_u
  local.set $pagesNeeded
  local.get $pagesNeeded
  local.get $pagesBefore
  i32.gt_s
  if (result i32)
   local.get $pagesNeeded
   local.get $pagesBefore
   i32.sub
   memory.grow
   i32.const 0
   i32.lt_s
  else
   i32.const 0
  end
  if
   unreachable
  end
  local.get $rootOffset
  local.set $root
  local.get $root
  i32.const 0
  call $~lib/rt/tlsf/Root#set:flMap
  local.get $root
  local.set $root|4
  i32.const 0
  local.set $tail
  local.get $root|4
  local.get $tail
  i32.store offset=1568
  i32.const 0
  local.set $fl
  loop $for-loop|0
   local.get $fl
   i32.const 23
   i32.lt_u
   if
    local.get $root
    local.set $root|7
    local.get $fl
    local.set $fl|8
    i32.const 0
    local.set $slMap
    local.get $root|7
    local.get $fl|8
    i32.const 2
    i32.shl
    i32.add
    local.get $slMap
    i32.store offset=4
    i32.const 0
    local.set $sl
    loop $for-loop|1
     local.get $sl
     i32.const 16
     i32.lt_u
     if
      local.get $root
      local.set $root|11
      local.get $fl
      local.set $fl|12
      local.get $sl
      local.set $sl|13
      i32.const 0
      local.set $head
      local.get $root|11
      local.get $fl|12
      i32.const 4
      i32.shl
      local.get $sl|13
      i32.add
      i32.const 2
      i32.shl
      i32.add
      local.get $head
      i32.store offset=96
      local.get $sl
      i32.const 1
      i32.add
      local.set $sl
      br $for-loop|1
     end
    end
    local.get $fl
    i32.const 1
    i32.add
    local.set $fl
    br $for-loop|0
   end
  end
  local.get $rootOffset
  i32.const 1572
  i32.add
  local.set $memStart
  i32.const 0
  drop
  local.get $root
  local.get $memStart
  memory.size
  i64.extend_i32_s
  i64.const 16
  i64.shl
  call $~lib/rt/tlsf/addMemory
  drop
  local.get $root
  global.set $~lib/rt/tlsf/ROOT
 )
 (func $~lib/rt/tlsf/checkUsedBlock (param $ptr i32) (result i32)
  (local $block i32)
  local.get $ptr
  i32.const 4
  i32.sub
  local.set $block
  local.get $ptr
  i32.const 0
  i32.ne
  if (result i32)
   local.get $ptr
   i32.const 15
   i32.and
   i32.eqz
  else
   i32.const 0
  end
  if (result i32)
   local.get $block
   call $~lib/rt/common/BLOCK#get:mmInfo
   i32.const 1
   i32.and
   i32.eqz
  else
   i32.const 0
  end
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 562
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $block
  return
 )
 (func $~lib/rt/tlsf/freeBlock (param $root i32) (param $block i32)
  i32.const 0
  drop
  local.get $block
  local.get $block
  call $~lib/rt/common/BLOCK#get:mmInfo
  i32.const 1
  i32.or
  call $~lib/rt/common/BLOCK#set:mmInfo
  local.get $root
  local.get $block
  call $~lib/rt/tlsf/insertBlock
 )
 (func $~lib/rt/tlsf/__free (param $ptr i32)
  local.get $ptr
  global.get $~lib/memory/__heap_base
  i32.lt_u
  if
   return
  end
  global.get $~lib/rt/tlsf/ROOT
  i32.eqz
  if
   call $~lib/rt/tlsf/initialize
  end
  global.get $~lib/rt/tlsf/ROOT
  local.get $ptr
  call $~lib/rt/tlsf/checkUsedBlock
  call $~lib/rt/tlsf/freeBlock
 )
 (func $~lib/rt/itcms/free (param $obj i32)
  local.get $obj
  global.get $~lib/memory/__heap_base
  i32.lt_u
  if
   local.get $obj
   i32.const 0
   call $~lib/rt/itcms/Object#set:nextWithColor
   local.get $obj
   i32.const 0
   call $~lib/rt/itcms/Object#set:prev
  else
   global.get $~lib/rt/itcms/total
   local.get $obj
   call $~lib/rt/itcms/Object#get:size
   i32.sub
   global.set $~lib/rt/itcms/total
   i32.const 0
   drop
   local.get $obj
   i32.const 4
   i32.add
   call $~lib/rt/tlsf/__free
  end
 )
 (func $~lib/rt/itcms/step (result i32)
  (local $obj i32)
  (local $1 i32)
  (local $black i32)
  (local $from i32)
  block $break|0
   block $case2|0
    block $case1|0
     block $case0|0
      global.get $~lib/rt/itcms/state
      local.set $1
      local.get $1
      i32.const 0
      i32.eq
      br_if $case0|0
      local.get $1
      i32.const 1
      i32.eq
      br_if $case1|0
      local.get $1
      i32.const 2
      i32.eq
      br_if $case2|0
      br $break|0
     end
     i32.const 1
     global.set $~lib/rt/itcms/state
     i32.const 0
     global.set $~lib/rt/itcms/visitCount
     i32.const 0
     call $~lib/rt/itcms/visitRoots
     global.get $~lib/rt/itcms/toSpace
     global.set $~lib/rt/itcms/iter
     global.get $~lib/rt/itcms/visitCount
     i32.const 1
     i32.mul
     return
    end
    global.get $~lib/rt/itcms/white
    i32.eqz
    local.set $black
    global.get $~lib/rt/itcms/iter
    call $~lib/rt/itcms/Object#get:next
    local.set $obj
    loop $while-continue|1
     local.get $obj
     global.get $~lib/rt/itcms/toSpace
     i32.ne
     if
      local.get $obj
      global.set $~lib/rt/itcms/iter
      local.get $obj
      call $~lib/rt/itcms/Object#get:color
      local.get $black
      i32.ne
      if
       local.get $obj
       local.get $black
       call $~lib/rt/itcms/Object#set:color
       i32.const 0
       global.set $~lib/rt/itcms/visitCount
       local.get $obj
       i32.const 20
       i32.add
       i32.const 0
       call $~lib/rt/__visit_members
       global.get $~lib/rt/itcms/visitCount
       i32.const 1
       i32.mul
       return
      end
      local.get $obj
      call $~lib/rt/itcms/Object#get:next
      local.set $obj
      br $while-continue|1
     end
    end
    i32.const 0
    global.set $~lib/rt/itcms/visitCount
    i32.const 0
    call $~lib/rt/itcms/visitRoots
    global.get $~lib/rt/itcms/iter
    call $~lib/rt/itcms/Object#get:next
    local.set $obj
    local.get $obj
    global.get $~lib/rt/itcms/toSpace
    i32.eq
    if
     i32.const 0
     call $~lib/rt/itcms/visitStack
     global.get $~lib/rt/itcms/iter
     call $~lib/rt/itcms/Object#get:next
     local.set $obj
     loop $while-continue|2
      local.get $obj
      global.get $~lib/rt/itcms/toSpace
      i32.ne
      if
       local.get $obj
       call $~lib/rt/itcms/Object#get:color
       local.get $black
       i32.ne
       if
        local.get $obj
        local.get $black
        call $~lib/rt/itcms/Object#set:color
        local.get $obj
        i32.const 20
        i32.add
        i32.const 0
        call $~lib/rt/__visit_members
       end
       local.get $obj
       call $~lib/rt/itcms/Object#get:next
       local.set $obj
       br $while-continue|2
      end
     end
     global.get $~lib/rt/itcms/fromSpace
     local.set $from
     global.get $~lib/rt/itcms/toSpace
     global.set $~lib/rt/itcms/fromSpace
     local.get $from
     global.set $~lib/rt/itcms/toSpace
     local.get $black
     global.set $~lib/rt/itcms/white
     local.get $from
     call $~lib/rt/itcms/Object#get:next
     global.set $~lib/rt/itcms/iter
     i32.const 2
     global.set $~lib/rt/itcms/state
    end
    global.get $~lib/rt/itcms/visitCount
    i32.const 1
    i32.mul
    return
   end
   global.get $~lib/rt/itcms/iter
   local.set $obj
   local.get $obj
   global.get $~lib/rt/itcms/toSpace
   i32.ne
   if
    local.get $obj
    call $~lib/rt/itcms/Object#get:next
    global.set $~lib/rt/itcms/iter
    i32.const 1
    drop
    local.get $obj
    call $~lib/rt/itcms/Object#get:color
    global.get $~lib/rt/itcms/white
    i32.eqz
    i32.eq
    i32.eqz
    if
     i32.const 0
     i32.const 96
     i32.const 229
     i32.const 20
     call $~lib/builtins/abort
     unreachable
    end
    local.get $obj
    call $~lib/rt/itcms/free
    i32.const 10
    return
   end
   global.get $~lib/rt/itcms/toSpace
   global.get $~lib/rt/itcms/toSpace
   call $~lib/rt/itcms/Object#set:nextWithColor
   global.get $~lib/rt/itcms/toSpace
   global.get $~lib/rt/itcms/toSpace
   call $~lib/rt/itcms/Object#set:prev
   i32.const 0
   global.set $~lib/rt/itcms/state
   br $break|0
  end
  i32.const 0
  return
 )
 (func $~lib/rt/itcms/interrupt
  (local $budget i32)
  i32.const 0
  drop
  i32.const 0
  drop
  i32.const 1024
  i32.const 200
  i32.mul
  i32.const 100
  i32.div_u
  local.set $budget
  loop $do-loop|0
   local.get $budget
   call $~lib/rt/itcms/step
   i32.sub
   local.set $budget
   global.get $~lib/rt/itcms/state
   i32.const 0
   i32.eq
   if
    i32.const 0
    drop
    i32.const 200
    i32.const 100
    i32.rem_u
    i32.const 0
    i32.eq
    drop
    global.get $~lib/rt/itcms/total
    i32.const 200
    i32.const 100
    i32.div_u
    i32.mul
    i32.const 1024
    i32.add
    global.set $~lib/rt/itcms/threshold
    i32.const 0
    drop
    return
   end
   local.get $budget
   i32.const 0
   i32.gt_s
   br_if $do-loop|0
  end
  i32.const 0
  drop
  global.get $~lib/rt/itcms/total
  i32.const 1024
  global.get $~lib/rt/itcms/total
  global.get $~lib/rt/itcms/threshold
  i32.sub
  i32.const 1024
  i32.lt_u
  i32.mul
  i32.add
  global.set $~lib/rt/itcms/threshold
  i32.const 0
  drop
 )
 (func $~lib/rt/tlsf/computeSize (param $size i32) (result i32)
  local.get $size
  i32.const 12
  i32.le_u
  if (result i32)
   i32.const 12
  else
   local.get $size
   i32.const 4
   i32.add
   i32.const 15
   i32.add
   i32.const 15
   i32.const -1
   i32.xor
   i32.and
   i32.const 4
   i32.sub
  end
  return
 )
 (func $~lib/rt/tlsf/prepareSize (param $size i32) (result i32)
  local.get $size
  i32.const 1073741820
  i32.gt_u
  if
   i32.const 32
   i32.const 368
   i32.const 461
   i32.const 29
   call $~lib/builtins/abort
   unreachable
  end
  local.get $size
  call $~lib/rt/tlsf/computeSize
  return
 )
 (func $~lib/rt/tlsf/roundSize (param $size i32) (result i32)
  local.get $size
  i32.const 536870910
  i32.lt_u
  if (result i32)
   local.get $size
   i32.const 1
   i32.const 27
   local.get $size
   i32.clz
   i32.sub
   i32.shl
   i32.add
   i32.const 1
   i32.sub
  else
   local.get $size
  end
  return
 )
 (func $~lib/rt/tlsf/searchBlock (param $root i32) (param $size i32) (result i32)
  (local $fl i32)
  (local $sl i32)
  (local $requestSize i32)
  (local $root|5 i32)
  (local $fl|6 i32)
  (local $slMap i32)
  (local $head i32)
  (local $flMap i32)
  (local $root|10 i32)
  (local $fl|11 i32)
  (local $root|12 i32)
  (local $fl|13 i32)
  (local $sl|14 i32)
  (local $root|15 i32)
  (local $fl|16 i32)
  (local $sl|17 i32)
  local.get $size
  i32.const 256
  i32.lt_u
  if
   i32.const 0
   local.set $fl
   local.get $size
   i32.const 4
   i32.shr_u
   local.set $sl
  else
   local.get $size
   call $~lib/rt/tlsf/roundSize
   local.set $requestSize
   i32.const 4
   i32.const 8
   i32.mul
   i32.const 1
   i32.sub
   local.get $requestSize
   i32.clz
   i32.sub
   local.set $fl
   local.get $requestSize
   local.get $fl
   i32.const 4
   i32.sub
   i32.shr_u
   i32.const 1
   i32.const 4
   i32.shl
   i32.xor
   local.set $sl
   local.get $fl
   i32.const 8
   i32.const 1
   i32.sub
   i32.sub
   local.set $fl
  end
  i32.const 1
  drop
  local.get $fl
  i32.const 23
  i32.lt_u
  if (result i32)
   local.get $sl
   i32.const 16
   i32.lt_u
  else
   i32.const 0
  end
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 334
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  block $~lib/rt/tlsf/GETSL|inlined.2 (result i32)
   local.get $root
   local.set $root|5
   local.get $fl
   local.set $fl|6
   local.get $root|5
   local.get $fl|6
   i32.const 2
   i32.shl
   i32.add
   i32.load offset=4
   br $~lib/rt/tlsf/GETSL|inlined.2
  end
  i32.const 0
  i32.const -1
  i32.xor
  local.get $sl
  i32.shl
  i32.and
  local.set $slMap
  i32.const 0
  local.set $head
  local.get $slMap
  i32.eqz
  if
   local.get $root
   call $~lib/rt/tlsf/Root#get:flMap
   i32.const 0
   i32.const -1
   i32.xor
   local.get $fl
   i32.const 1
   i32.add
   i32.shl
   i32.and
   local.set $flMap
   local.get $flMap
   i32.eqz
   if
    i32.const 0
    local.set $head
   else
    local.get $flMap
    i32.ctz
    local.set $fl
    block $~lib/rt/tlsf/GETSL|inlined.3 (result i32)
     local.get $root
     local.set $root|10
     local.get $fl
     local.set $fl|11
     local.get $root|10
     local.get $fl|11
     i32.const 2
     i32.shl
     i32.add
     i32.load offset=4
     br $~lib/rt/tlsf/GETSL|inlined.3
    end
    local.set $slMap
    i32.const 1
    drop
    local.get $slMap
    i32.eqz
    if
     i32.const 0
     i32.const 368
     i32.const 347
     i32.const 18
     call $~lib/builtins/abort
     unreachable
    end
    block $~lib/rt/tlsf/GETHEAD|inlined.2 (result i32)
     local.get $root
     local.set $root|12
     local.get $fl
     local.set $fl|13
     local.get $slMap
     i32.ctz
     local.set $sl|14
     local.get $root|12
     local.get $fl|13
     i32.const 4
     i32.shl
     local.get $sl|14
     i32.add
     i32.const 2
     i32.shl
     i32.add
     i32.load offset=96
     br $~lib/rt/tlsf/GETHEAD|inlined.2
    end
    local.set $head
   end
  else
   block $~lib/rt/tlsf/GETHEAD|inlined.3 (result i32)
    local.get $root
    local.set $root|15
    local.get $fl
    local.set $fl|16
    local.get $slMap
    i32.ctz
    local.set $sl|17
    local.get $root|15
    local.get $fl|16
    i32.const 4
    i32.shl
    local.get $sl|17
    i32.add
    i32.const 2
    i32.shl
    i32.add
    i32.load offset=96
    br $~lib/rt/tlsf/GETHEAD|inlined.3
   end
   local.set $head
  end
  local.get $head
  return
 )
 (func $~lib/rt/tlsf/growMemory (param $root i32) (param $size i32)
  (local $pagesBefore i32)
  (local $root|3 i32)
  (local $pagesNeeded i32)
  (local $5 i32)
  (local $6 i32)
  (local $pagesWanted i32)
  (local $pagesAfter i32)
  i32.const 0
  drop
  local.get $size
  i32.const 256
  i32.ge_u
  if
   local.get $size
   call $~lib/rt/tlsf/roundSize
   local.set $size
  end
  memory.size
  local.set $pagesBefore
  local.get $size
  i32.const 4
  local.get $pagesBefore
  i32.const 16
  i32.shl
  i32.const 4
  i32.sub
  block $~lib/rt/tlsf/GETTAIL|inlined.1 (result i32)
   local.get $root
   local.set $root|3
   local.get $root|3
   i32.load offset=1568
   br $~lib/rt/tlsf/GETTAIL|inlined.1
  end
  i32.ne
  i32.shl
  i32.add
  local.set $size
  local.get $size
  i32.const 65535
  i32.add
  i32.const 65535
  i32.const -1
  i32.xor
  i32.and
  i32.const 16
  i32.shr_u
  local.set $pagesNeeded
  local.get $pagesBefore
  local.tee $5
  local.get $pagesNeeded
  local.tee $6
  local.get $5
  local.get $6
  i32.gt_s
  select
  local.set $pagesWanted
  local.get $pagesWanted
  memory.grow
  i32.const 0
  i32.lt_s
  if
   local.get $pagesNeeded
   memory.grow
   i32.const 0
   i32.lt_s
   if
    unreachable
   end
  end
  memory.size
  local.set $pagesAfter
  local.get $root
  local.get $pagesBefore
  i32.const 16
  i32.shl
  local.get $pagesAfter
  i64.extend_i32_s
  i64.const 16
  i64.shl
  call $~lib/rt/tlsf/addMemory
  drop
 )
 (func $~lib/rt/tlsf/prepareBlock (param $root i32) (param $block i32) (param $size i32)
  (local $blockInfo i32)
  (local $remaining i32)
  (local $spare i32)
  (local $block|6 i32)
  (local $block|7 i32)
  local.get $block
  call $~lib/rt/common/BLOCK#get:mmInfo
  local.set $blockInfo
  i32.const 1
  drop
  local.get $size
  i32.const 4
  i32.add
  i32.const 15
  i32.and
  i32.eqz
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 361
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $blockInfo
  i32.const 3
  i32.const -1
  i32.xor
  i32.and
  local.get $size
  i32.sub
  local.set $remaining
  local.get $remaining
  i32.const 4
  i32.const 12
  i32.add
  i32.ge_u
  if
   local.get $block
   local.get $size
   local.get $blockInfo
   i32.const 2
   i32.and
   i32.or
   call $~lib/rt/common/BLOCK#set:mmInfo
   local.get $block
   i32.const 4
   i32.add
   local.get $size
   i32.add
   local.set $spare
   local.get $spare
   local.get $remaining
   i32.const 4
   i32.sub
   i32.const 1
   i32.or
   call $~lib/rt/common/BLOCK#set:mmInfo
   local.get $root
   local.get $spare
   call $~lib/rt/tlsf/insertBlock
  else
   local.get $block
   local.get $blockInfo
   i32.const 1
   i32.const -1
   i32.xor
   i32.and
   call $~lib/rt/common/BLOCK#set:mmInfo
   block $~lib/rt/tlsf/GETRIGHT|inlined.3 (result i32)
    local.get $block
    local.set $block|7
    local.get $block|7
    i32.const 4
    i32.add
    local.get $block|7
    call $~lib/rt/common/BLOCK#get:mmInfo
    i32.const 3
    i32.const -1
    i32.xor
    i32.and
    i32.add
    br $~lib/rt/tlsf/GETRIGHT|inlined.3
   end
   block $~lib/rt/tlsf/GETRIGHT|inlined.2 (result i32)
    local.get $block
    local.set $block|6
    local.get $block|6
    i32.const 4
    i32.add
    local.get $block|6
    call $~lib/rt/common/BLOCK#get:mmInfo
    i32.const 3
    i32.const -1
    i32.xor
    i32.and
    i32.add
    br $~lib/rt/tlsf/GETRIGHT|inlined.2
   end
   call $~lib/rt/common/BLOCK#get:mmInfo
   i32.const 2
   i32.const -1
   i32.xor
   i32.and
   call $~lib/rt/common/BLOCK#set:mmInfo
  end
 )
 (func $~lib/rt/tlsf/allocateBlock (param $root i32) (param $size i32) (result i32)
  (local $payloadSize i32)
  (local $block i32)
  local.get $size
  call $~lib/rt/tlsf/prepareSize
  local.set $payloadSize
  local.get $root
  local.get $payloadSize
  call $~lib/rt/tlsf/searchBlock
  local.set $block
  local.get $block
  i32.eqz
  if
   local.get $root
   local.get $payloadSize
   call $~lib/rt/tlsf/growMemory
   local.get $root
   local.get $payloadSize
   call $~lib/rt/tlsf/searchBlock
   local.set $block
   i32.const 1
   drop
   local.get $block
   i32.eqz
   if
    i32.const 0
    i32.const 368
    i32.const 499
    i32.const 16
    call $~lib/builtins/abort
    unreachable
   end
  end
  i32.const 1
  drop
  local.get $block
  call $~lib/rt/common/BLOCK#get:mmInfo
  i32.const 3
  i32.const -1
  i32.xor
  i32.and
  local.get $payloadSize
  i32.ge_u
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 501
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $root
  local.get $block
  call $~lib/rt/tlsf/removeBlock
  local.get $root
  local.get $block
  local.get $payloadSize
  call $~lib/rt/tlsf/prepareBlock
  i32.const 0
  drop
  local.get $block
  return
 )
 (func $~lib/rt/tlsf/__alloc (param $size i32) (result i32)
  global.get $~lib/rt/tlsf/ROOT
  i32.eqz
  if
   call $~lib/rt/tlsf/initialize
  end
  global.get $~lib/rt/tlsf/ROOT
  local.get $size
  call $~lib/rt/tlsf/allocateBlock
  i32.const 4
  i32.add
  return
 )
 (func $~lib/rt/itcms/Object#set:rtId (param $this i32) (param $rtId i32)
  local.get $this
  local.get $rtId
  i32.store offset=12
 )
 (func $~lib/rt/itcms/Object#set:rtSize (param $this i32) (param $rtSize i32)
  local.get $this
  local.get $rtSize
  i32.store offset=16
 )
 (func $~lib/rt/itcms/__new (param $size i32) (param $id i32) (result i32)
  (local $obj i32)
  (local $ptr i32)
  local.get $size
  i32.const 1073741804
  i32.ge_u
  if
   i32.const 32
   i32.const 96
   i32.const 261
   i32.const 31
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/rt/itcms/total
  global.get $~lib/rt/itcms/threshold
  i32.ge_u
  if
   call $~lib/rt/itcms/interrupt
  end
  i32.const 16
  local.get $size
  i32.add
  call $~lib/rt/tlsf/__alloc
  i32.const 4
  i32.sub
  local.set $obj
  local.get $obj
  local.get $id
  call $~lib/rt/itcms/Object#set:rtId
  local.get $obj
  local.get $size
  call $~lib/rt/itcms/Object#set:rtSize
  local.get $obj
  global.get $~lib/rt/itcms/fromSpace
  global.get $~lib/rt/itcms/white
  call $~lib/rt/itcms/Object#linkTo
  global.get $~lib/rt/itcms/total
  local.get $obj
  call $~lib/rt/itcms/Object#get:size
  i32.add
  global.set $~lib/rt/itcms/total
  local.get $obj
  i32.const 20
  i32.add
  local.set $ptr
  local.get $ptr
  i32.const 0
  local.get $size
  memory.fill
  local.get $ptr
  return
 )
 (func $~lib/rt/itcms/__link (param $parentPtr i32) (param $childPtr i32) (param $expectMultiple i32)
  (local $child i32)
  (local $parent i32)
  (local $parentColor i32)
  local.get $childPtr
  i32.eqz
  if
   return
  end
  i32.const 1
  drop
  local.get $parentPtr
  i32.eqz
  if
   i32.const 0
   i32.const 96
   i32.const 295
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $childPtr
  i32.const 20
  i32.sub
  local.set $child
  local.get $child
  call $~lib/rt/itcms/Object#get:color
  global.get $~lib/rt/itcms/white
  i32.eq
  if
   local.get $parentPtr
   i32.const 20
   i32.sub
   local.set $parent
   local.get $parent
   call $~lib/rt/itcms/Object#get:color
   local.set $parentColor
   local.get $parentColor
   global.get $~lib/rt/itcms/white
   i32.eqz
   i32.eq
   if
    local.get $expectMultiple
    if
     local.get $parent
     call $~lib/rt/itcms/Object#makeGray
    else
     local.get $child
     call $~lib/rt/itcms/Object#makeGray
    end
   else
    local.get $parentColor
    i32.const 3
    i32.eq
    if (result i32)
     global.get $~lib/rt/itcms/state
     i32.const 1
     i32.eq
    else
     i32.const 0
    end
    if
     local.get $child
     call $~lib/rt/itcms/Object#makeGray
    end
   end
  end
 )
 (func $~lib/task-rt/TaskState#set:record (param $this i32) (param $record i32)
  local.get $this
  local.get $record
  i32.store
  local.get $this
  local.get $record
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $~lib/task-rt/TaskState#set:resume (param $this i32) (param $resume i32)
  local.get $this
  local.get $resume
  i32.store offset=4
  local.get $this
  local.get $resume
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $async-closure-value/outer$State#set:h (param $this i32) (param $h i32)
  local.get $this
  local.get $h
  i32.store offset=8
  local.get $this
  local.get $h
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $async-closure-value/outer$State#set:resumePoint (param $this i32) (param $resumePoint i32)
  local.get $this
  local.get $resumePoint
  i32.store offset=20
 )
 (func $async-closure-value/outer$State#set:result (param $this i32) (param $result i32)
  local.get $this
  local.get $result
  i32.store offset=24
 )
 (func $async-closure-value/outer$State#set:$closureEnv (param $this i32) (param $$closureEnv i32)
  local.get $this
  local.get $$closureEnv
  i32.store offset=16
  local.get $this
  local.get $$closureEnv
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $async-closure-value/outer$State#set:$env (param $this i32) (param $$env i32)
  local.get $this
  local.get $$env
  i32.store offset=12
  local.get $this
  local.get $$env
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $async-closure-value/outer$State#set:$awaited1 (param $this i32) (param $$awaited1 i32)
  local.get $this
  local.get $$awaited1
  i32.store offset=28
  local.get $this
  local.get $$awaited1
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $async-closure-value/outer$State#set:handle (param $this i32) (param $handle i32)
  local.get $this
  local.get $handle
  i32.store offset=32
  local.get $this
  local.get $handle
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $~lib/task/Task<i32>#set:_record (param $this i32) (param $_record i32)
  local.get $this
  local.get $_record
  i32.store
  local.get $this
  local.get $_record
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $~lib/task/TaskRecord#set:class_ (param $this i32) (param $class_ i32)
  local.get $this
  local.get $class_
  i32.store
 )
 (func $~lib/task/TaskRecord#set:key (param $this i32) (param $key i32)
  local.get $this
  local.get $key
  i32.store offset=4
 )
 (func $~lib/task/TaskRecord#set:payload (param $this i32) (param $payload i32)
  local.get $this
  local.get $payload
  i32.store offset=8
 )
 (func $~lib/task/TaskRecord#set:status (param $this i32) (param $status i32)
  local.get $this
  local.get $status
  i32.store offset=12
 )
 (func $~lib/task/TaskRecord#set:f0 (param $this i32) (param $f0 f32)
  local.get $this
  local.get $f0
  f32.store offset=16
 )
 (func $~lib/task/TaskRecord#set:f1 (param $this i32) (param $f1 f32)
  local.get $this
  local.get $f1
  f32.store offset=20
 )
 (func $~lib/task/TaskRecord#set:tag (param $this i32) (param $tag i32)
  local.get $this
  local.get $tag
  i32.store offset=24
 )
 (func $~lib/task/TaskRecord#set:done (param $this i32) (param $done i32)
  local.get $this
  local.get $done
  i32.store offset=28
 )
 (func $async-closure-value/outer$State#get:h (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $async-closure-value/outer$State#get:$closureEnv (param $this i32) (result i32)
  local.get $this
  i32.load offset=16
 )
 (func $async-closure-value/outer$State#get:resumePoint (param $this i32) (result i32)
  local.get $this
  i32.load offset=20
 )
 (func $async-closure-value/outer$Env#set:x (param $this i32) (param $x i32)
  local.get $this
  local.get $x
  i32.store
 )
 (func $async-closure-value/inner$State#set:g (param $this i32) (param $g i32)
  local.get $this
  local.get $g
  i32.store offset=8
  local.get $this
  local.get $g
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $async-closure-value/inner$State#set:resumePoint (param $this i32) (param $resumePoint i32)
  local.get $this
  local.get $resumePoint
  i32.store offset=16
 )
 (func $async-closure-value/inner$State#set:result (param $this i32) (param $result i32)
  local.get $this
  local.get $result
  i32.store offset=20
 )
 (func $async-closure-value/inner$State#set:$env (param $this i32) (param $$env i32)
  local.get $this
  local.get $$env
  i32.store offset=12
  local.get $this
  local.get $$env
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $async-closure-value/inner$State#set:$awaited1 (param $this i32) (param $$awaited1 i32)
  local.get $this
  local.get $$awaited1
  i32.store offset=24
  local.get $this
  local.get $$awaited1
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $async-closure-value/inner$State#set:handle (param $this i32) (param $handle i32)
  local.get $this
  local.get $handle
  i32.store offset=28
  local.get $this
  local.get $handle
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $async-closure-value/inner$State#get:$env (param $this i32) (result i32)
  local.get $this
  i32.load offset=12
 )
 (func $async-closure-value/inner$State#get:g (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $async-closure-value/inner$State#get:resumePoint (param $this i32) (result i32)
  local.get $this
  i32.load offset=16
 )
 (func $~lib/task/TaskRecord#get:done (param $this i32) (result i32)
  local.get $this
  i32.load offset=28
 )
 (func $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:buckets" (param $this i32) (param $buckets i32)
  local.get $this
  local.get $buckets
  i32.store
  local.get $this
  local.get $buckets
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:bucketsMask" (param $this i32) (param $bucketsMask i32)
  local.get $this
  local.get $bucketsMask
  i32.store offset=4
 )
 (func $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:entries" (param $this i32) (param $entries i32)
  local.get $this
  local.get $entries
  i32.store offset=8
  local.get $this
  local.get $entries
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:entriesCapacity" (param $this i32) (param $entriesCapacity i32)
  local.get $this
  local.get $entriesCapacity
  i32.store offset=12
 )
 (func $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:entriesOffset" (param $this i32) (param $entriesOffset i32)
  local.get $this
  local.get $entriesOffset
  i32.store offset=16
 )
 (func $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:entriesCount" (param $this i32) (param $entriesCount i32)
  local.get $this
  local.get $entriesCount
  i32.store offset=20
 )
 (func $~lib/util/hash/HASH<~lib/task/TaskRecord> (param $key i32) (result i32)
  (local $key|1 i32)
  (local $len i32)
  (local $h i32)
  i32.const 0
  drop
  i32.const 1
  drop
  i32.const 4
  i32.const 4
  i32.eq
  drop
  block $~lib/util/hash/hash32|inlined.0 (result i32)
   local.get $key
   local.set $key|1
   i32.const 4
   local.set $len
   i32.const 0
   i32.const 374761393
   i32.add
   local.get $len
   i32.add
   local.set $h
   local.get $h
   local.get $key|1
   i32.const -1028477379
   i32.mul
   i32.add
   local.set $h
   local.get $h
   i32.const 17
   i32.rotl
   i32.const 668265263
   i32.mul
   local.set $h
   local.get $h
   local.get $h
   i32.const 15
   i32.shr_u
   i32.xor
   local.set $h
   local.get $h
   i32.const -2048144777
   i32.mul
   local.set $h
   local.get $h
   local.get $h
   i32.const 13
   i32.shr_u
   i32.xor
   local.set $h
   local.get $h
   i32.const -1028477379
   i32.mul
   local.set $h
   local.get $h
   local.get $h
   i32.const 16
   i32.shr_u
   i32.xor
   local.set $h
   local.get $h
   br $~lib/util/hash/hash32|inlined.0
  end
  return
 )
 (func $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:buckets" (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:bucketsMask" (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $"~lib/map/MapEntry<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:taggedNext" (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $"~lib/map/MapEntry<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:key" (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $"~lib/map/MapEntry<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:value" (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/array/Array<~lib/task-rt/TaskState>#set:buffer (param $this i32) (param $buffer i32)
  local.get $this
  local.get $buffer
  i32.store
  local.get $this
  local.get $buffer
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $~lib/array/Array<~lib/task-rt/TaskState>#set:dataStart (param $this i32) (param $dataStart i32)
  local.get $this
  local.get $dataStart
  i32.store offset=4
 )
 (func $~lib/array/Array<~lib/task-rt/TaskState>#set:byteLength (param $this i32) (param $byteLength i32)
  local.get $this
  local.get $byteLength
  i32.store offset=8
 )
 (func $~lib/array/Array<~lib/task-rt/TaskState>#set:length_ (param $this i32) (param $length_ i32)
  local.get $this
  local.get $length_
  i32.store offset=12
 )
 (func $"~lib/map/MapEntry<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:value" (param $this i32) (param $value i32)
  local.get $this
  local.get $value
  i32.store offset=4
 )
 (func $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:entriesOffset" (param $this i32) (result i32)
  local.get $this
  i32.load offset=16
 )
 (func $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:entriesCapacity" (param $this i32) (result i32)
  local.get $this
  i32.load offset=12
 )
 (func $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:entriesCount" (param $this i32) (result i32)
  local.get $this
  i32.load offset=20
 )
 (func $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:entries" (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $"~lib/map/MapEntry<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:key" (param $this i32) (param $key i32)
  local.get $this
  local.get $key
  i32.store
 )
 (func $"~lib/map/MapEntry<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:taggedNext" (param $this i32) (param $taggedNext i32)
  local.get $this
  local.get $taggedNext
  i32.store offset=8
 )
 (func $~lib/array/Array<~lib/task-rt/TaskState>#get:length_ (param $this i32) (result i32)
  local.get $this
  i32.load offset=12
 )
 (func $~lib/arraybuffer/ArrayBufferView#get:byteLength (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $~lib/arraybuffer/ArrayBufferView#get:buffer (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/rt/itcms/Object#get:rtSize (param $this i32) (result i32)
  local.get $this
  i32.load offset=16
 )
 (func $~lib/rt/itcms/__renew (param $oldPtr i32) (param $size i32) (result i32)
  (local $oldObj i32)
  (local $newPtr i32)
  (local $4 i32)
  (local $5 i32)
  local.get $oldPtr
  i32.const 20
  i32.sub
  local.set $oldObj
  local.get $size
  local.get $oldObj
  call $~lib/rt/common/BLOCK#get:mmInfo
  i32.const 3
  i32.const -1
  i32.xor
  i32.and
  i32.const 16
  i32.sub
  i32.le_u
  if
   local.get $oldObj
   local.get $size
   call $~lib/rt/itcms/Object#set:rtSize
   local.get $oldPtr
   return
  end
  local.get $size
  local.get $oldObj
  call $~lib/rt/itcms/Object#get:rtId
  call $~lib/rt/itcms/__new
  local.set $newPtr
  local.get $newPtr
  local.get $oldPtr
  local.get $size
  local.tee $4
  local.get $oldObj
  call $~lib/rt/itcms/Object#get:rtSize
  local.tee $5
  local.get $4
  local.get $5
  i32.lt_u
  select
  memory.copy
  local.get $newPtr
  return
 )
 (func $~lib/array/Array<~lib/task-rt/TaskState>#get:dataStart (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/task/TaskRecord#get:class_ (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $"~lib/map/Map<i64,~lib/task/TaskRecord>#set:buckets" (param $this i32) (param $buckets i32)
  local.get $this
  local.get $buckets
  i32.store
  local.get $this
  local.get $buckets
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $"~lib/map/Map<i64,~lib/task/TaskRecord>#set:bucketsMask" (param $this i32) (param $bucketsMask i32)
  local.get $this
  local.get $bucketsMask
  i32.store offset=4
 )
 (func $"~lib/map/Map<i64,~lib/task/TaskRecord>#set:entries" (param $this i32) (param $entries i32)
  local.get $this
  local.get $entries
  i32.store offset=8
  local.get $this
  local.get $entries
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $"~lib/map/Map<i64,~lib/task/TaskRecord>#set:entriesCapacity" (param $this i32) (param $entriesCapacity i32)
  local.get $this
  local.get $entriesCapacity
  i32.store offset=12
 )
 (func $"~lib/map/Map<i64,~lib/task/TaskRecord>#set:entriesOffset" (param $this i32) (param $entriesOffset i32)
  local.get $this
  local.get $entriesOffset
  i32.store offset=16
 )
 (func $"~lib/map/Map<i64,~lib/task/TaskRecord>#set:entriesCount" (param $this i32) (param $entriesCount i32)
  local.get $this
  local.get $entriesCount
  i32.store offset=20
 )
 (func $~lib/util/hash/HASH<i32> (param $key i32) (result i32)
  (local $key|1 i32)
  (local $len i32)
  (local $h i32)
  i32.const 0
  drop
  i32.const 0
  drop
  i32.const 0
  drop
  i32.const 4
  i32.const 4
  i32.le_u
  drop
  block $~lib/util/hash/hash32|inlined.1 (result i32)
   local.get $key
   local.set $key|1
   i32.const 4
   local.set $len
   i32.const 0
   i32.const 374761393
   i32.add
   local.get $len
   i32.add
   local.set $h
   local.get $h
   local.get $key|1
   i32.const -1028477379
   i32.mul
   i32.add
   local.set $h
   local.get $h
   i32.const 17
   i32.rotl
   i32.const 668265263
   i32.mul
   local.set $h
   local.get $h
   local.get $h
   i32.const 15
   i32.shr_u
   i32.xor
   local.set $h
   local.get $h
   i32.const -2048144777
   i32.mul
   local.set $h
   local.get $h
   local.get $h
   i32.const 13
   i32.shr_u
   i32.xor
   local.set $h
   local.get $h
   i32.const -1028477379
   i32.mul
   local.set $h
   local.get $h
   local.get $h
   i32.const 16
   i32.shr_u
   i32.xor
   local.set $h
   local.get $h
   br $~lib/util/hash/hash32|inlined.1
  end
  return
 )
 (func $"~lib/map/Map<i32,i32>#get:buckets" (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $"~lib/map/Map<i32,i32>#get:bucketsMask" (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $"~lib/map/MapEntry<i32,i32>#get:taggedNext" (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $"~lib/map/MapEntry<i32,i32>#get:key" (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $"~lib/map/MapEntry<i32,i32>#get:value" (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/task/TaskRecord#get:key (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/task-rt/keyOf (param $family i32) (param $a i32) (result i64)
  local.get $family
  i64.extend_i32_s
  i64.const 32
  i64.shl
  local.get $a
  i64.extend_i32_u
  i64.or
  return
 )
 (func $~lib/util/hash/HASH<i64> (param $key i64) (result i32)
  (local $key|1 i64)
  (local $h i32)
  i32.const 0
  drop
  i32.const 0
  drop
  i32.const 0
  drop
  i32.const 8
  i32.const 4
  i32.le_u
  drop
  i32.const 8
  i32.const 8
  i32.eq
  drop
  block $~lib/util/hash/hash64|inlined.0 (result i32)
   local.get $key
   local.set $key|1
   i32.const 0
   i32.const 374761393
   i32.add
   i32.const 8
   i32.add
   local.set $h
   local.get $h
   local.get $key|1
   i32.wrap_i64
   i32.const -1028477379
   i32.mul
   i32.add
   local.set $h
   local.get $h
   i32.const 17
   i32.rotl
   i32.const 668265263
   i32.mul
   local.set $h
   local.get $h
   local.get $key|1
   i64.const 32
   i64.shr_u
   i32.wrap_i64
   i32.const -1028477379
   i32.mul
   i32.add
   local.set $h
   local.get $h
   i32.const 17
   i32.rotl
   i32.const 668265263
   i32.mul
   local.set $h
   local.get $h
   local.get $h
   i32.const 15
   i32.shr_u
   i32.xor
   local.set $h
   local.get $h
   i32.const -2048144777
   i32.mul
   local.set $h
   local.get $h
   local.get $h
   i32.const 13
   i32.shr_u
   i32.xor
   local.set $h
   local.get $h
   i32.const -1028477379
   i32.mul
   local.set $h
   local.get $h
   local.get $h
   i32.const 16
   i32.shr_u
   i32.xor
   local.set $h
   local.get $h
   br $~lib/util/hash/hash64|inlined.0
  end
  return
 )
 (func $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:buckets" (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:bucketsMask" (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $"~lib/map/MapEntry<i64,~lib/task/TaskRecord>#get:taggedNext" (param $this i32) (result i32)
  local.get $this
  i32.load offset=12
 )
 (func $"~lib/map/MapEntry<i64,~lib/task/TaskRecord>#get:key" (param $this i32) (result i64)
  local.get $this
  i64.load
 )
 (func $"~lib/map/MapEntry<i64,~lib/task/TaskRecord>#set:value" (param $this i32) (param $value i32)
  local.get $this
  local.get $value
  i32.store offset=8
 )
 (func $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:entriesOffset" (param $this i32) (result i32)
  local.get $this
  i32.load offset=16
 )
 (func $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:entriesCapacity" (param $this i32) (result i32)
  local.get $this
  i32.load offset=12
 )
 (func $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:entriesCount" (param $this i32) (result i32)
  local.get $this
  i32.load offset=20
 )
 (func $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:entries" (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $"~lib/map/MapEntry<i64,~lib/task/TaskRecord>#set:key" (param $this i32) (param $key i64)
  local.get $this
  local.get $key
  i64.store
 )
 (func $"~lib/map/MapEntry<i64,~lib/task/TaskRecord>#get:value" (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $"~lib/map/MapEntry<i64,~lib/task/TaskRecord>#set:taggedNext" (param $this i32) (param $taggedNext i32)
  local.get $this
  local.get $taggedNext
  i32.store offset=12
 )
 (func $async-closure-value/outer$Env#get:x (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $async-closure-value/main (result i32)
  i32.const 0
  call $async-closure-value/outer
  global.set $async-closure-value/sink
  i32.const 1
  return
 )
 (func $~lib/rt/__visit_globals (param $0 i32)
  (local $1 i32)
  global.get $~lib/task-rt/families
  local.tee $1
  if
   local.get $1
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $~lib/task-rt/waitingByKey
  local.tee $1
  if
   local.get $1
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $~lib/task-rt/waiters
  local.tee $1
  if
   local.get $1
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $~lib/task-rt/ready
  local.tee $1
  if
   local.get $1
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $async-closure-value/sink
  local.tee $1
  if
   local.get $1
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  i32.const 224
  local.get $0
  call $~lib/rt/itcms/__visit
  i32.const 672
  local.get $0
  call $~lib/rt/itcms/__visit
  i32.const 784
  local.get $0
  call $~lib/rt/itcms/__visit
  i32.const 32
  local.get $0
  call $~lib/rt/itcms/__visit
 )
 (func $~lib/arraybuffer/ArrayBufferView~visit (param $0 i32) (param $1 i32)
  (local $2 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  i32.load
  local.get $1
  call $~lib/rt/itcms/__visit
 )
 (func $~lib/object/Object~visit (param $0 i32) (param $1 i32)
 )
 (func $~lib/task/Task<i32>~visit (param $0 i32) (param $1 i32)
  (local $2 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  i32.load
  local.get $1
  call $~lib/rt/itcms/__visit
 )
 (func $async-closure-value/outer$State~visit (param $0 i32) (param $1 i32)
  (local $2 i32)
  local.get $0
  local.get $1
  call $~lib/task-rt/TaskState~visit
  local.get $0
  i32.load offset=8
  local.get $1
  call $~lib/rt/itcms/__visit
  local.get $0
  i32.load offset=12
  local.get $1
  call $~lib/rt/itcms/__visit
  local.get $0
  i32.load offset=16
  local.get $1
  call $~lib/rt/itcms/__visit
  local.get $0
  i32.load offset=28
  local.get $1
  call $~lib/rt/itcms/__visit
  local.get $0
  i32.load offset=32
  local.get $1
  call $~lib/rt/itcms/__visit
 )
 (func $~lib/task-rt/TaskState~visit (param $0 i32) (param $1 i32)
  (local $2 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  i32.load
  local.get $1
  call $~lib/rt/itcms/__visit
  local.get $0
  i32.load offset=4
  local.get $1
  call $~lib/rt/itcms/__visit
 )
 (func $"~lib/map/Map<i32,i32>#get:entries" (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $"~lib/map/Map<i32,i32>~visit" (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  local.get $1
  call $"~lib/map/Map<i32,i32>#__visit"
 )
 (func $"~lib/map/Map<i64,~lib/task/TaskRecord>~visit" (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  local.get $1
  call $"~lib/map/Map<i64,~lib/task/TaskRecord>#__visit"
 )
 (func $~lib/array/Array<~lib/task-rt/TaskState>#get:buffer (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/array/Array<~lib/task-rt/TaskState>~visit (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  local.get $1
  call $~lib/array/Array<~lib/task-rt/TaskState>#__visit
 )
 (func $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>~visit" (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  local.get $1
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#__visit"
 )
 (func $~lib/function/Function<%28%29=>~lib/task/TaskRecord>#get:_env (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/function/Function<%28%29=>~lib/task/TaskRecord>~visit (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  local.get $1
  call $~lib/function/Function<%28%29=>~lib/task/TaskRecord>#__visit
 )
 (func $async-closure-value/inner$State~visit (param $0 i32) (param $1 i32)
  (local $2 i32)
  local.get $0
  local.get $1
  call $~lib/task-rt/TaskState~visit
  local.get $0
  i32.load offset=8
  local.get $1
  call $~lib/rt/itcms/__visit
  local.get $0
  i32.load offset=12
  local.get $1
  call $~lib/rt/itcms/__visit
  local.get $0
  i32.load offset=24
  local.get $1
  call $~lib/rt/itcms/__visit
  local.get $0
  i32.load offset=28
  local.get $1
  call $~lib/rt/itcms/__visit
 )
 (func $~lib/function/Function<%28async-closure-value/inner$State%29=>void>#get:_env (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/function/Function<%28async-closure-value/inner$State%29=>void>~visit (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  local.get $1
  call $~lib/function/Function<%28async-closure-value/inner$State%29=>void>#__visit
 )
 (func $~lib/function/Function<%28~lib/task/Task<i32>%29=>~lib/task/Task<i32>>#get:_env (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/function/Function<%28~lib/task/Task<i32>%29=>~lib/task/Task<i32>>~visit (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  local.get $1
  call $~lib/function/Function<%28~lib/task/Task<i32>%29=>~lib/task/Task<i32>>#__visit
 )
 (func $~lib/function/Function<%28async-closure-value/outer$State%29=>void>#get:_env (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/function/Function<%28async-closure-value/outer$State%29=>void>~visit (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  local.get $1
  call $~lib/function/Function<%28async-closure-value/outer$State%29=>void>#__visit
 )
 (func $~lib/rt/__visit_members (param $0 i32) (param $1 i32)
  block $invalid
   block $~lib/function/Function<%28async-closure-value/outer$State%29=>void>
    block $~lib/function/Function<%28~lib/task/Task<i32>%29=>~lib/task/Task<i32>>
     block $~lib/function/Function<%28async-closure-value/inner$State%29=>void>
      block $async-closure-value/inner$State
       block $~lib/function/Function<%28%29=>~lib/task/TaskRecord>
        block $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>"
         block $~lib/array/Array<~lib/task-rt/TaskState>
          block $"~lib/map/Map<i64,~lib/task/TaskRecord>"
           block $"~lib/map/Map<i32,i32>"
            block $async-closure-value/outer$Env
             block $~lib/task-rt/TaskEnv
              block $~lib/task-rt/TaskState
               block $async-closure-value/outer$State
                block $~lib/task/TaskRecord
                 block $~lib/task/Task<i32>
                  block $~lib/arraybuffer/ArrayBufferView
                   block $~lib/string/String
                    block $~lib/arraybuffer/ArrayBuffer
                     block $~lib/object/Object
                      local.get $0
                      i32.const 8
                      i32.sub
                      i32.load
                      br_table $~lib/object/Object $~lib/arraybuffer/ArrayBuffer $~lib/string/String $~lib/arraybuffer/ArrayBufferView $~lib/task/Task<i32> $~lib/task/TaskRecord $async-closure-value/outer$State $~lib/task-rt/TaskState $~lib/task-rt/TaskEnv $async-closure-value/outer$Env $"~lib/map/Map<i32,i32>" $"~lib/map/Map<i64,~lib/task/TaskRecord>" $~lib/array/Array<~lib/task-rt/TaskState> $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>" $~lib/function/Function<%28%29=>~lib/task/TaskRecord> $async-closure-value/inner$State $~lib/function/Function<%28async-closure-value/inner$State%29=>void> $~lib/function/Function<%28~lib/task/Task<i32>%29=>~lib/task/Task<i32>> $~lib/function/Function<%28async-closure-value/outer$State%29=>void> $invalid
                     end
                     return
                    end
                    return
                   end
                   return
                  end
                  local.get $0
                  local.get $1
                  call $~lib/arraybuffer/ArrayBufferView~visit
                  return
                 end
                 local.get $0
                 local.get $1
                 call $~lib/task/Task<i32>~visit
                 return
                end
                return
               end
               local.get $0
               local.get $1
               call $async-closure-value/outer$State~visit
               return
              end
              local.get $0
              local.get $1
              call $~lib/task-rt/TaskState~visit
              return
             end
             return
            end
            return
           end
           local.get $0
           local.get $1
           call $"~lib/map/Map<i32,i32>~visit"
           return
          end
          local.get $0
          local.get $1
          call $"~lib/map/Map<i64,~lib/task/TaskRecord>~visit"
          return
         end
         local.get $0
         local.get $1
         call $~lib/array/Array<~lib/task-rt/TaskState>~visit
         return
        end
        local.get $0
        local.get $1
        call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>~visit"
        return
       end
       local.get $0
       local.get $1
       call $~lib/function/Function<%28%29=>~lib/task/TaskRecord>~visit
       return
      end
      local.get $0
      local.get $1
      call $async-closure-value/inner$State~visit
      return
     end
     local.get $0
     local.get $1
     call $~lib/function/Function<%28async-closure-value/inner$State%29=>void>~visit
     return
    end
    local.get $0
    local.get $1
    call $~lib/function/Function<%28~lib/task/Task<i32>%29=>~lib/task/Task<i32>>~visit
    return
   end
   local.get $0
   local.get $1
   call $~lib/function/Function<%28async-closure-value/outer$State%29=>void>~visit
   return
  end
  unreachable
 )
 (func $~start
  memory.size
  i32.const 16
  i32.shl
  global.get $~lib/memory/__heap_base
  i32.sub
  i32.const 1
  i32.shr_u
  global.set $~lib/rt/itcms/threshold
  i32.const 144
  call $~lib/rt/itcms/initLazy
  global.set $~lib/rt/itcms/pinSpace
  i32.const 176
  call $~lib/rt/itcms/initLazy
  global.set $~lib/rt/itcms/toSpace
  i32.const 320
  call $~lib/rt/itcms/initLazy
  global.set $~lib/rt/itcms/fromSpace
 )
 (func $~stack_check
  global.get $~lib/memory/__stack_pointer
  global.get $~lib/memory/__data_end
  i32.lt_s
  if
   i32.const 33872
   i32.const 33920
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
 )
 (func $~lib/task-rt/TaskState#constructor (param $this i32) (result i32)
  (local $1 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  local.get $this
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.const 7
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  global.get $~lib/memory/__stack_pointer
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  call $~lib/object/Object#constructor
  local.tee $this
  i32.store
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $~lib/task-rt/TaskState#set:record
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $~lib/task-rt/TaskState#set:resume
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
 (func $async-closure-value/outer$State#constructor (param $this i32) (param $h i32) (result i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store offset=8
  local.get $this
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 36
   i32.const 6
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  i32.const 0
  call $async-closure-value/outer$State#set:h
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  i32.const 0
  call $async-closure-value/outer$State#set:$env
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  i32.const 0
  call $async-closure-value/outer$State#set:$closureEnv
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  i32.const 0
  call $async-closure-value/outer$State#set:resumePoint
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  i32.const 0
  call $async-closure-value/outer$State#set:result
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  i32.const 0
  call $async-closure-value/outer$State#set:$awaited1
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  i32.const 0
  call $async-closure-value/outer$State#set:handle
  global.get $~lib/memory/__stack_pointer
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  call $~lib/task-rt/TaskState#constructor
  local.tee $this
  i32.store
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  local.get $h
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=8
  local.get $2
  call $async-closure-value/outer$State#set:h
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  i32.const 0
  call $async-closure-value/outer$State#set:resumePoint
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  i32.const 0
  call $async-closure-value/outer$State#set:result
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  i32.const 0
  call $async-closure-value/outer$State#set:$closureEnv
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
 )
 (func $~lib/task/Task<i32>#constructor (param $this i32) (result i32)
  (local $1 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  local.get $this
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 4
   i32.const 4
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  global.get $~lib/memory/__stack_pointer
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  call $~lib/object/Object#constructor
  local.tee $this
  i32.store
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $~lib/task/Task<i32>#set:_record
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
 (func $~lib/task/TaskRecord#constructor (param $this i32) (result i32)
  (local $1 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  local.get $this
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 32
   i32.const 5
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  global.get $~lib/memory/__stack_pointer
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  call $~lib/object/Object#constructor
  local.tee $this
  i32.store
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $~lib/task/TaskRecord#set:class_
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $~lib/task/TaskRecord#set:key
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $~lib/task/TaskRecord#set:payload
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $~lib/task/TaskRecord#set:status
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  f32.const 0
  call $~lib/task/TaskRecord#set:f0
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  f32.const 0
  call $~lib/task/TaskRecord#set:f1
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $~lib/task/TaskRecord#set:tag
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $~lib/task/TaskRecord#set:done
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
 (func $~lib/task-rt/__taskRegister (param $state i32) (result i32)
  (local $make i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $record i32)
  (local $6 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 24
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.const 24
  memory.fill
  global.get $~lib/memory/__stack_pointer
  global.get $~lib/task-rt/recordFactory
  local.tee $make
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $make
  i32.const 0
  i32.ne
  if (result i32)
   global.get $~env
   local.set $3
   global.get $~lib/memory/__stack_pointer
   local.get $make
   local.tee $2
   i32.store offset=4
   local.get $2
   i32.load offset=4
   global.set $~env
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   global.set $~argumentsLength
   local.get $2
   i32.load
   call_indirect (type $6)
   local.tee $4
   i32.store offset=8
   local.get $3
   global.set $~env
   local.get $4
  else
   i32.const 0
   call $~lib/task/TaskRecord#constructor
  end
  local.tee $record
  i32.store offset=12
  local.get $state
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=16
  local.get $6
  local.get $record
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=20
  local.get $6
  call $~lib/task-rt/TaskState#set:record
  local.get $record
  local.set $6
  global.get $~lib/memory/__stack_pointer
  i32.const 24
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $6
  return
 )
 (func $~lib/task-rt/TaskEnv#constructor (param $this i32) (result i32)
  (local $1 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  local.get $this
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.const 8
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  global.get $~lib/memory/__stack_pointer
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  call $~lib/object/Object#constructor
  local.tee $this
  i32.store
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
 (func $async-closure-value/outer$Env#constructor (param $this i32) (result i32)
  (local $1 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  local.get $this
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 4
   i32.const 9
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  global.get $~lib/memory/__stack_pointer
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  call $~lib/task-rt/TaskEnv#constructor
  local.tee $this
  i32.store
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $async-closure-value/outer$Env#set:x
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
 (func $async-closure-value/inner$State#constructor (param $this i32) (param $g i32) (result i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store offset=8
  local.get $this
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 32
   i32.const 15
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  i32.const 0
  call $async-closure-value/inner$State#set:g
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  i32.const 0
  call $async-closure-value/inner$State#set:$env
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  i32.const 0
  call $async-closure-value/inner$State#set:resumePoint
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  i32.const 0
  call $async-closure-value/inner$State#set:result
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  i32.const 0
  call $async-closure-value/inner$State#set:$awaited1
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  i32.const 0
  call $async-closure-value/inner$State#set:handle
  global.get $~lib/memory/__stack_pointer
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  call $~lib/task-rt/TaskState#constructor
  local.tee $this
  i32.store
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  local.get $g
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=8
  local.get $2
  call $async-closure-value/inner$State#set:g
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  i32.const 0
  call $async-closure-value/inner$State#set:resumePoint
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  i32.const 0
  call $async-closure-value/inner$State#set:result
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
 )
 (func $~lib/task-rt/__taskSettled (param $record i32) (result i32)
  (local $1 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $record
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store
  local.get $1
  call $~lib/task/TaskRecord#get:done
  i32.const 0
  i32.ne
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
  return
 )
 (func $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#constructor" (param $this i32) (result i32)
  (local $1 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store offset=8
  local.get $this
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 24
   i32.const 13
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  i32.const 4
  i32.const 4
  i32.mul
  call $~lib/arraybuffer/ArrayBuffer#constructor
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=8
  local.get $1
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:buckets"
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 4
  i32.const 1
  i32.sub
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:bucketsMask"
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  i32.const 4
  block $"~lib/map/ENTRY_SIZE<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>|inlined.0" (result i32)
   i32.const 12
   br $"~lib/map/ENTRY_SIZE<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>|inlined.0"
  end
  i32.mul
  call $~lib/arraybuffer/ArrayBuffer#constructor
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=8
  local.get $1
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:entries"
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 4
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:entriesCapacity"
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:entriesOffset"
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:entriesCount"
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
 (func $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#find" (param $this i32) (param $key i32) (param $hashCode i32) (result i32)
  (local $entry i32)
  (local $taggedNext i32)
  (local $5 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $this
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store
  local.get $5
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:buckets"
  local.get $hashCode
  local.get $this
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store
  local.get $5
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:bucketsMask"
  i32.and
  i32.const 4
  i32.mul
  i32.add
  i32.load
  local.set $entry
  loop $while-continue|0
   local.get $entry
   if
    local.get $entry
    call $"~lib/map/MapEntry<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:taggedNext"
    local.set $taggedNext
    local.get $taggedNext
    i32.const 1
    i32.and
    i32.eqz
    if (result i32)
     local.get $entry
     call $"~lib/map/MapEntry<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:key"
     local.get $key
     i32.eq
    else
     i32.const 0
    end
    if
     local.get $entry
     local.set $5
     global.get $~lib/memory/__stack_pointer
     i32.const 4
     i32.add
     global.set $~lib/memory/__stack_pointer
     local.get $5
     return
    end
    local.get $taggedNext
    i32.const 1
    i32.const -1
    i32.xor
    i32.and
    local.set $entry
    br $while-continue|0
   end
  end
  i32.const 0
  local.set $5
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $5
  return
 )
 (func $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#has" (param $this i32) (param $key i32) (result i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store offset=8
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  local.get $key
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  local.get $key
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=8
  local.get $2
  call $~lib/util/hash/HASH<~lib/task/TaskRecord>
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#find"
  i32.const 0
  i32.ne
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
  return
 )
 (func $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get" (param $this i32) (param $key i32) (result i32)
  (local $entry i32)
  (local $3 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store offset=8
  local.get $this
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  local.get $key
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=4
  local.get $3
  local.get $key
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=8
  local.get $3
  call $~lib/util/hash/HASH<~lib/task/TaskRecord>
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#find"
  local.set $entry
  local.get $entry
  i32.eqz
  if
   i32.const 784
   i32.const 848
   i32.const 105
   i32.const 17
   call $~lib/builtins/abort
   unreachable
  end
  local.get $entry
  call $"~lib/map/MapEntry<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:value"
  local.set $3
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $3
  return
 )
 (func $~lib/array/Array<~lib/task-rt/TaskState>#constructor (param $this i32) (param $length i32) (result i32)
  (local $2 i32)
  (local $3 i32)
  (local $bufferSize i32)
  (local $buffer i32)
  (local $6 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store offset=8
  local.get $this
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 16
   i32.const 12
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  i32.const 0
  call $~lib/array/Array<~lib/task-rt/TaskState>#set:buffer
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  i32.const 0
  call $~lib/array/Array<~lib/task-rt/TaskState>#set:dataStart
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  i32.const 0
  call $~lib/array/Array<~lib/task-rt/TaskState>#set:byteLength
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  i32.const 0
  call $~lib/array/Array<~lib/task-rt/TaskState>#set:length_
  local.get $length
  i32.const 1073741820
  i32.const 2
  i32.shr_u
  i32.gt_u
  if
   i32.const 672
   i32.const 896
   i32.const 70
   i32.const 60
   call $~lib/builtins/abort
   unreachable
  end
  local.get $length
  local.tee $2
  i32.const 8
  local.tee $3
  local.get $2
  local.get $3
  i32.gt_u
  select
  i32.const 2
  i32.shl
  local.set $bufferSize
  global.get $~lib/memory/__stack_pointer
  local.get $bufferSize
  i32.const 1
  call $~lib/rt/itcms/__new
  local.tee $buffer
  i32.store offset=8
  i32.const 2
  global.get $~lib/shared/runtime/Runtime.Incremental
  i32.ne
  drop
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  local.get $buffer
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=12
  local.get $6
  call $~lib/array/Array<~lib/task-rt/TaskState>#set:buffer
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  local.get $buffer
  call $~lib/array/Array<~lib/task-rt/TaskState>#set:dataStart
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  local.get $bufferSize
  call $~lib/array/Array<~lib/task-rt/TaskState>#set:byteLength
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  local.get $length
  call $~lib/array/Array<~lib/task-rt/TaskState>#set:length_
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $6
 )
 (func $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#rehash" (param $this i32) (param $newBucketsMask i32)
  (local $newBucketsCapacity i32)
  (local $newBuckets i32)
  (local $newEntriesCapacity i32)
  (local $newEntries i32)
  (local $oldPtr i32)
  (local $oldEnd i32)
  (local $newPtr i32)
  (local $oldEntry i32)
  (local $newEntry i32)
  (local $oldEntryKey i32)
  (local $newBucketIndex i32)
  (local $newBucketPtrBase i32)
  (local $14 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 20
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.const 20
  memory.fill
  local.get $newBucketsMask
  i32.const 1
  i32.add
  local.set $newBucketsCapacity
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  local.get $newBucketsCapacity
  i32.const 4
  i32.mul
  call $~lib/arraybuffer/ArrayBuffer#constructor
  local.tee $newBuckets
  i32.store
  local.get $newBucketsCapacity
  i32.const 8
  i32.mul
  i32.const 3
  i32.div_s
  local.set $newEntriesCapacity
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  local.get $newEntriesCapacity
  block $"~lib/map/ENTRY_SIZE<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>|inlined.1" (result i32)
   i32.const 12
   br $"~lib/map/ENTRY_SIZE<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>|inlined.1"
  end
  i32.mul
  call $~lib/arraybuffer/ArrayBuffer#constructor
  local.tee $newEntries
  i32.store offset=4
  local.get $this
  local.set $14
  global.get $~lib/memory/__stack_pointer
  local.get $14
  i32.store offset=8
  local.get $14
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:entries"
  local.set $oldPtr
  local.get $oldPtr
  local.get $this
  local.set $14
  global.get $~lib/memory/__stack_pointer
  local.get $14
  i32.store offset=8
  local.get $14
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:entriesOffset"
  block $"~lib/map/ENTRY_SIZE<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>|inlined.2" (result i32)
   i32.const 12
   br $"~lib/map/ENTRY_SIZE<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>|inlined.2"
  end
  i32.mul
  i32.add
  local.set $oldEnd
  local.get $newEntries
  local.set $newPtr
  loop $while-continue|0
   local.get $oldPtr
   local.get $oldEnd
   i32.ne
   if
    local.get $oldPtr
    local.set $oldEntry
    local.get $oldEntry
    call $"~lib/map/MapEntry<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:taggedNext"
    i32.const 1
    i32.and
    i32.eqz
    if
     local.get $newPtr
     local.set $newEntry
     global.get $~lib/memory/__stack_pointer
     local.get $oldEntry
     call $"~lib/map/MapEntry<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:key"
     local.tee $oldEntryKey
     i32.store offset=12
     local.get $newEntry
     local.get $oldEntryKey
     local.set $14
     global.get $~lib/memory/__stack_pointer
     local.get $14
     i32.store offset=8
     local.get $14
     call $"~lib/map/MapEntry<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:key"
     local.get $newEntry
     local.get $oldEntry
     call $"~lib/map/MapEntry<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:value"
     local.set $14
     global.get $~lib/memory/__stack_pointer
     local.get $14
     i32.store offset=8
     local.get $14
     call $"~lib/map/MapEntry<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:value"
     local.get $oldEntryKey
     local.set $14
     global.get $~lib/memory/__stack_pointer
     local.get $14
     i32.store offset=8
     local.get $14
     call $~lib/util/hash/HASH<~lib/task/TaskRecord>
     local.get $newBucketsMask
     i32.and
     local.set $newBucketIndex
     local.get $newBuckets
     local.get $newBucketIndex
     i32.const 4
     i32.mul
     i32.add
     local.set $newBucketPtrBase
     local.get $newEntry
     local.get $newBucketPtrBase
     i32.load
     call $"~lib/map/MapEntry<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:taggedNext"
     local.get $newBucketPtrBase
     local.get $newPtr
     i32.store
     local.get $newPtr
     block $"~lib/map/ENTRY_SIZE<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>|inlined.3" (result i32)
      i32.const 12
      br $"~lib/map/ENTRY_SIZE<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>|inlined.3"
     end
     i32.add
     local.set $newPtr
    end
    local.get $oldPtr
    block $"~lib/map/ENTRY_SIZE<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>|inlined.4" (result i32)
     i32.const 12
     br $"~lib/map/ENTRY_SIZE<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>|inlined.4"
    end
    i32.add
    local.set $oldPtr
    br $while-continue|0
   end
  end
  local.get $this
  local.set $14
  global.get $~lib/memory/__stack_pointer
  local.get $14
  i32.store offset=8
  local.get $14
  local.get $newBuckets
  local.set $14
  global.get $~lib/memory/__stack_pointer
  local.get $14
  i32.store offset=16
  local.get $14
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:buckets"
  local.get $this
  local.set $14
  global.get $~lib/memory/__stack_pointer
  local.get $14
  i32.store offset=8
  local.get $14
  local.get $newBucketsMask
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:bucketsMask"
  local.get $this
  local.set $14
  global.get $~lib/memory/__stack_pointer
  local.get $14
  i32.store offset=8
  local.get $14
  local.get $newEntries
  local.set $14
  global.get $~lib/memory/__stack_pointer
  local.get $14
  i32.store offset=16
  local.get $14
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:entries"
  local.get $this
  local.set $14
  global.get $~lib/memory/__stack_pointer
  local.get $14
  i32.store offset=8
  local.get $14
  local.get $newEntriesCapacity
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:entriesCapacity"
  local.get $this
  local.set $14
  global.get $~lib/memory/__stack_pointer
  local.get $14
  i32.store offset=8
  local.get $14
  local.get $this
  local.set $14
  global.get $~lib/memory/__stack_pointer
  local.get $14
  i32.store offset=16
  local.get $14
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:entriesCount"
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:entriesOffset"
  global.get $~lib/memory/__stack_pointer
  i32.const 20
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set" (param $this i32) (param $key i32) (param $value i32) (result i32)
  (local $hashCode i32)
  (local $entry i32)
  (local $entries i32)
  (local $6 i32)
  (local $bucketPtrBase i32)
  (local $8 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store offset=8
  local.get $key
  local.set $8
  global.get $~lib/memory/__stack_pointer
  local.get $8
  i32.store
  local.get $8
  call $~lib/util/hash/HASH<~lib/task/TaskRecord>
  local.set $hashCode
  local.get $this
  local.set $8
  global.get $~lib/memory/__stack_pointer
  local.get $8
  i32.store
  local.get $8
  local.get $key
  local.set $8
  global.get $~lib/memory/__stack_pointer
  local.get $8
  i32.store offset=4
  local.get $8
  local.get $hashCode
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#find"
  local.set $entry
  local.get $entry
  if
   local.get $entry
   local.get $value
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   call $"~lib/map/MapEntry<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:value"
   i32.const 1
   drop
   local.get $this
   local.get $value
   i32.const 1
   call $~lib/rt/itcms/__link
  else
   local.get $this
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:entriesOffset"
   local.get $this
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:entriesCapacity"
   i32.eq
   if
    local.get $this
    local.set $8
    global.get $~lib/memory/__stack_pointer
    local.get $8
    i32.store
    local.get $8
    local.get $this
    local.set $8
    global.get $~lib/memory/__stack_pointer
    local.get $8
    i32.store offset=4
    local.get $8
    call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:entriesCount"
    local.get $this
    local.set $8
    global.get $~lib/memory/__stack_pointer
    local.get $8
    i32.store offset=4
    local.get $8
    call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:entriesCapacity"
    i32.const 3
    i32.mul
    i32.const 4
    i32.div_s
    i32.lt_s
    if (result i32)
     local.get $this
     local.set $8
     global.get $~lib/memory/__stack_pointer
     local.get $8
     i32.store offset=4
     local.get $8
     call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:bucketsMask"
    else
     local.get $this
     local.set $8
     global.get $~lib/memory/__stack_pointer
     local.get $8
     i32.store offset=4
     local.get $8
     call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:bucketsMask"
     i32.const 1
     i32.shl
     i32.const 1
     i32.or
    end
    call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#rehash"
   end
   global.get $~lib/memory/__stack_pointer
   local.get $this
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:entries"
   local.tee $entries
   i32.store offset=8
   local.get $entries
   local.get $this
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   local.get $this
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store offset=4
   local.get $8
   call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:entriesOffset"
   local.tee $6
   i32.const 1
   i32.add
   call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:entriesOffset"
   local.get $6
   block $"~lib/map/ENTRY_SIZE<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>|inlined.5" (result i32)
    i32.const 12
    br $"~lib/map/ENTRY_SIZE<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>|inlined.5"
   end
   i32.mul
   i32.add
   local.set $entry
   local.get $entry
   local.get $key
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   call $"~lib/map/MapEntry<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:key"
   i32.const 1
   drop
   local.get $this
   local.get $key
   i32.const 1
   call $~lib/rt/itcms/__link
   local.get $entry
   local.get $value
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   call $"~lib/map/MapEntry<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:value"
   i32.const 1
   drop
   local.get $this
   local.get $value
   i32.const 1
   call $~lib/rt/itcms/__link
   local.get $this
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   local.get $this
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store offset=4
   local.get $8
   call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:entriesCount"
   i32.const 1
   i32.add
   call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:entriesCount"
   local.get $this
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:buckets"
   local.get $hashCode
   local.get $this
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:bucketsMask"
   i32.and
   i32.const 4
   i32.mul
   i32.add
   local.set $bucketPtrBase
   local.get $entry
   local.get $bucketPtrBase
   i32.load
   call $"~lib/map/MapEntry<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set:taggedNext"
   local.get $bucketPtrBase
   local.get $entry
   i32.store
  end
  local.get $this
  local.set $8
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $8
  return
 )
 (func $~lib/array/ensureCapacity (param $array i32) (param $newSize i32) (param $alignLog2 i32) (param $canGrow i32)
  (local $oldCapacity i32)
  (local $oldData i32)
  (local $6 i32)
  (local $7 i32)
  (local $newCapacity i32)
  (local $9 i32)
  (local $10 i32)
  (local $11 i32)
  (local $12 i32)
  (local $newData i32)
  (local $14 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $array
  local.set $14
  global.get $~lib/memory/__stack_pointer
  local.get $14
  i32.store
  local.get $14
  call $~lib/arraybuffer/ArrayBufferView#get:byteLength
  local.set $oldCapacity
  local.get $newSize
  local.get $oldCapacity
  local.get $alignLog2
  i32.shr_u
  i32.gt_u
  if
   local.get $newSize
   i32.const 1073741820
   local.get $alignLog2
   i32.shr_u
   i32.gt_u
   if
    i32.const 672
    i32.const 896
    i32.const 19
    i32.const 48
    call $~lib/builtins/abort
    unreachable
   end
   local.get $array
   local.set $14
   global.get $~lib/memory/__stack_pointer
   local.get $14
   i32.store
   local.get $14
   call $~lib/arraybuffer/ArrayBufferView#get:buffer
   local.set $oldData
   local.get $newSize
   local.tee $6
   i32.const 8
   local.tee $7
   local.get $6
   local.get $7
   i32.gt_u
   select
   local.get $alignLog2
   i32.shl
   local.set $newCapacity
   local.get $canGrow
   if
    local.get $oldCapacity
    i32.const 1
    i32.shl
    local.tee $9
    i32.const 1073741820
    local.tee $10
    local.get $9
    local.get $10
    i32.lt_u
    select
    local.tee $11
    local.get $newCapacity
    local.tee $12
    local.get $11
    local.get $12
    i32.gt_u
    select
    local.set $newCapacity
   end
   local.get $oldData
   local.get $newCapacity
   call $~lib/rt/itcms/__renew
   local.set $newData
   i32.const 2
   global.get $~lib/shared/runtime/Runtime.Incremental
   i32.ne
   drop
   local.get $newData
   local.get $oldData
   i32.ne
   if
    local.get $array
    local.get $newData
    i32.store
    local.get $array
    local.get $newData
    i32.store offset=4
    local.get $array
    local.get $newData
    i32.const 0
    call $~lib/rt/itcms/__link
   end
   local.get $array
   local.get $newCapacity
   i32.store offset=8
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/array/Array<~lib/task-rt/TaskState>#push (param $this i32) (param $value i32) (result i32)
  (local $oldLen i32)
  (local $len i32)
  (local $4 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store
  local.get $4
  call $~lib/array/Array<~lib/task-rt/TaskState>#get:length_
  local.set $oldLen
  local.get $oldLen
  i32.const 1
  i32.add
  local.set $len
  local.get $this
  local.get $len
  i32.const 2
  i32.const 1
  call $~lib/array/ensureCapacity
  i32.const 1
  drop
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store
  local.get $4
  call $~lib/array/Array<~lib/task-rt/TaskState>#get:dataStart
  local.get $oldLen
  i32.const 2
  i32.shl
  i32.add
  local.get $value
  i32.store
  local.get $this
  local.get $value
  i32.const 1
  call $~lib/rt/itcms/__link
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store
  local.get $4
  local.get $len
  call $~lib/array/Array<~lib/task-rt/TaskState>#set:length_
  local.get $len
  local.set $4
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $4
  return
 )
 (func $"~lib/map/Map<i64,~lib/task/TaskRecord>#constructor" (param $this i32) (result i32)
  (local $1 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store offset=8
  local.get $this
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 24
   i32.const 11
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  i32.const 4
  i32.const 4
  i32.mul
  call $~lib/arraybuffer/ArrayBuffer#constructor
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=8
  local.get $1
  call $"~lib/map/Map<i64,~lib/task/TaskRecord>#set:buckets"
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 4
  i32.const 1
  i32.sub
  call $"~lib/map/Map<i64,~lib/task/TaskRecord>#set:bucketsMask"
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  i32.const 4
  block $"~lib/map/ENTRY_SIZE<i64,~lib/task/TaskRecord>|inlined.0" (result i32)
   i32.const 16
   br $"~lib/map/ENTRY_SIZE<i64,~lib/task/TaskRecord>|inlined.0"
  end
  i32.mul
  call $~lib/arraybuffer/ArrayBuffer#constructor
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=8
  local.get $1
  call $"~lib/map/Map<i64,~lib/task/TaskRecord>#set:entries"
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 4
  call $"~lib/map/Map<i64,~lib/task/TaskRecord>#set:entriesCapacity"
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $"~lib/map/Map<i64,~lib/task/TaskRecord>#set:entriesOffset"
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $"~lib/map/Map<i64,~lib/task/TaskRecord>#set:entriesCount"
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
 (func $"~lib/map/Map<i32,i32>#find" (param $this i32) (param $key i32) (param $hashCode i32) (result i32)
  (local $entry i32)
  (local $taggedNext i32)
  (local $5 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $this
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store
  local.get $5
  call $"~lib/map/Map<i32,i32>#get:buckets"
  local.get $hashCode
  local.get $this
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store
  local.get $5
  call $"~lib/map/Map<i32,i32>#get:bucketsMask"
  i32.and
  i32.const 4
  i32.mul
  i32.add
  i32.load
  local.set $entry
  loop $while-continue|0
   local.get $entry
   if
    local.get $entry
    call $"~lib/map/MapEntry<i32,i32>#get:taggedNext"
    local.set $taggedNext
    local.get $taggedNext
    i32.const 1
    i32.and
    i32.eqz
    if (result i32)
     local.get $entry
     call $"~lib/map/MapEntry<i32,i32>#get:key"
     local.get $key
     i32.eq
    else
     i32.const 0
    end
    if
     local.get $entry
     local.set $5
     global.get $~lib/memory/__stack_pointer
     i32.const 4
     i32.add
     global.set $~lib/memory/__stack_pointer
     local.get $5
     return
    end
    local.get $taggedNext
    i32.const 1
    i32.const -1
    i32.xor
    i32.and
    local.set $entry
    br $while-continue|0
   end
  end
  i32.const 0
  local.set $5
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $5
  return
 )
 (func $"~lib/map/Map<i32,i32>#has" (param $this i32) (param $key i32) (result i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  local.get $key
  local.get $key
  call $~lib/util/hash/HASH<i32>
  call $"~lib/map/Map<i32,i32>#find"
  i32.const 0
  i32.ne
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
  return
 )
 (func $"~lib/map/Map<i32,i32>#get" (param $this i32) (param $key i32) (result i32)
  (local $entry i32)
  (local $3 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $this
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  local.get $key
  local.get $key
  call $~lib/util/hash/HASH<i32>
  call $"~lib/map/Map<i32,i32>#find"
  local.set $entry
  local.get $entry
  i32.eqz
  if
   i32.const 784
   i32.const 848
   i32.const 105
   i32.const 17
   call $~lib/builtins/abort
   unreachable
  end
  local.get $entry
  call $"~lib/map/MapEntry<i32,i32>#get:value"
  local.set $3
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $3
  return
 )
 (func $~lib/task-rt/familyOf (param $class_ i32) (result i32)
  (local $map i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  global.get $~lib/task-rt/families
  local.tee $map
  i32.store
  local.get $map
  i32.const 0
  i32.ne
  if (result i32)
   local.get $map
   local.set $2
   global.get $~lib/memory/__stack_pointer
   local.get $2
   i32.store offset=4
   local.get $2
   local.get $class_
   call $"~lib/map/Map<i32,i32>#has"
  else
   i32.const 0
  end
  if
   local.get $map
   local.set $2
   global.get $~lib/memory/__stack_pointer
   local.get $2
   i32.store offset=4
   local.get $2
   local.get $class_
   call $"~lib/map/Map<i32,i32>#get"
   local.set $2
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $2
   return
  end
  local.get $class_
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
  return
 )
 (func $"~lib/map/Map<i64,~lib/task/TaskRecord>#find" (param $this i32) (param $key i64) (param $hashCode i32) (result i32)
  (local $entry i32)
  (local $taggedNext i32)
  (local $5 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $this
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store
  local.get $5
  call $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:buckets"
  local.get $hashCode
  local.get $this
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store
  local.get $5
  call $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:bucketsMask"
  i32.and
  i32.const 4
  i32.mul
  i32.add
  i32.load
  local.set $entry
  loop $while-continue|0
   local.get $entry
   if
    local.get $entry
    call $"~lib/map/MapEntry<i64,~lib/task/TaskRecord>#get:taggedNext"
    local.set $taggedNext
    local.get $taggedNext
    i32.const 1
    i32.and
    i32.eqz
    if (result i32)
     local.get $entry
     call $"~lib/map/MapEntry<i64,~lib/task/TaskRecord>#get:key"
     local.get $key
     i64.eq
    else
     i32.const 0
    end
    if
     local.get $entry
     local.set $5
     global.get $~lib/memory/__stack_pointer
     i32.const 4
     i32.add
     global.set $~lib/memory/__stack_pointer
     local.get $5
     return
    end
    local.get $taggedNext
    i32.const 1
    i32.const -1
    i32.xor
    i32.and
    local.set $entry
    br $while-continue|0
   end
  end
  i32.const 0
  local.set $5
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $5
  return
 )
 (func $"~lib/map/Map<i64,~lib/task/TaskRecord>#rehash" (param $this i32) (param $newBucketsMask i32)
  (local $newBucketsCapacity i32)
  (local $newBuckets i32)
  (local $newEntriesCapacity i32)
  (local $newEntries i32)
  (local $oldPtr i32)
  (local $oldEnd i32)
  (local $newPtr i32)
  (local $oldEntry i32)
  (local $newEntry i32)
  (local $oldEntryKey i64)
  (local $newBucketIndex i32)
  (local $newBucketPtrBase i32)
  (local $14 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store offset=8
  local.get $newBucketsMask
  i32.const 1
  i32.add
  local.set $newBucketsCapacity
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  local.get $newBucketsCapacity
  i32.const 4
  i32.mul
  call $~lib/arraybuffer/ArrayBuffer#constructor
  local.tee $newBuckets
  i32.store
  local.get $newBucketsCapacity
  i32.const 8
  i32.mul
  i32.const 3
  i32.div_s
  local.set $newEntriesCapacity
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  local.get $newEntriesCapacity
  block $"~lib/map/ENTRY_SIZE<i64,~lib/task/TaskRecord>|inlined.1" (result i32)
   i32.const 16
   br $"~lib/map/ENTRY_SIZE<i64,~lib/task/TaskRecord>|inlined.1"
  end
  i32.mul
  call $~lib/arraybuffer/ArrayBuffer#constructor
  local.tee $newEntries
  i32.store offset=4
  local.get $this
  local.set $14
  global.get $~lib/memory/__stack_pointer
  local.get $14
  i32.store offset=8
  local.get $14
  call $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:entries"
  local.set $oldPtr
  local.get $oldPtr
  local.get $this
  local.set $14
  global.get $~lib/memory/__stack_pointer
  local.get $14
  i32.store offset=8
  local.get $14
  call $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:entriesOffset"
  block $"~lib/map/ENTRY_SIZE<i64,~lib/task/TaskRecord>|inlined.2" (result i32)
   i32.const 16
   br $"~lib/map/ENTRY_SIZE<i64,~lib/task/TaskRecord>|inlined.2"
  end
  i32.mul
  i32.add
  local.set $oldEnd
  local.get $newEntries
  local.set $newPtr
  loop $while-continue|0
   local.get $oldPtr
   local.get $oldEnd
   i32.ne
   if
    local.get $oldPtr
    local.set $oldEntry
    local.get $oldEntry
    call $"~lib/map/MapEntry<i64,~lib/task/TaskRecord>#get:taggedNext"
    i32.const 1
    i32.and
    i32.eqz
    if
     local.get $newPtr
     local.set $newEntry
     local.get $oldEntry
     call $"~lib/map/MapEntry<i64,~lib/task/TaskRecord>#get:key"
     local.set $oldEntryKey
     local.get $newEntry
     local.get $oldEntryKey
     call $"~lib/map/MapEntry<i64,~lib/task/TaskRecord>#set:key"
     local.get $newEntry
     local.get $oldEntry
     call $"~lib/map/MapEntry<i64,~lib/task/TaskRecord>#get:value"
     local.set $14
     global.get $~lib/memory/__stack_pointer
     local.get $14
     i32.store offset=8
     local.get $14
     call $"~lib/map/MapEntry<i64,~lib/task/TaskRecord>#set:value"
     local.get $oldEntryKey
     call $~lib/util/hash/HASH<i64>
     local.get $newBucketsMask
     i32.and
     local.set $newBucketIndex
     local.get $newBuckets
     local.get $newBucketIndex
     i32.const 4
     i32.mul
     i32.add
     local.set $newBucketPtrBase
     local.get $newEntry
     local.get $newBucketPtrBase
     i32.load
     call $"~lib/map/MapEntry<i64,~lib/task/TaskRecord>#set:taggedNext"
     local.get $newBucketPtrBase
     local.get $newPtr
     i32.store
     local.get $newPtr
     block $"~lib/map/ENTRY_SIZE<i64,~lib/task/TaskRecord>|inlined.3" (result i32)
      i32.const 16
      br $"~lib/map/ENTRY_SIZE<i64,~lib/task/TaskRecord>|inlined.3"
     end
     i32.add
     local.set $newPtr
    end
    local.get $oldPtr
    block $"~lib/map/ENTRY_SIZE<i64,~lib/task/TaskRecord>|inlined.4" (result i32)
     i32.const 16
     br $"~lib/map/ENTRY_SIZE<i64,~lib/task/TaskRecord>|inlined.4"
    end
    i32.add
    local.set $oldPtr
    br $while-continue|0
   end
  end
  local.get $this
  local.set $14
  global.get $~lib/memory/__stack_pointer
  local.get $14
  i32.store offset=8
  local.get $14
  local.get $newBuckets
  local.set $14
  global.get $~lib/memory/__stack_pointer
  local.get $14
  i32.store offset=12
  local.get $14
  call $"~lib/map/Map<i64,~lib/task/TaskRecord>#set:buckets"
  local.get $this
  local.set $14
  global.get $~lib/memory/__stack_pointer
  local.get $14
  i32.store offset=8
  local.get $14
  local.get $newBucketsMask
  call $"~lib/map/Map<i64,~lib/task/TaskRecord>#set:bucketsMask"
  local.get $this
  local.set $14
  global.get $~lib/memory/__stack_pointer
  local.get $14
  i32.store offset=8
  local.get $14
  local.get $newEntries
  local.set $14
  global.get $~lib/memory/__stack_pointer
  local.get $14
  i32.store offset=12
  local.get $14
  call $"~lib/map/Map<i64,~lib/task/TaskRecord>#set:entries"
  local.get $this
  local.set $14
  global.get $~lib/memory/__stack_pointer
  local.get $14
  i32.store offset=8
  local.get $14
  local.get $newEntriesCapacity
  call $"~lib/map/Map<i64,~lib/task/TaskRecord>#set:entriesCapacity"
  local.get $this
  local.set $14
  global.get $~lib/memory/__stack_pointer
  local.get $14
  i32.store offset=8
  local.get $14
  local.get $this
  local.set $14
  global.get $~lib/memory/__stack_pointer
  local.get $14
  i32.store offset=12
  local.get $14
  call $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:entriesCount"
  call $"~lib/map/Map<i64,~lib/task/TaskRecord>#set:entriesOffset"
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $"~lib/map/Map<i64,~lib/task/TaskRecord>#set" (param $this i32) (param $key i64) (param $value i32) (result i32)
  (local $hashCode i32)
  (local $entry i32)
  (local $entries i32)
  (local $6 i32)
  (local $bucketPtrBase i32)
  (local $8 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store offset=8
  local.get $key
  call $~lib/util/hash/HASH<i64>
  local.set $hashCode
  local.get $this
  local.set $8
  global.get $~lib/memory/__stack_pointer
  local.get $8
  i32.store
  local.get $8
  local.get $key
  local.get $hashCode
  call $"~lib/map/Map<i64,~lib/task/TaskRecord>#find"
  local.set $entry
  local.get $entry
  if
   local.get $entry
   local.get $value
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   call $"~lib/map/MapEntry<i64,~lib/task/TaskRecord>#set:value"
   i32.const 1
   drop
   local.get $this
   local.get $value
   i32.const 1
   call $~lib/rt/itcms/__link
  else
   local.get $this
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   call $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:entriesOffset"
   local.get $this
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   call $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:entriesCapacity"
   i32.eq
   if
    local.get $this
    local.set $8
    global.get $~lib/memory/__stack_pointer
    local.get $8
    i32.store
    local.get $8
    local.get $this
    local.set $8
    global.get $~lib/memory/__stack_pointer
    local.get $8
    i32.store offset=4
    local.get $8
    call $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:entriesCount"
    local.get $this
    local.set $8
    global.get $~lib/memory/__stack_pointer
    local.get $8
    i32.store offset=4
    local.get $8
    call $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:entriesCapacity"
    i32.const 3
    i32.mul
    i32.const 4
    i32.div_s
    i32.lt_s
    if (result i32)
     local.get $this
     local.set $8
     global.get $~lib/memory/__stack_pointer
     local.get $8
     i32.store offset=4
     local.get $8
     call $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:bucketsMask"
    else
     local.get $this
     local.set $8
     global.get $~lib/memory/__stack_pointer
     local.get $8
     i32.store offset=4
     local.get $8
     call $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:bucketsMask"
     i32.const 1
     i32.shl
     i32.const 1
     i32.or
    end
    call $"~lib/map/Map<i64,~lib/task/TaskRecord>#rehash"
   end
   global.get $~lib/memory/__stack_pointer
   local.get $this
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   call $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:entries"
   local.tee $entries
   i32.store offset=8
   local.get $entries
   local.get $this
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   local.get $this
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store offset=4
   local.get $8
   call $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:entriesOffset"
   local.tee $6
   i32.const 1
   i32.add
   call $"~lib/map/Map<i64,~lib/task/TaskRecord>#set:entriesOffset"
   local.get $6
   block $"~lib/map/ENTRY_SIZE<i64,~lib/task/TaskRecord>|inlined.5" (result i32)
    i32.const 16
    br $"~lib/map/ENTRY_SIZE<i64,~lib/task/TaskRecord>|inlined.5"
   end
   i32.mul
   i32.add
   local.set $entry
   local.get $entry
   local.get $key
   call $"~lib/map/MapEntry<i64,~lib/task/TaskRecord>#set:key"
   i32.const 0
   drop
   local.get $entry
   local.get $value
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   call $"~lib/map/MapEntry<i64,~lib/task/TaskRecord>#set:value"
   i32.const 1
   drop
   local.get $this
   local.get $value
   i32.const 1
   call $~lib/rt/itcms/__link
   local.get $this
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   local.get $this
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store offset=4
   local.get $8
   call $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:entriesCount"
   i32.const 1
   i32.add
   call $"~lib/map/Map<i64,~lib/task/TaskRecord>#set:entriesCount"
   local.get $this
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   call $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:buckets"
   local.get $hashCode
   local.get $this
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   call $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:bucketsMask"
   i32.and
   i32.const 4
   i32.mul
   i32.add
   local.set $bucketPtrBase
   local.get $entry
   local.get $bucketPtrBase
   i32.load
   call $"~lib/map/MapEntry<i64,~lib/task/TaskRecord>#set:taggedNext"
   local.get $bucketPtrBase
   local.get $entry
   i32.store
  end
  local.get $this
  local.set $8
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $8
  return
 )
 (func $~lib/task-rt/__taskPark (param $state i32) (param $awaited i32)
  (local $byRecord i32)
  (local $list i32)
  (local $byKey i32)
  (local $5 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 24
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.const 24
  memory.fill
  global.get $~lib/memory/__stack_pointer
  global.get $~lib/task-rt/waiters
  local.tee $byRecord
  i32.store
  local.get $byRecord
  i32.const 0
  i32.eq
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#constructor"
   local.tee $byRecord
   i32.store
   local.get $byRecord
   global.set $~lib/task-rt/waiters
  end
  i32.const 0
  local.set $list
  local.get $byRecord
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store offset=4
  local.get $5
  local.get $awaited
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store offset=8
  local.get $5
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#has"
  if
   global.get $~lib/memory/__stack_pointer
   local.get $byRecord
   local.set $5
   global.get $~lib/memory/__stack_pointer
   local.get $5
   i32.store offset=4
   local.get $5
   local.get $awaited
   local.set $5
   global.get $~lib/memory/__stack_pointer
   local.get $5
   i32.store offset=8
   local.get $5
   call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get"
   local.tee $list
   i32.store offset=12
  end
  local.get $list
  i32.const 0
  i32.eq
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.const 0
   call $~lib/array/Array<~lib/task-rt/TaskState>#constructor
   local.tee $list
   i32.store offset=12
   local.get $byRecord
   local.set $5
   global.get $~lib/memory/__stack_pointer
   local.get $5
   i32.store offset=4
   local.get $5
   local.get $awaited
   local.set $5
   global.get $~lib/memory/__stack_pointer
   local.get $5
   i32.store offset=8
   local.get $5
   local.get $list
   local.set $5
   global.get $~lib/memory/__stack_pointer
   local.get $5
   i32.store offset=16
   local.get $5
   call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#set"
   drop
  end
  local.get $list
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store offset=4
  local.get $5
  local.get $state
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store offset=8
  local.get $5
  call $~lib/array/Array<~lib/task-rt/TaskState>#push
  drop
  local.get $awaited
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store offset=4
  local.get $5
  call $~lib/task/TaskRecord#get:class_
  i32.const 0
  i32.ne
  if
   global.get $~lib/memory/__stack_pointer
   global.get $~lib/task-rt/waitingByKey
   local.tee $byKey
   i32.store offset=20
   local.get $byKey
   i32.const 0
   i32.eq
   if
    global.get $~lib/memory/__stack_pointer
    i32.const 0
    call $"~lib/map/Map<i64,~lib/task/TaskRecord>#constructor"
    local.tee $byKey
    i32.store offset=20
    local.get $byKey
    global.set $~lib/task-rt/waitingByKey
   end
   local.get $byKey
   local.set $5
   global.get $~lib/memory/__stack_pointer
   local.get $5
   i32.store offset=4
   local.get $5
   local.get $awaited
   local.set $5
   global.get $~lib/memory/__stack_pointer
   local.get $5
   i32.store offset=16
   local.get $5
   call $~lib/task/TaskRecord#get:class_
   call $~lib/task-rt/familyOf
   local.get $awaited
   local.set $5
   global.get $~lib/memory/__stack_pointer
   local.get $5
   i32.store offset=16
   local.get $5
   call $~lib/task/TaskRecord#get:key
   call $~lib/task-rt/keyOf
   local.get $awaited
   local.set $5
   global.get $~lib/memory/__stack_pointer
   local.get $5
   i32.store offset=8
   local.get $5
   call $"~lib/map/Map<i64,~lib/task/TaskRecord>#set"
   drop
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 24
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $async-closure-value/inner$resume (param $state i32)
  (local $$closureEnvIn i32)
  (local $g i32)
  (local $3 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 20
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.const 20
  memory.fill
  global.get $~lib/memory/__stack_pointer
  local.get $state
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $async-closure-value/inner$State#get:$env
  local.tee $$closureEnvIn
  i32.store offset=4
  global.get $~lib/memory/__stack_pointer
  local.get $state
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $async-closure-value/inner$State#get:g
  local.tee $g
  i32.store offset=8
  local.get $state
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $async-closure-value/inner$State#get:resumePoint
  i32.const 0
  i32.eq
  if
   local.get $state
   local.set $3
   global.get $~lib/memory/__stack_pointer
   local.get $3
   i32.store
   local.get $3
   local.get $g
   local.set $3
   global.get $~lib/memory/__stack_pointer
   local.get $3
   i32.store offset=16
   local.get $3
   call $~lib/task/Task<i32>#get:_record
   local.set $3
   global.get $~lib/memory/__stack_pointer
   local.get $3
   i32.store offset=12
   local.get $3
   call $async-closure-value/inner$State#set:$awaited1
   local.get $state
   local.set $3
   global.get $~lib/memory/__stack_pointer
   local.get $3
   i32.store
   local.get $3
   i32.const 1
   call $async-closure-value/inner$State#set:resumePoint
   local.get $state
   local.set $3
   global.get $~lib/memory/__stack_pointer
   local.get $3
   i32.store offset=12
   local.get $3
   call $async-closure-value/inner$State#get:$awaited1
   local.set $3
   global.get $~lib/memory/__stack_pointer
   local.get $3
   i32.store
   local.get $3
   call $~lib/task-rt/__taskSettled
   i32.eqz
   if
    local.get $state
    local.set $3
    global.get $~lib/memory/__stack_pointer
    local.get $3
    i32.store
    local.get $3
    local.get $state
    local.set $3
    global.get $~lib/memory/__stack_pointer
    local.get $3
    i32.store offset=16
    local.get $3
    call $async-closure-value/inner$State#get:$awaited1
    local.set $3
    global.get $~lib/memory/__stack_pointer
    local.get $3
    i32.store offset=12
    local.get $3
    call $~lib/task-rt/__taskPark
    global.get $~lib/memory/__stack_pointer
    i32.const 20
    i32.add
    global.set $~lib/memory/__stack_pointer
    return
   end
  end
  local.get $state
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $async-closure-value/inner$State#get:resumePoint
  i32.const 1
  i32.eq
  if
   local.get $state
   local.set $3
   global.get $~lib/memory/__stack_pointer
   local.get $3
   i32.store
   local.get $3
   i32.const 0
   call $async-closure-value/inner$State#set:resumePoint
   local.get $state
   local.set $3
   global.get $~lib/memory/__stack_pointer
   local.get $3
   i32.store
   local.get $3
   call $async-closure-value/inner$State#get:$awaited1
   i32.load offset=8
   drop
  end
  local.get $state
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $async-closure-value/inner$State#get:resumePoint
  i32.const 0
  i32.eq
  if
   local.get $state
   local.set $3
   global.get $~lib/memory/__stack_pointer
   local.get $3
   i32.store
   local.get $3
   local.get $$closureEnvIn
   local.set $3
   global.get $~lib/memory/__stack_pointer
   local.get $3
   i32.store offset=12
   local.get $3
   call $async-closure-value/outer$Env#get:x
   call $async-closure-value/inner$State#set:result
   local.get $state
   local.set $3
   global.get $~lib/memory/__stack_pointer
   local.get $3
   i32.store
   local.get $3
   i32.const 2
   call $async-closure-value/inner$State#set:resumePoint
   global.get $~lib/memory/__stack_pointer
   i32.const 20
   i32.add
   global.set $~lib/memory/__stack_pointer
   return
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 20
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $async-closure-value/outer$resume~inner (param $g i32) (result i32)
  (local $$closureEnvIn i32)
  (local $state i32)
  (local $3 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 20
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.const 20
  memory.fill
  global.get $~lib/memory/__stack_pointer
  global.get $~env
  local.tee $$closureEnvIn
  i32.store
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  local.get $g
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=4
  local.get $3
  call $async-closure-value/inner$State#constructor
  local.tee $state
  i32.store offset=8
  local.get $state
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=4
  local.get $3
  local.get $$closureEnvIn
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=12
  local.get $3
  call $async-closure-value/inner$State#set:$env
  local.get $state
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=4
  local.get $3
  i32.const 0
  call $~lib/task/Task<i32>#constructor
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=12
  local.get $3
  call $async-closure-value/inner$State#set:handle
  local.get $state
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=16
  local.get $3
  call $async-closure-value/inner$State#get:handle
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=4
  local.get $3
  local.get $state
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=16
  local.get $3
  call $~lib/task-rt/__taskRegister
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=12
  local.get $3
  call $~lib/task/Task<i32>#set:_record
  local.get $state
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=4
  local.get $3
  i32.const 944
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=12
  local.get $3
  call $~lib/task-rt/TaskState#set:resume
  local.get $state
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=4
  local.get $3
  call $async-closure-value/inner$resume
  local.get $state
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=4
  local.get $3
  call $async-closure-value/inner$State#get:handle
  local.set $3
  global.get $~lib/memory/__stack_pointer
  i32.const 20
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $3
  return
 )
 (func $async-closure-value/outer$resume (param $state i32)
  (local $h i32)
  (local $$closureEnv i32)
  (local $3 i32)
  (local $inner i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 36
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.const 36
  memory.fill
  global.get $~lib/memory/__stack_pointer
  local.get $state
  local.set $8
  global.get $~lib/memory/__stack_pointer
  local.get $8
  i32.store
  local.get $8
  call $async-closure-value/outer$State#get:h
  local.tee $h
  i32.store offset=4
  global.get $~lib/memory/__stack_pointer
  local.get $state
  local.set $8
  global.get $~lib/memory/__stack_pointer
  local.get $8
  i32.store
  local.get $8
  call $async-closure-value/outer$State#get:$closureEnv
  local.tee $$closureEnv
  i32.store offset=8
  local.get $state
  local.set $8
  global.get $~lib/memory/__stack_pointer
  local.get $8
  i32.store
  local.get $8
  call $async-closure-value/outer$State#get:resumePoint
  i32.const 0
  i32.eq
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   call $async-closure-value/outer$Env#constructor
   local.tee $$closureEnv
   i32.store offset=8
  end
  local.get $state
  local.set $8
  global.get $~lib/memory/__stack_pointer
  local.get $8
  i32.store
  local.get $8
  call $async-closure-value/outer$State#get:resumePoint
  i32.const 0
  i32.eq
  if
   local.get $$closureEnv
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   i32.const 1
   call $async-closure-value/outer$Env#set:x
  end
  global.get $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.const 17
  call $~lib/rt/itcms/__new
  local.tee $3
  i32.store offset=12
  local.get $3
  i32.const 2
  i32.store
  local.get $3
  local.get $$closureEnv
  i32.store offset=4
  local.get $3
  local.tee $inner
  i32.store offset=16
  local.get $inner
  drop
  local.get $state
  local.set $8
  global.get $~lib/memory/__stack_pointer
  local.get $8
  i32.store
  local.get $8
  call $async-closure-value/outer$State#get:resumePoint
  i32.const 0
  i32.eq
  if
   local.get $state
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   local.get $h
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store offset=24
   local.get $8
   call $~lib/task/Task<i32>#get:_record
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store offset=20
   local.get $8
   call $async-closure-value/outer$State#set:$awaited1
   local.get $state
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   i32.const 1
   call $async-closure-value/outer$State#set:resumePoint
   local.get $state
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store offset=20
   local.get $8
   call $async-closure-value/outer$State#get:$awaited1
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   call $~lib/task-rt/__taskSettled
   i32.eqz
   if
    local.get $state
    local.set $8
    global.get $~lib/memory/__stack_pointer
    local.get $8
    i32.store
    local.get $8
    local.get $$closureEnv
    local.set $8
    global.get $~lib/memory/__stack_pointer
    local.get $8
    i32.store offset=20
    local.get $8
    call $async-closure-value/outer$State#set:$closureEnv
    local.get $state
    local.set $8
    global.get $~lib/memory/__stack_pointer
    local.get $8
    i32.store
    local.get $8
    local.get $state
    local.set $8
    global.get $~lib/memory/__stack_pointer
    local.get $8
    i32.store offset=24
    local.get $8
    call $async-closure-value/outer$State#get:$awaited1
    local.set $8
    global.get $~lib/memory/__stack_pointer
    local.get $8
    i32.store offset=20
    local.get $8
    call $~lib/task-rt/__taskPark
    global.get $~lib/memory/__stack_pointer
    i32.const 36
    i32.add
    global.set $~lib/memory/__stack_pointer
    return
   end
  end
  local.get $state
  local.set $8
  global.get $~lib/memory/__stack_pointer
  local.get $8
  i32.store
  local.get $8
  call $async-closure-value/outer$State#get:resumePoint
  i32.const 1
  i32.eq
  if
   local.get $state
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   i32.const 0
   call $async-closure-value/outer$State#set:resumePoint
   local.get $state
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   call $async-closure-value/outer$State#get:$awaited1
   i32.load offset=8
   drop
  end
  local.get $state
  local.set $8
  global.get $~lib/memory/__stack_pointer
  local.get $8
  i32.store
  local.get $8
  call $async-closure-value/outer$State#get:resumePoint
  i32.const 0
  i32.eq
  if
   global.get $~env
   local.set $6
   global.get $~lib/memory/__stack_pointer
   local.get $inner
   local.tee $5
   i32.store offset=28
   local.get $5
   i32.load offset=4
   global.set $~env
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.const 1
   global.set $~argumentsLength
   local.get $5
   i32.load
   call_indirect (type $1)
   local.tee $7
   i32.store offset=32
   local.get $6
   global.set $~env
   local.get $7
   drop
  end
  local.get $state
  local.set $8
  global.get $~lib/memory/__stack_pointer
  local.get $8
  i32.store
  local.get $8
  call $async-closure-value/outer$State#get:resumePoint
  i32.const 0
  i32.eq
  if
   local.get $state
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   local.get $$closureEnv
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store offset=20
   local.get $8
   call $async-closure-value/outer$Env#get:x
   call $async-closure-value/outer$State#set:result
   local.get $state
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store
   local.get $8
   i32.const 2
   call $async-closure-value/outer$State#set:resumePoint
   global.get $~lib/memory/__stack_pointer
   i32.const 36
   i32.add
   global.set $~lib/memory/__stack_pointer
   return
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 36
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $async-closure-value/outer (param $h i32) (result i32)
  (local $state i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store offset=8
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  local.get $h
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $async-closure-value/outer$State#constructor
  local.tee $state
  i32.store offset=4
  local.get $state
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  i32.const 0
  call $~lib/task/Task<i32>#constructor
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=8
  local.get $2
  call $async-closure-value/outer$State#set:handle
  local.get $state
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=12
  local.get $2
  call $async-closure-value/outer$State#get:handle
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  local.get $state
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=12
  local.get $2
  call $~lib/task-rt/__taskRegister
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=8
  local.get $2
  call $~lib/task/Task<i32>#set:_record
  local.get $state
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  i32.const 976
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=8
  local.get $2
  call $~lib/task-rt/TaskState#set:resume
  local.get $state
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $async-closure-value/outer$resume
  local.get $state
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $async-closure-value/outer$State#get:handle
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
  return
 )
 (func $"~lib/map/Map<i32,i32>#__visit" (param $this i32) (param $cookie i32)
  (local $entries i32)
  (local $3 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $this
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $"~lib/map/Map<i32,i32>#get:buckets"
  local.get $cookie
  call $~lib/rt/itcms/__visit
  local.get $this
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $"~lib/map/Map<i32,i32>#get:entries"
  local.set $entries
  i32.const 0
  drop
  local.get $entries
  local.get $cookie
  call $~lib/rt/itcms/__visit
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $"~lib/map/Map<i64,~lib/task/TaskRecord>#__visit" (param $this i32) (param $cookie i32)
  (local $entries i32)
  (local $cur i32)
  (local $end i32)
  (local $entry i32)
  (local $val i32)
  (local $7 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $this
  local.set $7
  global.get $~lib/memory/__stack_pointer
  local.get $7
  i32.store
  local.get $7
  call $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:buckets"
  local.get $cookie
  call $~lib/rt/itcms/__visit
  local.get $this
  local.set $7
  global.get $~lib/memory/__stack_pointer
  local.get $7
  i32.store
  local.get $7
  call $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:entries"
  local.set $entries
  i32.const 1
  drop
  local.get $entries
  local.set $cur
  local.get $cur
  local.get $this
  local.set $7
  global.get $~lib/memory/__stack_pointer
  local.get $7
  i32.store
  local.get $7
  call $"~lib/map/Map<i64,~lib/task/TaskRecord>#get:entriesOffset"
  block $"~lib/map/ENTRY_SIZE<i64,~lib/task/TaskRecord>|inlined.6" (result i32)
   i32.const 16
   br $"~lib/map/ENTRY_SIZE<i64,~lib/task/TaskRecord>|inlined.6"
  end
  i32.mul
  i32.add
  local.set $end
  loop $while-continue|0
   local.get $cur
   local.get $end
   i32.lt_u
   if
    local.get $cur
    local.set $entry
    local.get $entry
    call $"~lib/map/MapEntry<i64,~lib/task/TaskRecord>#get:taggedNext"
    i32.const 1
    i32.and
    i32.eqz
    if
     i32.const 0
     drop
     i32.const 1
     drop
     local.get $entry
     call $"~lib/map/MapEntry<i64,~lib/task/TaskRecord>#get:value"
     local.set $val
     i32.const 0
     drop
     local.get $val
     local.get $cookie
     call $~lib/rt/itcms/__visit
    end
    local.get $cur
    block $"~lib/map/ENTRY_SIZE<i64,~lib/task/TaskRecord>|inlined.7" (result i32)
     i32.const 16
     br $"~lib/map/ENTRY_SIZE<i64,~lib/task/TaskRecord>|inlined.7"
    end
    i32.add
    local.set $cur
    br $while-continue|0
   end
  end
  local.get $entries
  local.get $cookie
  call $~lib/rt/itcms/__visit
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/array/Array<~lib/task-rt/TaskState>#__visit (param $this i32) (param $cookie i32)
  (local $cur i32)
  (local $end i32)
  (local $val i32)
  (local $5 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  i32.const 1
  drop
  local.get $this
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store
  local.get $5
  call $~lib/array/Array<~lib/task-rt/TaskState>#get:dataStart
  local.set $cur
  local.get $cur
  local.get $this
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store
  local.get $5
  call $~lib/array/Array<~lib/task-rt/TaskState>#get:length_
  i32.const 2
  i32.shl
  i32.add
  local.set $end
  loop $while-continue|0
   local.get $cur
   local.get $end
   i32.lt_u
   if
    local.get $cur
    i32.load
    local.set $val
    local.get $val
    if
     local.get $val
     local.get $cookie
     call $~lib/rt/itcms/__visit
    end
    local.get $cur
    i32.const 4
    i32.add
    local.set $cur
    br $while-continue|0
   end
  end
  local.get $this
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store
  local.get $5
  call $~lib/array/Array<~lib/task-rt/TaskState>#get:buffer
  local.get $cookie
  call $~lib/rt/itcms/__visit
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#__visit" (param $this i32) (param $cookie i32)
  (local $entries i32)
  (local $cur i32)
  (local $end i32)
  (local $entry i32)
  (local $val i32)
  (local $val|7 i32)
  (local $8 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $this
  local.set $8
  global.get $~lib/memory/__stack_pointer
  local.get $8
  i32.store
  local.get $8
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:buckets"
  local.get $cookie
  call $~lib/rt/itcms/__visit
  local.get $this
  local.set $8
  global.get $~lib/memory/__stack_pointer
  local.get $8
  i32.store
  local.get $8
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:entries"
  local.set $entries
  i32.const 1
  drop
  local.get $entries
  local.set $cur
  local.get $cur
  local.get $this
  local.set $8
  global.get $~lib/memory/__stack_pointer
  local.get $8
  i32.store
  local.get $8
  call $"~lib/map/Map<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:entriesOffset"
  block $"~lib/map/ENTRY_SIZE<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>|inlined.6" (result i32)
   i32.const 12
   br $"~lib/map/ENTRY_SIZE<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>|inlined.6"
  end
  i32.mul
  i32.add
  local.set $end
  loop $while-continue|0
   local.get $cur
   local.get $end
   i32.lt_u
   if
    local.get $cur
    local.set $entry
    local.get $entry
    call $"~lib/map/MapEntry<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:taggedNext"
    i32.const 1
    i32.and
    i32.eqz
    if
     i32.const 1
     drop
     local.get $entry
     call $"~lib/map/MapEntry<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:key"
     local.set $val
     i32.const 0
     drop
     local.get $val
     local.get $cookie
     call $~lib/rt/itcms/__visit
     i32.const 1
     drop
     local.get $entry
     call $"~lib/map/MapEntry<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>#get:value"
     local.set $val|7
     i32.const 0
     drop
     local.get $val|7
     local.get $cookie
     call $~lib/rt/itcms/__visit
    end
    local.get $cur
    block $"~lib/map/ENTRY_SIZE<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>|inlined.7" (result i32)
     i32.const 12
     br $"~lib/map/ENTRY_SIZE<~lib/task/TaskRecord,~lib/array/Array<~lib/task-rt/TaskState>>|inlined.7"
    end
    i32.add
    local.set $cur
    br $while-continue|0
   end
  end
  local.get $entries
  local.get $cookie
  call $~lib/rt/itcms/__visit
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/function/Function<%28%29=>~lib/task/TaskRecord>#__visit (param $this i32) (param $cookie i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $~lib/function/Function<%28%29=>~lib/task/TaskRecord>#get:_env
  local.get $cookie
  call $~lib/rt/itcms/__visit
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/function/Function<%28async-closure-value/inner$State%29=>void>#__visit (param $this i32) (param $cookie i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $~lib/function/Function<%28async-closure-value/inner$State%29=>void>#get:_env
  local.get $cookie
  call $~lib/rt/itcms/__visit
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/function/Function<%28~lib/task/Task<i32>%29=>~lib/task/Task<i32>>#__visit (param $this i32) (param $cookie i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $~lib/function/Function<%28~lib/task/Task<i32>%29=>~lib/task/Task<i32>>#get:_env
  local.get $cookie
  call $~lib/rt/itcms/__visit
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/function/Function<%28async-closure-value/outer$State%29=>void>#__visit (param $this i32) (param $cookie i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $~lib/function/Function<%28async-closure-value/outer$State%29=>void>#get:_env
  local.get $cookie
  call $~lib/rt/itcms/__visit
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/object/Object#constructor (param $this i32) (result i32)
  (local $1 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $this
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.const 0
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
 (func $async-closure-value/outer$State#get:handle (param $this i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $this
  i32.load offset=32
  local.tee $1
  i32.store
  local.get $1
  if (result i32)
   local.get $1
  else
   i32.const 432
   i32.const 560
   i32.const 15
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
 )
 (func $async-closure-value/inner$State#get:handle (param $this i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $this
  i32.load offset=28
  local.tee $1
  i32.store
  local.get $1
  if (result i32)
   local.get $1
  else
   i32.const 432
   i32.const 560
   i32.const 17
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
 )
 (func $~lib/task/Task<i32>#get:_record (param $this i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $this
  i32.load
  local.tee $1
  i32.store
  local.get $1
  if (result i32)
   local.get $1
  else
   i32.const 432
   i32.const 624
   i32.const 89
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
 )
 (func $async-closure-value/inner$State#get:$awaited1 (param $this i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $this
  i32.load offset=24
  local.tee $1
  i32.store
  local.get $1
  if (result i32)
   local.get $1
  else
   i32.const 432
   i32.const 560
   i32.const 17
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
 )
 (func $~lib/arraybuffer/ArrayBuffer#constructor (param $this i32) (param $length i32) (result i32)
  (local $buffer i32)
  (local $3 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $length
  i32.const 1073741820
  i32.gt_u
  if
   i32.const 672
   i32.const 720
   i32.const 52
   i32.const 43
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  local.get $length
  i32.const 1
  call $~lib/rt/itcms/__new
  local.tee $buffer
  i32.store
  i32.const 2
  global.get $~lib/shared/runtime/Runtime.Incremental
  i32.ne
  drop
  local.get $buffer
  local.set $3
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $3
  return
 )
 (func $async-closure-value/outer$State#get:$awaited1 (param $this i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $this
  i32.load offset=28
  local.tee $1
  i32.store
  local.get $1
  if (result i32)
   local.get $1
  else
   i32.const 432
   i32.const 560
   i32.const 15
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
 )
)
