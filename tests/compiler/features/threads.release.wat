(module
 (type $0 (func (result i32)))
 (type $1 (func (param i32 i32)))
 (type $2 (func (param i32) (result i32)))
 (type $3 (func))
 (type $4 (func (param i32 i32 i32 i32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (global $~lib/rt/common/ARENA_END (mut i32) (i32.const 0))
 (global $~lib/rt/common/ARENA_BASE_CONFIGURED (mut i32) (i32.const 0))
 (global $~lib/rt/common/HEAP_BASE (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/ARENA_FROM_SPACE (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/fromSpace (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/ARENA_TO_SPACE (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/toSpace (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/ARENA_PIN_SPACE (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/pinSpace (mut i32) (i32.const 0))
 (global $~lib/thread/__heapBase (mut i32) (i32.const 0))
 (global $~lib/thread/__controlBase (mut i32) (i32.const 0))
 (global $~lib/thread/__controlStride (mut i32) (i32.const 0))
 (global $~lib/thread/__ringCapacity (mut i32) (i32.const 0))
 (global $~lib/thread/__executorTotal (mut i32) (i32.const 0))
 (global $~lib/thread/requestBase (mut i32) (i32.const 0))
 (global $~lib/thread/freeRingBase (mut i32) (i32.const 0))
 (memory $0 1 10 shared)
 (data $3 (i32.const 108) "<")
 (data $3.1 (i32.const 120) "\02\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00t\00l\00s\00f\00.\00t\00s")
 (data $4 (i32.const 172) "\1c")
 (data $4.1 (i32.const 184) "\04\00\00\00\08\00\00\00\01")
 (export "__arenaInit" (func $~lib/rt/tlsf/__arenaInit))
 (export "__arenaHeapBase" (func $~lib/rt/common/__arenaHeapBase))
 (export "__arenaEnd" (func $~lib/rt/common/__arenaEnd))
 (export "__threadInit" (func $~lib/thread/__threadInitPlain))
 (export "__mainArenaBase" (func $~lib/thread/__mainArenaBase))
 (export "__mainArenaSize" (func $~lib/thread/__mainArenaSize))
 (export "__heapBase" (global $~lib/thread/__heapBase))
 (export "__controlBase" (global $~lib/thread/__controlBase))
 (export "__controlStride" (global $~lib/thread/__controlStride))
 (export "__ringCapacity" (global $~lib/thread/__ringCapacity))
 (export "__executorTotal" (global $~lib/thread/__executorTotal))
 (export "memory" (memory $0))
 (export "__start" (func $__start))
 (func $~lib/rt/tlsf/removeBlock (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  local.get $1
  i32.load
  local.tee $3
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
  local.get $3
  i32.const -4
  i32.and
  local.tee $3
  i32.const 12
  i32.lt_u
  if
   i32.const 0
   i32.const 128
   i32.const 270
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $3
  i32.const 256
  i32.lt_u
  if (result i32)
   local.get $3
   i32.const 4
   i32.shr_u
  else
   i32.const 31
   i32.const 1073741820
   local.get $3
   local.get $3
   i32.const 1073741820
   i32.ge_u
   select
   local.tee $3
   i32.clz
   i32.sub
   local.tee $4
   i32.const 7
   i32.sub
   local.set $2
   local.get $3
   local.get $4
   i32.const 4
   i32.sub
   i32.shr_u
   i32.const 16
   i32.xor
  end
  local.tee $3
  i32.const 16
  i32.lt_u
  local.get $2
  i32.const 23
  i32.lt_u
  i32.and
  i32.eqz
  if
   i32.const 0
   i32.const 128
   i32.const 284
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  i32.load offset=8
  local.set $5
  local.get $1
  i32.load offset=4
  local.tee $4
  if
   local.get $4
   local.get $5
   i32.store offset=8
  end
  local.get $5
  if
   local.get $5
   local.get $4
   i32.store offset=4
  end
  local.get $1
  local.get $0
  local.get $2
  i32.const 4
  i32.shl
  local.get $3
  i32.add
  i32.const 2
  i32.shl
  i32.add
  local.tee $1
  i32.load offset=96
  i32.eq
  if
   local.get $1
   local.get $5
   i32.store offset=96
   local.get $5
   i32.eqz
   if
    local.get $0
    local.get $2
    i32.const 2
    i32.shl
    i32.add
    local.tee $1
    i32.load offset=4
    i32.const -2
    local.get $3
    i32.rotl
    i32.and
    local.set $3
    local.get $1
    local.get $3
    i32.store offset=4
    local.get $3
    i32.eqz
    if
     local.get $0
     local.get $0
     i32.load
     i32.const -2
     local.get $2
     i32.rotl
     i32.and
     i32.store
    end
   end
  end
 )
 (func $~lib/thread/__threadInitPlain (param $0 i32) (result i32)
  global.get $~lib/thread/__controlBase
  if
   i32.const 0
   return
  end
  local.get $0
  call $~lib/thread/__carveThreadLayout
 )
 (func $~lib/thread/__mainArenaSize (result i32)
  (local $0 i32)
  global.get $~lib/thread/__controlBase
  i32.eqz
  if
   i32.const 0
   return
  end
  global.get $~lib/thread/__ringCapacity
  i32.const 3
  i32.shl
  local.tee $0
  global.get $~lib/thread/__controlBase
  local.get $0
  i32.add
  i32.add
  i32.const 96
  i32.add
  i32.atomic.load
 )
 (func $~lib/thread/__mainArenaBase (result i32)
  (local $0 i32)
  global.get $~lib/thread/__controlBase
  i32.eqz
  if
   i32.const 0
   return
  end
  global.get $~lib/thread/__ringCapacity
  i32.const 3
  i32.shl
  local.tee $0
  global.get $~lib/thread/__controlBase
  local.get $0
  i32.add
  i32.add
  i32.const 92
  i32.add
  i32.atomic.load
 )
 (func $~lib/thread/__carveThreadLayout (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  i32.const 1024
  local.get $0
  local.get $0
  i32.const 0
  i32.le_s
  select
  local.tee $4
  i32.const 4
  i32.shl
  local.tee $0
  i32.const 63
  i32.add
  i32.const -16
  i32.and
  local.set $2
  local.get $0
  local.get $2
  i32.add
  local.get $4
  i32.const 2
  i32.shl
  i32.add
  i32.const 76
  i32.add
  local.tee $5
  i32.const 65536
  i32.add
  local.tee $3
  i32.const 4259839
  i32.add
  i32.const 16
  i32.shr_u
  local.tee $6
  memory.size
  local.tee $7
  i32.gt_s
  if (result i32)
   local.get $6
   local.get $7
   i32.sub
   memory.grow
   i32.const 0
   i32.lt_s
  else
   i32.const 0
  end
  if
   i32.const -2
   return
  end
  i32.const 65536
  i32.const 0
  local.get $5
  memory.fill
  i32.const 65536
  global.set $~lib/thread/__controlBase
  i32.const 65536
  global.set $~lib/thread/__heapBase
  local.get $2
  global.set $~lib/thread/__controlStride
  local.get $4
  global.set $~lib/thread/__ringCapacity
  i32.const 1
  global.set $~lib/thread/__executorTotal
  local.get $2
  i32.const 65600
  i32.add
  global.set $~lib/thread/requestBase
  global.get $~lib/thread/requestBase
  local.get $0
  i32.add
  global.set $~lib/thread/freeRingBase
  i32.const 65536
  i32.const 1414025796
  i32.atomic.store
  i32.const 65540
  i32.const 1
  i32.atomic.store
  i32.const 65544
  local.get $2
  i32.atomic.store
  i32.const 65548
  local.get $4
  i32.atomic.store
  i32.const 65552
  local.get $4
  i32.atomic.store
  loop $for-loop|0
   local.get $1
   i32.const 0
   i32.le_s
   if
    i32.const 0
    local.set $0
    local.get $1
    local.get $2
    i32.mul
    i32.const 65600
    i32.add
    local.tee $6
    i32.const 0
    i32.atomic.store
    local.get $6
    i32.const 4
    i32.add
    i32.const 0
    i32.atomic.store
    local.get $6
    i32.const 8
    i32.add
    local.get $4
    i32.atomic.store
    loop $for-loop|00
     local.get $0
     local.get $4
     i32.lt_s
     if
      local.get $6
      i32.const 12
      i32.add
      local.get $0
      i32.const 3
      i32.shl
      i32.add
      local.tee $5
      i32.const 0
      i32.atomic.store
      local.get $5
      i32.const 4
      i32.add
      local.get $0
      i32.atomic.store
      local.get $0
      i32.const 1
      i32.add
      local.set $0
      br $for-loop|00
     end
    end
    i32.const 0
    local.set $0
    local.get $6
    global.get $~lib/thread/__ringCapacity
    i32.const 1
    i32.shl
    local.tee $5
    i32.const 3
    i32.add
    i32.const 2
    i32.shl
    i32.add
    local.tee $7
    i32.const 0
    i32.atomic.store
    local.get $7
    i32.const 4
    i32.add
    i32.const 0
    i32.atomic.store
    local.get $7
    i32.const 8
    i32.add
    local.get $4
    i32.atomic.store
    loop $for-loop|01
     local.get $0
     local.get $4
     i32.lt_s
     if
      local.get $7
      i32.const 12
      i32.add
      local.get $0
      i32.const 3
      i32.shl
      i32.add
      local.tee $8
      i32.const 0
      i32.atomic.store
      local.get $8
      i32.const 4
      i32.add
      local.get $0
      i32.atomic.store
      local.get $0
      i32.const 1
      i32.add
      local.set $0
      br $for-loop|01
     end
    end
    local.get $5
    i32.const 2
    i32.shl
    local.tee $0
    local.get $6
    i32.add
    local.get $0
    i32.add
    i32.const 24
    i32.add
    local.tee $0
    i32.const 0
    i32.atomic.store
    local.get $0
    i32.const 4
    i32.add
    local.get $1
    if (result i32)
     local.get $3
     local.get $1
     i32.const 1
     i32.sub
     i32.const 20
     i32.shl
     i32.add
    else
     i32.const 0
    end
    i32.atomic.store
    local.get $0
    i32.const 8
    i32.add
    i32.const 1048576
    i32.const 0
    local.get $1
    select
    i32.atomic.store
    local.get $0
    i32.const 12
    i32.add
    local.get $1
    i32.eqz
    i32.atomic.store
    local.get $0
    i32.const 16
    i32.add
    i32.const -1
    i32.atomic.store
    local.get $0
    i32.const 20
    i32.add
    i32.const 0
    i32.atomic.store
    local.get $1
    i32.const 1
    i32.add
    local.set $1
    br $for-loop|0
   end
  end
  global.get $~lib/thread/freeRingBase
  local.tee $0
  i32.const 0
  i32.atomic.store
  local.get $0
  i32.const 4
  i32.add
  local.get $4
  i32.atomic.store
  local.get $0
  i32.const 8
  i32.add
  local.get $4
  i32.atomic.store
  i32.const 0
  local.set $1
  loop $for-loop|1
   local.get $1
   local.get $4
   i32.lt_s
   if
    local.get $0
    i32.const 12
    i32.add
    local.get $1
    i32.const 2
    i32.shl
    i32.add
    local.get $1
    i32.atomic.store
    local.get $1
    i32.const 1
    i32.add
    local.set $1
    br $for-loop|1
   end
  end
  memory.size
  i32.const 16
  i32.shl
  local.set $0
  global.get $~lib/thread/__ringCapacity
  i32.const 3
  i32.shl
  local.tee $1
  i32.const 65600
  i32.add
  local.get $1
  i32.add
  local.tee $1
  i32.const 28
  i32.add
  local.get $3
  i32.atomic.store
  local.get $1
  i32.const 32
  i32.add
  local.get $0
  local.get $3
  i32.sub
  i32.atomic.store
  i32.const 0
 )
 (func $~lib/rt/tlsf/insertBlock (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  local.get $1
  i32.eqz
  if
   i32.const 0
   i32.const 128
   i32.const 201
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  i32.load
  local.tee $3
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
  local.get $1
  i32.const 4
  i32.add
  local.get $1
  i32.load
  i32.const -4
  i32.and
  i32.add
  local.tee $4
  i32.load
  local.tee $2
  i32.const 1
  i32.and
  if
   local.get $0
   local.get $4
   call $~lib/rt/tlsf/removeBlock
   local.get $1
   local.get $3
   i32.const 4
   i32.add
   local.get $2
   i32.const -4
   i32.and
   i32.add
   local.tee $3
   i32.store
   local.get $1
   i32.const 4
   i32.add
   local.get $1
   i32.load
   i32.const -4
   i32.and
   i32.add
   local.tee $4
   i32.load
   local.set $2
  end
  local.get $3
  i32.const 2
  i32.and
  if
   local.get $1
   i32.const 4
   i32.sub
   i32.load
   local.tee $1
   i32.load
   local.tee $6
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
   local.get $0
   local.get $1
   call $~lib/rt/tlsf/removeBlock
   local.get $1
   local.get $6
   i32.const 4
   i32.add
   local.get $3
   i32.const -4
   i32.and
   i32.add
   local.tee $3
   i32.store
  end
  local.get $4
  local.get $2
  i32.const 2
  i32.or
  i32.store
  local.get $3
  i32.const -4
  i32.and
  local.tee $2
  i32.const 12
  i32.lt_u
  if
   i32.const 0
   i32.const 128
   i32.const 233
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $4
  local.get $1
  i32.const 4
  i32.add
  local.get $2
  i32.add
  i32.ne
  if
   i32.const 0
   i32.const 128
   i32.const 234
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $4
  i32.const 4
  i32.sub
  local.get $1
  i32.store
  local.get $2
  i32.const 256
  i32.lt_u
  if (result i32)
   local.get $2
   i32.const 4
   i32.shr_u
  else
   i32.const 31
   i32.const 1073741820
   local.get $2
   local.get $2
   i32.const 1073741820
   i32.ge_u
   select
   local.tee $2
   i32.clz
   i32.sub
   local.tee $3
   i32.const 7
   i32.sub
   local.set $5
   local.get $2
   local.get $3
   i32.const 4
   i32.sub
   i32.shr_u
   i32.const 16
   i32.xor
  end
  local.tee $2
  i32.const 16
  i32.lt_u
  local.get $5
  i32.const 23
  i32.lt_u
  i32.and
  i32.eqz
  if
   i32.const 0
   i32.const 128
   i32.const 251
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  local.get $5
  i32.const 4
  i32.shl
  local.get $2
  i32.add
  i32.const 2
  i32.shl
  i32.add
  i32.load offset=96
  local.set $3
  local.get $1
  i32.const 0
  i32.store offset=4
  local.get $1
  local.get $3
  i32.store offset=8
  local.get $3
  if
   local.get $3
   local.get $1
   i32.store offset=4
  end
  local.get $0
  local.get $5
  i32.const 4
  i32.shl
  local.get $2
  i32.add
  i32.const 2
  i32.shl
  i32.add
  local.get $1
  i32.store offset=96
  local.get $0
  local.get $0
  i32.load
  i32.const 1
  local.get $5
  i32.shl
  i32.or
  i32.store
  local.get $0
  local.get $5
  i32.const 2
  i32.shl
  i32.add
  local.tee $0
  local.get $0
  i32.load offset=4
  i32.const 1
  local.get $2
  i32.shl
  i32.or
  i32.store offset=4
 )
 (func $~lib/rt/tlsf/__arenaInit (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i64)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  local.get $0
  local.get $1
  i32.add
  i32.const -16
  i32.and
  local.tee $1
  local.get $0
  i32.const 15
  i32.add
  i32.const -16
  i32.and
  i32.const 32783
  i32.add
  i32.const -16
  i32.and
  local.tee $0
  i32.const 1024
  i32.add
  i32.lt_u
  if
   unreachable
  end
  local.get $1
  global.set $~lib/rt/common/ARENA_END
  local.get $0
  global.set $~lib/rt/common/HEAP_BASE
  local.get $0
  global.set $~lib/rt/common/ARENA_BASE_CONFIGURED
  local.get $0
  local.get $0
  i32.store offset=4
  local.get $0
  local.get $0
  i32.store offset=8
  local.get $0
  global.set $~lib/rt/itcms/fromSpace
  local.get $0
  i32.const 20
  i32.add
  local.tee $1
  local.get $1
  i32.store offset=4
  local.get $1
  local.get $1
  i32.store offset=8
  local.get $1
  global.set $~lib/rt/itcms/toSpace
  local.get $0
  i32.const 40
  i32.add
  local.tee $1
  local.get $1
  i32.store offset=4
  local.get $1
  local.get $1
  i32.store offset=8
  local.get $1
  global.set $~lib/rt/itcms/pinSpace
  global.get $~lib/rt/itcms/fromSpace
  global.set $~lib/rt/itcms/ARENA_FROM_SPACE
  global.get $~lib/rt/itcms/toSpace
  global.set $~lib/rt/itcms/ARENA_TO_SPACE
  global.get $~lib/rt/itcms/pinSpace
  global.set $~lib/rt/itcms/ARENA_PIN_SPACE
  global.get $~lib/rt/common/ARENA_END
  local.get $0
  i32.const 75
  i32.add
  i32.const -16
  i32.and
  local.tee $5
  i32.const 0
  i32.store
  local.get $5
  i32.const 0
  i32.store offset=1568
  loop $for-loop|0
   local.get $2
   i32.const 23
   i32.lt_u
   if
    local.get $5
    local.get $2
    i32.const 2
    i32.shl
    i32.add
    i32.const 0
    i32.store offset=4
    i32.const 0
    local.set $4
    loop $for-loop|1
     local.get $4
     i32.const 16
     i32.lt_u
     if
      local.get $5
      local.get $2
      i32.const 4
      i32.shl
      local.get $4
      i32.add
      i32.const 2
      i32.shl
      i32.add
      i32.const 0
      i32.store offset=96
      local.get $4
      i32.const 1
      i32.add
      local.set $4
      br $for-loop|1
     end
    end
    local.get $2
    i32.const 1
    i32.add
    local.set $2
    br $for-loop|0
   end
  end
  i64.extend_i32_u
  local.tee $3
  i32.wrap_i64
  local.get $3
  local.get $5
  i32.const 1572
  i32.add
  local.tee $0
  i64.extend_i32_u
  i64.lt_u
  if
   i32.const 0
   i32.const 128
   i32.const 382
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 19
  i32.add
  i32.const -16
  i32.and
  i32.const 4
  i32.sub
  local.set $0
  i32.const 0
  local.set $4
  local.get $5
  i32.load offset=1568
  local.tee $1
  if
   local.get $1
   i32.const 4
   i32.add
   local.get $0
   i32.gt_u
   if
    i32.const 0
    i32.const 128
    i32.const 389
    i32.const 16
    call $~lib/builtins/abort
    unreachable
   end
   local.get $0
   i32.const 16
   i32.sub
   local.tee $6
   local.get $1
   i32.eq
   if
    local.get $1
    i32.load
    local.set $4
    local.get $6
    local.set $0
   end
  else
   local.get $5
   i32.const 1572
   i32.add
   local.get $0
   i32.gt_u
   if
    i32.const 0
    i32.const 128
    i32.const 402
    i32.const 5
    call $~lib/builtins/abort
    unreachable
   end
  end
  i32.const -16
  i32.and
  local.get $0
  i32.sub
  local.tee $1
  i32.const 20
  i32.ge_u
  if
   local.get $0
   local.get $4
   i32.const 2
   i32.and
   local.get $1
   i32.const 8
   i32.sub
   local.tee $1
   i32.const 1
   i32.or
   i32.or
   i32.store
   local.get $0
   i32.const 0
   i32.store offset=4
   local.get $0
   i32.const 0
   i32.store offset=8
   local.get $0
   i32.const 4
   i32.add
   local.get $1
   i32.add
   local.tee $1
   i32.const 2
   i32.store
   local.get $5
   local.get $1
   i32.store offset=1568
   local.get $5
   local.get $0
   call $~lib/rt/tlsf/insertBlock
  end
 )
 (func $~lib/rt/common/__arenaHeapBase (result i32)
  global.get $~lib/rt/common/HEAP_BASE
 )
 (func $~lib/rt/common/__arenaEnd (result i32)
  global.get $~lib/rt/common/ARENA_END
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
  i32.const 8
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
  i32.const 8
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
 (func $__start (result i32)
  (local $0 i32)
  call $features/threads/testAtomic
  call $features/threads/testAtomicAsm
  global.get $~lib/rt/common/ARENA_BASE_CONFIGURED
  local.tee $0
  i32.const 32972
  local.get $0
  select
  global.set $~lib/rt/common/HEAP_BASE
  global.get $~lib/rt/itcms/ARENA_FROM_SPACE
  local.tee $0
  if (result i32)
   local.get $0
  else
   i32.const 20
   i32.const 16
   i32.store
   i32.const 24
   i32.const 16
   i32.store
   i32.const 16
  end
  global.set $~lib/rt/itcms/fromSpace
  global.get $~lib/rt/itcms/ARENA_TO_SPACE
  local.tee $0
  if (result i32)
   local.get $0
  else
   i32.const 52
   i32.const 48
   i32.store
   i32.const 56
   i32.const 48
   i32.store
   i32.const 48
  end
  global.set $~lib/rt/itcms/toSpace
  global.get $~lib/rt/itcms/ARENA_PIN_SPACE
  local.tee $0
  if (result i32)
   local.get $0
  else
   i32.const 84
   i32.const 80
   i32.store
   i32.const 88
   i32.const 80
   i32.store
   i32.const 80
  end
  global.set $~lib/rt/itcms/pinSpace
  memory.size
  drop
  i32.const 0
 )
)
