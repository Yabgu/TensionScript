(module
 (type $0 (func (param i32) (result i32)))
 (type $1 (func (result i32)))
 (type $2 (func (param i32)))
 (type $3 (func (param i32 i32)))
 (type $4 (func (param i32 i32) (result i32)))
 (type $5 (func))
 (type $6 (func (param i32 i32 i32 i32)))
 (type $7 (func (param i32 i32 i32)))
 (type $8 (func (param i32 i32 i64)))
 (type $9 (func (param i64 i32 i32)))
 (type $10 (func (param i32 i32 i32) (result i32)))
 (type $11 (func (param i64) (result i32)))
 (import "env" "memory" (memory $0 2 256 shared))
 (import "env" "abort" (func $~lib/builtins/abort (type $6) (param i32 i32 i32 i32)))
 (import "scheduler" "park" (func $~lib/task-stack/hostPark (type $9) (param i64 i32 i32)))
 (import "env" "__startThread" (func $~lib/thread/__startThread (type $0) (param i32) (result i32)))
 (import "env" "__executorCount" (func $~lib/thread/__executorCount (type $1) (result i32)))
 (import "scheduler" "completion" (func $~lib/task-stack/hostCompletion (type $11) (param i64) (result i32)))
 (global $~asyncStatus (mut i32) (i32.const 0))
 (global $~lib/task-stack/selfExecutor (mut i32) (i32.const 0))
 (global $~lib/thread/executors (mut i32) (i32.const 0))
 (global $~lib/thread/mainExecutorInstance (mut i32) (i32.const 0))
 (global $~lib/thread/__heapBase (mut i32) (i32.const 0))
 (global $~lib/thread/__controlBase (mut i32) (i32.const 0))
 (global $~lib/thread/__controlStride (mut i32) (i32.const 0))
 (global $~lib/thread/__ringCapacity (mut i32) (i32.const 0))
 (global $~lib/thread/__executorTotal (mut i32) (i32.const 0))
 (global $~lib/thread/requestBase (mut i32) (i32.const 0))
 (global $~lib/thread/freeRingBase (mut i32) (i32.const 0))
 (global $~lib/thread/requestCount (mut i32) (i32.const 0))
 (global $~lib/thread/sinkInstalled (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/total (mut i32) (i32.const 0))
 (global $~lib/rt/common/ARENA_BASE_CONFIGURED (mut i32) (i32.const 0))
 (global $~lib/rt/common/HEAP_BASE (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/threshold (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/state (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/visitCount (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/ARENA_PIN_SPACE (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/pinSpace (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/iter (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/ARENA_TO_SPACE (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/toSpace (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/white (mut i32) (i32.const 0))
 (global $~lib/rt/common/ARENA_END (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/ARENA_FROM_SPACE (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/fromSpace (mut i32) (i32.const 0))
 (global $~lib/rt/tlsf/ROOT (mut i32) (i32.const 0))
 (global $~env (mut i32) (i32.const 0))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 34564))
 (data $0 (i32.const 1036) "\1c\00\00\00\00\00\00\00\00\00\00\00\04\00\00\00\08\00\00\00\01\00\00\00\00\00\00\00\00\00\00\00")
 (data $1 (i32.const 1068) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00(\00\00\00A\00l\00l\00o\00c\00a\00t\00i\00o\00n\00 \00t\00o\00o\00 \00l\00a\00r\00g\00e\00\00\00\00\00")
 (data $2 (i32.const 1132) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00 \00\00\00~\00l\00i\00b\00/\00r\00t\00/\00i\00t\00c\00m\00s\00.\00t\00s\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $3 (i32.const 1200) "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $4 (i32.const 1232) "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $5 (i32.const 1260) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00$\00\00\00I\00n\00d\00e\00x\00 \00o\00u\00t\00 \00o\00f\00 \00r\00a\00n\00g\00e\00\00\00\00\00\00\00\00\00")
 (data $6 (i32.const 1324) ",\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00\14\00\00\00~\00l\00i\00b\00/\00r\00t\00.\00t\00s\00\00\00\00\00\00\00\00\00")
 (data $7 (i32.const 1376) "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $8 (i32.const 1404) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00t\00l\00s\00f\00.\00t\00s\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $9 (i32.const 1468) ",\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00\1a\00\00\00~\00l\00i\00b\00/\00a\00r\00r\00a\00y\00.\00t\00s\00\00\00")
 (data $10 (i32.const 1516) ",\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00\1c\00\00\00I\00n\00v\00a\00l\00i\00d\00 \00l\00e\00n\00g\00t\00h\00")
 (data $11 (i32.const 1564) "\1c\00\00\00\00\00\00\00\00\00\00\00\17\00\00\00\08\00\00\00\02\00\00\00\00\00\00\00\00\00\00\00")
 (data $12 (i32.const 1596) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00&\00\00\00~\00l\00i\00b\00/\00a\00r\00r\00a\00y\00b\00u\00f\00f\00e\00r\00.\00t\00s\00\00\00\00\00\00\00")
 (data $13 (i32.const 1660) "\1c\00\00\00\00\00\00\00\00\00\00\00\04\00\00\00\08\00\00\00\03\00\00\00\00\00\00\00\00\00\00\00")
 (data $14 (i32.const 1696) "\18\00\00\00 \00\00\00 \00\00\00 \00\00\00\00\00\00\00\00\00\00\00 \00\00\00\00\00\00\00 \00\00\00\02A\00\00 \00\00\00\02a\00\00\00\00\00\00 \00\00\00\10A\12\00\00\00\00\00\00\00\00\00\01\t\00\00\02a\00\00 \00\00\00\02a\00\00\02\t\00\00\00\00\00\00 \00\00\00\00\00\00\00")
 (table $0 4 4 funcref)
 (table $$starts 1 1 funcref)
 (elem $0 (table $0) (i32.const 1) func $~lib/task/noopWake $~lib/thread/__mainStep__ $~lib/thread/installWakeSink~anonymous|0)
 (elem $$starts$elem (table $$starts) (i32.const 0) func $~asyncMainStart)
 (export "__asyncStatus" (global $~asyncStatus))
 (export "main" (func $stackful-fiber-record/main))
 (export "__asyncPump" (func $~lib/async/__asyncPump))
 (export "__arenaInit" (func $~lib/rt/tlsf/__arenaInit))
 (export "__arenaHeapBase" (func $~lib/rt/common/__arenaHeapBase))
 (export "__arenaEnd" (func $~lib/rt/common/__arenaEnd))
 (export "__threadInit" (func $~lib/thread/__threadInit))
 (export "__mainArenaBase" (func $~lib/thread/__mainArenaBase))
 (export "__mainArenaSize" (func $~lib/thread/__mainArenaSize))
 (export "__heapBase" (global $~lib/thread/__heapBase))
 (export "__controlBase" (global $~lib/thread/__controlBase))
 (export "__controlStride" (global $~lib/thread/__controlStride))
 (export "__ringCapacity" (global $~lib/thread/__ringCapacity))
 (export "__executorTotal" (global $~lib/thread/__executorTotal))
 (export "__spawnThread" (func $~lib/thread/__spawnThread))
 (export "__workerMain" (func $~lib/thread/__workerMain))
 (export "__threadJoin" (func $~lib/thread/__threadJoin))
 (export "__executorExit" (func $~lib/thread/__executorExit))
 (export "__workerArenaBase" (func $~lib/thread/__workerArenaBase))
 (export "__workerArenaSize" (func $~lib/thread/__workerArenaSize))
 (export "memory" (memory $0))
 (export "$starts" (table $$starts))
 (export "__start" (func $__start))
 (func $~lib/rt/itcms/__visit (type $2) (param $0 i32)
  (local $1 i32)
  local.get $0
  if (result i32)
   global.get $~lib/rt/common/ARENA_END
   local.tee $1
   local.get $0
   i32.le_u
   global.get $~lib/rt/common/HEAP_BASE
   local.get $0
   i32.gt_u
   i32.or
   i32.const 0
   local.get $1
   select
  else
   i32.const 1
  end
  if
   return
  end
  global.get $~lib/rt/itcms/white
  local.get $0
  i32.const 20
  i32.sub
  local.tee $0
  i32.load offset=4
  i32.const 3
  i32.and
  i32.eq
  if
   local.get $0
   call $~lib/rt/itcms/Object#makeGray
   global.get $~lib/rt/itcms/visitCount
   i32.const 1
   i32.add
   global.set $~lib/rt/itcms/visitCount
  end
 )
 (func $~lib/rt/itcms/__link (type $7) (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  local.get $1
  if (result i32)
   global.get $~lib/rt/common/ARENA_END
   local.tee $3
   local.get $1
   i32.le_u
   global.get $~lib/rt/common/HEAP_BASE
   local.get $1
   i32.gt_u
   i32.or
   i32.const 0
   local.get $3
   select
  else
   i32.const 1
  end
  if
   return
  end
  local.get $0
  i32.eqz
  if
   i32.const 0
   i32.const 1152
   i32.const 295
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/rt/itcms/white
  local.get $1
  i32.const 20
  i32.sub
  local.tee $1
  i32.load offset=4
  i32.const 3
  i32.and
  i32.eq
  if
   local.get $0
   i32.const 20
   i32.sub
   local.tee $0
   i32.load offset=4
   i32.const 3
   i32.and
   local.tee $3
   global.get $~lib/rt/itcms/white
   i32.eqz
   i32.eq
   if
    local.get $0
    local.get $1
    local.get $2
    select
    call $~lib/rt/itcms/Object#makeGray
   else
    global.get $~lib/rt/itcms/state
    i32.const 1
    i32.eq
    local.get $3
    i32.const 3
    i32.eq
    i32.and
    if
     local.get $1
     call $~lib/rt/itcms/Object#makeGray
    end
   end
  end
 )
 (func $~lib/rt/itcms/__new (type $4) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  local.get $0
  i32.const 1073741804
  i32.ge_u
  if
   i32.const 1088
   i32.const 1152
   i32.const 261
   i32.const 31
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/rt/itcms/total
  global.get $~lib/rt/itcms/threshold
  i32.ge_u
  if
   block $__inlined_func$~lib/rt/itcms/interrupt$71
    i32.const 2048
    local.set $2
    loop $do-loop|0
     local.get $2
     call $~lib/rt/itcms/step
     i32.sub
     local.set $2
     global.get $~lib/rt/itcms/state
     i32.eqz
     if
      global.get $~lib/rt/itcms/total
      i32.const 1
      i32.shl
      i32.const 1024
      i32.add
      global.set $~lib/rt/itcms/threshold
      br $__inlined_func$~lib/rt/itcms/interrupt$71
     end
     local.get $2
     i32.const 0
     i32.gt_s
     br_if $do-loop|0
    end
    global.get $~lib/rt/itcms/total
    global.get $~lib/rt/itcms/total
    global.get $~lib/rt/itcms/threshold
    i32.sub
    i32.const 1024
    i32.lt_u
    i32.const 10
    i32.shl
    i32.add
    global.set $~lib/rt/itcms/threshold
   end
  end
  global.get $~lib/rt/tlsf/ROOT
  i32.eqz
  if
   call $~lib/rt/tlsf/initialize
  end
  global.get $~lib/rt/tlsf/ROOT
  local.set $4
  local.get $0
  i32.const 16
  i32.add
  local.tee $2
  i32.const 1073741820
  i32.gt_u
  if
   i32.const 1088
   i32.const 1424
   i32.const 461
   i32.const 29
   call $~lib/builtins/abort
   unreachable
  end
  local.get $4
  local.get $2
  i32.const 12
  i32.le_u
  if (result i32)
   i32.const 12
  else
   local.get $2
   i32.const 19
   i32.add
   i32.const -16
   i32.and
   i32.const 4
   i32.sub
  end
  local.tee $5
  call $~lib/rt/tlsf/searchBlock
  local.tee $2
  i32.eqz
  if
   global.get $~lib/rt/common/ARENA_END
   if
    unreachable
   end
   memory.size
   local.tee $2
   local.get $5
   i32.const 256
   i32.ge_u
   if (result i32)
    local.get $5
    i32.const 536870910
    i32.lt_u
    if (result i32)
     local.get $5
     i32.const 1
     i32.const 27
     local.get $5
     i32.clz
     i32.sub
     i32.shl
     i32.add
     i32.const 1
     i32.sub
    else
     local.get $5
    end
   else
    local.get $5
   end
   i32.const 4
   local.get $4
   i32.load offset=1568
   local.get $2
   i32.const 16
   i32.shl
   i32.const 4
   i32.sub
   i32.ne
   i32.shl
   i32.add
   i32.const 65535
   i32.add
   i32.const -65536
   i32.and
   i32.const 16
   i32.shr_u
   local.tee $3
   local.get $2
   local.get $3
   i32.gt_s
   select
   memory.grow
   i32.const 0
   i32.lt_s
   if
    local.get $3
    memory.grow
    i32.const 0
    i32.lt_s
    if
     unreachable
    end
   end
   local.get $4
   local.get $2
   i32.const 16
   i32.shl
   memory.size
   i64.extend_i32_s
   i64.const 16
   i64.shl
   call $~lib/rt/tlsf/addMemory
   local.get $4
   local.get $5
   call $~lib/rt/tlsf/searchBlock
   local.tee $2
   i32.eqz
   if
    i32.const 0
    i32.const 1424
    i32.const 499
    i32.const 16
    call $~lib/builtins/abort
    unreachable
   end
  end
  local.get $5
  local.get $2
  i32.load
  i32.const -4
  i32.and
  i32.gt_u
  if
   i32.const 0
   i32.const 1424
   i32.const 501
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $4
  local.get $2
  call $~lib/rt/tlsf/removeBlock
  local.get $2
  i32.load
  local.set $6
  local.get $5
  i32.const 4
  i32.add
  i32.const 15
  i32.and
  if
   i32.const 0
   i32.const 1424
   i32.const 361
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $6
  i32.const -4
  i32.and
  local.get $5
  i32.sub
  local.tee $3
  i32.const 16
  i32.ge_u
  if
   local.get $2
   local.get $5
   local.get $6
   i32.const 2
   i32.and
   i32.or
   i32.store
   local.get $2
   i32.const 4
   i32.add
   local.get $5
   i32.add
   local.tee $5
   local.get $3
   i32.const 4
   i32.sub
   i32.const 1
   i32.or
   i32.store
   local.get $4
   local.get $5
   call $~lib/rt/tlsf/insertBlock
  else
   local.get $2
   local.get $6
   i32.const -2
   i32.and
   i32.store
   local.get $2
   i32.const 4
   i32.add
   local.get $2
   i32.load
   i32.const -4
   i32.and
   i32.add
   local.tee $3
   local.get $3
   i32.load
   i32.const -3
   i32.and
   i32.store
  end
  local.get $2
  local.get $1
  i32.store offset=12
  local.get $2
  local.get $0
  i32.store offset=16
  global.get $~lib/rt/itcms/fromSpace
  local.tee $1
  i32.load offset=8
  local.set $3
  local.get $2
  local.get $1
  global.get $~lib/rt/itcms/white
  i32.or
  i32.store offset=4
  local.get $2
  local.get $3
  i32.store offset=8
  local.get $3
  local.get $2
  local.get $3
  i32.load offset=4
  i32.const 3
  i32.and
  i32.or
  i32.store offset=4
  local.get $1
  local.get $2
  i32.store offset=8
  global.get $~lib/rt/itcms/total
  local.get $2
  i32.load
  i32.const -4
  i32.and
  i32.const 4
  i32.add
  i32.add
  global.set $~lib/rt/itcms/total
  local.get $2
  i32.const 20
  i32.add
  local.tee $1
  i32.const 0
  local.get $0
  memory.fill
  local.get $1
 )
 (func $~lib/thread/SlotRing#get:depth (type $0) (param $0 i32) (result i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 1796
  i32.lt_s
  if
   i32.const 34592
   i32.const 34640
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $0
  i32.load offset=4
  i32.const 0
  i32.le_s
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 4
   i32.add
   global.set $~lib/memory/__stack_pointer
   i32.const 0
   return
  end
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $0
  i32.load
  local.tee $0
  i32.atomic.load offset=4
  local.get $0
  i32.atomic.load
  i32.sub
  local.set $0
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $0
  i32.const 0
  local.get $0
  i32.const 0
  i32.gt_s
  select
 )
 (func $~lib/object/Object#constructor (type $0) (param $0 i32) (result i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 1796
  i32.lt_s
  if
   i32.const 34592
   i32.const 34640
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $0
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.const 0
   call $~lib/rt/itcms/__new
   local.tee $0
   i32.store
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $0
 )
 (func $stackful-fiber-record/main (type $1) (result i32)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.sub
  global.set $~lib/memory/__stack_pointer
  block $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i32.const 1796
   i32.lt_s
   br_if $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i64.const 0
   i64.store
   global.get $~lib/memory/__stack_pointer
   i64.const 0
   i64.store offset=8
   global.get $~lib/memory/__stack_pointer
   call $stackful-fiber-record/pendingJob
   local.tee $1
   i32.store
   global.get $~lib/memory/__stack_pointer
   block $__inlined_func$~lib/thread/RemotePolicy#constructor$7 (result i32)
    global.get $~lib/memory/__stack_pointer
    i32.const 8
    i32.sub
    global.set $~lib/memory/__stack_pointer
    block $folding-inner00
     global.get $~lib/memory/__stack_pointer
     i32.const 1796
     i32.lt_s
     br_if $folding-inner00
     global.get $~lib/memory/__stack_pointer
     i64.const 0
     i64.store
     global.get $~lib/memory/__stack_pointer
     i32.const 16
     i32.const 22
     call $~lib/rt/itcms/__new
     local.tee $0
     i32.store
     global.get $~lib/memory/__stack_pointer
     local.get $0
     i32.store offset=4
     local.get $0
     i32.const 0
     i32.store offset=4
     global.get $~lib/memory/__stack_pointer
     local.get $0
     i32.store offset=4
     local.get $0
     i32.const 0
     i32.store offset=8
     global.get $~lib/memory/__stack_pointer
     local.get $0
     i32.store offset=4
     local.get $0
     i32.const 0
     i32.store offset=12
     global.get $~lib/memory/__stack_pointer
     global.get $~lib/memory/__stack_pointer
     local.get $0
     i32.store offset=4
     global.get $~lib/memory/__stack_pointer
     i32.const 8
     i32.sub
     global.set $~lib/memory/__stack_pointer
     global.get $~lib/memory/__stack_pointer
     i32.const 1796
     i32.lt_s
     br_if $folding-inner00
     global.get $~lib/memory/__stack_pointer
     i64.const 0
     i64.store
     local.get $0
     i32.eqz
     if
      global.get $~lib/memory/__stack_pointer
      i32.const 1
      i32.const 5
      call $~lib/rt/itcms/__new
      local.tee $0
      i32.store
     end
     global.get $~lib/memory/__stack_pointer
     local.get $0
     i32.store offset=4
     global.get $~lib/memory/__stack_pointer
     local.get $0
     call $~lib/object/Object#constructor
     local.tee $0
     i32.store
     global.get $~lib/memory/__stack_pointer
     local.get $0
     i32.store offset=4
     local.get $0
     i32.const 0
     i32.store8
     global.get $~lib/memory/__stack_pointer
     i32.const 8
     i32.add
     global.set $~lib/memory/__stack_pointer
     local.get $0
     i32.store
     global.get $~lib/memory/__stack_pointer
     local.get $0
     i32.store offset=4
     local.get $0
     i32.const 1
     i32.store offset=4
     global.get $~lib/memory/__stack_pointer
     local.get $0
     i32.store offset=4
     local.get $0
     i32.const 0
     i32.store offset=8
     global.get $~lib/memory/__stack_pointer
     local.get $0
     i32.store offset=4
     local.get $0
     i32.const -1
     i32.store offset=12
     global.get $~lib/memory/__stack_pointer
     i32.const 8
     i32.add
     global.set $~lib/memory/__stack_pointer
     local.get $0
     br $__inlined_func$~lib/thread/RemotePolicy#constructor$7
    end
    br $folding-inner1
   end
   local.tee $0
   i32.store offset=4
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=8
   global.get $~lib/memory/__stack_pointer
   local.get $1
   i32.store offset=12
   global.get $~lib/memory/__stack_pointer
   i32.const 4
   i32.sub
   global.set $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 1796
   i32.lt_s
   br_if $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $1
   i32.store
   local.get $1
   call $~lib/task-stack/__parkOn
   global.get $~lib/memory/__stack_pointer
   local.get $1
   i32.store
   local.get $1
   call $~lib/task-stack/__parkAwait
   global.get $~lib/memory/__stack_pointer
   i32.const 4
   i32.add
   global.set $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 16
   i32.add
   global.set $~lib/memory/__stack_pointer
   i32.const 1
   return
  end
  i32.const 34592
  i32.const 34640
  i32.const 1
  i32.const 1
  call $~lib/builtins/abort
  unreachable
 )
 (func $~lib/thread/SlotRing#constructor (type $1) (result i32)
  (local $0 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 1796
  i32.lt_s
  if
   i32.const 34592
   i32.const 34640
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store offset=8
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.const 15
  call $~lib/rt/itcms/__new
  local.tee $0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store offset=4
  local.get $0
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store offset=4
  local.get $0
  i32.const 0
  i32.store offset=4
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store offset=4
  local.get $0
  i32.const 0
  i32.store offset=8
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store offset=4
  local.get $0
  i32.const 0
  i32.store offset=12
  local.get $0
  i32.const 0
  i32.const 0
  call $~lib/rt/itcms/__link
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store offset=4
  local.get $0
  i32.const 0
  i32.store offset=4
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $0
 )
 (func $~lib/rt/tlsf/removeBlock (type $3) (param $0 i32) (param $1 i32)
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
   i32.const 1424
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
   i32.const 1424
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
   i32.const 1424
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
 (func $~lib/rt/tlsf/insertBlock (type $3) (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  local.get $1
  i32.eqz
  if
   i32.const 0
   i32.const 1424
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
   i32.const 1424
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
    i32.const 1424
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
   i32.const 1424
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
   i32.const 1424
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
   i32.const 1424
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
 (func $~lib/rt/tlsf/addMemory (type $8) (param $0 i32) (param $1 i32) (param $2 i64)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  local.get $2
  local.get $1
  i64.extend_i32_u
  i64.lt_u
  if
   i32.const 0
   i32.const 1424
   i32.const 382
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  i32.const 19
  i32.add
  i32.const -16
  i32.and
  i32.const 4
  i32.sub
  local.set $1
  local.get $0
  i32.load offset=1568
  local.tee $3
  if
   local.get $3
   i32.const 4
   i32.add
   local.get $1
   i32.gt_u
   if
    i32.const 0
    i32.const 1424
    i32.const 389
    i32.const 16
    call $~lib/builtins/abort
    unreachable
   end
   local.get $3
   local.get $1
   i32.const 16
   i32.sub
   local.tee $5
   i32.eq
   if
    local.get $3
    i32.load
    local.set $4
    local.get $5
    local.set $1
   end
  else
   local.get $0
   i32.const 1572
   i32.add
   local.get $1
   i32.gt_u
   if
    i32.const 0
    i32.const 1424
    i32.const 402
    i32.const 5
    call $~lib/builtins/abort
    unreachable
   end
  end
  local.get $2
  i32.wrap_i64
  i32.const -16
  i32.and
  local.get $1
  i32.sub
  local.tee $3
  i32.const 20
  i32.lt_u
  if
   return
  end
  local.get $1
  local.get $4
  i32.const 2
  i32.and
  local.get $3
  i32.const 8
  i32.sub
  local.tee $3
  i32.const 1
  i32.or
  i32.or
  i32.store
  local.get $1
  i32.const 0
  i32.store offset=4
  local.get $1
  i32.const 0
  i32.store offset=8
  local.get $1
  i32.const 4
  i32.add
  local.get $3
  i32.add
  local.tee $3
  i32.const 2
  i32.store
  local.get $0
  local.get $3
  i32.store offset=1568
  local.get $0
  local.get $1
  call $~lib/rt/tlsf/insertBlock
 )
 (func $~lib/rt/itcms/Object#makeGray (type $2) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  local.get $0
  global.get $~lib/rt/itcms/iter
  i32.eq
  if
   local.get $0
   i32.load offset=8
   local.tee $1
   i32.eqz
   if
    i32.const 0
    i32.const 1152
    i32.const 148
    i32.const 30
    call $~lib/builtins/abort
    unreachable
   end
   local.get $1
   global.set $~lib/rt/itcms/iter
  end
  block $__inlined_func$~lib/rt/itcms/Object#unlink$390
   local.get $0
   i32.load offset=4
   i32.const -4
   i32.and
   local.tee $1
   i32.eqz
   if
    local.get $0
    i32.load offset=8
    i32.eqz
    global.get $~lib/rt/common/HEAP_BASE
    local.get $0
    i32.gt_u
    i32.and
    i32.eqz
    if
     i32.const 0
     i32.const 1152
     i32.const 128
     i32.const 18
     call $~lib/builtins/abort
     unreachable
    end
    br $__inlined_func$~lib/rt/itcms/Object#unlink$390
   end
   local.get $0
   i32.load offset=8
   local.tee $2
   i32.eqz
   if
    i32.const 0
    i32.const 1152
    i32.const 132
    i32.const 16
    call $~lib/builtins/abort
    unreachable
   end
   local.get $1
   local.get $2
   i32.store offset=8
   local.get $2
   local.get $1
   local.get $2
   i32.load offset=4
   i32.const 3
   i32.and
   i32.or
   i32.store offset=4
  end
  global.get $~lib/rt/itcms/toSpace
  local.set $2
  local.get $0
  i32.load offset=12
  local.tee $1
  i32.const 2
  i32.le_u
  if (result i32)
   i32.const 1
  else
   local.get $1
   i32.const 1696
   i32.load
   i32.gt_u
   if
    i32.const 1280
    i32.const 1344
    i32.const 21
    i32.const 28
    call $~lib/builtins/abort
    unreachable
   end
   local.get $1
   i32.const 2
   i32.shl
   i32.const 1700
   i32.add
   i32.load
   i32.const 32
   i32.and
  end
  local.set $3
  local.get $2
  i32.load offset=8
  local.set $1
  local.get $0
  global.get $~lib/rt/itcms/white
  i32.eqz
  i32.const 2
  local.get $3
  select
  local.get $2
  i32.or
  i32.store offset=4
  local.get $0
  local.get $1
  i32.store offset=8
  local.get $1
  local.get $0
  local.get $1
  i32.load offset=4
  i32.const 3
  i32.and
  i32.or
  i32.store offset=4
  local.get $2
  local.get $0
  i32.store offset=8
 )
 (func $~lib/rt/__visit_members (type $2) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  block $folding-inner2
   block $folding-inner1
    block $invalid
     block $~lib/function/Function<%28~lib/thread/Executor%29=>bool>
      block $~lib/thread/RemotePolicy
       block $~lib/task/Task<i32>
        block $~lib/array/Array<i32>
         block $~lib/thread/Request
          block $~lib/typedarray/Int32Array
           block $~lib/thread/SlotRing
            block $~lib/thread/Executor
             block $"~lib/map/Map<i32,~lib/task-stack/RemotePark>"
              block $~lib/task/TaskRecord
               block $~lib/task-stack/RemotePark
                block $~lib/mask/MaskBase
                 block $~lib/task/Waiter
                  block $~lib/task/TaskBase
                   block $~lib/task/TaskPolicy
                    block $~lib/function/Function<%28i32%2Ci32%29=>void>
                     block $~lib/arraybuffer/ArrayBufferView
                      block $~lib/string/String
                       block $~lib/arraybuffer/ArrayBuffer
                        block $~lib/object/Object
                         local.get $0
                         i32.const 8
                         i32.sub
                         i32.load
                         br_table $~lib/object/Object $~lib/arraybuffer/ArrayBuffer $~lib/string/String $~lib/arraybuffer/ArrayBufferView $~lib/function/Function<%28i32%2Ci32%29=>void> $~lib/task/TaskPolicy $~lib/task/TaskBase $~lib/task/Waiter $folding-inner1 $~lib/mask/MaskBase $folding-inner1 $~lib/task-stack/RemotePark $~lib/task/TaskRecord $"~lib/map/Map<i32,~lib/task-stack/RemotePark>" $~lib/thread/Executor $~lib/thread/SlotRing $~lib/typedarray/Int32Array $folding-inner1 $~lib/thread/Request $folding-inner1 $~lib/array/Array<i32> $~lib/task/Task<i32> $~lib/thread/RemotePolicy $~lib/function/Function<%28~lib/thread/Executor%29=>bool> $invalid
                        end
                        return
                       end
                       return
                      end
                      return
                     end
                     local.get $0
                     i32.load
                     call $~lib/rt/itcms/__visit
                     return
                    end
                    local.get $0
                    call $~lib/function/Function<%28i32%2Ci32%29=>void>~visit
                    return
                   end
                   return
                  end
                  local.get $0
                  i32.load offset=16
                  call $~lib/rt/itcms/__visit
                  local.get $0
                  i32.load offset=20
                  call $~lib/rt/itcms/__visit
                  local.get $0
                  i32.load offset=28
                  call $~lib/rt/itcms/__visit
                  return
                 end
                 return
                end
                return
               end
               local.get $0
               i32.load offset=4
               call $~lib/rt/itcms/__visit
               local.get $0
               i32.load offset=8
               call $~lib/rt/itcms/__visit
               return
              end
              return
             end
             global.get $~lib/memory/__stack_pointer
             i32.const 4
             i32.sub
             global.set $~lib/memory/__stack_pointer
             global.get $~lib/memory/__stack_pointer
             i32.const 1796
             i32.lt_s
             br_if $folding-inner2
             global.get $~lib/memory/__stack_pointer
             i32.const 0
             i32.store
             global.get $~lib/memory/__stack_pointer
             local.get $0
             i32.store
             local.get $0
             i32.load
             call $~lib/rt/itcms/__visit
             global.get $~lib/memory/__stack_pointer
             local.get $0
             i32.store
             local.get $0
             i32.load offset=8
             local.tee $2
             local.set $1
             global.get $~lib/memory/__stack_pointer
             local.get $0
             i32.store
             local.get $1
             local.get $0
             i32.load offset=16
             i32.const 12
             i32.mul
             i32.add
             local.set $0
             loop $while-continue|0
              local.get $0
              local.get $1
              i32.gt_u
              if
               local.get $1
               i32.load offset=8
               i32.const 1
               i32.and
               i32.eqz
               if
                local.get $1
                i32.load offset=4
                call $~lib/rt/itcms/__visit
               end
               local.get $1
               i32.const 12
               i32.add
               local.set $1
               br $while-continue|0
              end
             end
             local.get $2
             call $~lib/rt/itcms/__visit
             global.get $~lib/memory/__stack_pointer
             i32.const 4
             i32.add
             global.set $~lib/memory/__stack_pointer
             return
            end
            local.get $0
            i32.load offset=4
            call $~lib/rt/itcms/__visit
            local.get $0
            i32.load offset=8
            call $~lib/rt/itcms/__visit
            local.get $0
            i32.load offset=12
            call $~lib/rt/itcms/__visit
            return
           end
           local.get $0
           i32.load offset=12
           call $~lib/rt/itcms/__visit
           return
          end
          local.get $0
          i32.load
          call $~lib/rt/itcms/__visit
          return
         end
         return
        end
        global.get $~lib/memory/__stack_pointer
        i32.const 4
        i32.sub
        global.set $~lib/memory/__stack_pointer
        global.get $~lib/memory/__stack_pointer
        i32.const 1796
        i32.lt_s
        br_if $folding-inner2
        global.get $~lib/memory/__stack_pointer
        i32.const 0
        i32.store
        global.get $~lib/memory/__stack_pointer
        local.get $0
        i32.store
        local.get $0
        i32.load
        call $~lib/rt/itcms/__visit
        global.get $~lib/memory/__stack_pointer
        i32.const 4
        i32.add
        global.set $~lib/memory/__stack_pointer
        return
       end
       local.get $0
       i32.load offset=16
       call $~lib/rt/itcms/__visit
       local.get $0
       i32.load offset=20
       call $~lib/rt/itcms/__visit
       local.get $0
       i32.load offset=28
       call $~lib/rt/itcms/__visit
       local.get $0
       i32.load offset=44
       call $~lib/rt/itcms/__visit
       return
      end
      return
     end
     local.get $0
     call $~lib/function/Function<%28i32%2Ci32%29=>void>~visit
     return
    end
    unreachable
   end
   global.get $~lib/memory/__stack_pointer
   i32.const 4
   i32.sub
   global.set $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 1796
   i32.lt_s
   br_if $folding-inner2
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store
   local.get $0
   i32.load offset=4
   local.set $1
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store
   local.get $1
   local.get $0
   i32.load offset=12
   i32.const 2
   i32.shl
   i32.add
   local.set $3
   loop $while-continue|00
    local.get $1
    local.get $3
    i32.lt_u
    if
     local.get $1
     i32.load
     local.tee $2
     if
      local.get $2
      call $~lib/rt/itcms/__visit
     end
     local.get $1
     i32.const 4
     i32.add
     local.set $1
     br $while-continue|00
    end
   end
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store
   local.get $0
   i32.load
   call $~lib/rt/itcms/__visit
   global.get $~lib/memory/__stack_pointer
   i32.const 4
   i32.add
   global.set $~lib/memory/__stack_pointer
   return
  end
  i32.const 34592
  i32.const 34640
  i32.const 1
  i32.const 1
  call $~lib/builtins/abort
  unreachable
 )
 (func $~lib/thread/__serveOne (type $2) (param $0 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 1796
  i32.lt_s
  if
   i32.const 34592
   i32.const 34640
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store offset=8
  local.get $0
  i32.eqz
  if
   call $stackful-fiber-record/main
   drop
  end
  call $~lib/task-stack/__driveSlot
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/thread/__drainInbox (type $2) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 20
  i32.sub
  global.set $~lib/memory/__stack_pointer
  block $folding-inner0
   global.get $~lib/memory/__stack_pointer
   i32.const 1796
   i32.lt_s
   br_if $folding-inner0
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.const 20
   memory.fill
   loop $while-continue|0
    block $while-break|0
     global.get $~lib/memory/__stack_pointer
     local.get $0
     i32.store offset=4
     global.get $~lib/memory/__stack_pointer
     local.get $0
     i32.load offset=8
     local.tee $1
     i32.store
     local.get $1
     call $~lib/thread/SlotRing#pop
     local.tee $1
     i32.const 0
     i32.lt_s
     local.tee $3
     br_if $while-break|0
     global.get $~lib/thread/__controlBase
     if
      global.get $~lib/thread/requestBase
      local.get $1
      i32.const 4
      i32.shl
      i32.add
      i32.atomic.load
      global.get $~lib/thread/requestBase
      local.get $1
      i32.const 2
      i32.shl
      local.tee $4
      i32.const 1
      i32.add
      i32.const 2
      i32.shl
      i32.add
      i32.atomic.load
      drop
      global.get $~lib/thread/requestBase
      local.get $4
      i32.const 2
      i32.add
      i32.const 2
      i32.shl
      i32.add
      i32.atomic.load
      drop
      global.get $~lib/thread/requestBase
      local.get $4
      i32.const 3
      i32.add
      i32.const 2
      i32.shl
      i32.add
      i32.atomic.load
      drop
      block $__inlined_func$~lib/thread/blockFreeRequest$233
       local.get $3
       global.get $~lib/thread/freeRingBase
       local.tee $3
       i32.eqz
       global.get $~lib/thread/requestCount
       local.tee $5
       i32.const 0
       i32.le_s
       i32.or
       i32.or
       local.get $1
       local.get $5
       i32.ge_s
       i32.or
       br_if $__inlined_func$~lib/thread/blockFreeRequest$233
       loop $while-continue|01
        local.get $3
        i32.const 4
        i32.add
        local.tee $6
        i32.atomic.load
        local.tee $4
        local.get $3
        i32.atomic.load
        i32.sub
        local.get $5
        i32.ge_s
        br_if $__inlined_func$~lib/thread/blockFreeRequest$233
        local.get $6
        local.get $4
        local.get $4
        i32.const 1
        i32.add
        i32.atomic.rmw.cmpxchg
        local.get $4
        i32.ne
        br_if $while-continue|01
       end
       local.get $3
       i32.const 12
       i32.add
       local.get $4
       local.get $5
       i32.rem_s
       i32.const 2
       i32.shl
       i32.add
       local.get $1
       i32.atomic.store
      end
      global.get $~lib/memory/__stack_pointer
      local.get $0
      i32.store
      call $~lib/thread/__serveOne
      br $while-continue|0
     end
     global.get $~lib/memory/__stack_pointer
     global.get $~lib/memory/__stack_pointer
     i32.const 8
     i32.sub
     global.set $~lib/memory/__stack_pointer
     global.get $~lib/memory/__stack_pointer
     i32.const 1796
     i32.lt_s
     br_if $folding-inner0
     global.get $~lib/memory/__stack_pointer
     i64.const 0
     i64.store
     global.get $~lib/memory/__stack_pointer
     i32.const 0
     i32.store
     global.get $~lib/memory/__stack_pointer
     i32.const 8
     i32.add
     global.set $~lib/memory/__stack_pointer
     i32.const 0
     i32.store offset=8
     br $while-continue|0
    end
   end
   global.get $~lib/memory/__stack_pointer
   i32.const 20
   i32.add
   global.set $~lib/memory/__stack_pointer
   return
  end
  i32.const 34592
  i32.const 34640
  i32.const 1
  i32.const 1
  call $~lib/builtins/abort
  unreachable
 )
 (func $~lib/thread/SlotRing.at (type $4) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 1796
  i32.lt_s
  if
   i32.const 34592
   i32.const 34640
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  call $~lib/thread/SlotRing#constructor
  local.tee $2
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  local.get $0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  local.get $1
  i32.store offset=4
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
 )
 (func $~lib/thread/SlotRing#pop (type $0) (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 1796
  i32.lt_s
  if
   i32.const 34592
   i32.const 34640
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  block $folding-inner0
   local.get $0
   i32.load offset=4
   local.tee $1
   i32.const 0
   i32.le_s
   br_if $folding-inner0
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store
   local.get $0
   i32.load
   local.set $0
   loop $while-continue|0
    local.get $0
    i32.atomic.load
    local.tee $2
    local.get $0
    i32.atomic.load offset=4
    i32.ge_s
    br_if $folding-inner0
    local.get $2
    i32.const 1
    i32.add
    local.tee $3
    local.get $0
    i32.const 12
    i32.add
    local.get $2
    local.get $1
    i32.rem_s
    i32.const 3
    i32.shl
    i32.add
    local.tee $4
    i32.const 4
    i32.add
    i32.atomic.load
    i32.ne
    br_if $folding-inner0
    local.get $2
    local.get $0
    local.get $2
    local.get $3
    i32.atomic.rmw.cmpxchg
    i32.ne
    br_if $while-continue|0
   end
   local.get $4
   i32.atomic.load
   local.get $4
   local.get $1
   local.get $2
   i32.add
   i32.atomic.store offset=4
   global.get $~lib/memory/__stack_pointer
   i32.const 4
   i32.add
   global.set $~lib/memory/__stack_pointer
   return
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  i32.const -1
 )
 (func $~lib/task-stack/__taskAt (type $1) (result i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 1796
  i32.lt_s
  if
   i32.const 34592
   i32.const 34640
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  i32.const 0
 )
 (func $~lib/task-stack/__driveSlot (type $5)
  (local $0 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 1796
  i32.lt_s
  if
   i32.const 34592
   i32.const 34640
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  call $~lib/task-stack/__taskAt
  local.tee $0
  i32.store
  local.get $0
  if
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   local.get $0
   i32.const 8
   i32.sub
   i32.load
   i32.const 21
   i32.ne
   if
    unreachable
   end
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/rt/tlsf/searchBlock (type $4) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  local.get $1
  i32.const 256
  i32.lt_u
  if
   local.get $1
   i32.const 4
   i32.shr_u
   local.set $1
  else
   local.get $1
   i32.const 536870910
   i32.lt_u
   if
    local.get $1
    i32.const 1
    i32.const 27
    local.get $1
    i32.clz
    i32.sub
    i32.shl
    i32.add
    i32.const 1
    i32.sub
    local.set $1
   end
   local.get $1
   i32.const 31
   local.get $1
   i32.clz
   i32.sub
   local.tee $2
   i32.const 4
   i32.sub
   i32.shr_u
   i32.const 16
   i32.xor
   local.set $1
   local.get $2
   i32.const 7
   i32.sub
   local.set $2
  end
  local.get $1
  i32.const 16
  i32.lt_u
  local.get $2
  i32.const 23
  i32.lt_u
  i32.and
  i32.eqz
  if
   i32.const 0
   i32.const 1424
   i32.const 334
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  local.get $2
  i32.const 2
  i32.shl
  i32.add
  i32.load offset=4
  i32.const -1
  local.get $1
  i32.shl
  i32.and
  local.tee $1
  if (result i32)
   local.get $0
   local.get $1
   i32.ctz
   local.get $2
   i32.const 4
   i32.shl
   i32.add
   i32.const 2
   i32.shl
   i32.add
   i32.load offset=96
  else
   local.get $0
   i32.load
   i32.const -1
   local.get $2
   i32.const 1
   i32.add
   i32.shl
   i32.and
   local.tee $1
   if (result i32)
    local.get $0
    local.get $1
    i32.ctz
    local.tee $1
    i32.const 2
    i32.shl
    i32.add
    i32.load offset=4
    local.tee $2
    i32.eqz
    if
     i32.const 0
     i32.const 1424
     i32.const 347
     i32.const 18
     call $~lib/builtins/abort
     unreachable
    end
    local.get $0
    local.get $2
    i32.ctz
    local.get $1
    i32.const 4
    i32.shl
    i32.add
    i32.const 2
    i32.shl
    i32.add
    i32.load offset=96
   else
    i32.const 0
   end
  end
 )
 (func $~lib/rt/tlsf/initialize (type $5)
  (local $0 i32)
  (local $1 i32)
  memory.size
  local.tee $1
  i32.const 0
  i32.le_s
  if (result i32)
   i32.const 1
   local.get $1
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
  i32.const 34576
  i32.const 0
  i32.store
  i32.const 36144
  i32.const 0
  i32.store
  loop $for-loop|0
   local.get $0
   i32.const 23
   i32.lt_u
   if
    local.get $0
    i32.const 2
    i32.shl
    i32.const 34576
    i32.add
    i32.const 0
    i32.store offset=4
    i32.const 0
    local.set $1
    loop $for-loop|1
     local.get $1
     i32.const 16
     i32.lt_u
     if
      local.get $0
      i32.const 4
      i32.shl
      local.get $1
      i32.add
      i32.const 2
      i32.shl
      i32.const 34576
      i32.add
      i32.const 0
      i32.store offset=96
      local.get $1
      i32.const 1
      i32.add
      local.set $1
      br $for-loop|1
     end
    end
    local.get $0
    i32.const 1
    i32.add
    local.set $0
    br $for-loop|0
   end
  end
  i32.const 34576
  i32.const 36148
  memory.size
  i64.extend_i32_s
  i64.const 16
  i64.shl
  call $~lib/rt/tlsf/addMemory
  i32.const 34576
  global.set $~lib/rt/tlsf/ROOT
 )
 (func $~lib/rt/itcms/visitRoots (type $5)
  (local $0 i32)
  (local $1 i32)
  global.get $~lib/thread/executors
  local.tee $0
  if
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $~lib/thread/mainExecutorInstance
  local.tee $0
  if
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  i32.const 1280
  call $~lib/rt/itcms/__visit
  i32.const 1536
  call $~lib/rt/itcms/__visit
  i32.const 1088
  call $~lib/rt/itcms/__visit
  global.get $~lib/rt/itcms/pinSpace
  local.tee $1
  i32.load offset=4
  i32.const -4
  i32.and
  local.set $0
  loop $while-continue|0
   local.get $0
   local.get $1
   i32.ne
   if
    local.get $0
    i32.load offset=4
    i32.const 3
    i32.and
    i32.const 3
    i32.ne
    if
     i32.const 0
     i32.const 1152
     i32.const 160
     i32.const 16
     call $~lib/builtins/abort
     unreachable
    end
    local.get $0
    i32.const 20
    i32.add
    call $~lib/rt/__visit_members
    local.get $0
    i32.load offset=4
    i32.const -4
    i32.and
    local.set $0
    br $while-continue|0
   end
  end
 )
 (func $~lib/function/Function<%28i32%2Ci32%29=>void>~visit (type $2) (param $0 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 1796
  i32.lt_s
  if
   i32.const 34592
   i32.const 34640
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $0
  i32.load offset=4
  call $~lib/rt/itcms/__visit
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/array/ensureCapacity (type $3) (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 1796
  i32.lt_s
  if
   i32.const 34592
   i32.const 34640
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $1
  local.get $0
  i32.load offset=8
  local.tee $2
  i32.const 2
  i32.shr_u
  i32.gt_u
  if
   local.get $1
   i32.const 268435455
   i32.gt_u
   if
    i32.const 1536
    i32.const 1488
    i32.const 19
    i32.const 48
    call $~lib/builtins/abort
    unreachable
   end
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store
   block $__inlined_func$~lib/rt/itcms/__renew$376
    i32.const 1073741820
    local.get $2
    i32.const 1
    i32.shl
    local.tee $2
    local.get $2
    i32.const 1073741820
    i32.ge_u
    select
    local.tee $2
    i32.const 8
    local.get $1
    local.get $1
    i32.const 8
    i32.le_u
    select
    i32.const 2
    i32.shl
    local.tee $1
    local.get $1
    local.get $2
    i32.lt_u
    select
    local.tee $3
    local.get $0
    i32.load
    local.tee $2
    i32.const 20
    i32.sub
    local.tee $4
    i32.load
    i32.const -4
    i32.and
    i32.const 16
    i32.sub
    i32.le_u
    if
     local.get $4
     local.get $3
     i32.store offset=16
     local.get $2
     local.set $1
     br $__inlined_func$~lib/rt/itcms/__renew$376
    end
    local.get $3
    local.get $4
    i32.load offset=12
    call $~lib/rt/itcms/__new
    local.tee $1
    local.get $2
    local.get $3
    local.get $4
    i32.load offset=16
    local.tee $4
    local.get $3
    local.get $4
    i32.lt_u
    select
    memory.copy
   end
   local.get $1
   local.get $2
   i32.ne
   if
    local.get $0
    local.get $1
    i32.store
    local.get $0
    local.get $1
    i32.store offset=4
    local.get $0
    local.get $1
    i32.const 0
    call $~lib/rt/itcms/__link
   end
   local.get $0
   local.get $3
   i32.store offset=8
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/array/Array<~lib/task/Waiter>#push (type $3) (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 1796
  i32.lt_s
  if
   i32.const 34592
   i32.const 34640
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $0
  local.get $0
  i32.load offset=12
  local.tee $2
  i32.const 1
  i32.add
  local.tee $3
  call $~lib/array/ensureCapacity
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $0
  i32.load offset=4
  local.get $2
  i32.const 2
  i32.shl
  i32.add
  local.get $1
  i32.store
  local.get $0
  local.get $1
  i32.const 1
  call $~lib/rt/itcms/__link
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $0
  local.get $3
  i32.store offset=12
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/array/Array<~lib/task/TaskBase|null>#get:length (type $0) (param $0 i32) (result i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 1796
  i32.lt_s
  if
   i32.const 34592
   i32.const 34640
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $0
  i32.load offset=12
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/thread/installWakeSink~anonymous|0 (type $3) (param $0 i32) (param $1 i32)
  unreachable
 )
 (func $~lib/thread/bindExecutor (type $0) (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 20
  i32.sub
  global.set $~lib/memory/__stack_pointer
  block $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i32.const 1796
   i32.lt_s
   br_if $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.const 20
   memory.fill
   global.get $~lib/memory/__stack_pointer
   global.get $~lib/thread/executors
   local.tee $1
   i32.store
   local.get $1
   i32.eqz
   if
    global.get $~lib/memory/__stack_pointer
    global.get $~lib/memory/__stack_pointer
    i32.const 16
    i32.sub
    global.set $~lib/memory/__stack_pointer
    global.get $~lib/memory/__stack_pointer
    i32.const 1796
    i32.lt_s
    br_if $folding-inner1
    global.get $~lib/memory/__stack_pointer
    i64.const 0
    i64.store
    global.get $~lib/memory/__stack_pointer
    i64.const 0
    i64.store offset=8
    global.get $~lib/memory/__stack_pointer
    i32.const 16
    i32.const 17
    call $~lib/rt/itcms/__new
    local.tee $1
    i32.store
    global.get $~lib/memory/__stack_pointer
    local.get $1
    i32.store offset=4
    local.get $1
    i32.const 0
    i32.store
    local.get $1
    i32.const 0
    i32.const 0
    call $~lib/rt/itcms/__link
    global.get $~lib/memory/__stack_pointer
    local.get $1
    i32.store offset=4
    local.get $1
    i32.const 0
    i32.store offset=4
    global.get $~lib/memory/__stack_pointer
    local.get $1
    i32.store offset=4
    local.get $1
    i32.const 0
    i32.store offset=8
    global.get $~lib/memory/__stack_pointer
    local.get $1
    i32.store offset=4
    local.get $1
    i32.const 0
    i32.store offset=12
    global.get $~lib/memory/__stack_pointer
    i32.const 32
    i32.const 1
    call $~lib/rt/itcms/__new
    local.tee $2
    i32.store offset=8
    global.get $~lib/memory/__stack_pointer
    local.get $1
    i32.store offset=4
    global.get $~lib/memory/__stack_pointer
    local.get $2
    i32.store offset=12
    local.get $1
    local.get $2
    i32.store
    local.get $1
    local.get $2
    i32.const 0
    call $~lib/rt/itcms/__link
    global.get $~lib/memory/__stack_pointer
    local.get $1
    i32.store offset=4
    local.get $1
    local.get $2
    i32.store offset=4
    global.get $~lib/memory/__stack_pointer
    local.get $1
    i32.store offset=4
    local.get $1
    i32.const 32
    i32.store offset=8
    global.get $~lib/memory/__stack_pointer
    local.get $1
    i32.store offset=4
    local.get $1
    i32.const 0
    i32.store offset=12
    global.get $~lib/memory/__stack_pointer
    i32.const 16
    i32.add
    global.set $~lib/memory/__stack_pointer
    local.get $1
    i32.store
    local.get $1
    global.set $~lib/thread/executors
   end
   loop $while-continue|0
    global.get $~lib/memory/__stack_pointer
    local.get $1
    i32.store offset=4
    local.get $1
    call $~lib/array/Array<~lib/task/TaskBase|null>#get:length
    local.get $0
    i32.le_s
    if
     global.get $~lib/memory/__stack_pointer
     local.get $1
     i32.store offset=4
     local.get $1
     i32.const 0
     call $~lib/array/Array<~lib/task/Waiter>#push
     br $while-continue|0
    end
   end
   global.get $~lib/memory/__stack_pointer
   i32.const 1584
   i32.store offset=8
   global.get $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 1584
   i32.store offset=4
   global.get $~lib/thread/__controlBase
   i32.const -64
   i32.sub
   local.get $0
   global.get $~lib/thread/__controlStride
   i32.mul
   i32.add
   local.tee $5
   global.get $~lib/thread/__ringCapacity
   i32.const 1
   i32.shl
   local.tee $2
   i32.const 3
   i32.add
   i32.const 2
   i32.shl
   i32.add
   local.set $4
   local.get $2
   i32.const 2
   i32.shl
   local.tee $2
   local.get $2
   local.get $5
   i32.add
   i32.add
   i32.const 24
   i32.add
   local.set $2
   global.get $~lib/memory/__stack_pointer
   i32.const 20
   i32.sub
   global.set $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 1796
   i32.lt_s
   br_if $folding-inner1
   global.get $~lib/thread/__ringCapacity
   local.set $6
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.const 20
   memory.fill
   global.get $~lib/memory/__stack_pointer
   i32.const 1584
   i32.store
   global.get $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 12
   i32.sub
   global.set $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 1796
   i32.lt_s
   br_if $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i64.const 0
   i64.store
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.store offset=8
   global.get $~lib/memory/__stack_pointer
   i32.const 17
   i32.const 14
   call $~lib/rt/itcms/__new
   local.tee $7
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $7
   i32.store offset=4
   local.get $7
   i32.const 0
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $7
   i32.store offset=4
   local.get $7
   i32.const 0
   i32.store offset=4
   local.get $7
   i32.const 0
   i32.const 0
   call $~lib/rt/itcms/__link
   global.get $~lib/memory/__stack_pointer
   local.get $7
   i32.store offset=4
   local.get $7
   i32.const 0
   i32.store offset=8
   local.get $7
   i32.const 0
   i32.const 0
   call $~lib/rt/itcms/__link
   global.get $~lib/memory/__stack_pointer
   local.get $7
   i32.store offset=4
   local.get $7
   i32.const 0
   i32.store offset=12
   local.get $7
   i32.const 0
   i32.const 0
   call $~lib/rt/itcms/__link
   global.get $~lib/memory/__stack_pointer
   local.get $7
   i32.store offset=4
   local.get $7
   i32.const 0
   i32.store8 offset=16
   global.get $~lib/memory/__stack_pointer
   local.get $7
   i32.store offset=4
   local.get $7
   local.get $0
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $7
   i32.store offset=4
   global.get $~lib/memory/__stack_pointer
   i32.const 1584
   i32.store offset=8
   local.get $7
   i32.const 1584
   i32.store offset=12
   local.get $7
   i32.const 1584
   i32.const 0
   call $~lib/rt/itcms/__link
   global.get $~lib/memory/__stack_pointer
   local.get $7
   i32.store offset=4
   call $~lib/thread/SlotRing#constructor
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store offset=8
   local.get $7
   local.get $8
   i32.store offset=4
   local.get $7
   local.get $8
   i32.const 0
   call $~lib/rt/itcms/__link
   global.get $~lib/memory/__stack_pointer
   local.get $7
   i32.store offset=4
   call $~lib/thread/SlotRing#constructor
   local.set $8
   global.get $~lib/memory/__stack_pointer
   local.get $8
   i32.store offset=8
   local.get $7
   local.get $8
   i32.store offset=8
   local.get $7
   local.get $8
   i32.const 0
   call $~lib/rt/itcms/__link
   global.get $~lib/memory/__stack_pointer
   i32.const 12
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $7
   i32.store offset=4
   global.get $~lib/memory/__stack_pointer
   local.get $5
   local.get $6
   call $~lib/thread/SlotRing.at
   local.tee $5
   i32.store offset=8
   global.get $~lib/memory/__stack_pointer
   local.get $5
   i32.store
   local.get $5
   local.get $2
   i32.store offset=8
   global.get $~lib/memory/__stack_pointer
   local.get $4
   local.get $6
   call $~lib/thread/SlotRing.at
   local.tee $4
   i32.store offset=12
   global.get $~lib/memory/__stack_pointer
   local.get $4
   i32.store
   local.get $4
   local.get $2
   i32.store offset=8
   global.get $~lib/memory/__stack_pointer
   local.get $7
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $5
   i32.store offset=16
   local.get $7
   local.get $5
   i32.store offset=4
   local.get $7
   local.get $5
   i32.const 0
   call $~lib/rt/itcms/__link
   global.get $~lib/memory/__stack_pointer
   local.get $7
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $4
   i32.store offset=16
   local.get $7
   local.get $4
   i32.store offset=8
   local.get $7
   local.get $4
   i32.const 0
   call $~lib/rt/itcms/__link
   global.get $~lib/memory/__stack_pointer
   i32.const 20
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $7
   i32.store offset=12
   global.get $~lib/memory/__stack_pointer
   local.get $1
   i32.store offset=4
   global.get $~lib/memory/__stack_pointer
   local.get $7
   i32.store offset=16
   global.get $~lib/memory/__stack_pointer
   i32.const 4
   i32.sub
   global.set $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 1796
   i32.lt_s
   br_if $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $1
   i32.store
   local.get $0
   local.get $1
   i32.load offset=12
   i32.ge_u
   if
    local.get $0
    i32.const 0
    i32.lt_s
    if
     i32.const 1280
     i32.const 1488
     i32.const 130
     i32.const 22
     call $~lib/builtins/abort
     unreachable
    end
    local.get $1
    local.get $0
    i32.const 1
    i32.add
    local.tee $2
    call $~lib/array/ensureCapacity
    global.get $~lib/memory/__stack_pointer
    local.get $1
    i32.store
    local.get $1
    local.get $2
    i32.store offset=12
   end
   global.get $~lib/memory/__stack_pointer
   local.get $1
   i32.store
   local.get $1
   i32.load offset=4
   local.get $0
   i32.const 2
   i32.shl
   i32.add
   local.get $7
   i32.store
   local.get $1
   local.get $7
   i32.const 1
   call $~lib/rt/itcms/__link
   global.get $~lib/memory/__stack_pointer
   i32.const 4
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $0
   i32.eqz
   if
    local.get $7
    global.set $~lib/thread/mainExecutorInstance
   end
   global.get $~lib/memory/__stack_pointer
   i32.const 20
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $7
   return
  end
  i32.const 34592
  i32.const 34640
  i32.const 1
  i32.const 1
  call $~lib/builtins/abort
  unreachable
 )
 (func $~lib/thread/__workerMain (type $0) (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.sub
  global.set $~lib/memory/__stack_pointer
  block $folding-inner0
   global.get $~lib/memory/__stack_pointer
   i32.const 1796
   i32.lt_s
   br_if $folding-inner0
   global.get $~lib/memory/__stack_pointer
   i64.const 0
   i64.store
   global.get $~lib/memory/__stack_pointer
   i64.const 0
   i64.store offset=8
   block $__inlined_func$~lib/thread/controlBlockBase$291
    global.get $~lib/thread/__controlBase
    local.tee $1
    br_if $__inlined_func$~lib/thread/controlBlockBase$291
    i32.const 0
    local.set $1
    i32.const 65536
    i32.atomic.load
    i32.const 1414025796
    i32.ne
    br_if $__inlined_func$~lib/thread/controlBlockBase$291
    i32.const 65536
    local.set $1
   end
   local.get $1
   i32.eqz
   if
    global.get $~lib/memory/__stack_pointer
    i32.const 16
    i32.add
    global.set $~lib/memory/__stack_pointer
    i32.const -2
    return
   end
   local.get $0
   i32.const 0
   i32.le_s
   local.get $1
   i32.atomic.load offset=4
   local.tee $2
   local.get $0
   i32.le_s
   i32.or
   if
    global.get $~lib/memory/__stack_pointer
    i32.const 16
    i32.add
    global.set $~lib/memory/__stack_pointer
    i32.const -1
    return
   end
   local.get $1
   global.set $~lib/thread/__controlBase
   local.get $1
   i32.atomic.load offset=8
   global.set $~lib/thread/__controlStride
   local.get $1
   i32.atomic.load offset=12
   global.set $~lib/thread/__ringCapacity
   local.get $2
   global.set $~lib/thread/__executorTotal
   local.get $1
   i32.atomic.load offset=16
   global.set $~lib/thread/requestCount
   local.get $1
   i32.const -64
   i32.sub
   local.get $2
   global.get $~lib/thread/__controlStride
   i32.mul
   i32.add
   global.set $~lib/thread/requestBase
   global.get $~lib/thread/requestBase
   global.get $~lib/thread/requestCount
   i32.const 4
   i32.shl
   i32.add
   global.set $~lib/thread/freeRingBase
   local.get $0
   global.set $~lib/task-stack/selfExecutor
   global.get $~lib/rt/common/HEAP_BASE
   local.tee $1
   global.get $~lib/thread/__ringCapacity
   i32.const 3
   i32.shl
   local.tee $2
   global.get $~lib/thread/__controlBase
   local.get $0
   global.get $~lib/thread/__controlStride
   i32.mul
   i32.add
   local.get $2
   i32.add
   i32.add
   i32.const 88
   i32.add
   local.tee $2
   i32.atomic.load offset=4
   local.tee $3
   local.get $2
   i32.atomic.load offset=8
   i32.add
   i32.ge_u
   local.get $1
   local.get $3
   i32.le_u
   i32.or
   if
    global.get $~lib/memory/__stack_pointer
    i32.const 16
    i32.add
    global.set $~lib/memory/__stack_pointer
    i32.const -3
    return
   end
   global.get $~lib/memory/__stack_pointer
   local.get $0
   call $~lib/thread/bindExecutor
   local.tee $0
   i32.store
   global.get $~lib/thread/sinkInstalled
   i32.eqz
   if
    global.get $~lib/memory/__stack_pointer
    i32.const 4
    i32.sub
    global.set $~lib/memory/__stack_pointer
    global.get $~lib/memory/__stack_pointer
    i32.const 1796
    i32.lt_s
    br_if $folding-inner0
    global.get $~lib/memory/__stack_pointer
    i32.const 0
    i32.store
    global.get $~lib/memory/__stack_pointer
    i32.const 1680
    i32.store
    global.get $~lib/memory/__stack_pointer
    i32.const 4
    i32.add
    global.set $~lib/memory/__stack_pointer
    i32.const 1
    global.set $~lib/thread/sinkInstalled
   end
   local.get $2
   i32.atomic.load offset=16
   local.tee $1
   i32.const 0
   i32.ge_s
   if
    global.get $~lib/memory/__stack_pointer
    local.get $0
    i32.store offset=4
    local.get $2
    i32.atomic.load offset=20
    drop
    local.get $1
    call $~lib/thread/__serveOne
   end
   loop $while-continue|0
    global.get $~lib/memory/__stack_pointer
    local.get $0
    i32.store offset=4
    local.get $0
    i32.load8_u offset=16
    if (result i32)
     i32.const 0
    else
     local.get $2
     i32.atomic.load offset=12
     i32.const 2
     i32.ne
    end
    if
     block $while-break|0
      global.get $~lib/memory/__stack_pointer
      local.get $0
      i32.store offset=8
      global.get $~lib/memory/__stack_pointer
      local.get $0
      i32.load offset=8
      local.tee $1
      i32.store offset=4
      local.get $1
      call $~lib/thread/SlotRing#get:depth
      i32.const 0
      i32.gt_s
      if
       global.get $~lib/memory/__stack_pointer
       local.get $0
       i32.store offset=4
       local.get $0
       call $~lib/thread/__drainInbox
       br $while-continue|0
      end
      global.get $~lib/memory/__stack_pointer
      local.get $0
      i32.store offset=8
      global.get $~lib/memory/__stack_pointer
      local.get $0
      i32.load offset=4
      local.tee $1
      i32.store offset=4
      local.get $1
      call $~lib/thread/SlotRing#get:depth
      i32.const 0
      i32.gt_s
      if
       global.get $~env
       global.get $~lib/memory/__stack_pointer
       local.get $0
       i32.store offset=4
       global.get $~lib/memory/__stack_pointer
       local.get $0
       i32.load offset=12
       local.tee $3
       i32.store offset=12
       local.get $3
       i32.load offset=4
       global.set $~env
       global.get $~lib/memory/__stack_pointer
       local.get $0
       i32.store offset=4
       local.get $0
       local.get $3
       i32.load
       call_indirect $0 (type $0)
       local.set $3
       global.set $~env
       local.get $3
       br_if $while-break|0
       br $while-continue|0
      end
      local.get $2
      i32.atomic.load
      local.set $1
      global.get $~lib/memory/__stack_pointer
      local.get $0
      i32.store offset=8
      global.get $~lib/memory/__stack_pointer
      local.get $0
      i32.load offset=8
      local.tee $3
      i32.store offset=4
      local.get $3
      call $~lib/thread/SlotRing#get:depth
      i32.const 0
      i32.gt_s
      if (result i32)
       i32.const 1
      else
       global.get $~lib/memory/__stack_pointer
       local.get $0
       i32.store offset=8
       global.get $~lib/memory/__stack_pointer
       local.get $0
       i32.load offset=4
       local.tee $3
       i32.store offset=4
       local.get $3
       call $~lib/thread/SlotRing#get:depth
       i32.const 0
       i32.gt_s
      end
      br_if $while-continue|0
      local.get $2
      local.get $1
      i64.const -1
      memory.atomic.wait32
      drop
      br $while-continue|0
     end
    end
   end
   local.get $2
   i32.const 12
   i32.add
   local.tee $0
   i32.const 2
   i32.atomic.store
   local.get $0
   i32.const -1
   memory.atomic.notify
   drop
   local.get $2
   i32.const -1
   memory.atomic.notify
   drop
   global.get $~lib/memory/__stack_pointer
   i32.const 16
   i32.add
   global.set $~lib/memory/__stack_pointer
   i32.const 0
   return
  end
  i32.const 34592
  i32.const 34640
  i32.const 1
  i32.const 1
  call $~lib/builtins/abort
  unreachable
 )
 (func $~lib/thread/__workerArenaSize (type $0) (param $0 i32) (result i32)
  (local $1 i32)
  block $__inlined_func$~lib/thread/controlBlockBase$85
   global.get $~lib/thread/__controlBase
   local.tee $1
   br_if $__inlined_func$~lib/thread/controlBlockBase$85
   i32.const 0
   local.set $1
   i32.const 65536
   i32.atomic.load
   i32.const 1414025796
   i32.ne
   br_if $__inlined_func$~lib/thread/controlBlockBase$85
   i32.const 65536
   local.set $1
  end
  local.get $1
  i32.eqz
  if
   i32.const 0
   return
  end
  local.get $0
  i32.const 0
  i32.le_s
  local.get $1
  i32.atomic.load offset=4
  local.get $0
  i32.le_s
  i32.or
  if
   i32.const 0
   return
  end
  local.get $1
  local.get $0
  local.get $1
  i32.atomic.load offset=8
  i32.mul
  i32.add
  local.get $1
  i32.atomic.load offset=12
  i32.const 4
  i32.shl
  i32.add
  i32.atomic.load offset=96
 )
 (func $~lib/thread/__workerArenaBase (type $0) (param $0 i32) (result i32)
  (local $1 i32)
  block $__inlined_func$~lib/thread/controlBlockBase$84
   global.get $~lib/thread/__controlBase
   local.tee $1
   br_if $__inlined_func$~lib/thread/controlBlockBase$84
   i32.const 0
   local.set $1
   i32.const 65536
   i32.atomic.load
   i32.const 1414025796
   i32.ne
   br_if $__inlined_func$~lib/thread/controlBlockBase$84
   i32.const 65536
   local.set $1
  end
  local.get $1
  i32.eqz
  if
   i32.const 0
   return
  end
  local.get $0
  i32.const 0
  i32.le_s
  local.get $1
  i32.atomic.load offset=4
  local.get $0
  i32.le_s
  i32.or
  if
   i32.const 0
   return
  end
  local.get $1
  local.get $0
  local.get $1
  i32.atomic.load offset=8
  i32.mul
  i32.add
  local.get $1
  i32.atomic.load offset=12
  i32.const 4
  i32.shl
  i32.add
  i32.atomic.load offset=92
 )
 (func $~lib/thread/__threadJoin (type $0) (param $0 i32) (result i32)
  (local $1 i32)
  global.get $~lib/thread/__controlBase
  i32.eqz
  if
   i32.const -1
   return
  end
  local.get $0
  i32.const 0
  i32.lt_s
  local.get $0
  global.get $~lib/thread/__executorTotal
  i32.ge_s
  i32.or
  if
   i32.const -1
   return
  end
  global.get $~lib/thread/__ringCapacity
  i32.const 3
  i32.shl
  local.tee $1
  global.get $~lib/thread/__controlBase
  local.get $0
  global.get $~lib/thread/__controlStride
  i32.mul
  i32.add
  local.get $1
  i32.add
  i32.add
  i32.const 100
  i32.add
  local.set $0
  loop $while-continue|0
   local.get $0
   i32.atomic.load
   local.tee $1
   i32.const 2
   i32.ne
   if
    local.get $0
    local.get $1
    i64.const -1
    memory.atomic.wait32
    drop
    br $while-continue|0
   end
  end
  i32.const 0
 )
 (func $~lib/thread/__threadInit (type $0) (param $0 i32) (result i32)
  (local $1 i32)
  global.get $~lib/thread/__controlBase
  if
   i32.const 0
   return
  end
  call $~lib/thread/__executorCount
  local.tee $1
  i32.const 0
  i32.le_s
  if
   i32.const -1
   return
  end
  local.get $0
  local.get $1
  call $~lib/thread/__carveThreadLayout
 )
 (func $~lib/thread/__spawnThread (type $10) (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  (local $3 i32)
  global.get $~lib/thread/__controlBase
  i32.eqz
  if
   i32.const -1
   return
  end
  local.get $0
  i32.const 0
  i32.le_s
  local.get $0
  global.get $~lib/thread/__executorTotal
  i32.ge_s
  i32.or
  if
   i32.const -1
   return
  end
  global.get $~lib/thread/__ringCapacity
  i32.const 3
  i32.shl
  local.tee $3
  global.get $~lib/thread/__controlBase
  local.get $0
  global.get $~lib/thread/__controlStride
  i32.mul
  i32.add
  local.get $3
  i32.add
  i32.add
  i32.const 88
  i32.add
  local.tee $3
  i32.atomic.load offset=12
  if
   i32.const -2
   return
  end
  local.get $3
  local.get $1
  i32.atomic.store offset=16
  local.get $3
  local.get $2
  i32.atomic.store offset=20
  local.get $0
  call $~lib/thread/__startThread
  local.tee $0
  if
   local.get $3
   i32.const 2
   i32.atomic.store offset=12
  end
  local.get $0
 )
 (func $~lib/thread/__mainStep__ (type $0) (param $0 i32) (result i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  block $folding-inner0
   global.get $~lib/memory/__stack_pointer
   i32.const 1796
   i32.lt_s
   br_if $folding-inner0
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store
   local.get $0
   call $~lib/thread/__drainInbox
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store
   global.get $~lib/memory/__stack_pointer
   i32.const 12
   i32.sub
   global.set $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 1796
   i32.lt_s
   br_if $folding-inner0
   global.get $~lib/memory/__stack_pointer
   i64.const 0
   i64.store
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.store offset=8
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.load offset=4
   local.tee $0
   i32.store
   block $__inlined_func$~lib/thread/driveReady$384
    local.get $0
    call $~lib/thread/SlotRing#pop
    i32.const 0
    i32.lt_s
    br_if $__inlined_func$~lib/thread/driveReady$384
    global.get $~lib/memory/__stack_pointer
    call $~lib/task-stack/__taskAt
    local.tee $0
    i32.store offset=8
    local.get $0
    if
     global.get $~lib/memory/__stack_pointer
     local.get $0
     i32.store
     local.get $0
     i32.load8_u offset=8
     br_if $__inlined_func$~lib/thread/driveReady$384
    end
    call $~lib/task-stack/__driveSlot
   end
   global.get $~lib/memory/__stack_pointer
   i32.const 12
   i32.add
   global.set $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 4
   i32.add
   global.set $~lib/memory/__stack_pointer
   i32.const 0
   return
  end
  i32.const 34592
  i32.const 34640
  i32.const 1
  i32.const 1
  call $~lib/builtins/abort
  unreachable
 )
 (func $~lib/thread/__mainArenaSize (type $1) (result i32)
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
  i32.atomic.load offset=96
 )
 (func $~lib/thread/__mainArenaBase (type $1) (result i32)
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
  i32.atomic.load offset=92
 )
 (func $~lib/thread/__executorExit (type $0) (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  block $folding-inner2
   global.get $~lib/memory/__stack_pointer
   i32.const 1796
   i32.lt_s
   br_if $folding-inner2
   global.get $~lib/memory/__stack_pointer
   i64.const 0
   i64.store
   block $folding-inner1
    global.get $~lib/thread/__controlBase
    i32.eqz
    br_if $folding-inner1
    local.get $0
    i32.const 0
    i32.lt_s
    local.tee $1
    local.get $0
    global.get $~lib/thread/__executorTotal
    i32.ge_s
    i32.or
    br_if $folding-inner1
    global.get $~lib/memory/__stack_pointer
    global.get $~lib/memory/__stack_pointer
    i32.const 8
    i32.sub
    global.set $~lib/memory/__stack_pointer
    global.get $~lib/memory/__stack_pointer
    i32.const 1796
    i32.lt_s
    br_if $folding-inner2
    global.get $~lib/thread/__ringCapacity
    i32.const 3
    i32.shl
    local.tee $3
    global.get $~lib/thread/__controlBase
    local.get $0
    global.get $~lib/thread/__controlStride
    i32.mul
    i32.add
    i32.add
    local.get $3
    i32.add
    i32.const 88
    i32.add
    local.set $4
    global.get $~lib/memory/__stack_pointer
    i64.const 0
    i64.store
    global.get $~lib/memory/__stack_pointer
    global.get $~lib/thread/executors
    local.tee $3
    i32.store
    block $__inlined_func$~lib/thread/__executorOf$389
     local.get $1
     local.get $3
     i32.eqz
     i32.or
     if (result i32)
      i32.const 1
     else
      global.get $~lib/memory/__stack_pointer
      local.get $3
      i32.store offset=4
      local.get $3
      call $~lib/array/Array<~lib/task/TaskBase|null>#get:length
      local.get $0
      i32.le_s
     end
     if
      global.get $~lib/memory/__stack_pointer
      i32.const 8
      i32.add
      global.set $~lib/memory/__stack_pointer
      i32.const 0
      local.set $0
      br $__inlined_func$~lib/thread/__executorOf$389
     end
     global.get $~lib/memory/__stack_pointer
     local.get $3
     i32.store offset=4
     global.get $~lib/memory/__stack_pointer
     i32.const 8
     i32.sub
     global.set $~lib/memory/__stack_pointer
     global.get $~lib/memory/__stack_pointer
     i32.const 1796
     i32.lt_s
     br_if $folding-inner2
     global.get $~lib/memory/__stack_pointer
     i64.const 0
     i64.store
     global.get $~lib/memory/__stack_pointer
     local.get $3
     i32.store
     local.get $0
     local.get $3
     i32.load offset=12
     i32.ge_u
     if
      i32.const 1280
      i32.const 1488
      i32.const 114
      i32.const 42
      call $~lib/builtins/abort
      unreachable
     end
     global.get $~lib/memory/__stack_pointer
     local.get $3
     i32.store
     global.get $~lib/memory/__stack_pointer
     local.get $3
     i32.load offset=4
     local.get $0
     i32.const 2
     i32.shl
     i32.add
     i32.load
     local.tee $0
     i32.store offset=4
     global.get $~lib/memory/__stack_pointer
     i32.const 8
     i32.add
     global.set $~lib/memory/__stack_pointer
     global.get $~lib/memory/__stack_pointer
     i32.const 8
     i32.add
     global.set $~lib/memory/__stack_pointer
    end
    local.get $0
    i32.store
    local.get $0
    if
     global.get $~lib/memory/__stack_pointer
     local.get $0
     i32.store offset=4
     local.get $0
     i32.const 1
     i32.store8 offset=16
    end
    local.get $4
    i32.const 12
    i32.add
    local.tee $0
    i32.const 2
    i32.atomic.store
    local.get $0
    i32.const -1
    memory.atomic.notify
    drop
    local.get $4
    i32.const -1
    memory.atomic.notify
    drop
    global.get $~lib/memory/__stack_pointer
    i32.const 8
    i32.add
    global.set $~lib/memory/__stack_pointer
    i32.const 0
    return
   end
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.add
   global.set $~lib/memory/__stack_pointer
   i32.const -1
   return
  end
  i32.const 34592
  i32.const 34640
  i32.const 1
  i32.const 1
  call $~lib/builtins/abort
  unreachable
 )
 (func $~lib/thread/__carveThreadLayout (type $4) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  (local $10 i32)
  i32.const 1024
  local.get $0
  local.get $0
  i32.const 0
  i32.le_s
  select
  local.tee $6
  i32.const 4
  i32.shl
  local.tee $0
  i32.const 63
  i32.add
  i32.const -16
  i32.and
  local.tee $3
  local.get $1
  i32.mul
  local.set $7
  local.get $0
  local.get $7
  i32.add
  local.get $6
  i32.const 2
  i32.shl
  i32.add
  i32.const 76
  i32.add
  local.tee $8
  i32.const 65536
  i32.add
  local.tee $4
  local.get $1
  i32.const 1
  i32.sub
  local.tee $5
  i32.const 20
  i32.shl
  i32.add
  i32.const 4259839
  i32.add
  i32.const 16
  i32.shr_u
  local.tee $9
  memory.size
  local.tee $10
  i32.gt_s
  if (result i32)
   local.get $9
   local.get $10
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
  local.get $8
  memory.fill
  i32.const 65536
  global.set $~lib/thread/__controlBase
  i32.const 65536
  global.set $~lib/thread/__heapBase
  local.get $3
  global.set $~lib/thread/__controlStride
  local.get $6
  global.set $~lib/thread/__ringCapacity
  local.get $1
  global.set $~lib/thread/__executorTotal
  local.get $7
  i32.const 65600
  i32.add
  global.set $~lib/thread/requestBase
  global.get $~lib/thread/requestBase
  local.get $0
  i32.add
  global.set $~lib/thread/freeRingBase
  local.get $6
  global.set $~lib/thread/requestCount
  i32.const 65536
  i32.const 1414025796
  i32.atomic.store
  i32.const 65540
  local.get $1
  i32.atomic.store
  i32.const 65544
  local.get $3
  i32.atomic.store
  i32.const 65548
  local.get $6
  i32.atomic.store
  i32.const 65552
  local.get $6
  i32.atomic.store
  loop $for-loop|0
   local.get $1
   local.get $2
   i32.gt_s
   if
    i32.const 0
    local.set $0
    local.get $2
    local.get $3
    i32.mul
    i32.const 65600
    i32.add
    local.tee $7
    i32.const 0
    i32.atomic.store
    local.get $7
    i32.const 0
    i32.atomic.store offset=4
    local.get $7
    local.get $6
    i32.atomic.store offset=8
    loop $for-loop|00
     local.get $0
     local.get $6
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
      local.get $0
      i32.atomic.store offset=4
      local.get $0
      i32.const 1
      i32.add
      local.set $0
      br $for-loop|00
     end
    end
    i32.const 0
    local.set $0
    local.get $7
    global.get $~lib/thread/__ringCapacity
    i32.const 1
    i32.shl
    local.tee $8
    i32.const 3
    i32.add
    i32.const 2
    i32.shl
    i32.add
    local.tee $9
    i32.const 0
    i32.atomic.store
    local.get $9
    i32.const 0
    i32.atomic.store offset=4
    local.get $9
    local.get $6
    i32.atomic.store offset=8
    loop $for-loop|01
     local.get $0
     local.get $6
     i32.lt_s
     if
      local.get $9
      i32.const 12
      i32.add
      local.get $0
      i32.const 3
      i32.shl
      i32.add
      local.tee $10
      i32.const 0
      i32.atomic.store
      local.get $10
      local.get $0
      i32.atomic.store offset=4
      local.get $0
      i32.const 1
      i32.add
      local.set $0
      br $for-loop|01
     end
    end
    local.get $8
    i32.const 2
    i32.shl
    local.tee $0
    local.get $0
    local.get $7
    i32.add
    i32.add
    i32.const 24
    i32.add
    local.tee $0
    i32.const 0
    i32.atomic.store
    local.get $0
    local.get $2
    if (result i32)
     local.get $4
     local.get $2
     i32.const 1
     i32.sub
     i32.const 20
     i32.shl
     i32.add
    else
     i32.const 0
    end
    i32.atomic.store offset=4
    local.get $0
    i32.const 1048576
    i32.const 0
    local.get $2
    select
    i32.atomic.store offset=8
    local.get $0
    local.get $2
    i32.eqz
    i32.atomic.store offset=12
    local.get $0
    i32.const -1
    i32.atomic.store offset=16
    local.get $0
    i32.const 0
    i32.atomic.store offset=20
    local.get $2
    i32.const 1
    i32.add
    local.set $2
    br $for-loop|0
   end
  end
  global.get $~lib/thread/freeRingBase
  local.tee $0
  i32.const 0
  i32.atomic.store
  local.get $0
  local.get $6
  i32.atomic.store offset=4
  local.get $0
  local.get $6
  i32.atomic.store offset=8
  i32.const 0
  local.set $1
  loop $for-loop|1
   local.get $1
   local.get $6
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
  local.get $1
  i32.const 65600
  i32.add
  i32.add
  local.tee $1
  local.get $4
  local.get $5
  i32.const 20
  i32.shl
  i32.add
  local.tee $2
  i32.atomic.store offset=28
  local.get $1
  local.get $0
  local.get $2
  i32.sub
  i32.atomic.store offset=32
  i32.const 0
 )
 (func $~lib/task/noopWake (type $3) (param $0 i32) (param $1 i32)
  unreachable
 )
 (func $~lib/task-stack/__parkOn (type $2) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 28
  i32.sub
  global.set $~lib/memory/__stack_pointer
  block $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i32.const 1796
   i32.lt_s
   br_if $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.const 28
   memory.fill
   global.get $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.sub
   global.set $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 1796
   i32.lt_s
   br_if $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i64.const 0
   i64.store
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.store
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.add
   global.set $~lib/memory/__stack_pointer
   i32.const 0
   i32.store
   global.get $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.sub
   global.set $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 1796
   i32.lt_s
   br_if $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i64.const 0
   i64.store
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.const 7
   call $~lib/rt/itcms/__new
   local.tee $2
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $2
   i32.store offset=4
   global.get $~lib/memory/__stack_pointer
   local.get $2
   call $~lib/object/Object#constructor
   local.tee $2
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $2
   i32.store offset=4
   local.get $2
   i32.const 0
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $2
   i32.store offset=4
   local.get $2
   i32.const 0
   i32.store offset=4
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $2
   i32.store offset=16
   global.get $~lib/memory/__stack_pointer
   local.get $2
   i32.store offset=4
   local.get $2
   global.get $~lib/task-stack/selfExecutor
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $2
   i32.store offset=4
   local.get $2
   i32.const 0
   i32.store offset=4
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.load offset=16
   local.tee $1
   i32.store offset=20
   local.get $1
   i32.eqz
   if
    global.get $~lib/memory/__stack_pointer
    global.get $~lib/memory/__stack_pointer
    i32.const 16
    i32.sub
    global.set $~lib/memory/__stack_pointer
    global.get $~lib/memory/__stack_pointer
    i32.const 1796
    i32.lt_s
    br_if $folding-inner1
    global.get $~lib/memory/__stack_pointer
    i64.const 0
    i64.store
    global.get $~lib/memory/__stack_pointer
    i64.const 0
    i64.store offset=8
    global.get $~lib/memory/__stack_pointer
    i32.const 16
    i32.const 8
    call $~lib/rt/itcms/__new
    local.tee $1
    i32.store
    global.get $~lib/memory/__stack_pointer
    local.get $1
    i32.store offset=4
    local.get $1
    i32.const 0
    i32.store
    local.get $1
    i32.const 0
    i32.const 0
    call $~lib/rt/itcms/__link
    global.get $~lib/memory/__stack_pointer
    local.get $1
    i32.store offset=4
    local.get $1
    i32.const 0
    i32.store offset=4
    global.get $~lib/memory/__stack_pointer
    local.get $1
    i32.store offset=4
    local.get $1
    i32.const 0
    i32.store offset=8
    global.get $~lib/memory/__stack_pointer
    local.get $1
    i32.store offset=4
    local.get $1
    i32.const 0
    i32.store offset=12
    global.get $~lib/memory/__stack_pointer
    i32.const 32
    i32.const 1
    call $~lib/rt/itcms/__new
    local.tee $3
    i32.store offset=8
    global.get $~lib/memory/__stack_pointer
    local.get $1
    i32.store offset=4
    global.get $~lib/memory/__stack_pointer
    local.get $3
    i32.store offset=12
    local.get $1
    local.get $3
    i32.store
    local.get $1
    local.get $3
    i32.const 0
    call $~lib/rt/itcms/__link
    global.get $~lib/memory/__stack_pointer
    local.get $1
    i32.store offset=4
    local.get $1
    local.get $3
    i32.store offset=4
    global.get $~lib/memory/__stack_pointer
    local.get $1
    i32.store offset=4
    local.get $1
    i32.const 32
    i32.store offset=8
    global.get $~lib/memory/__stack_pointer
    local.get $1
    i32.store offset=4
    local.get $1
    i32.const 0
    i32.store offset=12
    global.get $~lib/memory/__stack_pointer
    i32.const 16
    i32.add
    global.set $~lib/memory/__stack_pointer
    local.get $1
    i32.store offset=20
    global.get $~lib/memory/__stack_pointer
    local.get $0
    i32.store offset=4
    global.get $~lib/memory/__stack_pointer
    local.get $1
    i32.store offset=24
    local.get $0
    local.get $1
    i32.store offset=16
    local.get $0
    local.get $1
    i32.const 0
    call $~lib/rt/itcms/__link
   end
   global.get $~lib/memory/__stack_pointer
   local.get $1
   i32.store offset=4
   global.get $~lib/memory/__stack_pointer
   local.get $2
   i32.store offset=24
   local.get $1
   local.get $2
   call $~lib/array/Array<~lib/task/Waiter>#push
   global.get $~lib/memory/__stack_pointer
   i32.const 28
   i32.add
   global.set $~lib/memory/__stack_pointer
   return
  end
  i32.const 34592
  i32.const 34640
  i32.const 1
  i32.const 1
  call $~lib/builtins/abort
  unreachable
 )
 (func $~lib/task-stack/__parkAwait (type $2) (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.sub
  global.set $~lib/memory/__stack_pointer
  block $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i32.const 1796
   i32.lt_s
   br_if $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i64.const 0
   i64.store
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.store offset=8
   global.get $~lib/memory/__stack_pointer
   local.get $0
   if
    global.get $~lib/memory/__stack_pointer
    local.get $0
    i32.store
    local.get $0
    i32.const 8
    i32.sub
    i32.load
    i32.const 21
    i32.eq
    if
     global.get $~lib/memory/__stack_pointer
     i32.const 4
     i32.sub
     global.set $~lib/memory/__stack_pointer
     global.get $~lib/memory/__stack_pointer
     i32.const 1796
     i32.lt_s
     br_if $folding-inner1
     global.get $~lib/memory/__stack_pointer
     i32.const 0
     i32.store
     global.get $~lib/memory/__stack_pointer
     local.get $0
     i32.store
     local.get $0
     i32.load offset=44
     local.set $1
     global.get $~lib/memory/__stack_pointer
     i32.const 4
     i32.add
     global.set $~lib/memory/__stack_pointer
    end
   end
   local.get $1
   i32.store offset=4
   local.get $1
   i32.const 0
   local.get $0
   select
   if
    global.get $~lib/memory/__stack_pointer
    local.get $1
    i32.store
    local.get $1
    i32.load
    if
     global.get $~lib/memory/__stack_pointer
     local.get $1
     i32.store
     global.get $~lib/memory/__stack_pointer
     i32.const 4
     i32.sub
     global.set $~lib/memory/__stack_pointer
     global.get $~lib/memory/__stack_pointer
     i32.const 1796
     i32.lt_s
     br_if $folding-inner1
     global.get $~lib/memory/__stack_pointer
     i32.const 0
     i32.store
     global.get $~lib/memory/__stack_pointer
     local.get $1
     i32.store
     local.get $1
     i32.load
     local.set $2
     global.get $~lib/memory/__stack_pointer
     local.get $1
     i32.store
     i64.const 0
     local.get $2
     local.get $1
     i32.load offset=4
     call $~lib/task-stack/hostPark
     global.get $~lib/memory/__stack_pointer
     local.get $1
     i32.store
     local.get $1
     i64.const 0
     call $~lib/task-stack/hostCompletion
     i32.store offset=8
     global.get $~lib/memory/__stack_pointer
     local.get $1
     i32.store
     local.get $1
     i32.const 0
     i32.store offset=12
     global.get $~lib/memory/__stack_pointer
     local.get $1
     i32.store
     local.get $1
     i32.const 1
     i32.store offset=28
     global.get $~lib/memory/__stack_pointer
     i32.const 4
     i32.add
     global.set $~lib/memory/__stack_pointer
     global.get $~lib/memory/__stack_pointer
     local.get $0
     i32.store
     global.get $~lib/memory/__stack_pointer
     local.get $1
     i32.store offset=8
     block $__inlined_func$~lib/task/TaskBase#__settleFromRecord@override$400
      local.get $0
      i32.const 8
      i32.sub
      i32.load
      i32.const 21
      i32.eq
      if
       global.get $~lib/memory/__stack_pointer
       i32.const 8
       i32.sub
       global.set $~lib/memory/__stack_pointer
       global.get $~lib/memory/__stack_pointer
       i32.const 1796
       i32.lt_s
       br_if $folding-inner1
       global.get $~lib/memory/__stack_pointer
       i64.const 0
       i64.store
       global.get $~lib/memory/__stack_pointer
       local.get $0
       i32.store
       global.get $~lib/memory/__stack_pointer
       local.get $1
       i32.store offset=4
       local.get $0
       local.get $1
       i32.load offset=8
       i32.store offset=48
       br $__inlined_func$~lib/task/TaskBase#__settleFromRecord@override$400
      end
      global.get $~lib/memory/__stack_pointer
      i32.const 8
      i32.sub
      global.set $~lib/memory/__stack_pointer
      global.get $~lib/memory/__stack_pointer
      i32.const 1796
      i32.lt_s
      br_if $folding-inner1
      global.get $~lib/memory/__stack_pointer
      i64.const 0
      i64.store
     end
     global.get $~lib/memory/__stack_pointer
     local.get $0
     i32.store
     global.get $~lib/memory/__stack_pointer
     local.get $1
     i32.store offset=4
     local.get $0
     local.get $1
     i32.load offset=12
     i32.store offset=12
     global.get $~lib/memory/__stack_pointer
     local.get $0
     i32.store
     local.get $0
     i32.const 1
     i32.store8 offset=8
     global.get $~lib/memory/__stack_pointer
     i32.const 8
     i32.add
     global.set $~lib/memory/__stack_pointer
     global.get $~lib/memory/__stack_pointer
     i32.const 12
     i32.add
     global.set $~lib/memory/__stack_pointer
     return
    end
   end
   i64.const 0
   i32.const 0
   i32.const 0
   call $~lib/task-stack/hostPark
   global.get $~lib/memory/__stack_pointer
   i32.const 12
   i32.add
   global.set $~lib/memory/__stack_pointer
   return
  end
  i32.const 34592
  i32.const 34640
  i32.const 1
  i32.const 1
  call $~lib/builtins/abort
  unreachable
 )
 (func $~lib/rt/tlsf/__arenaInit (type $3) (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
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
  i32.const 0
  global.set $~lib/rt/itcms/total
  i32.const 0
  global.set $~lib/rt/itcms/state
  i32.const 0
  global.set $~lib/rt/itcms/white
  i32.const 0
  global.set $~lib/rt/itcms/visitCount
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
  global.get $~lib/rt/itcms/toSpace
  global.set $~lib/rt/itcms/iter
  global.get $~lib/rt/common/ARENA_END
  local.get $0
  i32.sub
  i32.const 1
  i32.shr_u
  global.set $~lib/rt/itcms/threshold
  global.get $~lib/rt/common/ARENA_END
  local.set $4
  local.get $0
  i32.const 75
  i32.add
  i32.const -16
  i32.and
  local.tee $3
  i32.const 0
  i32.store
  local.get $3
  i32.const 0
  i32.store offset=1568
  loop $for-loop|0
   local.get $2
   i32.const 23
   i32.lt_u
   if
    local.get $3
    local.get $2
    i32.const 2
    i32.shl
    i32.add
    i32.const 0
    i32.store offset=4
    i32.const 0
    local.set $1
    loop $for-loop|1
     local.get $1
     i32.const 16
     i32.lt_u
     if
      local.get $3
      local.get $2
      i32.const 4
      i32.shl
      local.get $1
      i32.add
      i32.const 2
      i32.shl
      i32.add
      i32.const 0
      i32.store offset=96
      local.get $1
      i32.const 1
      i32.add
      local.set $1
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
  local.get $3
  global.set $~lib/rt/tlsf/ROOT
  local.get $3
  local.get $3
  i32.const 1572
  i32.add
  local.get $4
  i64.extend_i32_u
  call $~lib/rt/tlsf/addMemory
  local.get $0
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/rt/itcms/step (type $1) (result i32)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  block $folding-inner0
   block $break|0
    block $case2|0
     block $case1|0
      block $case0|0
       global.get $~lib/rt/itcms/state
       br_table $case0|0 $case1|0 $case2|0 $break|0
      end
      i32.const 1
      global.set $~lib/rt/itcms/state
      i32.const 0
      global.set $~lib/rt/itcms/visitCount
      call $~lib/rt/itcms/visitRoots
      global.get $~lib/rt/itcms/toSpace
      global.set $~lib/rt/itcms/iter
      br $folding-inner0
     end
     global.get $~lib/rt/itcms/white
     i32.eqz
     local.set $1
     global.get $~lib/rt/itcms/iter
     i32.load offset=4
     i32.const -4
     i32.and
     local.set $0
     loop $while-continue|1
      local.get $0
      global.get $~lib/rt/itcms/toSpace
      i32.ne
      if
       local.get $0
       global.set $~lib/rt/itcms/iter
       local.get $0
       i32.load offset=4
       local.tee $2
       i32.const 3
       i32.and
       local.get $1
       i32.ne
       if
        local.get $0
        local.get $2
        i32.const -4
        i32.and
        local.get $1
        i32.or
        i32.store offset=4
        i32.const 0
        global.set $~lib/rt/itcms/visitCount
        local.get $0
        i32.const 20
        i32.add
        call $~lib/rt/__visit_members
        br $folding-inner0
       end
       local.get $0
       i32.load offset=4
       i32.const -4
       i32.and
       local.set $0
       br $while-continue|1
      end
     end
     i32.const 0
     global.set $~lib/rt/itcms/visitCount
     call $~lib/rt/itcms/visitRoots
     global.get $~lib/rt/itcms/toSpace
     global.get $~lib/rt/itcms/iter
     i32.load offset=4
     i32.const -4
     i32.and
     i32.eq
     if
      global.get $~lib/memory/__stack_pointer
      local.set $0
      loop $while-continue|0
       global.get $~lib/rt/common/HEAP_BASE
       local.get $0
       i32.gt_u
       if
        local.get $0
        i32.load
        call $~lib/rt/itcms/__visit
        local.get $0
        i32.const 4
        i32.add
        local.set $0
        br $while-continue|0
       end
      end
      global.get $~lib/rt/itcms/iter
      i32.load offset=4
      i32.const -4
      i32.and
      local.set $0
      loop $while-continue|2
       local.get $0
       global.get $~lib/rt/itcms/toSpace
       i32.ne
       if
        local.get $0
        i32.load offset=4
        local.tee $2
        i32.const 3
        i32.and
        local.get $1
        i32.ne
        if
         local.get $0
         local.get $2
         i32.const -4
         i32.and
         local.get $1
         i32.or
         i32.store offset=4
         local.get $0
         i32.const 20
         i32.add
         call $~lib/rt/__visit_members
        end
        local.get $0
        i32.load offset=4
        i32.const -4
        i32.and
        local.set $0
        br $while-continue|2
       end
      end
      global.get $~lib/rt/itcms/fromSpace
      local.set $0
      global.get $~lib/rt/itcms/toSpace
      global.set $~lib/rt/itcms/fromSpace
      local.get $0
      global.set $~lib/rt/itcms/toSpace
      local.get $1
      global.set $~lib/rt/itcms/white
      local.get $0
      i32.load offset=4
      i32.const -4
      i32.and
      global.set $~lib/rt/itcms/iter
      i32.const 2
      global.set $~lib/rt/itcms/state
     end
     br $folding-inner0
    end
    global.get $~lib/rt/itcms/iter
    local.tee $0
    global.get $~lib/rt/itcms/toSpace
    i32.ne
    if
     local.get $0
     i32.load offset=4
     local.tee $1
     i32.const -4
     i32.and
     global.set $~lib/rt/itcms/iter
     global.get $~lib/rt/itcms/white
     i32.eqz
     local.get $1
     i32.const 3
     i32.and
     i32.ne
     if
      i32.const 0
      i32.const 1152
      i32.const 229
      i32.const 20
      call $~lib/builtins/abort
      unreachable
     end
     global.get $~lib/rt/common/HEAP_BASE
     local.get $0
     i32.gt_u
     if
      local.get $0
      i32.const 0
      i32.store offset=4
      local.get $0
      i32.const 0
      i32.store offset=8
     else
      global.get $~lib/rt/itcms/total
      local.get $0
      i32.load
      i32.const -4
      i32.and
      i32.const 4
      i32.add
      i32.sub
      global.set $~lib/rt/itcms/total
      local.get $0
      i32.const 4
      i32.add
      local.tee $0
      global.get $~lib/rt/common/HEAP_BASE
      i32.ge_u
      if
       global.get $~lib/rt/tlsf/ROOT
       i32.eqz
       if
        call $~lib/rt/tlsf/initialize
       end
       global.get $~lib/rt/tlsf/ROOT
       local.get $0
       i32.const 4
       i32.sub
       local.set $2
       local.get $0
       i32.const 15
       i32.and
       i32.const 1
       local.get $0
       select
       if (result i32)
        i32.const 1
       else
        local.get $2
        i32.load
        i32.const 1
        i32.and
       end
       if
        i32.const 0
        i32.const 1424
        i32.const 562
        i32.const 3
        call $~lib/builtins/abort
        unreachable
       end
       local.get $2
       local.get $2
       i32.load
       i32.const 1
       i32.or
       i32.store
       local.get $2
       call $~lib/rt/tlsf/insertBlock
      end
     end
     i32.const 10
     return
    end
    global.get $~lib/rt/itcms/toSpace
    global.get $~lib/rt/itcms/toSpace
    i32.store offset=4
    global.get $~lib/rt/itcms/toSpace
    global.get $~lib/rt/itcms/toSpace
    i32.store offset=8
    i32.const 0
    global.set $~lib/rt/itcms/state
   end
   i32.const 0
   return
  end
  global.get $~lib/rt/itcms/visitCount
 )
 (func $~lib/rt/common/__arenaHeapBase (type $1) (result i32)
  global.get $~lib/rt/common/HEAP_BASE
 )
 (func $~lib/rt/common/__arenaEnd (type $1) (result i32)
  global.get $~lib/rt/common/ARENA_END
 )
 (func $~lib/async/__asyncPump (type $1) (result i32)
  i32.const 0
 )
 (func $~asyncMainStart (type $1) (result i32)
  unreachable
 )
 (func $stackful-fiber-record/pendingJob (type $1) (result i32)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.sub
  global.set $~lib/memory/__stack_pointer
  block $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i32.const 1796
   i32.lt_s
   br_if $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i64.const 0
   i64.store
   global.get $~lib/memory/__stack_pointer
   i64.const 0
   i64.store offset=8
   global.get $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.sub
   global.set $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 1796
   i32.lt_s
   br_if $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i64.const 0
   i64.store
   global.get $~lib/memory/__stack_pointer
   i32.const 32
   i32.const 12
   call $~lib/rt/itcms/__new
   local.tee $1
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $1
   i32.store offset=4
   global.get $~lib/memory/__stack_pointer
   local.get $1
   call $~lib/object/Object#constructor
   local.tee $1
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $1
   i32.store offset=4
   local.get $1
   i32.const 0
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $1
   i32.store offset=4
   local.get $1
   i32.const 0
   i32.store offset=4
   global.get $~lib/memory/__stack_pointer
   local.get $1
   i32.store offset=4
   local.get $1
   i32.const 0
   i32.store offset=8
   global.get $~lib/memory/__stack_pointer
   local.get $1
   i32.store offset=4
   local.get $1
   i32.const 0
   i32.store offset=12
   global.get $~lib/memory/__stack_pointer
   local.get $1
   i32.store offset=4
   local.get $1
   f32.const 0
   f32.store offset=16
   global.get $~lib/memory/__stack_pointer
   local.get $1
   i32.store offset=4
   local.get $1
   f32.const 0
   f32.store offset=20
   global.get $~lib/memory/__stack_pointer
   local.get $1
   i32.store offset=4
   local.get $1
   i32.const 0
   i32.store offset=24
   global.get $~lib/memory/__stack_pointer
   local.get $1
   i32.store offset=4
   local.get $1
   i32.const 0
   i32.store offset=28
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $1
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $1
   i32.store offset=4
   local.get $1
   i32.const 4
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $1
   i32.store offset=4
   local.get $1
   i32.const 7
   i32.store offset=4
   global.get $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.sub
   global.set $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 1796
   i32.lt_s
   br_if $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i64.const 0
   i64.store
   global.get $~lib/memory/__stack_pointer
   i32.const 52
   i32.const 21
   call $~lib/rt/itcms/__new
   local.tee $0
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   global.get $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.sub
   global.set $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 1796
   i32.lt_s
   br_if $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i64.const 0
   i64.store
   local.get $0
   i32.eqz
   if
    global.get $~lib/memory/__stack_pointer
    i32.const 44
    i32.const 6
    call $~lib/rt/itcms/__new
    local.tee $0
    i32.store
   end
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   global.get $~lib/memory/__stack_pointer
   local.get $0
   call $~lib/object/Object#constructor
   local.tee $0
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   local.get $0
   i32.const -1
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   local.get $0
   i32.const 0
   i32.store offset=4
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   local.get $0
   i32.const 0
   i32.store8 offset=8
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   local.get $0
   i32.const 0
   i32.store offset=12
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   local.get $0
   i32.const 0
   i32.store offset=16
   local.get $0
   i32.const 0
   i32.const 0
   call $~lib/rt/itcms/__link
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   local.get $0
   i32.const 0
   i32.store offset=20
   local.get $0
   i32.const 0
   i32.const 0
   call $~lib/rt/itcms/__link
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   local.get $0
   i32.const -1
   i32.store offset=24
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   local.get $0
   i32.const 0
   i32.store offset=28
   local.get $0
   i32.const 0
   i32.const 0
   call $~lib/rt/itcms/__link
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   local.get $0
   i32.const 0
   i32.store offset=32
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   local.get $0
   i32.const 0
   i32.store offset=36
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   local.get $0
   i32.const 0
   i32.store offset=40
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $0
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   local.get $0
   i32.const 0
   i32.store offset=44
   local.get $0
   i32.const 0
   i32.const 0
   call $~lib/rt/itcms/__link
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   local.get $0
   i32.const 0
   i32.store offset=48
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=8
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   global.get $~lib/memory/__stack_pointer
   local.get $1
   i32.store offset=12
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.sub
   global.set $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 1796
   i32.lt_s
   br_if $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i64.const 0
   i64.store
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $1
   i32.store offset=4
   local.get $0
   local.get $1
   i32.store offset=44
   local.get $0
   local.get $1
   i32.const 0
   call $~lib/rt/itcms/__link
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.add
   global.set $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 16
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $0
   return
  end
  i32.const 34592
  i32.const 34640
  i32.const 1
  i32.const 1
  call $~lib/builtins/abort
  unreachable
 )
 (func $__start (type $1) (result i32)
  (local $0 i32)
  global.get $~lib/rt/common/ARENA_BASE_CONFIGURED
  local.tee $0
  i32.const 34564
  local.get $0
  select
  global.set $~lib/rt/common/HEAP_BASE
  memory.size
  i32.const 16
  i32.shl
  global.get $~lib/rt/common/HEAP_BASE
  i32.sub
  i32.const 1
  i32.shr_u
  global.set $~lib/rt/itcms/threshold
  global.get $~lib/rt/itcms/ARENA_PIN_SPACE
  local.tee $0
  if (result i32)
   local.get $0
  else
   i32.const 1204
   i32.const 1200
   i32.store
   i32.const 1208
   i32.const 1200
   i32.store
   i32.const 1200
  end
  global.set $~lib/rt/itcms/pinSpace
  global.get $~lib/rt/itcms/ARENA_TO_SPACE
  local.tee $0
  if (result i32)
   local.get $0
  else
   i32.const 1236
   i32.const 1232
   i32.store
   i32.const 1240
   i32.const 1232
   i32.store
   i32.const 1232
  end
  global.set $~lib/rt/itcms/toSpace
  global.get $~lib/rt/itcms/ARENA_FROM_SPACE
  local.tee $0
  if (result i32)
   local.get $0
  else
   i32.const 1380
   i32.const 1376
   i32.store
   i32.const 1384
   i32.const 1376
   i32.store
   i32.const 1376
  end
  global.set $~lib/rt/itcms/fromSpace
  call $stackful-fiber-record/main
  global.set $~asyncStatus
  global.get $~asyncStatus
 )
 ;; custom section "tension.stackful-backend", size 5, contents: "fiber"
)
