(module
 (type $0 (func (param i32 i32)))
 (type $1 (func (param i32) (result i32)))
 (type $2 (func))
 (type $3 (func (result i32)))
 (type $4 (func (param i32 i32) (result i32)))
 (type $5 (func (param i32 i32 i32 i32)))
 (type $6 (func (param i32 i32 i64) (result i32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (global $~lib/native/ASC_FEATURE_THREADS i32 (i32.const 1))
 (global $~lib/rt/common/ARENA_END (mut i32) (i32.const 0))
 (global $~lib/rt/common/HEAP_BASE (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/total (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/state (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/white (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/visitCount (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/fromSpace (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/toSpace (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/pinSpace (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/iter (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/threshold (mut i32) (i32.const 0))
 (global $~lib/rt/tlsf/ROOT (mut i32) (i32.const 0))
 (global $~lib/memory/__data_end i32 (i32.const 172))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 32940))
 (global $~lib/memory/__heap_base i32 (i32.const 32940))
 (memory $0 1 10 shared)
 (data $0 (i32.const 16) "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $1 (i32.const 48) "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $2 (i32.const 80) "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $3 (i32.const 108) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00t\00l\00s\00f\00.\00t\00s\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "__arenaInit" (func $~lib/rt/tlsf/__arenaInit))
 (export "__arenaHeapBase" (func $~lib/rt/common/__arenaHeapBase))
 (export "__arenaEnd" (func $~lib/rt/common/__arenaEnd))
 (export "memory" (memory $0))
 (export "__start" (func $__start))
 (func $features/threads/testAtomic
  i32.const 0
  i32.atomic.load8_u
  drop
  i32.const 0
  i32.atomic.load16_u
  drop
  i32.const 0
  i32.atomic.load
  drop
  i32.const 0
  i64.atomic.load8_u
  drop
  i32.const 0
  i64.atomic.load16_u
  drop
  i32.const 0
  i64.atomic.load32_u
  drop
  i32.const 0
  i64.atomic.load
  drop
  i32.const 0
  i64.atomic.load offset=8
  drop
  i32.const 0
  i32.const 1
  i32.atomic.store8
  i32.const 0
  i32.const 1
  i32.atomic.store16
  i32.const 0
  i32.const 1
  i32.atomic.store
  i32.const 0
  i64.const 1
  i64.atomic.store8
  i32.const 0
  i64.const 1
  i64.atomic.store16
  i32.const 0
  i64.const 1
  i64.atomic.store32
  i32.const 0
  i64.const 1
  i64.atomic.store
  i32.const 0
  i64.const 1
  i64.atomic.store offset=8
  i32.const 0
  i32.const 1
  i32.atomic.rmw8.add_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw16.add_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw.add
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw8.add_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw16.add_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw32.add_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw.add
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw.add offset=8
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw8.sub_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw16.sub_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw.sub
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw8.sub_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw16.sub_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw32.sub_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw.sub
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw.sub offset=8
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw8.and_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw16.and_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw.and
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw8.and_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw16.and_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw32.and_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw.and
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw.and offset=8
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw8.or_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw16.or_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw.or
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw8.or_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw16.or_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw32.or_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw.or
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw.or offset=8
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw8.xor_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw16.xor_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw.xor
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw8.xor_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw16.xor_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw32.xor_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw.xor
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw.xor offset=8
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw8.xchg_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw16.xchg_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw.xchg
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw8.xchg_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw16.xchg_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw32.xchg_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw.xchg
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw.xchg offset=8
  drop
  i32.const 0
  i32.const 1
  i32.const 2
  i32.atomic.rmw8.cmpxchg_u
  drop
  i32.const 0
  i32.const 1
  i32.const 2
  i32.atomic.rmw16.cmpxchg_u
  drop
  i32.const 0
  i32.const 1
  i32.const 2
  i32.atomic.rmw.cmpxchg
  drop
  i32.const 0
  i64.const 1
  i64.const 2
  i64.atomic.rmw8.cmpxchg_u
  drop
  i32.const 0
  i64.const 1
  i64.const 2
  i64.atomic.rmw16.cmpxchg_u
  drop
  i32.const 0
  i64.const 1
  i64.const 2
  i64.atomic.rmw32.cmpxchg_u
  drop
  i32.const 0
  i64.const 1
  i64.const 2
  i64.atomic.rmw.cmpxchg
  drop
  i32.const 0
  i64.const 1
  i64.const 2
  i64.atomic.rmw.cmpxchg offset=8
  drop
 )
 (func $features/threads/testAtomicAsm
  i32.const 0
  i32.atomic.load8_u
  drop
  i32.const 0
  i32.atomic.load16_u
  drop
  i32.const 0
  i32.atomic.load
  drop
  i32.const 0
  i64.atomic.load8_u
  drop
  i32.const 0
  i64.atomic.load16_u
  drop
  i32.const 0
  i64.atomic.load32_u
  drop
  i32.const 0
  i64.atomic.load
  drop
  i32.const 0
  i32.const 1
  i32.atomic.store8
  i32.const 0
  i32.const 1
  i32.atomic.store16
  i32.const 0
  i32.const 1
  i32.atomic.store
  i32.const 0
  i64.const 1
  i64.atomic.store8
  i32.const 0
  i64.const 1
  i64.atomic.store16
  i32.const 0
  i64.const 1
  i64.atomic.store32
  i32.const 0
  i64.const 1
  i64.atomic.store
  i32.const 0
  i32.const 1
  i32.atomic.rmw8.add_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw16.add_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw.add
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw8.add_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw16.add_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw32.add_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw.add
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw8.sub_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw16.sub_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw.sub
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw8.sub_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw16.sub_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw32.sub_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw.sub
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw8.and_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw16.and_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw.and
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw8.and_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw16.and_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw32.and_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw.and
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw8.or_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw16.or_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw.or
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw8.or_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw16.or_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw32.or_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw.or
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw8.xor_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw16.xor_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw.xor
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw8.xor_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw16.xor_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw32.xor_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw.xor
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw8.xchg_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw16.xchg_u
  drop
  i32.const 0
  i32.const 1
  i32.atomic.rmw.xchg
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw8.xchg_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw16.xchg_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw32.xchg_u
  drop
  i32.const 0
  i64.const 1
  i64.atomic.rmw.xchg
  drop
  i32.const 0
  i32.const 1
  i32.const 2
  i32.atomic.rmw8.cmpxchg_u
  drop
  i32.const 0
  i32.const 1
  i32.const 2
  i32.atomic.rmw16.cmpxchg_u
  drop
  i32.const 0
  i32.const 1
  i32.const 2
  i32.atomic.rmw.cmpxchg
  drop
  i32.const 0
  i64.const 1
  i64.const 2
  i64.atomic.rmw8.cmpxchg_u
  drop
  i32.const 0
  i64.const 1
  i64.const 2
  i64.atomic.rmw16.cmpxchg_u
  drop
  i32.const 0
  i64.const 1
  i64.const 2
  i64.atomic.rmw32.cmpxchg_u
  drop
  i32.const 0
  i64.const 1
  i64.const 2
  i64.atomic.rmw.cmpxchg
  drop
 )
 (func $start:features/threads
  i32.const 1
  drop
  call $features/threads/testAtomic
  call $features/threads/testAtomicAsm
 )
 (func $~lib/rt/common/enterArena (param $base i32) (param $size i32) (result i32)
  (local $start i32)
  (local $end i32)
  (local $reserve i32)
  (local $heap i32)
  local.get $base
  i32.const 15
  i32.add
  i32.const 15
  i32.const -1
  i32.xor
  i32.and
  local.set $start
  local.get $base
  local.get $size
  i32.add
  i32.const 15
  i32.const -1
  i32.xor
  i32.and
  local.set $end
  global.get $~lib/memory/__heap_base
  global.get $~lib/memory/__data_end
  i32.sub
  local.set $reserve
  local.get $start
  local.get $reserve
  i32.add
  i32.const 15
  i32.add
  i32.const 15
  i32.const -1
  i32.xor
  i32.and
  local.set $heap
  local.get $end
  local.get $heap
  i32.const 1024
  i32.add
  i32.lt_u
  if
   unreachable
  end
  local.get $end
  global.set $~lib/rt/common/ARENA_END
  local.get $heap
  global.set $~lib/rt/common/HEAP_BASE
  local.get $heap
  return
 )
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
 (func $~lib/rt/itcms/__arenaPlaceState (param $heapBase i32) (param $arenaEnd i32) (result i32)
  (local $stride i32)
  i32.const 20
  local.set $stride
  i32.const 0
  global.set $~lib/rt/itcms/total
  i32.const 0
  global.set $~lib/rt/itcms/state
  i32.const 0
  global.set $~lib/rt/itcms/white
  i32.const 0
  global.set $~lib/rt/itcms/visitCount
  local.get $heapBase
  call $~lib/rt/itcms/initLazy
  global.set $~lib/rt/itcms/fromSpace
  local.get $heapBase
  local.get $stride
  i32.add
  call $~lib/rt/itcms/initLazy
  global.set $~lib/rt/itcms/toSpace
  local.get $heapBase
  i32.const 2
  local.get $stride
  i32.mul
  i32.add
  call $~lib/rt/itcms/initLazy
  global.set $~lib/rt/itcms/pinSpace
  global.get $~lib/rt/itcms/toSpace
  global.set $~lib/rt/itcms/iter
  local.get $arenaEnd
  local.get $heapBase
  i32.sub
  i32.const 1
  i32.shr_u
  global.set $~lib/rt/itcms/threshold
  local.get $heapBase
  i32.const 3
  local.get $stride
  i32.mul
  i32.add
  return
 )
 (func $~lib/rt/tlsf/Root#set:flMap (param $this i32) (param $flMap i32)
  local.get $this
  local.get $flMap
  i32.store
 )
 (func $~lib/rt/common/BLOCK#get:mmInfo (param $this i32) (result i32)
  local.get $this
  i32.load
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
   i32.const 128
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
   i32.const 128
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
   i32.const 128
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
   i32.const 128
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
   i32.const 128
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
    i32.const 128
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
   i32.const 128
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
   i32.const 128
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
   i32.const 128
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
   i32.const 128
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
    i32.const 128
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
    i32.const 128
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
 (func $~lib/rt/tlsf/initializeAt (param $rootOffset i32) (param $memEnd i32)
  (local $root i32)
  (local $root|3 i32)
  (local $tail i32)
  (local $fl i32)
  (local $root|6 i32)
  (local $fl|7 i32)
  (local $slMap i32)
  (local $sl i32)
  (local $root|10 i32)
  (local $fl|11 i32)
  (local $sl|12 i32)
  (local $head i32)
  i32.const 0
  drop
  local.get $rootOffset
  local.set $root
  local.get $root
  i32.const 0
  call $~lib/rt/tlsf/Root#set:flMap
  local.get $root
  local.set $root|3
  i32.const 0
  local.set $tail
  local.get $root|3
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
    local.set $root|6
    local.get $fl
    local.set $fl|7
    i32.const 0
    local.set $slMap
    local.get $root|6
    local.get $fl|7
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
      local.set $root|10
      local.get $fl
      local.set $fl|11
      local.get $sl
      local.set $sl|12
      i32.const 0
      local.set $head
      local.get $root|10
      local.get $fl|11
      i32.const 4
      i32.shl
      local.get $sl|12
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
  local.get $root
  global.set $~lib/rt/tlsf/ROOT
  local.get $root
  local.get $rootOffset
  i32.const 1572
  i32.add
  local.get $memEnd
  i64.extend_i32_u
  call $~lib/rt/tlsf/addMemory
  drop
 )
 (func $~lib/rt/tlsf/__arenaInit (param $base i32) (param $size i32)
  (local $heap i32)
  (local $rootOffset i32)
  local.get $base
  local.get $size
  call $~lib/rt/common/enterArena
  local.set $heap
  local.get $heap
  global.get $~lib/rt/common/ARENA_END
  call $~lib/rt/itcms/__arenaPlaceState
  i32.const 15
  i32.add
  i32.const 15
  i32.const -1
  i32.xor
  i32.and
  local.set $rootOffset
  local.get $rootOffset
  global.get $~lib/rt/common/ARENA_END
  call $~lib/rt/tlsf/initializeAt
  local.get $heap
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/rt/common/__arenaHeapBase (result i32)
  global.get $~lib/rt/common/HEAP_BASE
  return
 )
 (func $~lib/rt/common/__arenaEnd (result i32)
  global.get $~lib/rt/common/ARENA_END
  return
 )
 (func $~start
  call $start:features/threads
  global.get $~lib/memory/__heap_base
  global.set $~lib/rt/common/HEAP_BASE
  i32.const 16
  call $~lib/rt/itcms/initLazy
  global.set $~lib/rt/itcms/fromSpace
  i32.const 48
  call $~lib/rt/itcms/initLazy
  global.set $~lib/rt/itcms/toSpace
  i32.const 80
  call $~lib/rt/itcms/initLazy
  global.set $~lib/rt/itcms/pinSpace
  memory.size
  i32.const 16
  i32.shl
  global.get $~lib/rt/common/HEAP_BASE
  i32.sub
  i32.const 1
  i32.shr_u
  global.set $~lib/rt/itcms/threshold
 )
 (func $__start (result i32)
  call $~start
  i32.const 0
 )
)
