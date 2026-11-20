(module
 (type $0 (func (param i32 i32)))
 (type $1 (func (result i32)))
 (type $2 (func))
 (type $3 (func (param i32 i32 i32 i32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (global $~lib/rt/common/ARENA_END (mut i32) (i32.const 0))
 (global $~lib/rt/common/HEAP_BASE (mut i32) (i32.const 0))
 (memory $0 1 10 shared)
 (data $3 (i32.const 108) "<")
 (data $3.1 (i32.const 120) "\02\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00t\00l\00s\00f\00.\00t\00s")
 (export "__arenaInit" (func $~lib/rt/tlsf/__arenaInit))
 (export "__arenaHeapBase" (func $~lib/rt/common/__arenaHeapBase))
 (export "__arenaEnd" (func $~lib/rt/common/__arenaEnd))
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
  local.get $0
  i32.store offset=4
  local.get $0
  local.get $0
  i32.store offset=8
  local.get $0
  i32.const 20
  i32.add
  local.tee $1
  local.get $1
  i32.store offset=4
  local.get $1
  local.get $1
  i32.store offset=8
  local.get $0
  i32.const 40
  i32.add
  local.tee $1
  local.get $1
  i32.store offset=4
  local.get $1
  local.get $1
  i32.store offset=8
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
  call $features/threads/testAtomic
  call $features/threads/testAtomicAsm
  i32.const 32940
  global.set $~lib/rt/common/HEAP_BASE
  i32.const 20
  i32.const 16
  i32.store
  i32.const 24
  i32.const 16
  i32.store
  i32.const 52
  i32.const 48
  i32.store
  i32.const 56
  i32.const 48
  i32.store
  i32.const 84
  i32.const 80
  i32.store
  i32.const 88
  i32.const 80
  i32.store
  memory.size
  drop
  i32.const 0
 )
)
