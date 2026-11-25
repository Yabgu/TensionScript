(module
 (type $0 (func (param i32 i32)))
 (type $1 (func (param i32) (result i32)))
 (type $2 (func (param i32 i32) (result i32)))
 (type $3 (func (param i32)))
 (type $4 (func (result i32)))
 (type $5 (func))
 (type $6 (func (param i32 i32 i32)))
 (type $7 (func (param i32 i32 i32 i32) (result i32)))
 (type $8 (func (param i32 i32 i32 i32)))
 (type $9 (func (param i32 f32)))
 (type $10 (func (param i32 i32 i32) (result i32)))
 (type $11 (func (param i32 i32 i64) (result i32)))
 (type $12 (func (param i64 i32 i32)))
 (type $13 (func (param i64) (result i32)))
 (type $14 (func (param i32 i32 i32 i32 i32) (result i32)))
 (type $15 (func (param i32 i32 i32 i32 i32 i32) (result i32)))
 (import "env" "memory" (memory $0 2 256 shared))
 (import "env" "abort" (func $~lib/builtins/abort (type $8) (param i32 i32 i32 i32)))
 (import "scheduler" "park" (func $~lib/task-stack/hostPark (type $12) (param i64 i32 i32)))
 (import "scheduler" "completion" (func $~lib/task-stack/hostCompletion (type $13) (param i64) (result i32)))
 (import "env" "__executorCount" (func $~lib/thread/__executorCount (type $4) (result i32)))
 (import "env" "__startThread" (func $~lib/thread/__startThread (type $1) (param i32) (result i32)))
 (global $~asyncLastStatus (mut i32) (i32.const 0))
 (global $~asyncCurrentSlot (mut i32) (i32.const 0))
 (global $~asyncNextSlot (mut i32) (i32.const 1))
 (global $~asyncStatus (mut i32) (i32.const 0))
 (global $~lib/task/__wakeSink (mut i32) (i32.const 32))
 (global $~lib/task/__remoteParkSink (mut i32) (i32.const 0))
 (global $~lib/task/inlinePolicyInstance (mut i32) (i32.const 0))
 (global $~lib/shared/runtime/Runtime.Stub i32 (i32.const 0))
 (global $~lib/shared/runtime/Runtime.Minimal i32 (i32.const 1))
 (global $~lib/shared/runtime/Runtime.Incremental i32 (i32.const 2))
 (global $~lib/thread/HEAD i32 (i32.const 0))
 (global $~lib/thread/TAIL i32 (i32.const 1))
 (global $~lib/thread/CAPACITY_WORD i32 (i32.const 2))
 (global $~lib/thread/SLOTS i32 (i32.const 3))
 (global $~lib/thread/VALUE_WORD i32 (i32.const 0))
 (global $~lib/thread/SEQ_WORD i32 (i32.const 1))
 (global $~lib/thread/CELL_WORDS i32 (i32.const 2))
 (global $~lib/thread/HEAD_OFF i32 (i32.const 0))
 (global $~lib/thread/TAIL_OFF i32 (i32.const 4))
 (global $~lib/thread/CAPACITY_OFF i32 (i32.const 8))
 (global $~lib/thread/SLOTS_OFF i32 (i32.const 12))
 (global $~lib/thread/CELL_BYTES i32 (i32.const 8))
 (global $~lib/task-stack/tasks (mut i32) (i32.const 0))
 (global $~lib/task-stack/remoteParks (mut i32) (i32.const 0))
 (global $~lib/task-stack/remoteSinkInstalled (mut i32) (i32.const 0))
 (global $~lib/task-stack/selfExecutor (mut i32) (i32.const 0))
 (global $~lib/task-stack/maskRefusals (mut i32) (i32.const 0))
 (global $~lib/task-stack/maskViolations (mut i32) (i32.const 0))
 (global $~lib/thread/DEFAULT_CAPACITY i32 (i32.const 1024))
 (global $~lib/thread/executors (mut i32) (i32.const 0))
 (global $~lib/thread/mainExecutorInstance (mut i32) (i32.const 0))
 (global $~lib/thread/hasCustomStep (mut i32) (i32.const 0))
 (global $~lib/thread/customStep (mut i32) (i32.const 0))
 (global $~lib/thread/requests (mut i32) (i32.const 0))
 (global $~lib/thread/freeRequests (mut i32) (i32.const 0))
 (global $~lib/thread/PAGE_SIZE i32 (i32.const 65536))
 (global $~lib/thread/CONTROL_MAGIC i32 (i32.const 1414025796))
 (global $~lib/thread/HEADER_WORDS i32 (i32.const 16))
 (global $~lib/thread/HEADER_BYTES i32 (i32.const 64))
 (global $~lib/thread/H_MAGIC i32 (i32.const 0))
 (global $~lib/thread/H_TOTAL i32 (i32.const 1))
 (global $~lib/thread/H_STRIDE i32 (i32.const 2))
 (global $~lib/thread/H_CAPACITY i32 (i32.const 3))
 (global $~lib/thread/H_REQUESTS i32 (i32.const 4))
 (global $~lib/thread/REQUEST_WORDS i32 (i32.const 4))
 (global $~lib/thread/REQ_FUNC i32 (i32.const 0))
 (global $~lib/thread/REQ_ARG i32 (i32.const 1))
 (global $~lib/thread/REQ_KEY i32 (i32.const 2))
 (global $~lib/thread/REQ_ORIGIN i32 (i32.const 3))
 (global $~lib/thread/WORKER_ARENA_BYTES i32 (i32.const 1048576))
 (global $~lib/thread/MAIN_ARENA_BYTES i32 (i32.const 4194304))
 (global $~lib/thread/__heapBase (mut i32) (i32.const 0))
 (global $~lib/thread/__controlBase (mut i32) (i32.const 0))
 (global $~lib/thread/__controlStride (mut i32) (i32.const 0))
 (global $~lib/thread/__ringCapacity (mut i32) (i32.const 0))
 (global $~lib/thread/__executorTotal (mut i32) (i32.const 0))
 (global $~lib/thread/selfExec (mut i32) (i32.const 0))
 (global $~lib/thread/requestBase (mut i32) (i32.const 0))
 (global $~lib/thread/freeRingBase (mut i32) (i32.const 0))
 (global $~lib/thread/requestCount (mut i32) (i32.const 0))
 (global $~lib/thread/servingArg (mut i32) (i32.const 0))
 (global $~lib/thread/servingKey (mut i32) (i32.const 0))
 (global $~lib/thread/servingOrigin (mut i32) (i32.const 0))
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
 (global $~lib/native/ASC_LOW_MEMORY_LIMIT i32 (i32.const 0))
 (global $~lib/native/ASC_RUNTIME i32 (i32.const 2))
 (global $~lib/rt/common/ARENA_END_CONFIGURED (mut i32) (i32.const 0))
 (global $~env (mut i32) (i32.const 0))
 (global $~argumentsLength (mut i32) (i32.const 0))
 (global $~lib/rt/__rtti_base i32 (i32.const 672))
 (global $~lib/memory/__data_end i32 (i32.const 772))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 33540))
 (global $~lib/memory/__heap_base i32 (i32.const 33540))
 (data $0 (i32.const 12) "\1c\00\00\00\00\00\00\00\00\00\00\00\04\00\00\00\08\00\00\00\01\00\00\00\00\00\00\00\00\00\00\00")
 (data $1 (i32.const 44) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00(\00\00\00A\00l\00l\00o\00c\00a\00t\00i\00o\00n\00 \00t\00o\00o\00 \00l\00a\00r\00g\00e\00\00\00\00\00")
 (data $2 (i32.const 108) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00 \00\00\00~\00l\00i\00b\00/\00r\00t\00/\00i\00t\00c\00m\00s\00.\00t\00s\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $3 (i32.const 176) "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $4 (i32.const 208) "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $5 (i32.const 236) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00$\00\00\00I\00n\00d\00e\00x\00 \00o\00u\00t\00 \00o\00f\00 \00r\00a\00n\00g\00e\00\00\00\00\00\00\00\00\00")
 (data $6 (i32.const 300) ",\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00\14\00\00\00~\00l\00i\00b\00/\00r\00t\00.\00t\00s\00\00\00\00\00\00\00\00\00")
 (data $7 (i32.const 352) "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $8 (i32.const 380) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00t\00l\00s\00f\00.\00t\00s\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $9 (i32.const 444) ",\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00\1a\00\00\00~\00l\00i\00b\00/\00a\00r\00r\00a\00y\00.\00t\00s\00\00\00")
 (data $10 (i32.const 492) ",\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00\1c\00\00\00I\00n\00v\00a\00l\00i\00d\00 \00l\00e\00n\00g\00t\00h\00")
 (data $11 (i32.const 540) "\1c\00\00\00\00\00\00\00\00\00\00\00\17\00\00\00\08\00\00\00\02\00\00\00\00\00\00\00\00\00\00\00")
 (data $12 (i32.const 572) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00&\00\00\00~\00l\00i\00b\00/\00a\00r\00r\00a\00y\00b\00u\00f\00f\00e\00r\00.\00t\00s\00\00\00\00\00\00\00")
 (data $13 (i32.const 636) "\1c\00\00\00\00\00\00\00\00\00\00\00\04\00\00\00\08\00\00\00\03\00\00\00\00\00\00\00\00\00\00\00")
 (data $14 (i32.const 672) "\18\00\00\00 \00\00\00 \00\00\00 \00\00\00\00\00\00\00\00\00\00\00 \00\00\00\00\00\00\00 \00\00\00\02A\00\00 \00\00\00\02a\00\00\00\00\00\00 \00\00\00\10A\12\00\00\00\00\00\00\00\00\00\01\t\00\00\02a\00\00 \00\00\00\02a\00\00\02\t\00\00\00\00\00\00 \00\00\00\00\00\00\00")
 (table $0 4 4 funcref)
 (table $$starts 1 1 funcref)
 (elem $0 (table $0) (i32.const 1) func $~lib/task/noopWake $~lib/thread/__mainStep__ $~lib/thread/installWakeSink~anonymous|0)
 (elem $~asyncStart func $~asyncMainStart)
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
 (func $~lib/task/noopWake (type $0) (param $exec i32) (param $slot i32)
 )
 (func $stackful-fiber-record/leaf (type $4) (result i32)
  i32.const 1
  return
 )
 (func $~lib/rt/common/initialHeapBase (type $4) (result i32)
  (local $heap i32)
  i32.const 1
  drop
  global.get $~lib/rt/common/ARENA_BASE_CONFIGURED
  local.set $heap
  local.get $heap
  i32.const 0
  i32.ne
  if
   local.get $heap
   return
  end
  global.get $~lib/memory/__heap_base
  return
 )
 (func $~lib/rt/itcms/Object#set:nextWithColor (type $0) (param $this i32) (param $nextWithColor i32)
  local.get $this
  local.get $nextWithColor
  i32.store offset=4
 )
 (func $~lib/rt/itcms/Object#set:prev (type $0) (param $this i32) (param $prev i32)
  local.get $this
  local.get $prev
  i32.store offset=8
 )
 (func $~lib/rt/itcms/initLazy (type $1) (param $space i32) (result i32)
  local.get $space
  local.get $space
  call $~lib/rt/itcms/Object#set:nextWithColor
  local.get $space
  local.get $space
  call $~lib/rt/itcms/Object#set:prev
  local.get $space
  return
 )
 (func $~lib/rt/itcms/initialPinSpace (type $4) (result i32)
  (local $s i32)
  i32.const 1
  drop
  global.get $~lib/rt/itcms/ARENA_PIN_SPACE
  local.set $s
  local.get $s
  i32.const 0
  i32.ne
  if
   local.get $s
   return
  end
  i32.const 176
  call $~lib/rt/itcms/initLazy
  return
 )
 (func $~lib/rt/itcms/Object#get:nextWithColor (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/rt/itcms/Object#get:next (type $1) (param $this i32) (result i32)
  local.get $this
  call $~lib/rt/itcms/Object#get:nextWithColor
  i32.const 3
  i32.const -1
  i32.xor
  i32.and
  return
 )
 (func $~lib/rt/itcms/Object#get:color (type $1) (param $this i32) (result i32)
  local.get $this
  call $~lib/rt/itcms/Object#get:nextWithColor
  i32.const 3
  i32.and
  return
 )
 (func $~lib/rt/itcms/visitRoots (type $3) (param $cookie i32)
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
     i32.const 128
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
 (func $~lib/rt/itcms/initialToSpace (type $4) (result i32)
  (local $s i32)
  i32.const 1
  drop
  global.get $~lib/rt/itcms/ARENA_TO_SPACE
  local.set $s
  local.get $s
  i32.const 0
  i32.ne
  if
   local.get $s
   return
  end
  i32.const 208
  call $~lib/rt/itcms/initLazy
  return
 )
 (func $~lib/rt/itcms/Object#set:color (type $0) (param $this i32) (param $color i32)
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
 (func $~lib/rt/common/outsideArena (type $1) (param $ptr i32) (result i32)
  (local $end i32)
  global.get $~lib/rt/common/ARENA_END
  local.set $end
  local.get $end
  i32.const 0
  i32.ne
  if (result i32)
   global.get $~lib/rt/common/HEAP_BASE
   local.get $ptr
   i32.gt_u
   if (result i32)
    i32.const 1
   else
    local.get $ptr
    local.get $end
    i32.ge_u
   end
  else
   i32.const 0
  end
  return
 )
 (func $~lib/rt/itcms/Object#get:prev (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $~lib/rt/itcms/Object#set:next (type $0) (param $this i32) (param $obj i32)
  local.get $this
  local.get $obj
  local.get $this
  call $~lib/rt/itcms/Object#get:nextWithColor
  i32.const 3
  i32.and
  i32.or
  call $~lib/rt/itcms/Object#set:nextWithColor
 )
 (func $~lib/rt/itcms/Object#unlink (type $3) (param $this i32)
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
    global.get $~lib/rt/common/HEAP_BASE
    local.get $this
    i32.gt_u
   else
    i32.const 0
   end
   i32.eqz
   if
    i32.const 0
    i32.const 128
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
   i32.const 128
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
 (func $~lib/rt/itcms/Object#get:rtId (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=12
 )
 (func $~lib/shared/typeinfo/Typeinfo#get:flags (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/rt/__typeinfo (type $1) (param $id i32) (result i32)
  (local $ptr i32)
  global.get $~lib/rt/__rtti_base
  local.set $ptr
  local.get $id
  local.get $ptr
  i32.load
  i32.gt_u
  if
   i32.const 256
   i32.const 320
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
 (func $~lib/rt/itcms/Object#get:isPointerfree (type $1) (param $this i32) (result i32)
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
 (func $~lib/rt/itcms/Object#linkTo (type $6) (param $this i32) (param $list i32) (param $withColor i32)
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
 (func $~lib/rt/itcms/Object#makeGray (type $3) (param $this i32)
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
    i32.const 128
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
 (func $~lib/rt/itcms/__visit (type $0) (param $ptr i32) (param $cookie i32)
  (local $obj i32)
  local.get $ptr
  i32.eqz
  if (result i32)
   i32.const 1
  else
   local.get $ptr
   call $~lib/rt/common/outsideArena
  end
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
 (func $~lib/rt/itcms/visitStack (type $3) (param $cookie i32)
  (local $ptr i32)
  global.get $~lib/memory/__stack_pointer
  local.set $ptr
  loop $while-continue|0
   global.get $~lib/rt/common/HEAP_BASE
   local.get $ptr
   i32.gt_u
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
 (func $~lib/rt/itcms/initialFromSpace (type $4) (result i32)
  (local $s i32)
  i32.const 1
  drop
  global.get $~lib/rt/itcms/ARENA_FROM_SPACE
  local.set $s
  local.get $s
  i32.const 0
  i32.ne
  if
   local.get $s
   return
  end
  i32.const 352
  call $~lib/rt/itcms/initLazy
  return
 )
 (func $~lib/rt/common/BLOCK#get:mmInfo (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/rt/itcms/Object#get:size (type $1) (param $this i32) (result i32)
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
 (func $~lib/rt/tlsf/Root#set:flMap (type $0) (param $this i32) (param $flMap i32)
  local.get $this
  local.get $flMap
  i32.store
 )
 (func $~lib/rt/common/BLOCK#set:mmInfo (type $0) (param $this i32) (param $mmInfo i32)
  local.get $this
  local.get $mmInfo
  i32.store
 )
 (func $~lib/rt/tlsf/Block#set:prev (type $0) (param $this i32) (param $prev i32)
  local.get $this
  local.get $prev
  i32.store offset=4
 )
 (func $~lib/rt/tlsf/Block#set:next (type $0) (param $this i32) (param $next i32)
  local.get $this
  local.get $next
  i32.store offset=8
 )
 (func $~lib/rt/tlsf/Block#get:prev (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/rt/tlsf/Block#get:next (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $~lib/rt/tlsf/Root#get:flMap (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/rt/tlsf/removeBlock (type $0) (param $root i32) (param $block i32)
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
   i32.const 400
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
   i32.const 400
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
   i32.const 400
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
 (func $~lib/rt/tlsf/insertBlock (type $0) (param $root i32) (param $block i32)
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
   i32.const 400
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
   i32.const 400
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
    i32.const 400
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
   i32.const 400
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
   i32.const 400
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
   i32.const 400
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
 (func $~lib/rt/tlsf/addMemory (type $11) (param $root i32) (param $start i32) (param $endU64 i64) (result i32)
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
   i32.const 400
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
    i32.const 400
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
    i32.const 400
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
 (func $~lib/rt/tlsf/initialize (type $5)
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
 (func $~lib/rt/tlsf/checkUsedBlock (type $1) (param $ptr i32) (result i32)
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
   i32.const 400
   i32.const 562
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $block
  return
 )
 (func $~lib/rt/tlsf/freeBlock (type $0) (param $root i32) (param $block i32)
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
 (func $~lib/rt/tlsf/__free (type $3) (param $ptr i32)
  global.get $~lib/rt/common/HEAP_BASE
  local.get $ptr
  i32.gt_u
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
 (func $~lib/rt/itcms/free (type $3) (param $obj i32)
  global.get $~lib/rt/common/HEAP_BASE
  local.get $obj
  i32.gt_u
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
 (func $~lib/rt/itcms/step (type $4) (result i32)
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
     i32.const 128
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
 (func $~lib/rt/itcms/interrupt (type $5)
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
 (func $~lib/rt/tlsf/computeSize (type $1) (param $size i32) (result i32)
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
 (func $~lib/rt/tlsf/prepareSize (type $1) (param $size i32) (result i32)
  local.get $size
  i32.const 1073741820
  i32.gt_u
  if
   i32.const 64
   i32.const 400
   i32.const 461
   i32.const 29
   call $~lib/builtins/abort
   unreachable
  end
  local.get $size
  call $~lib/rt/tlsf/computeSize
  return
 )
 (func $~lib/rt/tlsf/roundSize (type $1) (param $size i32) (result i32)
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
 (func $~lib/rt/tlsf/searchBlock (type $2) (param $root i32) (param $size i32) (result i32)
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
   i32.const 400
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
     i32.const 400
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
 (func $~lib/rt/tlsf/growMemory (type $0) (param $root i32) (param $size i32)
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
 (func $~lib/rt/tlsf/growMemoryGated (type $0) (param $root i32) (param $size i32)
  global.get $~lib/rt/common/ARENA_END
  if
   unreachable
  end
  local.get $root
  local.get $size
  call $~lib/rt/tlsf/growMemory
 )
 (func $~lib/rt/tlsf/prepareBlock (type $6) (param $root i32) (param $block i32) (param $size i32)
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
   i32.const 400
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
 (func $~lib/rt/tlsf/allocateBlock (type $2) (param $root i32) (param $size i32) (result i32)
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
   call $~lib/rt/tlsf/growMemoryGated
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
    i32.const 400
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
   i32.const 400
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
 (func $~lib/rt/tlsf/__alloc (type $1) (param $size i32) (result i32)
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
 (func $~lib/rt/itcms/Object#set:rtId (type $0) (param $this i32) (param $rtId i32)
  local.get $this
  local.get $rtId
  i32.store offset=12
 )
 (func $~lib/rt/itcms/Object#set:rtSize (type $0) (param $this i32) (param $rtSize i32)
  local.get $this
  local.get $rtSize
  i32.store offset=16
 )
 (func $~lib/rt/itcms/__new (type $2) (param $size i32) (param $id i32) (result i32)
  (local $obj i32)
  (local $ptr i32)
  local.get $size
  i32.const 1073741804
  i32.ge_u
  if
   i32.const 64
   i32.const 128
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
 (func $~lib/task/TaskRecord#set:class_ (type $0) (param $this i32) (param $class_ i32)
  local.get $this
  local.get $class_
  i32.store
 )
 (func $~lib/task/TaskRecord#set:key (type $0) (param $this i32) (param $key i32)
  local.get $this
  local.get $key
  i32.store offset=4
 )
 (func $~lib/task/TaskRecord#set:payload (type $0) (param $this i32) (param $payload i32)
  local.get $this
  local.get $payload
  i32.store offset=8
 )
 (func $~lib/task/TaskRecord#set:status (type $0) (param $this i32) (param $status i32)
  local.get $this
  local.get $status
  i32.store offset=12
 )
 (func $~lib/task/TaskRecord#set:f0 (type $9) (param $this i32) (param $f0 f32)
  local.get $this
  local.get $f0
  f32.store offset=16
 )
 (func $~lib/task/TaskRecord#set:f1 (type $9) (param $this i32) (param $f1 f32)
  local.get $this
  local.get $f1
  f32.store offset=20
 )
 (func $~lib/task/TaskRecord#set:tag (type $0) (param $this i32) (param $tag i32)
  local.get $this
  local.get $tag
  i32.store offset=24
 )
 (func $~lib/task/TaskRecord#set:done (type $0) (param $this i32) (param $done i32)
  local.get $this
  local.get $done
  i32.store offset=28
 )
 (func $~lib/task/TaskBase#set:slot (type $0) (param $this i32) (param $slot i32)
  local.get $this
  local.get $slot
  i32.store
 )
 (func $~lib/task/TaskBase#set:home (type $0) (param $this i32) (param $home i32)
  local.get $this
  local.get $home
  i32.store offset=4
 )
 (func $~lib/task/TaskBase#set:settled (type $0) (param $this i32) (param $settled i32)
  local.get $this
  local.get $settled
  i32.store8 offset=8
 )
 (func $~lib/task/TaskBase#set:status (type $0) (param $this i32) (param $status i32)
  local.get $this
  local.get $status
  i32.store offset=12
 )
 (func $~lib/rt/itcms/__link (type $6) (param $parentPtr i32) (param $childPtr i32) (param $expectMultiple i32)
  (local $child i32)
  (local $parent i32)
  (local $parentColor i32)
  local.get $childPtr
  i32.eqz
  if (result i32)
   i32.const 1
  else
   local.get $childPtr
   call $~lib/rt/common/outsideArena
  end
  if
   return
  end
  i32.const 1
  drop
  local.get $parentPtr
  i32.eqz
  if
   i32.const 0
   i32.const 128
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
 (func $~lib/task/TaskBase#set:waiters (type $0) (param $this i32) (param $waiters i32)
  local.get $this
  local.get $waiters
  i32.store offset=16
  local.get $this
  local.get $waiters
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $~lib/task/TaskBase#set:policy (type $0) (param $this i32) (param $policy i32)
  local.get $this
  local.get $policy
  i32.store offset=20
  local.get $this
  local.get $policy
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $~lib/task/TaskBase#set:entry (type $0) (param $this i32) (param $entry i32)
  local.get $this
  local.get $entry
  i32.store offset=24
 )
 (func $~lib/task/TaskBase#set:mask (type $0) (param $this i32) (param $mask i32)
  local.get $this
  local.get $mask
  i32.store offset=28
  local.get $this
  local.get $mask
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $~lib/task/TaskBase#set:serveArg (type $0) (param $this i32) (param $serveArg i32)
  local.get $this
  local.get $serveArg
  i32.store offset=32
 )
 (func $~lib/task/TaskBase#set:serveKey (type $0) (param $this i32) (param $serveKey i32)
  local.get $this
  local.get $serveKey
  i32.store offset=36
 )
 (func $~lib/task/TaskBase#set:serveOrigin (type $0) (param $this i32) (param $serveOrigin i32)
  local.get $this
  local.get $serveOrigin
  i32.store offset=40
 )
 (func $~lib/task/Task<i32>#set:recordValue (type $0) (param $this i32) (param $recordValue i32)
  local.get $this
  local.get $recordValue
  i32.store offset=44
  local.get $this
  local.get $recordValue
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $~lib/task/Task<i32>#set:value (type $0) (param $this i32) (param $value i32)
  local.get $this
  local.get $value
  i32.store offset=48
 )
 (func $~lib/task/TaskPolicy#set:crossesThreads (type $0) (param $this i32) (param $crossesThreads i32)
  local.get $this
  local.get $crossesThreads
  i32.store8
 )
 (func $~lib/thread/RemotePolicy#set:target (type $0) (param $this i32) (param $target i32)
  local.get $this
  local.get $target
  i32.store offset=4
 )
 (func $~lib/thread/RemotePolicy#set:arg (type $0) (param $this i32) (param $arg i32)
  local.get $this
  local.get $arg
  i32.store offset=8
 )
 (func $~lib/thread/RemotePolicy#set:reply (type $0) (param $this i32) (param $reply i32)
  local.get $this
  local.get $reply
  i32.store offset=12
 )
 (func $~lib/array/Array<~lib/task/TaskBase|null>#get:length_ (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=12
 )
 (func $~lib/array/Array<~lib/task/TaskBase|null>#get:dataStart (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/task/TaskBase#get:mask (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=28
 )
 (func $~lib/mask/MaskBase#get:width (type $1) (param $this i32) (result i32)
  unreachable
 )
 (func $~lib/mask/MaskBase#allows (type $2) (param $this i32) (param $id i32) (result i32)
  unreachable
 )
 (func $~lib/task/Waiter#set:exec (type $0) (param $this i32) (param $exec i32)
  local.get $this
  local.get $exec
  i32.store
 )
 (func $~lib/task/Waiter#set:slot (type $0) (param $this i32) (param $slot i32)
  local.get $this
  local.get $slot
  i32.store offset=4
 )
 (func $~lib/task/TaskBase#get:waiters (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=16
 )
 (func $~lib/array/Array<~lib/task/Waiter>#set:buffer (type $0) (param $this i32) (param $buffer i32)
  local.get $this
  local.get $buffer
  i32.store
  local.get $this
  local.get $buffer
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $~lib/array/Array<~lib/task/Waiter>#set:dataStart (type $0) (param $this i32) (param $dataStart i32)
  local.get $this
  local.get $dataStart
  i32.store offset=4
 )
 (func $~lib/array/Array<~lib/task/Waiter>#set:byteLength (type $0) (param $this i32) (param $byteLength i32)
  local.get $this
  local.get $byteLength
  i32.store offset=8
 )
 (func $~lib/array/Array<~lib/task/Waiter>#set:length_ (type $0) (param $this i32) (param $length_ i32)
  local.get $this
  local.get $length_
  i32.store offset=12
 )
 (func $~lib/array/Array<~lib/task/Waiter>#get:length_ (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=12
 )
 (func $~lib/arraybuffer/ArrayBufferView#get:byteLength (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $~lib/arraybuffer/ArrayBufferView#get:buffer (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/rt/itcms/Object#get:rtSize (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=16
 )
 (func $~lib/rt/itcms/__renew (type $2) (param $oldPtr i32) (param $size i32) (result i32)
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
 (func $~lib/array/Array<~lib/task/Waiter>#get:dataStart (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/task/TaskBase#__parkRecord (type $1) (param $this i32) (result i32)
  i32.const 0
  return
 )
 (func $~lib/task/TaskRecord#get:class_ (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/task/TaskRecord#get:key (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/task/TaskRecord#get:status (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=12
 )
 (func $~lib/task-stack/__parkYield (type $5)
  (local $id i32)
  global.get $~asyncCurrentSlot
  local.set $id
  local.get $id
  i32.const 0
  i32.lt_s
  if
   return
  end
  local.get $id
  i64.extend_i32_s
  i32.const 0
  i32.const 0
  call $~lib/task-stack/hostPark
 )
 (func $~asyncMainStart (type $4) (result i32)
  call $stackful-fiber-record/main
 )
 (func $~lib/async/__asyncPump (type $4) (result i32)
  i32.const 0
  return
 )
 (func $~lib/rt/common/noteArena (type $0) (param $end i32) (param $heap i32)
  local.get $end
  global.set $~lib/rt/common/ARENA_END_CONFIGURED
  local.get $heap
  global.set $~lib/rt/common/ARENA_BASE_CONFIGURED
 )
 (func $~lib/rt/common/enterArena (type $2) (param $base i32) (param $size i32) (result i32)
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
  local.get $end
  local.get $heap
  call $~lib/rt/common/noteArena
  local.get $heap
  return
 )
 (func $~lib/rt/itcms/noteArenaSpaces (type $5)
  global.get $~lib/rt/itcms/fromSpace
  global.set $~lib/rt/itcms/ARENA_FROM_SPACE
  global.get $~lib/rt/itcms/toSpace
  global.set $~lib/rt/itcms/ARENA_TO_SPACE
  global.get $~lib/rt/itcms/pinSpace
  global.set $~lib/rt/itcms/ARENA_PIN_SPACE
 )
 (func $~lib/rt/itcms/__arenaPlaceState (type $2) (param $heapBase i32) (param $arenaEnd i32) (result i32)
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
  call $~lib/rt/itcms/noteArenaSpaces
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
 (func $~lib/rt/tlsf/initializeAt (type $0) (param $rootOffset i32) (param $memEnd i32)
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
 (func $~lib/rt/tlsf/__arenaInit (type $0) (param $base i32) (param $size i32)
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
 (func $~lib/rt/common/__arenaHeapBase (type $4) (result i32)
  global.get $~lib/rt/common/HEAP_BASE
  return
 )
 (func $~lib/rt/common/__arenaEnd (type $4) (result i32)
  global.get $~lib/rt/common/ARENA_END
  return
 )
 (func $~lib/thread/initRingWords (type $0) (param $base i32) (param $capacity i32)
  (local $ptr i32)
  (local $value i32)
  (local $ptr|4 i32)
  (local $value|5 i32)
  (local $ptr|6 i32)
  (local $value|7 i32)
  (local $i i32)
  (local $off i32)
  (local $word i32)
  (local $ptr|11 i32)
  (local $value|12 i32)
  (local $word|13 i32)
  (local $ptr|14 i32)
  (local $value|15 i32)
  local.get $base
  global.get $~lib/thread/HEAD_OFF
  i32.add
  local.set $ptr
  i32.const 0
  local.set $value
  local.get $ptr
  local.get $value
  i32.atomic.store
  local.get $base
  global.get $~lib/thread/TAIL_OFF
  i32.add
  local.set $ptr|4
  i32.const 0
  local.set $value|5
  local.get $ptr|4
  local.get $value|5
  i32.atomic.store
  local.get $base
  global.get $~lib/thread/CAPACITY_OFF
  i32.add
  local.set $ptr|6
  local.get $capacity
  local.set $value|7
  local.get $ptr|6
  local.get $value|7
  i32.atomic.store
  i32.const 0
  local.set $i
  loop $for-loop|0
   local.get $i
   local.get $capacity
   i32.lt_s
   if
    local.get $base
    global.get $~lib/thread/SLOTS_OFF
    i32.add
    local.get $i
    i32.const 3
    i32.shl
    i32.add
    local.set $off
    local.get $off
    block $~lib/thread/wordOffset|inlined.0 (result i32)
     global.get $~lib/thread/VALUE_WORD
     local.set $word
     local.get $word
     i32.const 2
     i32.shl
     br $~lib/thread/wordOffset|inlined.0
    end
    i32.add
    local.set $ptr|11
    i32.const 0
    local.set $value|12
    local.get $ptr|11
    local.get $value|12
    i32.atomic.store
    local.get $off
    block $~lib/thread/wordOffset|inlined.1 (result i32)
     global.get $~lib/thread/SEQ_WORD
     local.set $word|13
     local.get $word|13
     i32.const 2
     i32.shl
     br $~lib/thread/wordOffset|inlined.1
    end
    i32.add
    local.set $ptr|14
    local.get $i
    local.set $value|15
    local.get $ptr|14
    local.get $value|15
    i32.atomic.store
    local.get $i
    i32.const 1
    i32.add
    local.set $i
    br $for-loop|0
   end
  end
 )
 (func $~lib/thread/__carveThreadLayout (type $2) (param $capacity i32) (param $total i32) (result i32)
  (local $capacity|2 i32)
  (local $stride i32)
  (local $requests i32)
  (local $recordBytes i32)
  (local $requestBytes i32)
  (local $freeBytes i32)
  (local $controlBytes i32)
  (local $here i32)
  (local $workers i32)
  (local $arenasBase i32)
  (local $needEnd i32)
  (local $needPages i32)
  (local $have i32)
  (local $ptr i32)
  (local $value i32)
  (local $ptr|17 i32)
  (local $value|18 i32)
  (local $ptr|19 i32)
  (local $value|20 i32)
  (local $ptr|21 i32)
  (local $value|22 i32)
  (local $ptr|23 i32)
  (local $value|24 i32)
  (local $id i32)
  (local $rec i32)
  (local $rec|27 i32)
  (local $rec|28 i32)
  (local $capacity|29 i32)
  (local $rec|30 i32)
  (local $rec|31 i32)
  (local $capacity|32 i32)
  (local $capacity|33 i32)
  (local $sig i32)
  (local $ptr|35 i32)
  (local $value|36 i32)
  (local $ptr|37 i32)
  (local $value|38 i32)
  (local $ptr|39 i32)
  (local $value|40 i32)
  (local $ptr|41 i32)
  (local $value|42 i32)
  (local $ptr|43 i32)
  (local $value|44 i32)
  (local $ptr|45 i32)
  (local $value|46 i32)
  (local $free i32)
  (local $ptr|48 i32)
  (local $value|49 i32)
  (local $ptr|50 i32)
  (local $value|51 i32)
  (local $ptr|52 i32)
  (local $value|53 i32)
  (local $i i32)
  (local $ptr|55 i32)
  (local $value|56 i32)
  (local $mainBase i32)
  (local $mainEnd i32)
  (local $mainRec i32)
  (local $rec|60 i32)
  (local $rec|61 i32)
  (local $capacity|62 i32)
  (local $capacity|63 i32)
  (local $ptr|64 i32)
  (local $value|65 i32)
  (local $rec|66 i32)
  (local $rec|67 i32)
  (local $capacity|68 i32)
  (local $capacity|69 i32)
  (local $ptr|70 i32)
  (local $value|71 i32)
  local.get $capacity
  i32.const 0
  i32.le_s
  if
   global.get $~lib/thread/DEFAULT_CAPACITY
   local.set $capacity
  end
  i32.const 2
  block $~lib/thread/ringWords|inlined.0 (result i32)
   local.get $capacity
   local.set $capacity|2
   i32.const 3
   local.get $capacity|2
   global.get $~lib/thread/CELL_WORDS
   i32.mul
   i32.add
   br $~lib/thread/ringWords|inlined.0
  end
  i32.mul
  i32.const 6
  i32.add
  i32.const 4
  i32.mul
  i32.const 15
  i32.add
  i32.const 15
  i32.const -1
  i32.xor
  i32.and
  local.set $stride
  local.get $capacity
  local.set $requests
  local.get $total
  local.get $stride
  i32.mul
  local.set $recordBytes
  local.get $requests
  global.get $~lib/thread/REQUEST_WORDS
  i32.mul
  i32.const 4
  i32.mul
  local.set $requestBytes
  local.get $requests
  i32.const 3
  i32.add
  i32.const 4
  i32.mul
  local.set $freeBytes
  global.get $~lib/thread/HEADER_BYTES
  local.get $recordBytes
  i32.add
  local.get $requestBytes
  i32.add
  local.get $freeBytes
  i32.add
  local.set $controlBytes
  global.get $~lib/memory/__heap_base
  global.get $~lib/thread/PAGE_SIZE
  i32.const 1
  i32.sub
  i32.add
  global.get $~lib/thread/PAGE_SIZE
  i32.const 1
  i32.sub
  i32.const -1
  i32.xor
  i32.and
  local.set $here
  local.get $total
  i32.const 1
  i32.sub
  local.set $workers
  local.get $here
  local.get $controlBytes
  i32.add
  local.set $arenasBase
  local.get $arenasBase
  local.get $workers
  global.get $~lib/thread/WORKER_ARENA_BYTES
  i32.mul
  i32.add
  global.get $~lib/thread/MAIN_ARENA_BYTES
  i32.add
  local.set $needEnd
  local.get $needEnd
  global.get $~lib/thread/PAGE_SIZE
  i32.const 1
  i32.sub
  i32.add
  i32.const 16
  i32.shr_u
  local.set $needPages
  memory.size
  local.set $have
  local.get $have
  local.get $needPages
  i32.lt_s
  if (result i32)
   local.get $needPages
   local.get $have
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
  local.get $here
  i32.const 0
  local.get $controlBytes
  memory.fill
  local.get $here
  global.set $~lib/thread/__controlBase
  local.get $here
  global.set $~lib/thread/__heapBase
  local.get $stride
  global.set $~lib/thread/__controlStride
  local.get $capacity
  global.set $~lib/thread/__ringCapacity
  local.get $total
  global.set $~lib/thread/__executorTotal
  local.get $here
  global.get $~lib/thread/HEADER_BYTES
  i32.add
  local.get $recordBytes
  i32.add
  global.set $~lib/thread/requestBase
  global.get $~lib/thread/requestBase
  local.get $requestBytes
  i32.add
  global.set $~lib/thread/freeRingBase
  local.get $requests
  global.set $~lib/thread/requestCount
  local.get $here
  global.get $~lib/thread/H_MAGIC
  i32.const 2
  i32.shl
  i32.add
  local.set $ptr
  global.get $~lib/thread/CONTROL_MAGIC
  local.set $value
  local.get $ptr
  local.get $value
  i32.atomic.store
  local.get $here
  global.get $~lib/thread/H_TOTAL
  i32.const 2
  i32.shl
  i32.add
  local.set $ptr|17
  local.get $total
  local.set $value|18
  local.get $ptr|17
  local.get $value|18
  i32.atomic.store
  local.get $here
  global.get $~lib/thread/H_STRIDE
  i32.const 2
  i32.shl
  i32.add
  local.set $ptr|19
  local.get $stride
  local.set $value|20
  local.get $ptr|19
  local.get $value|20
  i32.atomic.store
  local.get $here
  global.get $~lib/thread/H_CAPACITY
  i32.const 2
  i32.shl
  i32.add
  local.set $ptr|21
  local.get $capacity
  local.set $value|22
  local.get $ptr|21
  local.get $value|22
  i32.atomic.store
  local.get $here
  global.get $~lib/thread/H_REQUESTS
  i32.const 2
  i32.shl
  i32.add
  local.set $ptr|23
  local.get $requests
  local.set $value|24
  local.get $ptr|23
  local.get $value|24
  i32.atomic.store
  i32.const 0
  local.set $id
  loop $for-loop|0
   local.get $id
   local.get $total
   i32.lt_s
   if
    local.get $here
    global.get $~lib/thread/HEADER_BYTES
    i32.add
    local.get $id
    local.get $stride
    i32.mul
    i32.add
    local.set $rec
    block $~lib/thread/readyBase|inlined.0 (result i32)
     local.get $rec
     local.set $rec|27
     local.get $rec|27
     br $~lib/thread/readyBase|inlined.0
    end
    local.get $capacity
    call $~lib/thread/initRingWords
    block $~lib/thread/inboxBase|inlined.0 (result i32)
     local.get $rec
     local.set $rec|28
     local.get $rec|28
     block $~lib/thread/ringWords|inlined.1 (result i32)
      global.get $~lib/thread/__ringCapacity
      local.set $capacity|29
      i32.const 3
      local.get $capacity|29
      global.get $~lib/thread/CELL_WORDS
      i32.mul
      i32.add
      br $~lib/thread/ringWords|inlined.1
     end
     i32.const 2
     i32.shl
     i32.add
     br $~lib/thread/inboxBase|inlined.0
    end
    local.get $capacity
    call $~lib/thread/initRingWords
    block $~lib/thread/signalBase|inlined.0 (result i32)
     local.get $rec
     local.set $rec|30
     block $~lib/thread/inboxBase|inlined.1 (result i32)
      local.get $rec|30
      local.set $rec|31
      local.get $rec|31
      block $~lib/thread/ringWords|inlined.2 (result i32)
       global.get $~lib/thread/__ringCapacity
       local.set $capacity|32
       i32.const 3
       local.get $capacity|32
       global.get $~lib/thread/CELL_WORDS
       i32.mul
       i32.add
       br $~lib/thread/ringWords|inlined.2
      end
      i32.const 2
      i32.shl
      i32.add
      br $~lib/thread/inboxBase|inlined.1
     end
     block $~lib/thread/ringWords|inlined.3 (result i32)
      global.get $~lib/thread/__ringCapacity
      local.set $capacity|33
      i32.const 3
      local.get $capacity|33
      global.get $~lib/thread/CELL_WORDS
      i32.mul
      i32.add
      br $~lib/thread/ringWords|inlined.3
     end
     i32.const 2
     i32.shl
     i32.add
     br $~lib/thread/signalBase|inlined.0
    end
    local.set $sig
    local.get $sig
    local.set $ptr|35
    i32.const 0
    local.set $value|36
    local.get $ptr|35
    local.get $value|36
    i32.atomic.store
    local.get $sig
    i32.const 4
    i32.add
    local.set $ptr|37
    local.get $id
    i32.const 0
    i32.eq
    if (result i32)
     i32.const 0
    else
     local.get $arenasBase
     local.get $id
     i32.const 1
     i32.sub
     global.get $~lib/thread/WORKER_ARENA_BYTES
     i32.mul
     i32.add
    end
    local.set $value|38
    local.get $ptr|37
    local.get $value|38
    i32.atomic.store
    local.get $sig
    i32.const 8
    i32.add
    local.set $ptr|39
    local.get $id
    i32.const 0
    i32.eq
    if (result i32)
     i32.const 0
    else
     global.get $~lib/thread/WORKER_ARENA_BYTES
    end
    local.set $value|40
    local.get $ptr|39
    local.get $value|40
    i32.atomic.store
    local.get $sig
    i32.const 12
    i32.add
    local.set $ptr|41
    local.get $id
    i32.const 0
    i32.eq
    if (result i32)
     i32.const 1
    else
     i32.const 0
    end
    local.set $value|42
    local.get $ptr|41
    local.get $value|42
    i32.atomic.store
    local.get $sig
    i32.const 16
    i32.add
    local.set $ptr|43
    i32.const -1
    local.set $value|44
    local.get $ptr|43
    local.get $value|44
    i32.atomic.store
    local.get $sig
    i32.const 20
    i32.add
    local.set $ptr|45
    i32.const 0
    local.set $value|46
    local.get $ptr|45
    local.get $value|46
    i32.atomic.store
    local.get $id
    i32.const 1
    i32.add
    local.set $id
    br $for-loop|0
   end
  end
  global.get $~lib/thread/freeRingBase
  local.set $free
  local.get $free
  global.get $~lib/thread/HEAD_OFF
  i32.add
  local.set $ptr|48
  i32.const 0
  local.set $value|49
  local.get $ptr|48
  local.get $value|49
  i32.atomic.store
  local.get $free
  global.get $~lib/thread/TAIL_OFF
  i32.add
  local.set $ptr|50
  local.get $requests
  local.set $value|51
  local.get $ptr|50
  local.get $value|51
  i32.atomic.store
  local.get $free
  global.get $~lib/thread/CAPACITY_OFF
  i32.add
  local.set $ptr|52
  local.get $requests
  local.set $value|53
  local.get $ptr|52
  local.get $value|53
  i32.atomic.store
  i32.const 0
  local.set $i
  loop $for-loop|1
   local.get $i
   local.get $requests
   i32.lt_s
   if
    local.get $free
    global.get $~lib/thread/SLOTS_OFF
    i32.add
    local.get $i
    i32.const 2
    i32.shl
    i32.add
    local.set $ptr|55
    local.get $i
    local.set $value|56
    local.get $ptr|55
    local.get $value|56
    i32.atomic.store
    local.get $i
    i32.const 1
    i32.add
    local.set $i
    br $for-loop|1
   end
  end
  local.get $arenasBase
  local.get $workers
  global.get $~lib/thread/WORKER_ARENA_BYTES
  i32.mul
  i32.add
  local.set $mainBase
  memory.size
  i32.const 16
  i32.shl
  local.set $mainEnd
  local.get $here
  global.get $~lib/thread/HEADER_BYTES
  i32.add
  local.set $mainRec
  block $~lib/thread/signalBase|inlined.1 (result i32)
   local.get $mainRec
   local.set $rec|60
   block $~lib/thread/inboxBase|inlined.2 (result i32)
    local.get $rec|60
    local.set $rec|61
    local.get $rec|61
    block $~lib/thread/ringWords|inlined.4 (result i32)
     global.get $~lib/thread/__ringCapacity
     local.set $capacity|62
     i32.const 3
     local.get $capacity|62
     global.get $~lib/thread/CELL_WORDS
     i32.mul
     i32.add
     br $~lib/thread/ringWords|inlined.4
    end
    i32.const 2
    i32.shl
    i32.add
    br $~lib/thread/inboxBase|inlined.2
   end
   block $~lib/thread/ringWords|inlined.5 (result i32)
    global.get $~lib/thread/__ringCapacity
    local.set $capacity|63
    i32.const 3
    local.get $capacity|63
    global.get $~lib/thread/CELL_WORDS
    i32.mul
    i32.add
    br $~lib/thread/ringWords|inlined.5
   end
   i32.const 2
   i32.shl
   i32.add
   br $~lib/thread/signalBase|inlined.1
  end
  i32.const 4
  i32.add
  local.set $ptr|64
  local.get $mainBase
  local.set $value|65
  local.get $ptr|64
  local.get $value|65
  i32.atomic.store
  block $~lib/thread/signalBase|inlined.2 (result i32)
   local.get $mainRec
   local.set $rec|66
   block $~lib/thread/inboxBase|inlined.3 (result i32)
    local.get $rec|66
    local.set $rec|67
    local.get $rec|67
    block $~lib/thread/ringWords|inlined.6 (result i32)
     global.get $~lib/thread/__ringCapacity
     local.set $capacity|68
     i32.const 3
     local.get $capacity|68
     global.get $~lib/thread/CELL_WORDS
     i32.mul
     i32.add
     br $~lib/thread/ringWords|inlined.6
    end
    i32.const 2
    i32.shl
    i32.add
    br $~lib/thread/inboxBase|inlined.3
   end
   block $~lib/thread/ringWords|inlined.7 (result i32)
    global.get $~lib/thread/__ringCapacity
    local.set $capacity|69
    i32.const 3
    local.get $capacity|69
    global.get $~lib/thread/CELL_WORDS
    i32.mul
    i32.add
    br $~lib/thread/ringWords|inlined.7
   end
   i32.const 2
   i32.shl
   i32.add
   br $~lib/thread/signalBase|inlined.2
  end
  i32.const 8
  i32.add
  local.set $ptr|70
  local.get $mainEnd
  local.get $mainBase
  i32.sub
  local.set $value|71
  local.get $ptr|70
  local.get $value|71
  i32.atomic.store
  i32.const 0
  return
 )
 (func $~lib/thread/__threadInit (type $1) (param $capacity i32) (result i32)
  (local $total i32)
  i32.const 1
  i32.eqz
  drop
  global.get $~lib/thread/__controlBase
  i32.const 0
  i32.ne
  if
   i32.const 0
   return
  end
  call $~lib/thread/__executorCount
  local.set $total
  local.get $total
  i32.const 0
  i32.le_s
  if
   i32.const -1
   return
  end
  local.get $capacity
  local.get $total
  call $~lib/thread/__carveThreadLayout
  return
 )
 (func $~lib/thread/__mainArenaBase (type $4) (result i32)
  (local $rec i32)
  (local $rec|1 i32)
  (local $capacity i32)
  (local $capacity|3 i32)
  (local $ptr i32)
  global.get $~lib/thread/__controlBase
  i32.const 0
  i32.eq
  if
   i32.const 0
   return
  end
  block $~lib/atomics/atomicLoad<i32>|inlined.0 (result i32)
   block $~lib/thread/signalBase|inlined.3 (result i32)
    global.get $~lib/thread/__controlBase
    global.get $~lib/thread/HEADER_BYTES
    i32.add
    local.set $rec
    block $~lib/thread/inboxBase|inlined.4 (result i32)
     local.get $rec
     local.set $rec|1
     local.get $rec|1
     block $~lib/thread/ringWords|inlined.8 (result i32)
      global.get $~lib/thread/__ringCapacity
      local.set $capacity
      i32.const 3
      local.get $capacity
      global.get $~lib/thread/CELL_WORDS
      i32.mul
      i32.add
      br $~lib/thread/ringWords|inlined.8
     end
     i32.const 2
     i32.shl
     i32.add
     br $~lib/thread/inboxBase|inlined.4
    end
    block $~lib/thread/ringWords|inlined.9 (result i32)
     global.get $~lib/thread/__ringCapacity
     local.set $capacity|3
     i32.const 3
     local.get $capacity|3
     global.get $~lib/thread/CELL_WORDS
     i32.mul
     i32.add
     br $~lib/thread/ringWords|inlined.9
    end
    i32.const 2
    i32.shl
    i32.add
    br $~lib/thread/signalBase|inlined.3
   end
   i32.const 4
   i32.add
   local.set $ptr
   local.get $ptr
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.0
  end
  return
 )
 (func $~lib/thread/__mainArenaSize (type $4) (result i32)
  (local $rec i32)
  (local $rec|1 i32)
  (local $capacity i32)
  (local $capacity|3 i32)
  (local $ptr i32)
  global.get $~lib/thread/__controlBase
  i32.const 0
  i32.eq
  if
   i32.const 0
   return
  end
  block $~lib/atomics/atomicLoad<i32>|inlined.1 (result i32)
   block $~lib/thread/signalBase|inlined.4 (result i32)
    global.get $~lib/thread/__controlBase
    global.get $~lib/thread/HEADER_BYTES
    i32.add
    local.set $rec
    block $~lib/thread/inboxBase|inlined.5 (result i32)
     local.get $rec
     local.set $rec|1
     local.get $rec|1
     block $~lib/thread/ringWords|inlined.10 (result i32)
      global.get $~lib/thread/__ringCapacity
      local.set $capacity
      i32.const 3
      local.get $capacity
      global.get $~lib/thread/CELL_WORDS
      i32.mul
      i32.add
      br $~lib/thread/ringWords|inlined.10
     end
     i32.const 2
     i32.shl
     i32.add
     br $~lib/thread/inboxBase|inlined.5
    end
    block $~lib/thread/ringWords|inlined.11 (result i32)
     global.get $~lib/thread/__ringCapacity
     local.set $capacity|3
     i32.const 3
     local.get $capacity|3
     global.get $~lib/thread/CELL_WORDS
     i32.mul
     i32.add
     br $~lib/thread/ringWords|inlined.11
    end
    i32.const 2
    i32.shl
    i32.add
    br $~lib/thread/signalBase|inlined.4
   end
   i32.const 8
   i32.add
   local.set $ptr
   local.get $ptr
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.1
  end
  return
 )
 (func $~lib/thread/__spawnThread (type $10) (param $id i32) (param $entryIndex i32) (param $argSlot i32) (result i32)
  (local $id|3 i32)
  (local $rec i32)
  (local $rec|5 i32)
  (local $capacity i32)
  (local $capacity|7 i32)
  (local $sig i32)
  (local $ptr i32)
  (local $ptr|10 i32)
  (local $value i32)
  (local $ptr|12 i32)
  (local $value|13 i32)
  (local $status i32)
  (local $ptr|15 i32)
  (local $value|16 i32)
  global.get $~lib/thread/__controlBase
  i32.const 0
  i32.eq
  if
   i32.const -1
   return
  end
  local.get $id
  i32.const 0
  i32.le_s
  if (result i32)
   i32.const 1
  else
   local.get $id
   global.get $~lib/thread/__executorTotal
   i32.ge_s
  end
  if
   i32.const -1
   return
  end
  block $~lib/thread/signalBase|inlined.5 (result i32)
   block $~lib/thread/recordBase|inlined.0 (result i32)
    local.get $id
    local.set $id|3
    global.get $~lib/thread/__controlBase
    global.get $~lib/thread/HEADER_BYTES
    i32.add
    local.get $id|3
    global.get $~lib/thread/__controlStride
    i32.mul
    i32.add
    br $~lib/thread/recordBase|inlined.0
   end
   local.set $rec
   block $~lib/thread/inboxBase|inlined.6 (result i32)
    local.get $rec
    local.set $rec|5
    local.get $rec|5
    block $~lib/thread/ringWords|inlined.12 (result i32)
     global.get $~lib/thread/__ringCapacity
     local.set $capacity
     i32.const 3
     local.get $capacity
     global.get $~lib/thread/CELL_WORDS
     i32.mul
     i32.add
     br $~lib/thread/ringWords|inlined.12
    end
    i32.const 2
    i32.shl
    i32.add
    br $~lib/thread/inboxBase|inlined.6
   end
   block $~lib/thread/ringWords|inlined.13 (result i32)
    global.get $~lib/thread/__ringCapacity
    local.set $capacity|7
    i32.const 3
    local.get $capacity|7
    global.get $~lib/thread/CELL_WORDS
    i32.mul
    i32.add
    br $~lib/thread/ringWords|inlined.13
   end
   i32.const 2
   i32.shl
   i32.add
   br $~lib/thread/signalBase|inlined.5
  end
  local.set $sig
  block $~lib/atomics/atomicLoad<i32>|inlined.2 (result i32)
   local.get $sig
   i32.const 12
   i32.add
   local.set $ptr
   local.get $ptr
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.2
  end
  i32.const 0
  i32.ne
  if
   i32.const -2
   return
  end
  local.get $sig
  i32.const 16
  i32.add
  local.set $ptr|10
  local.get $entryIndex
  local.set $value
  local.get $ptr|10
  local.get $value
  i32.atomic.store
  local.get $sig
  i32.const 20
  i32.add
  local.set $ptr|12
  local.get $argSlot
  local.set $value|13
  local.get $ptr|12
  local.get $value|13
  i32.atomic.store
  local.get $id
  call $~lib/thread/__startThread
  local.set $status
  local.get $status
  i32.const 0
  i32.ne
  if
   local.get $sig
   i32.const 12
   i32.add
   local.set $ptr|15
   i32.const 2
   local.set $value|16
   local.get $ptr|15
   local.get $value|16
   i32.atomic.store
  end
  local.get $status
  return
 )
 (func $~lib/thread/controlBlockBase (type $4) (result i32)
  (local $b i32)
  (local $here i32)
  (local $ptr i32)
  global.get $~lib/thread/__controlBase
  local.set $b
  local.get $b
  i32.const 0
  i32.ne
  if
   local.get $b
   return
  end
  global.get $~lib/memory/__heap_base
  global.get $~lib/thread/PAGE_SIZE
  i32.const 1
  i32.sub
  i32.add
  global.get $~lib/thread/PAGE_SIZE
  i32.const 1
  i32.sub
  i32.const -1
  i32.xor
  i32.and
  local.set $here
  block $~lib/atomics/atomicLoad<i32>|inlined.3 (result i32)
   local.get $here
   global.get $~lib/thread/H_MAGIC
   i32.const 2
   i32.shl
   i32.add
   local.set $ptr
   local.get $ptr
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.3
  end
  global.get $~lib/thread/CONTROL_MAGIC
  i32.ne
  if
   i32.const 0
   return
  end
  local.get $here
  return
 )
 (func $~lib/task-stack/__setSelfExecutor (type $3) (param $id i32)
  local.get $id
  global.set $~lib/task-stack/selfExecutor
 )
 (func $~lib/array/Array<~lib/thread/Executor|null>#set:buffer (type $0) (param $this i32) (param $buffer i32)
  local.get $this
  local.get $buffer
  i32.store
  local.get $this
  local.get $buffer
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $~lib/array/Array<~lib/thread/Executor|null>#set:dataStart (type $0) (param $this i32) (param $dataStart i32)
  local.get $this
  local.get $dataStart
  i32.store offset=4
 )
 (func $~lib/array/Array<~lib/thread/Executor|null>#set:byteLength (type $0) (param $this i32) (param $byteLength i32)
  local.get $this
  local.get $byteLength
  i32.store offset=8
 )
 (func $~lib/array/Array<~lib/thread/Executor|null>#set:length_ (type $0) (param $this i32) (param $length_ i32)
  local.get $this
  local.get $length_
  i32.store offset=12
 )
 (func $~lib/array/Array<~lib/thread/Executor|null>#get:length_ (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=12
 )
 (func $~lib/array/Array<~lib/thread/Executor|null>#get:dataStart (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/thread/Executor#get:inbox (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $~lib/thread/SlotRing#get:capacity (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/thread/SlotRing#get:base (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/thread/blockFreeRequest (type $3) (param $index i32)
  (local $free i32)
  (local $capacity i32)
  (local $ptr i32)
  (local $tail i32)
  (local $ptr|5 i32)
  (local $head i32)
  (local $ptr|7 i32)
  (local $expect i32)
  (local $replace i32)
  (local $ptr|10 i32)
  (local $value i32)
  global.get $~lib/thread/freeRingBase
  local.set $free
  global.get $~lib/thread/requestCount
  local.set $capacity
  local.get $free
  i32.const 0
  i32.eq
  if (result i32)
   i32.const 1
  else
   local.get $capacity
   i32.const 0
   i32.le_s
  end
  if (result i32)
   i32.const 1
  else
   local.get $index
   i32.const 0
   i32.lt_s
  end
  if (result i32)
   i32.const 1
  else
   local.get $index
   local.get $capacity
   i32.ge_s
  end
  if
   return
  end
  loop $while-continue|0
   i32.const 1
   if
    block $~lib/atomics/atomicLoad<i32>|inlined.18 (result i32)
     local.get $free
     global.get $~lib/thread/TAIL_OFF
     i32.add
     local.set $ptr
     local.get $ptr
     i32.atomic.load
     br $~lib/atomics/atomicLoad<i32>|inlined.18
    end
    local.set $tail
    block $~lib/atomics/atomicLoad<i32>|inlined.19 (result i32)
     local.get $free
     global.get $~lib/thread/HEAD_OFF
     i32.add
     local.set $ptr|5
     local.get $ptr|5
     i32.atomic.load
     br $~lib/atomics/atomicLoad<i32>|inlined.19
    end
    local.set $head
    local.get $tail
    local.get $head
    i32.sub
    local.get $capacity
    i32.ge_s
    if
     return
    end
    block $~lib/atomics/atomicCompareExchange<i32>|inlined.1 (result i32)
     local.get $free
     global.get $~lib/thread/TAIL_OFF
     i32.add
     local.set $ptr|7
     local.get $tail
     local.set $expect
     local.get $tail
     i32.const 1
     i32.add
     local.set $replace
     local.get $ptr|7
     local.get $expect
     local.get $replace
     i32.atomic.rmw.cmpxchg
     br $~lib/atomics/atomicCompareExchange<i32>|inlined.1
    end
    local.get $tail
    i32.eq
    if
     local.get $free
     global.get $~lib/thread/SLOTS_OFF
     i32.add
     local.get $tail
     local.get $capacity
     i32.rem_s
     i32.const 2
     i32.shl
     i32.add
     local.set $ptr|10
     local.get $index
     local.set $value
     local.get $ptr|10
     local.get $value
     i32.atomic.store
     return
    end
    br $while-continue|0
   end
  end
  unreachable
 )
 (func $~lib/task-stack/__serveSlot (type $1) (param $funcIndex i32) (result i32)
  local.get $funcIndex
  call $$serveEntry
  drop
  i32.const -1
  return
 )
 (func $~lib/task/TaskBase#drive (type $3) (param $this i32)
  unreachable
 )
 (func $~lib/thread/Executor#get:ready (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/thread/SlotRing#get:signal (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $~lib/array/Array<~lib/thread/Request|null>#get:length_ (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=12
 )
 (func $~lib/array/Array<~lib/thread/Request|null>#get:dataStart (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/thread/Request#get:funcIndex (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/thread/Request#get:argSlot (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/thread/Request#get:taskKey (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $~lib/array/Array<i32>#set:buffer (type $0) (param $this i32) (param $buffer i32)
  local.get $this
  local.get $buffer
  i32.store
  local.get $this
  local.get $buffer
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $~lib/array/Array<i32>#set:dataStart (type $0) (param $this i32) (param $dataStart i32)
  local.get $this
  local.get $dataStart
  i32.store offset=4
 )
 (func $~lib/array/Array<i32>#set:byteLength (type $0) (param $this i32) (param $byteLength i32)
  local.get $this
  local.get $byteLength
  i32.store offset=8
 )
 (func $~lib/array/Array<i32>#set:length_ (type $0) (param $this i32) (param $length_ i32)
  local.get $this
  local.get $length_
  i32.store offset=12
 )
 (func $~lib/array/Array<i32>#get:length_ (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=12
 )
 (func $~lib/array/Array<i32>#get:dataStart (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/task/TaskBase#get:settled (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load8_u offset=8
 )
 (func $~lib/thread/Executor#set:id (type $0) (param $this i32) (param $id i32)
  local.get $this
  local.get $id
  i32.store
 )
 (func $~lib/thread/Executor#set:step (type $0) (param $this i32) (param $step i32)
  local.get $this
  local.get $step
  i32.store offset=12
  local.get $this
  local.get $step
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $~lib/thread/SlotRing#set:capacity (type $0) (param $this i32) (param $capacity i32)
  local.get $this
  local.get $capacity
  i32.store offset=4
 )
 (func $~lib/arraybuffer/ArrayBufferView#set:buffer (type $0) (param $this i32) (param $buffer i32)
  local.get $this
  local.get $buffer
  i32.store
  local.get $this
  local.get $buffer
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $~lib/arraybuffer/ArrayBufferView#set:dataStart (type $0) (param $this i32) (param $dataStart i32)
  local.get $this
  local.get $dataStart
  i32.store offset=4
 )
 (func $~lib/arraybuffer/ArrayBufferView#set:byteLength (type $0) (param $this i32) (param $byteLength i32)
  local.get $this
  local.get $byteLength
  i32.store offset=8
 )
 (func $~lib/arraybuffer/ArrayBufferView#get:dataStart (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/thread/SlotRing#set:anchor (type $0) (param $this i32) (param $anchor i32)
  local.get $this
  local.get $anchor
  i32.store offset=12
  local.get $this
  local.get $anchor
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $~lib/thread/SlotRing#set:base (type $0) (param $this i32) (param $base i32)
  local.get $this
  local.get $base
  i32.store
 )
 (func $~lib/thread/SlotRing#set:signal (type $0) (param $this i32) (param $signal i32)
  local.get $this
  local.get $signal
  i32.store offset=8
 )
 (func $~lib/thread/Executor#set:ready (type $0) (param $this i32) (param $ready i32)
  local.get $this
  local.get $ready
  i32.store offset=4
  local.get $this
  local.get $ready
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $~lib/thread/Executor#set:inbox (type $0) (param $this i32) (param $inbox i32)
  local.get $this
  local.get $inbox
  i32.store offset=8
  local.get $this
  local.get $inbox
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $~lib/thread/Executor#set:stop (type $0) (param $this i32) (param $stop i32)
  local.get $this
  local.get $stop
  i32.store8 offset=16
 )
 (func $~lib/thread/blockPush (type $7) (param $ring i32) (param $capacity i32) (param $value i32) (param $signal i32) (result i32)
  (local $ptr i32)
  (local $pos i32)
  (local $ptr|6 i32)
  (local $head i32)
  (local $off i32)
  (local $word i32)
  (local $ptr|10 i32)
  (local $seq i32)
  (local $ptr|12 i32)
  (local $expect i32)
  (local $replace i32)
  (local $word|15 i32)
  (local $ptr|16 i32)
  (local $value|17 i32)
  (local $word|18 i32)
  (local $ptr|19 i32)
  (local $value|20 i32)
  (local $ptr|21 i32)
  (local $value|22 i32)
  (local $ptr|23 i32)
  (local $count i32)
  loop $while-continue|0
   i32.const 1
   if
    block $~lib/atomics/atomicLoad<i32>|inlined.27 (result i32)
     local.get $ring
     global.get $~lib/thread/TAIL_OFF
     i32.add
     local.set $ptr
     local.get $ptr
     i32.atomic.load
     br $~lib/atomics/atomicLoad<i32>|inlined.27
    end
    local.set $pos
    block $~lib/atomics/atomicLoad<i32>|inlined.28 (result i32)
     local.get $ring
     global.get $~lib/thread/HEAD_OFF
     i32.add
     local.set $ptr|6
     local.get $ptr|6
     i32.atomic.load
     br $~lib/atomics/atomicLoad<i32>|inlined.28
    end
    local.set $head
    local.get $pos
    local.get $head
    i32.sub
    local.get $capacity
    i32.ge_s
    if
     i32.const 0
     return
    end
    local.get $ring
    global.get $~lib/thread/SLOTS_OFF
    i32.add
    local.get $pos
    local.get $capacity
    i32.rem_s
    i32.const 3
    i32.shl
    i32.add
    local.set $off
    block $~lib/atomics/atomicLoad<i32>|inlined.29 (result i32)
     local.get $off
     block $~lib/thread/wordOffset|inlined.10 (result i32)
      global.get $~lib/thread/SEQ_WORD
      local.set $word
      local.get $word
      i32.const 2
      i32.shl
      br $~lib/thread/wordOffset|inlined.10
     end
     i32.add
     local.set $ptr|10
     local.get $ptr|10
     i32.atomic.load
     br $~lib/atomics/atomicLoad<i32>|inlined.29
    end
    local.set $seq
    local.get $seq
    local.get $pos
    i32.eq
    if
     block $~lib/atomics/atomicCompareExchange<i32>|inlined.3 (result i32)
      local.get $ring
      global.get $~lib/thread/TAIL_OFF
      i32.add
      local.set $ptr|12
      local.get $pos
      local.set $expect
      local.get $pos
      i32.const 1
      i32.add
      local.set $replace
      local.get $ptr|12
      local.get $expect
      local.get $replace
      i32.atomic.rmw.cmpxchg
      br $~lib/atomics/atomicCompareExchange<i32>|inlined.3
     end
     local.get $pos
     i32.eq
     if
      local.get $off
      block $~lib/thread/wordOffset|inlined.11 (result i32)
       global.get $~lib/thread/VALUE_WORD
       local.set $word|15
       local.get $word|15
       i32.const 2
       i32.shl
       br $~lib/thread/wordOffset|inlined.11
      end
      i32.add
      local.set $ptr|16
      local.get $value
      local.set $value|17
      local.get $ptr|16
      local.get $value|17
      i32.atomic.store
      local.get $off
      block $~lib/thread/wordOffset|inlined.12 (result i32)
       global.get $~lib/thread/SEQ_WORD
       local.set $word|18
       local.get $word|18
       i32.const 2
       i32.shl
       br $~lib/thread/wordOffset|inlined.12
      end
      i32.add
      local.set $ptr|19
      local.get $pos
      i32.const 1
      i32.add
      local.set $value|20
      local.get $ptr|19
      local.get $value|20
      i32.atomic.store
      local.get $signal
      i32.const 0
      i32.ne
      if
       block $~lib/atomics/atomicAdd<i32>|inlined.1 (result i32)
        local.get $signal
        local.set $ptr|21
        i32.const 1
        local.set $value|22
        local.get $ptr|21
        local.get $value|22
        i32.atomic.rmw.add
        br $~lib/atomics/atomicAdd<i32>|inlined.1
       end
       drop
       block $~lib/atomics/atomicNotify|inlined.1 (result i32)
        local.get $signal
        local.set $ptr|23
        i32.const 1
        local.set $count
        local.get $ptr|23
        local.get $count
        memory.atomic.notify
        br $~lib/atomics/atomicNotify|inlined.1
       end
       drop
      end
      i32.const 1
      return
     end
    else
     local.get $seq
     local.get $pos
     i32.lt_s
     if
      i32.const 0
      return
     end
    end
    br $while-continue|0
   end
  end
  unreachable
 )
 (func $~lib/task/setWakeSink (type $3) (param $sink i32)
  local.get $sink
  global.set $~lib/task/__wakeSink
 )
 (func $~lib/thread/Executor#get:stop (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load8_u offset=16
 )
 (func $~lib/thread/Executor#get:step (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=12
 )
 (func $~lib/thread/__threadJoin (type $1) (param $id i32) (result i32)
  (local $id|1 i32)
  (local $rec i32)
  (local $rec|3 i32)
  (local $capacity i32)
  (local $capacity|5 i32)
  (local $addr i32)
  (local $ptr i32)
  (local $state i32)
  (local $ptr|9 i32)
  (local $expect i32)
  (local $timeout i64)
  global.get $~lib/thread/__controlBase
  i32.const 0
  i32.eq
  if
   i32.const -1
   return
  end
  local.get $id
  i32.const 0
  i32.lt_s
  if (result i32)
   i32.const 1
  else
   local.get $id
   global.get $~lib/thread/__executorTotal
   i32.ge_s
  end
  if
   i32.const -1
   return
  end
  block $~lib/thread/signalBase|inlined.9 (result i32)
   block $~lib/thread/recordBase|inlined.4 (result i32)
    local.get $id
    local.set $id|1
    global.get $~lib/thread/__controlBase
    global.get $~lib/thread/HEADER_BYTES
    i32.add
    local.get $id|1
    global.get $~lib/thread/__controlStride
    i32.mul
    i32.add
    br $~lib/thread/recordBase|inlined.4
   end
   local.set $rec
   block $~lib/thread/inboxBase|inlined.11 (result i32)
    local.get $rec
    local.set $rec|3
    local.get $rec|3
    block $~lib/thread/ringWords|inlined.22 (result i32)
     global.get $~lib/thread/__ringCapacity
     local.set $capacity
     i32.const 3
     local.get $capacity
     global.get $~lib/thread/CELL_WORDS
     i32.mul
     i32.add
     br $~lib/thread/ringWords|inlined.22
    end
    i32.const 2
    i32.shl
    i32.add
    br $~lib/thread/inboxBase|inlined.11
   end
   block $~lib/thread/ringWords|inlined.23 (result i32)
    global.get $~lib/thread/__ringCapacity
    local.set $capacity|5
    i32.const 3
    local.get $capacity|5
    global.get $~lib/thread/CELL_WORDS
    i32.mul
    i32.add
    br $~lib/thread/ringWords|inlined.23
   end
   i32.const 2
   i32.shl
   i32.add
   br $~lib/thread/signalBase|inlined.9
  end
  i32.const 12
  i32.add
  local.set $addr
  loop $while-continue|0
   i32.const 1
   if
    block $~lib/atomics/atomicLoad<i32>|inlined.36 (result i32)
     local.get $addr
     local.set $ptr
     local.get $ptr
     i32.atomic.load
     br $~lib/atomics/atomicLoad<i32>|inlined.36
    end
    local.set $state
    local.get $state
    i32.const 2
    i32.eq
    if
     i32.const 0
     return
    end
    block $~lib/atomics/atomicWait<i32>|inlined.1 (result i32)
     local.get $addr
     local.set $ptr|9
     local.get $state
     local.set $expect
     i64.const -1
     local.set $timeout
     local.get $ptr|9
     local.get $expect
     local.get $timeout
     memory.atomic.wait32
     br $~lib/atomics/atomicWait<i32>|inlined.1
    end
    drop
    br $while-continue|0
   end
  end
  unreachable
 )
 (func $~lib/thread/__workerArenaBase (type $1) (param $id i32) (result i32)
  (local $here i32)
  (local $ptr i32)
  (local $total i32)
  (local $ptr|4 i32)
  (local $stride i32)
  (local $ptr|6 i32)
  (local $capacity i32)
  (local $rec i32)
  (local $capacity|9 i32)
  (local $sig i32)
  (local $ptr|11 i32)
  call $~lib/thread/controlBlockBase
  local.set $here
  local.get $here
  i32.const 0
  i32.eq
  if
   i32.const 0
   return
  end
  block $~lib/atomics/atomicLoad<i32>|inlined.37 (result i32)
   local.get $here
   global.get $~lib/thread/H_TOTAL
   i32.const 2
   i32.shl
   i32.add
   local.set $ptr
   local.get $ptr
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.37
  end
  local.set $total
  local.get $id
  i32.const 0
  i32.le_s
  if (result i32)
   i32.const 1
  else
   local.get $id
   local.get $total
   i32.ge_s
  end
  if
   i32.const 0
   return
  end
  block $~lib/atomics/atomicLoad<i32>|inlined.38 (result i32)
   local.get $here
   global.get $~lib/thread/H_STRIDE
   i32.const 2
   i32.shl
   i32.add
   local.set $ptr|4
   local.get $ptr|4
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.38
  end
  local.set $stride
  block $~lib/atomics/atomicLoad<i32>|inlined.39 (result i32)
   local.get $here
   global.get $~lib/thread/H_CAPACITY
   i32.const 2
   i32.shl
   i32.add
   local.set $ptr|6
   local.get $ptr|6
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.39
  end
  local.set $capacity
  local.get $here
  global.get $~lib/thread/HEADER_BYTES
  i32.add
  local.get $id
  local.get $stride
  i32.mul
  i32.add
  local.set $rec
  local.get $rec
  i32.const 2
  block $~lib/thread/ringWords|inlined.26 (result i32)
   local.get $capacity
   local.set $capacity|9
   i32.const 3
   local.get $capacity|9
   global.get $~lib/thread/CELL_WORDS
   i32.mul
   i32.add
   br $~lib/thread/ringWords|inlined.26
  end
  i32.mul
  i32.const 2
  i32.shl
  i32.add
  local.set $sig
  block $~lib/atomics/atomicLoad<i32>|inlined.40 (result i32)
   local.get $sig
   i32.const 4
   i32.add
   local.set $ptr|11
   local.get $ptr|11
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.40
  end
  return
 )
 (func $~lib/thread/__workerArenaSize (type $1) (param $id i32) (result i32)
  (local $here i32)
  (local $ptr i32)
  (local $total i32)
  (local $ptr|4 i32)
  (local $stride i32)
  (local $ptr|6 i32)
  (local $capacity i32)
  (local $rec i32)
  (local $capacity|9 i32)
  (local $sig i32)
  (local $ptr|11 i32)
  call $~lib/thread/controlBlockBase
  local.set $here
  local.get $here
  i32.const 0
  i32.eq
  if
   i32.const 0
   return
  end
  block $~lib/atomics/atomicLoad<i32>|inlined.41 (result i32)
   local.get $here
   global.get $~lib/thread/H_TOTAL
   i32.const 2
   i32.shl
   i32.add
   local.set $ptr
   local.get $ptr
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.41
  end
  local.set $total
  local.get $id
  i32.const 0
  i32.le_s
  if (result i32)
   i32.const 1
  else
   local.get $id
   local.get $total
   i32.ge_s
  end
  if
   i32.const 0
   return
  end
  block $~lib/atomics/atomicLoad<i32>|inlined.42 (result i32)
   local.get $here
   global.get $~lib/thread/H_STRIDE
   i32.const 2
   i32.shl
   i32.add
   local.set $ptr|4
   local.get $ptr|4
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.42
  end
  local.set $stride
  block $~lib/atomics/atomicLoad<i32>|inlined.43 (result i32)
   local.get $here
   global.get $~lib/thread/H_CAPACITY
   i32.const 2
   i32.shl
   i32.add
   local.set $ptr|6
   local.get $ptr|6
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.43
  end
  local.set $capacity
  local.get $here
  global.get $~lib/thread/HEADER_BYTES
  i32.add
  local.get $id
  local.get $stride
  i32.mul
  i32.add
  local.set $rec
  local.get $rec
  i32.const 2
  block $~lib/thread/ringWords|inlined.27 (result i32)
   local.get $capacity
   local.set $capacity|9
   i32.const 3
   local.get $capacity|9
   global.get $~lib/thread/CELL_WORDS
   i32.mul
   i32.add
   br $~lib/thread/ringWords|inlined.27
  end
  i32.mul
  i32.const 2
  i32.shl
  i32.add
  local.set $sig
  block $~lib/atomics/atomicLoad<i32>|inlined.44 (result i32)
   local.get $sig
   i32.const 8
   i32.add
   local.set $ptr|11
   local.get $ptr|11
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.44
  end
  return
 )
 (func $~lib/task/Task<i32>#get:recordValue (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=44
 )
 (func $~lib/task/TaskRecord#get:payload (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $~lib/task/Task<i32>#drive (type $3) (param $this i32)
 )
 (func $~lib/mask/MaskBase#get:width@override (type $1) (param $0 i32) (result i32)
  (local $1 i32)
  local.get $0
  i32.const 8
  i32.sub
  i32.load
  unreachable
 )
 (func $~lib/mask/MaskBase#allows@override (type $2) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  local.get $0
  i32.const 8
  i32.sub
  i32.load
  unreachable
 )
 (func $~lib/task/TaskBase#__parkRecord@override (type $1) (param $0 i32) (result i32)
  (local $1 i32)
  block $default
   block $case0
    local.get $0
    i32.const 8
    i32.sub
    i32.load
    local.set $1
    local.get $1
    i32.const 21
    i32.eq
    br_if $case0
    br $default
   end
   local.get $0
   call $~lib/task/Task<i32>#__parkRecord
   return
  end
  local.get $0
  call $~lib/task/TaskBase#__parkRecord
 )
 (func $~lib/task/TaskBase#__settleFromRecord@override (type $0) (param $0 i32) (param $1 i32)
  (local $2 i32)
  block $default
   block $case0
    local.get $0
    i32.const 8
    i32.sub
    i32.load
    local.set $2
    local.get $2
    i32.const 21
    i32.eq
    br_if $case0
    br $default
   end
   local.get $0
   local.get $1
   call $~lib/task/Task<i32>#__settleFromRecord
   return
  end
  local.get $0
  local.get $1
  call $~lib/task/TaskBase#__settleFromRecord
 )
 (func $~lib/task/TaskBase#drive@override (type $3) (param $0 i32)
  (local $1 i32)
  block $default
   block $case0
    local.get $0
    i32.const 8
    i32.sub
    i32.load
    local.set $1
    local.get $1
    i32.const 21
    i32.eq
    br_if $case0
    br $default
   end
   local.get $0
   call $~lib/task/Task<i32>#drive
   return
  end
  unreachable
 )
 (func $~lib/rt/__visit_globals (type $3) (param $0 i32)
  (local $1 i32)
  global.get $~lib/task-stack/tasks
  local.tee $1
  if
   local.get $1
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $~lib/task-stack/remoteParks
  local.tee $1
  if
   local.get $1
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $~lib/task/inlinePolicyInstance
  local.tee $1
  if
   local.get $1
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $~lib/thread/executors
  local.tee $1
  if
   local.get $1
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $~lib/thread/mainExecutorInstance
  local.tee $1
  if
   local.get $1
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $~lib/thread/requests
  local.tee $1
  if
   local.get $1
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $~lib/thread/freeRequests
  local.tee $1
  if
   local.get $1
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  i32.const 256
  local.get $0
  call $~lib/rt/itcms/__visit
  i32.const 512
  local.get $0
  call $~lib/rt/itcms/__visit
  i32.const 64
  local.get $0
  call $~lib/rt/itcms/__visit
 )
 (func $~lib/arraybuffer/ArrayBufferView~visit (type $0) (param $0 i32) (param $1 i32)
  (local $2 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  i32.load
  local.get $1
  call $~lib/rt/itcms/__visit
 )
 (func $~lib/object/Object~visit (type $0) (param $0 i32) (param $1 i32)
 )
 (func $~lib/function/Function<%28i32%2Ci32%29=>void>#get:_env (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/function/Function<%28i32%2Ci32%29=>void>~visit (type $0) (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  local.get $1
  call $~lib/function/Function<%28i32%2Ci32%29=>void>#__visit
 )
 (func $~lib/task/TaskBase~visit (type $0) (param $0 i32) (param $1 i32)
  (local $2 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  i32.load offset=16
  local.get $1
  call $~lib/rt/itcms/__visit
  local.get $0
  i32.load offset=20
  local.get $1
  call $~lib/rt/itcms/__visit
  local.get $0
  i32.load offset=28
  local.get $1
  call $~lib/rt/itcms/__visit
 )
 (func $~lib/array/Array<~lib/task/Waiter>#get:buffer (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/array/Array<~lib/task/Waiter>~visit (type $0) (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  local.get $1
  call $~lib/array/Array<~lib/task/Waiter>#__visit
 )
 (func $~lib/array/Array<~lib/task/TaskBase|null>#get:buffer (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/array/Array<~lib/task/TaskBase|null>~visit (type $0) (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  local.get $1
  call $~lib/array/Array<~lib/task/TaskBase|null>#__visit
 )
 (func $~lib/task-stack/RemotePark~visit (type $0) (param $0 i32) (param $1 i32)
  (local $2 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  i32.load offset=4
  local.get $1
  call $~lib/rt/itcms/__visit
  local.get $0
  i32.load offset=8
  local.get $1
  call $~lib/rt/itcms/__visit
 )
 (func $"~lib/map/Map<i32,~lib/task-stack/RemotePark>#get:buckets" (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $"~lib/map/Map<i32,~lib/task-stack/RemotePark>#get:entries" (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $"~lib/map/Map<i32,~lib/task-stack/RemotePark>#get:entriesOffset" (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=16
 )
 (func $"~lib/map/MapEntry<i32,~lib/task-stack/RemotePark>#get:taggedNext" (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $"~lib/map/MapEntry<i32,~lib/task-stack/RemotePark>#get:value" (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $"~lib/map/Map<i32,~lib/task-stack/RemotePark>~visit" (type $0) (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  local.get $1
  call $"~lib/map/Map<i32,~lib/task-stack/RemotePark>#__visit"
 )
 (func $~lib/thread/Executor~visit (type $0) (param $0 i32) (param $1 i32)
  (local $2 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  i32.load offset=4
  local.get $1
  call $~lib/rt/itcms/__visit
  local.get $0
  i32.load offset=8
  local.get $1
  call $~lib/rt/itcms/__visit
  local.get $0
  i32.load offset=12
  local.get $1
  call $~lib/rt/itcms/__visit
 )
 (func $~lib/thread/SlotRing~visit (type $0) (param $0 i32) (param $1 i32)
  (local $2 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  i32.load offset=12
  local.get $1
  call $~lib/rt/itcms/__visit
 )
 (func $~lib/typedarray/Int32Array~visit (type $0) (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  call $~lib/arraybuffer/ArrayBufferView~visit
 )
 (func $~lib/array/Array<~lib/thread/Executor|null>#get:buffer (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/array/Array<~lib/thread/Executor|null>~visit (type $0) (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  local.get $1
  call $~lib/array/Array<~lib/thread/Executor|null>#__visit
 )
 (func $~lib/array/Array<~lib/thread/Request|null>#get:buffer (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/array/Array<~lib/thread/Request|null>~visit (type $0) (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  local.get $1
  call $~lib/array/Array<~lib/thread/Request|null>#__visit
 )
 (func $~lib/array/Array<i32>#get:buffer (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/array/Array<i32>~visit (type $0) (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  local.get $1
  call $~lib/array/Array<i32>#__visit
 )
 (func $~lib/task/Task<i32>~visit (type $0) (param $0 i32) (param $1 i32)
  (local $2 i32)
  local.get $0
  local.get $1
  call $~lib/task/TaskBase~visit
  local.get $0
  i32.load offset=44
  local.get $1
  call $~lib/rt/itcms/__visit
 )
 (func $~lib/function/Function<%28~lib/thread/Executor%29=>bool>#get:_env (type $1) (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/function/Function<%28~lib/thread/Executor%29=>bool>~visit (type $0) (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  local.get $1
  call $~lib/function/Function<%28~lib/thread/Executor%29=>bool>#__visit
 )
 (func $~lib/rt/__visit_members (type $0) (param $0 i32) (param $1 i32)
  block $invalid
   block $~lib/function/Function<%28~lib/thread/Executor%29=>bool>
    block $~lib/thread/RemotePolicy
     block $~lib/task/Task<i32>
      block $~lib/array/Array<i32>
       block $~lib/array/Array<~lib/thread/Request|null>
        block $~lib/thread/Request
         block $~lib/array/Array<~lib/thread/Executor|null>
          block $~lib/typedarray/Int32Array
           block $~lib/thread/SlotRing
            block $~lib/thread/Executor
             block $"~lib/map/Map<i32,~lib/task-stack/RemotePark>"
              block $~lib/task/TaskRecord
               block $~lib/task-stack/RemotePark
                block $~lib/array/Array<~lib/task/TaskBase|null>
                 block $~lib/mask/MaskBase
                  block $~lib/array/Array<~lib/task/Waiter>
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
                           br_table $~lib/object/Object $~lib/arraybuffer/ArrayBuffer $~lib/string/String $~lib/arraybuffer/ArrayBufferView $~lib/function/Function<%28i32%2Ci32%29=>void> $~lib/task/TaskPolicy $~lib/task/TaskBase $~lib/task/Waiter $~lib/array/Array<~lib/task/Waiter> $~lib/mask/MaskBase $~lib/array/Array<~lib/task/TaskBase|null> $~lib/task-stack/RemotePark $~lib/task/TaskRecord $"~lib/map/Map<i32,~lib/task-stack/RemotePark>" $~lib/thread/Executor $~lib/thread/SlotRing $~lib/typedarray/Int32Array $~lib/array/Array<~lib/thread/Executor|null> $~lib/thread/Request $~lib/array/Array<~lib/thread/Request|null> $~lib/array/Array<i32> $~lib/task/Task<i32> $~lib/thread/RemotePolicy $~lib/function/Function<%28~lib/thread/Executor%29=>bool> $invalid
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
                      call $~lib/function/Function<%28i32%2Ci32%29=>void>~visit
                      return
                     end
                     return
                    end
                    local.get $0
                    local.get $1
                    call $~lib/task/TaskBase~visit
                    return
                   end
                   return
                  end
                  local.get $0
                  local.get $1
                  call $~lib/array/Array<~lib/task/Waiter>~visit
                  return
                 end
                 return
                end
                local.get $0
                local.get $1
                call $~lib/array/Array<~lib/task/TaskBase|null>~visit
                return
               end
               local.get $0
               local.get $1
               call $~lib/task-stack/RemotePark~visit
               return
              end
              return
             end
             local.get $0
             local.get $1
             call $"~lib/map/Map<i32,~lib/task-stack/RemotePark>~visit"
             return
            end
            local.get $0
            local.get $1
            call $~lib/thread/Executor~visit
            return
           end
           local.get $0
           local.get $1
           call $~lib/thread/SlotRing~visit
           return
          end
          local.get $0
          local.get $1
          call $~lib/typedarray/Int32Array~visit
          return
         end
         local.get $0
         local.get $1
         call $~lib/array/Array<~lib/thread/Executor|null>~visit
         return
        end
        return
       end
       local.get $0
       local.get $1
       call $~lib/array/Array<~lib/thread/Request|null>~visit
       return
      end
      local.get $0
      local.get $1
      call $~lib/array/Array<i32>~visit
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
   call $~lib/function/Function<%28~lib/thread/Executor%29=>bool>~visit
   return
  end
  unreachable
 )
 (func $$serveEntry (type $1) (param $0 i32) (result i32)
  (local $1 i32)
  local.get $0
  i32.const 0
  i32.eq
  if (result i32)
   call $~asyncMainStart
  else
   i32.const 0
  end
 )
 (func $~start (type $5)
  call $~lib/rt/common/initialHeapBase
  global.set $~lib/rt/common/HEAP_BASE
  memory.size
  i32.const 16
  i32.shl
  global.get $~lib/rt/common/HEAP_BASE
  i32.sub
  i32.const 1
  i32.shr_u
  global.set $~lib/rt/itcms/threshold
  call $~lib/rt/itcms/initialPinSpace
  global.set $~lib/rt/itcms/pinSpace
  call $~lib/rt/itcms/initialToSpace
  global.set $~lib/rt/itcms/toSpace
  call $~lib/rt/itcms/initialFromSpace
  global.set $~lib/rt/itcms/fromSpace
  call $~asyncMainStart
  global.set $~asyncStatus
 )
 (func $__start (type $4) (result i32)
  call $~start
  global.get $~asyncStatus
 )
 (func $~stack_check (type $5)
  global.get $~lib/memory/__stack_pointer
  global.get $~lib/memory/__data_end
  i32.lt_s
  if
   i32.const 33568
   i32.const 33616
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
 )
 (func $~lib/task/TaskRecord#constructor (type $1) (param $this i32) (result i32)
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
   i32.const 12
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
 (func $~lib/task/TaskBase#constructor (type $1) (param $this i32) (result i32)
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
   i32.const 44
   i32.const 6
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
  i32.const -1
  call $~lib/task/TaskBase#set:slot
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $~lib/task/TaskBase#set:home
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $~lib/task/TaskBase#set:settled
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $~lib/task/TaskBase#set:status
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $~lib/task/TaskBase#set:waiters
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $~lib/task/TaskBase#set:policy
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const -1
  call $~lib/task/TaskBase#set:entry
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $~lib/task/TaskBase#set:mask
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $~lib/task/TaskBase#set:serveArg
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $~lib/task/TaskBase#set:serveKey
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $~lib/task/TaskBase#set:serveOrigin
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
 (func $~lib/task/Task<i32>#constructor (type $1) (param $this i32) (result i32)
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
   i32.const 52
   i32.const 21
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
  call $~lib/task/TaskBase#constructor
  local.tee $this
  i32.store
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $~lib/task/Task<i32>#set:recordValue
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $~lib/task/Task<i32>#set:value
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
 (func $~lib/task/Task<i32>#set:_record (type $0) (param $this i32) (param $value i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  local.get $value
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  call $~lib/task/Task<i32>#set:recordValue
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $stackful-fiber-record/pendingJob (type $1) (param $key i32) (result i32)
  (local $record i32)
  (local $handle i32)
  (local $3 i32)
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
  call $~lib/task/TaskRecord#constructor
  local.tee $record
  i32.store
  local.get $record
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=4
  local.get $3
  i32.const 4
  call $~lib/task/TaskRecord#set:class_
  local.get $record
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=4
  local.get $3
  local.get $key
  call $~lib/task/TaskRecord#set:key
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  call $~lib/task/Task<i32>#constructor
  local.tee $handle
  i32.store offset=8
  local.get $handle
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=4
  local.get $3
  local.get $record
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=12
  local.get $3
  call $~lib/task/Task<i32>#set:_record
  local.get $handle
  local.set $3
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $3
  return
 )
 (func $~lib/task/TaskPolicy#constructor (type $1) (param $this i32) (result i32)
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
   i32.const 1
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
  call $~lib/task/TaskPolicy#set:crossesThreads
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
 (func $~lib/thread/RemotePolicy#constructor (type $7) (param $this i32) (param $target i32) (param $arg i32) (param $reply i32) (result i32)
  (local $4 i32)
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
   i32.const 16
   i32.const 22
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  i32.const 0
  call $~lib/thread/RemotePolicy#set:target
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  i32.const 0
  call $~lib/thread/RemotePolicy#set:arg
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  i32.const 0
  call $~lib/thread/RemotePolicy#set:reply
  global.get $~lib/memory/__stack_pointer
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  call $~lib/task/TaskPolicy#constructor
  local.tee $this
  i32.store
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  local.get $target
  call $~lib/thread/RemotePolicy#set:target
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  local.get $arg
  call $~lib/thread/RemotePolicy#set:arg
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  local.get $reply
  call $~lib/thread/RemotePolicy#set:reply
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $4
 )
 (func $~lib/array/Array<~lib/task/TaskBase|null>#get:length (type $1) (param $this i32) (result i32)
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
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store
  local.get $1
  call $~lib/array/Array<~lib/task/TaskBase|null>#get:length_
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
  return
 )
 (func $~lib/array/Array<~lib/task/TaskBase|null>#__get (type $2) (param $this i32) (param $index i32) (result i32)
  (local $value i32)
  (local $3 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  local.get $index
  local.get $this
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $~lib/array/Array<~lib/task/TaskBase|null>#get:length_
  i32.ge_u
  if
   i32.const 256
   i32.const 464
   i32.const 114
   i32.const 42
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  local.get $this
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $~lib/array/Array<~lib/task/TaskBase|null>#get:dataStart
  local.get $index
  i32.const 2
  i32.shl
  i32.add
  i32.load
  local.tee $value
  i32.store offset=4
  i32.const 1
  drop
  i32.const 1
  i32.eqz
  drop
  local.get $value
  local.set $3
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $3
  return
 )
 (func $~lib/task-stack/__currentTask (type $4) (result i32)
  (local $table i32)
  (local $slot i32)
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
  global.get $~lib/task-stack/tasks
  local.tee $table
  i32.store
  local.get $table
  i32.eqz
  if
   i32.const 0
   local.set $2
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $2
   return
  end
  global.get $~asyncCurrentSlot
  local.set $slot
  local.get $slot
  i32.const 0
  i32.lt_s
  if (result i32)
   i32.const 1
  else
   local.get $slot
   local.get $table
   local.set $2
   global.get $~lib/memory/__stack_pointer
   local.get $2
   i32.store offset=4
   local.get $2
   call $~lib/array/Array<~lib/task/TaskBase|null>#get:length
   i32.ge_s
  end
  if
   i32.const 0
   local.set $2
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $2
   return
  end
  local.get $table
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  local.get $slot
  call $~lib/array/Array<~lib/task/TaskBase|null>#__get
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
  return
 )
 (func $~lib/task/Waiter#constructor (type $1) (param $this i32) (result i32)
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
  call $~lib/task/Waiter#set:exec
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  i32.const 0
  call $~lib/task/Waiter#set:slot
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
 (func $~lib/array/Array<~lib/task/Waiter>#constructor (type $2) (param $this i32) (param $length i32) (result i32)
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
   i32.const 8
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
  call $~lib/array/Array<~lib/task/Waiter>#set:buffer
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  i32.const 0
  call $~lib/array/Array<~lib/task/Waiter>#set:dataStart
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  i32.const 0
  call $~lib/array/Array<~lib/task/Waiter>#set:byteLength
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  i32.const 0
  call $~lib/array/Array<~lib/task/Waiter>#set:length_
  local.get $length
  i32.const 1073741820
  i32.const 2
  i32.shr_u
  i32.gt_u
  if
   i32.const 512
   i32.const 464
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
  call $~lib/array/Array<~lib/task/Waiter>#set:buffer
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  local.get $buffer
  call $~lib/array/Array<~lib/task/Waiter>#set:dataStart
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  local.get $bufferSize
  call $~lib/array/Array<~lib/task/Waiter>#set:byteLength
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  local.get $length
  call $~lib/array/Array<~lib/task/Waiter>#set:length_
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $6
 )
 (func $~lib/array/ensureCapacity (type $8) (param $array i32) (param $newSize i32) (param $alignLog2 i32) (param $canGrow i32)
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
    i32.const 512
    i32.const 464
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
 (func $~lib/array/Array<~lib/task/Waiter>#push (type $2) (param $this i32) (param $value i32) (result i32)
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
  call $~lib/array/Array<~lib/task/Waiter>#get:length_
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
  call $~lib/array/Array<~lib/task/Waiter>#get:dataStart
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
  call $~lib/array/Array<~lib/task/Waiter>#set:length_
  local.get $len
  local.set $4
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $4
  return
 )
 (func $~lib/task-stack/__parkOn (type $3) (param $task i32)
  (local $current i32)
  (local $mask i32)
  (local $policy i32)
  (local $waiter i32)
  (local $list i32)
  (local $6 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 28
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.const 28
  memory.fill
  global.get $~lib/memory/__stack_pointer
  call $~lib/task-stack/__currentTask
  local.tee $current
  i32.store
  local.get $current
  if
   global.get $~lib/memory/__stack_pointer
   local.get $current
   local.set $6
   global.get $~lib/memory/__stack_pointer
   local.get $6
   i32.store offset=4
   local.get $6
   call $~lib/task/TaskBase#get:mask
   local.tee $mask
   i32.store offset=8
   local.get $mask
   if
    global.get $~lib/memory/__stack_pointer
    local.get $mask
    local.tee $policy
    i32.store offset=12
    global.get $~lib/task-stack/selfExecutor
    i32.const 0
    i32.ge_s
    if (result i32)
     global.get $~lib/task-stack/selfExecutor
     local.get $policy
     local.set $6
     global.get $~lib/memory/__stack_pointer
     local.get $6
     i32.store offset=4
     local.get $6
     call $~lib/mask/MaskBase#get:width@override
     i32.lt_s
    else
     i32.const 0
    end
    if
     local.get $policy
     local.set $6
     global.get $~lib/memory/__stack_pointer
     local.get $6
     i32.store offset=4
     local.get $6
     global.get $~lib/task-stack/selfExecutor
     call $~lib/mask/MaskBase#allows@override
     i32.eqz
     if
      global.get $~lib/task-stack/maskViolations
      i32.const 1
      i32.add
      global.set $~lib/task-stack/maskViolations
     end
    end
   end
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  call $~lib/task/Waiter#constructor
  local.tee $waiter
  i32.store offset=16
  local.get $waiter
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  global.get $~lib/task-stack/selfExecutor
  call $~lib/task/Waiter#set:exec
  local.get $waiter
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  global.get $~asyncCurrentSlot
  call $~lib/task/Waiter#set:slot
  global.get $~lib/memory/__stack_pointer
  local.get $task
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  call $~lib/task/TaskBase#get:waiters
  local.tee $list
  i32.store offset=20
  local.get $list
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.const 0
   call $~lib/array/Array<~lib/task/Waiter>#constructor
   local.tee $list
   i32.store offset=20
   local.get $task
   local.set $6
   global.get $~lib/memory/__stack_pointer
   local.get $6
   i32.store offset=4
   local.get $6
   local.get $list
   local.set $6
   global.get $~lib/memory/__stack_pointer
   local.get $6
   i32.store offset=24
   local.get $6
   call $~lib/task/TaskBase#set:waiters
  end
  local.get $list
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  local.get $waiter
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=24
  local.get $6
  call $~lib/array/Array<~lib/task/Waiter>#push
  drop
  global.get $~lib/memory/__stack_pointer
  i32.const 28
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/task-stack/__parkHost (type $3) (param $awaited i32)
  (local $id i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~asyncCurrentSlot
  local.set $id
  local.get $id
  i32.const 0
  i32.lt_s
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 4
   i32.add
   global.set $~lib/memory/__stack_pointer
   return
  end
  local.get $id
  i64.extend_i32_s
  local.get $awaited
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $~lib/task/TaskRecord#get:class_
  local.get $awaited
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $~lib/task/TaskRecord#get:key
  call $~lib/task-stack/hostPark
  local.get $awaited
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  local.get $id
  i64.extend_i32_s
  call $~lib/task-stack/hostCompletion
  call $~lib/task/TaskRecord#set:payload
  local.get $awaited
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  i32.const 0
  call $~lib/task/TaskRecord#set:status
  local.get $awaited
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  i32.const 1
  call $~lib/task/TaskRecord#set:done
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/task/TaskBase#__settleFromRecord (type $0) (param $this i32) (param $record i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  local.get $record
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  call $~lib/task/TaskRecord#get:status
  call $~lib/task/TaskBase#set:status
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  i32.const 1
  call $~lib/task/TaskBase#set:settled
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/task-stack/__parkAwait (type $3) (param $task i32)
  (local $record i32)
  (local $stamp i32)
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
  global.get $~lib/memory/__stack_pointer
  local.get $task
  if (result i32)
   local.get $task
   local.set $3
   global.get $~lib/memory/__stack_pointer
   local.get $3
   i32.store
   local.get $3
   call $~lib/task/TaskBase#__parkRecord@override
  else
   i32.const 0
  end
  local.tee $record
  i32.store offset=4
  local.get $task
  if (result i32)
   local.get $record
  else
   i32.const 0
  end
  if
   local.get $record
   local.set $3
   global.get $~lib/memory/__stack_pointer
   local.get $3
   i32.store
   local.get $3
   call $~lib/task/TaskRecord#get:class_
   local.set $stamp
   local.get $stamp
   i32.const 0
   i32.ne
   if
    local.get $record
    local.set $3
    global.get $~lib/memory/__stack_pointer
    local.get $3
    i32.store
    local.get $3
    call $~lib/task-stack/__parkHost
    local.get $task
    local.set $3
    global.get $~lib/memory/__stack_pointer
    local.get $3
    i32.store
    local.get $3
    local.get $record
    local.set $3
    global.get $~lib/memory/__stack_pointer
    local.get $3
    i32.store offset=8
    local.get $3
    call $~lib/task/TaskBase#__settleFromRecord@override
    global.get $~lib/memory/__stack_pointer
    i32.const 12
    i32.add
    global.set $~lib/memory/__stack_pointer
    return
   end
  end
  call $~lib/task-stack/__parkYield
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/thread/RemotePolicy#await (type $0) (param $this i32) (param $task i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $task
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $~lib/task-stack/__parkOn
  local.get $task
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $~lib/task-stack/__parkAwait
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $stackful-fiber-record/main (type $4) (result i32)
  (local $warm_up i32)
  (local $job i32)
  (local $policy i32)
  (local $3 i32)
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
  call $stackful-fiber-record/leaf
  local.set $warm_up
  global.get $~lib/memory/__stack_pointer
  i32.const 7
  call $stackful-fiber-record/pendingJob
  local.tee $job
  i32.store
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.const 1
  i32.const 0
  i32.const -1
  call $~lib/thread/RemotePolicy#constructor
  local.tee $policy
  i32.store offset=4
  local.get $policy
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=8
  local.get $3
  local.get $job
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=12
  local.get $3
  call $~lib/thread/RemotePolicy#await
  local.get $warm_up
  local.set $3
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $3
  return
 )
 (func $~lib/array/Array<~lib/thread/Executor|null>#constructor (type $2) (param $this i32) (param $length i32) (result i32)
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
   i32.const 17
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
  call $~lib/array/Array<~lib/thread/Executor|null>#set:buffer
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  i32.const 0
  call $~lib/array/Array<~lib/thread/Executor|null>#set:dataStart
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  i32.const 0
  call $~lib/array/Array<~lib/thread/Executor|null>#set:byteLength
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  i32.const 0
  call $~lib/array/Array<~lib/thread/Executor|null>#set:length_
  local.get $length
  i32.const 1073741820
  i32.const 2
  i32.shr_u
  i32.gt_u
  if
   i32.const 512
   i32.const 464
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
  call $~lib/array/Array<~lib/thread/Executor|null>#set:buffer
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  local.get $buffer
  call $~lib/array/Array<~lib/thread/Executor|null>#set:dataStart
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  local.get $bufferSize
  call $~lib/array/Array<~lib/thread/Executor|null>#set:byteLength
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  local.get $length
  call $~lib/array/Array<~lib/thread/Executor|null>#set:length_
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $6
 )
 (func $~lib/array/Array<~lib/thread/Executor|null>#get:length (type $1) (param $this i32) (result i32)
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
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store
  local.get $1
  call $~lib/array/Array<~lib/thread/Executor|null>#get:length_
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
  return
 )
 (func $~lib/array/Array<~lib/thread/Executor|null>#push (type $2) (param $this i32) (param $value i32) (result i32)
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
  call $~lib/array/Array<~lib/thread/Executor|null>#get:length_
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
  call $~lib/array/Array<~lib/thread/Executor|null>#get:dataStart
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
  call $~lib/array/Array<~lib/thread/Executor|null>#set:length_
  local.get $len
  local.set $4
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $4
  return
 )
 (func $~lib/thread/SlotRing#pop (type $1) (param $this i32) (result i32)
  (local $capacity i32)
  (local $base i32)
  (local $ptr i32)
  (local $pos i32)
  (local $ptr|5 i32)
  (local $tail i32)
  (local $off i32)
  (local $word i32)
  (local $ptr|9 i32)
  (local $ptr|10 i32)
  (local $expect i32)
  (local $replace i32)
  (local $word|13 i32)
  (local $ptr|14 i32)
  (local $value i32)
  (local $word|16 i32)
  (local $ptr|17 i32)
  (local $value|18 i32)
  (local $19 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $this
  local.set $19
  global.get $~lib/memory/__stack_pointer
  local.get $19
  i32.store
  local.get $19
  call $~lib/thread/SlotRing#get:capacity
  local.set $capacity
  local.get $capacity
  i32.const 0
  i32.le_s
  if
   i32.const -1
   local.set $19
   global.get $~lib/memory/__stack_pointer
   i32.const 4
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $19
   return
  end
  local.get $this
  local.set $19
  global.get $~lib/memory/__stack_pointer
  local.get $19
  i32.store
  local.get $19
  call $~lib/thread/SlotRing#get:base
  local.set $base
  loop $while-continue|0
   i32.const 1
   if
    block $~lib/atomics/atomicLoad<i32>|inlined.10 (result i32)
     local.get $base
     global.get $~lib/thread/HEAD_OFF
     i32.add
     local.set $ptr
     local.get $ptr
     i32.atomic.load
     br $~lib/atomics/atomicLoad<i32>|inlined.10
    end
    local.set $pos
    block $~lib/atomics/atomicLoad<i32>|inlined.11 (result i32)
     local.get $base
     global.get $~lib/thread/TAIL_OFF
     i32.add
     local.set $ptr|5
     local.get $ptr|5
     i32.atomic.load
     br $~lib/atomics/atomicLoad<i32>|inlined.11
    end
    local.set $tail
    local.get $pos
    local.get $tail
    i32.ge_s
    if
     i32.const -1
     local.set $19
     global.get $~lib/memory/__stack_pointer
     i32.const 4
     i32.add
     global.set $~lib/memory/__stack_pointer
     local.get $19
     return
    end
    local.get $base
    global.get $~lib/thread/SLOTS_OFF
    i32.add
    local.get $pos
    local.get $capacity
    i32.rem_s
    i32.const 3
    i32.shl
    i32.add
    local.set $off
    block $~lib/atomics/atomicLoad<i32>|inlined.12 (result i32)
     local.get $off
     block $~lib/thread/wordOffset|inlined.2 (result i32)
      global.get $~lib/thread/SEQ_WORD
      local.set $word
      local.get $word
      i32.const 2
      i32.shl
      br $~lib/thread/wordOffset|inlined.2
     end
     i32.add
     local.set $ptr|9
     local.get $ptr|9
     i32.atomic.load
     br $~lib/atomics/atomicLoad<i32>|inlined.12
    end
    local.get $pos
    i32.const 1
    i32.add
    i32.ne
    if
     i32.const -1
     local.set $19
     global.get $~lib/memory/__stack_pointer
     i32.const 4
     i32.add
     global.set $~lib/memory/__stack_pointer
     local.get $19
     return
    end
    block $~lib/atomics/atomicCompareExchange<i32>|inlined.0 (result i32)
     local.get $base
     global.get $~lib/thread/HEAD_OFF
     i32.add
     local.set $ptr|10
     local.get $pos
     local.set $expect
     local.get $pos
     i32.const 1
     i32.add
     local.set $replace
     local.get $ptr|10
     local.get $expect
     local.get $replace
     i32.atomic.rmw.cmpxchg
     br $~lib/atomics/atomicCompareExchange<i32>|inlined.0
    end
    local.get $pos
    i32.ne
    if
     br $while-continue|0
    end
    block $~lib/atomics/atomicLoad<i32>|inlined.13 (result i32)
     local.get $off
     block $~lib/thread/wordOffset|inlined.3 (result i32)
      global.get $~lib/thread/VALUE_WORD
      local.set $word|13
      local.get $word|13
      i32.const 2
      i32.shl
      br $~lib/thread/wordOffset|inlined.3
     end
     i32.add
     local.set $ptr|14
     local.get $ptr|14
     i32.atomic.load
     br $~lib/atomics/atomicLoad<i32>|inlined.13
    end
    local.set $value
    local.get $off
    block $~lib/thread/wordOffset|inlined.4 (result i32)
     global.get $~lib/thread/SEQ_WORD
     local.set $word|16
     local.get $word|16
     i32.const 2
     i32.shl
     br $~lib/thread/wordOffset|inlined.4
    end
    i32.add
    local.set $ptr|17
    local.get $pos
    local.get $capacity
    i32.add
    local.set $value|18
    local.get $ptr|17
    local.get $value|18
    i32.atomic.store
    local.get $value
    local.set $19
    global.get $~lib/memory/__stack_pointer
    i32.const 4
    i32.add
    global.set $~lib/memory/__stack_pointer
    local.get $19
    return
   end
  end
  unreachable
 )
 (func $~lib/task-stack/__taskAt (type $1) (param $slot i32) (result i32)
  (local $table i32)
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
  global.get $~lib/task-stack/tasks
  local.tee $table
  i32.store
  local.get $table
  i32.eqz
  if (result i32)
   i32.const 1
  else
   local.get $slot
   i32.const 0
   i32.lt_s
  end
  if (result i32)
   i32.const 1
  else
   local.get $slot
   local.get $table
   local.set $2
   global.get $~lib/memory/__stack_pointer
   local.get $2
   i32.store offset=4
   local.get $2
   call $~lib/array/Array<~lib/task/TaskBase|null>#get:length
   i32.ge_s
  end
  if
   i32.const 0
   local.set $2
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $2
   return
  end
  local.get $table
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  local.get $slot
  call $~lib/array/Array<~lib/task/TaskBase|null>#__get
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
  return
 )
 (func $~lib/task-stack/__driveSlot (type $3) (param $slot i32)
  (local $taskOrNull i32)
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
  local.get $slot
  call $~lib/task-stack/__taskAt
  local.tee $taskOrNull
  i32.store
  local.get $taskOrNull
  if
   local.get $taskOrNull
   local.set $2
   global.get $~lib/memory/__stack_pointer
   local.get $2
   i32.store offset=4
   local.get $2
   call $~lib/task/TaskBase#drive@override
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/thread/SlotRing#push (type $2) (param $this i32) (param $slot i32) (result i32)
  (local $capacity i32)
  (local $base i32)
  (local $ptr i32)
  (local $headNow i32)
  (local $ptr|6 i32)
  (local $tailNow i32)
  (local $i i32)
  (local $off i32)
  (local $word i32)
  (local $ptr|11 i32)
  (local $word|12 i32)
  (local $ptr|13 i32)
  (local $ptr|14 i32)
  (local $pos i32)
  (local $ptr|16 i32)
  (local $head i32)
  (local $off|18 i32)
  (local $word|19 i32)
  (local $ptr|20 i32)
  (local $seq i32)
  (local $ptr|22 i32)
  (local $expect i32)
  (local $replace i32)
  (local $word|25 i32)
  (local $ptr|26 i32)
  (local $value i32)
  (local $word|28 i32)
  (local $ptr|29 i32)
  (local $value|30 i32)
  (local $signal i32)
  (local $ptr|32 i32)
  (local $value|33 i32)
  (local $ptr|34 i32)
  (local $count i32)
  (local $36 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $this
  local.set $36
  global.get $~lib/memory/__stack_pointer
  local.get $36
  i32.store
  local.get $36
  call $~lib/thread/SlotRing#get:capacity
  local.set $capacity
  local.get $capacity
  i32.const 0
  i32.le_s
  if
   i32.const 0
   local.set $36
   global.get $~lib/memory/__stack_pointer
   i32.const 4
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $36
   return
  end
  local.get $this
  local.set $36
  global.get $~lib/memory/__stack_pointer
  local.get $36
  i32.store
  local.get $36
  call $~lib/thread/SlotRing#get:base
  local.set $base
  block $~lib/atomics/atomicLoad<i32>|inlined.20 (result i32)
   local.get $base
   global.get $~lib/thread/HEAD_OFF
   i32.add
   local.set $ptr
   local.get $ptr
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.20
  end
  local.set $headNow
  block $~lib/atomics/atomicLoad<i32>|inlined.21 (result i32)
   local.get $base
   global.get $~lib/thread/TAIL_OFF
   i32.add
   local.set $ptr|6
   local.get $ptr|6
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.21
  end
  local.set $tailNow
  local.get $headNow
  local.set $i
  loop $for-loop|0
   local.get $i
   local.get $tailNow
   i32.lt_s
   if
    local.get $base
    global.get $~lib/thread/SLOTS_OFF
    i32.add
    local.get $i
    local.get $capacity
    i32.rem_s
    i32.const 3
    i32.shl
    i32.add
    local.set $off
    block $~lib/atomics/atomicLoad<i32>|inlined.22 (result i32)
     local.get $off
     block $~lib/thread/wordOffset|inlined.5 (result i32)
      global.get $~lib/thread/SEQ_WORD
      local.set $word
      local.get $word
      i32.const 2
      i32.shl
      br $~lib/thread/wordOffset|inlined.5
     end
     i32.add
     local.set $ptr|11
     local.get $ptr|11
     i32.atomic.load
     br $~lib/atomics/atomicLoad<i32>|inlined.22
    end
    local.get $i
    i32.const 1
    i32.add
    i32.eq
    if (result i32)
     block $~lib/atomics/atomicLoad<i32>|inlined.23 (result i32)
      local.get $off
      block $~lib/thread/wordOffset|inlined.6 (result i32)
       global.get $~lib/thread/VALUE_WORD
       local.set $word|12
       local.get $word|12
       i32.const 2
       i32.shl
       br $~lib/thread/wordOffset|inlined.6
      end
      i32.add
      local.set $ptr|13
      local.get $ptr|13
      i32.atomic.load
      br $~lib/atomics/atomicLoad<i32>|inlined.23
     end
     local.get $slot
     i32.eq
    else
     i32.const 0
    end
    if
     i32.const 0
     local.set $36
     global.get $~lib/memory/__stack_pointer
     i32.const 4
     i32.add
     global.set $~lib/memory/__stack_pointer
     local.get $36
     return
    end
    local.get $i
    i32.const 1
    i32.add
    local.set $i
    br $for-loop|0
   end
  end
  loop $while-continue|1
   i32.const 1
   if
    block $~lib/atomics/atomicLoad<i32>|inlined.24 (result i32)
     local.get $base
     global.get $~lib/thread/TAIL_OFF
     i32.add
     local.set $ptr|14
     local.get $ptr|14
     i32.atomic.load
     br $~lib/atomics/atomicLoad<i32>|inlined.24
    end
    local.set $pos
    block $~lib/atomics/atomicLoad<i32>|inlined.25 (result i32)
     local.get $base
     global.get $~lib/thread/HEAD_OFF
     i32.add
     local.set $ptr|16
     local.get $ptr|16
     i32.atomic.load
     br $~lib/atomics/atomicLoad<i32>|inlined.25
    end
    local.set $head
    local.get $pos
    local.get $head
    i32.sub
    local.get $capacity
    i32.ge_s
    if
     i32.const 0
     local.set $36
     global.get $~lib/memory/__stack_pointer
     i32.const 4
     i32.add
     global.set $~lib/memory/__stack_pointer
     local.get $36
     return
    end
    local.get $base
    global.get $~lib/thread/SLOTS_OFF
    i32.add
    local.get $pos
    local.get $capacity
    i32.rem_s
    i32.const 3
    i32.shl
    i32.add
    local.set $off|18
    block $~lib/atomics/atomicLoad<i32>|inlined.26 (result i32)
     local.get $off|18
     block $~lib/thread/wordOffset|inlined.7 (result i32)
      global.get $~lib/thread/SEQ_WORD
      local.set $word|19
      local.get $word|19
      i32.const 2
      i32.shl
      br $~lib/thread/wordOffset|inlined.7
     end
     i32.add
     local.set $ptr|20
     local.get $ptr|20
     i32.atomic.load
     br $~lib/atomics/atomicLoad<i32>|inlined.26
    end
    local.set $seq
    local.get $seq
    local.get $pos
    i32.eq
    if
     block $~lib/atomics/atomicCompareExchange<i32>|inlined.2 (result i32)
      local.get $base
      global.get $~lib/thread/TAIL_OFF
      i32.add
      local.set $ptr|22
      local.get $pos
      local.set $expect
      local.get $pos
      i32.const 1
      i32.add
      local.set $replace
      local.get $ptr|22
      local.get $expect
      local.get $replace
      i32.atomic.rmw.cmpxchg
      br $~lib/atomics/atomicCompareExchange<i32>|inlined.2
     end
     local.get $pos
     i32.eq
     if
      local.get $off|18
      block $~lib/thread/wordOffset|inlined.8 (result i32)
       global.get $~lib/thread/VALUE_WORD
       local.set $word|25
       local.get $word|25
       i32.const 2
       i32.shl
       br $~lib/thread/wordOffset|inlined.8
      end
      i32.add
      local.set $ptr|26
      local.get $slot
      local.set $value
      local.get $ptr|26
      local.get $value
      i32.atomic.store
      local.get $off|18
      block $~lib/thread/wordOffset|inlined.9 (result i32)
       global.get $~lib/thread/SEQ_WORD
       local.set $word|28
       local.get $word|28
       i32.const 2
       i32.shl
       br $~lib/thread/wordOffset|inlined.9
      end
      i32.add
      local.set $ptr|29
      local.get $pos
      i32.const 1
      i32.add
      local.set $value|30
      local.get $ptr|29
      local.get $value|30
      i32.atomic.store
      local.get $this
      local.set $36
      global.get $~lib/memory/__stack_pointer
      local.get $36
      i32.store
      local.get $36
      call $~lib/thread/SlotRing#get:signal
      local.set $signal
      local.get $signal
      i32.const 0
      i32.ne
      if
       block $~lib/atomics/atomicAdd<i32>|inlined.0 (result i32)
        local.get $signal
        local.set $ptr|32
        i32.const 1
        local.set $value|33
        local.get $ptr|32
        local.get $value|33
        i32.atomic.rmw.add
        br $~lib/atomics/atomicAdd<i32>|inlined.0
       end
       drop
       block $~lib/atomics/atomicNotify|inlined.0 (result i32)
        local.get $signal
        local.set $ptr|34
        i32.const 1
        local.set $count
        local.get $ptr|34
        local.get $count
        memory.atomic.notify
        br $~lib/atomics/atomicNotify|inlined.0
       end
       drop
      end
      i32.const 1
      local.set $36
      global.get $~lib/memory/__stack_pointer
      i32.const 4
      i32.add
      global.set $~lib/memory/__stack_pointer
      local.get $36
      return
     end
    else
     local.get $seq
     local.get $pos
     i32.lt_s
     if
      i32.const 0
      local.set $36
      global.get $~lib/memory/__stack_pointer
      i32.const 4
      i32.add
      global.set $~lib/memory/__stack_pointer
      local.get $36
      return
     end
    end
    br $while-continue|1
   end
  end
  unreachable
 )
 (func $~lib/thread/__serveOne (type $14) (param $e i32) (param $funcIndex i32) (param $argSlot i32) (param $taskKey i32) (param $origin i32) (result i32)
  (local $slot i32)
  (local $awaited i32)
  (local $taskOrNull i32)
  (local $task i32)
  (local $9 i32)
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
  local.get $argSlot
  global.set $~lib/thread/servingArg
  local.get $taskKey
  global.set $~lib/thread/servingKey
  local.get $origin
  global.set $~lib/thread/servingOrigin
  local.get $funcIndex
  call $~lib/task-stack/__serveSlot
  local.set $slot
  local.get $slot
  call $~lib/task-stack/__driveSlot
  i32.const -1
  local.set $awaited
  local.get $awaited
  i32.const 0
  i32.ge_s
  if
   global.get $~lib/memory/__stack_pointer
   local.get $awaited
   call $~lib/task-stack/__taskAt
   local.tee $taskOrNull
   i32.store
   local.get $taskOrNull
   if
    global.get $~lib/memory/__stack_pointer
    local.get $taskOrNull
    local.tee $task
    i32.store offset=4
    local.get $task
    local.set $9
    global.get $~lib/memory/__stack_pointer
    local.get $9
    i32.store offset=8
    local.get $9
    local.get $argSlot
    call $~lib/task/TaskBase#set:serveArg
    local.get $task
    local.set $9
    global.get $~lib/memory/__stack_pointer
    local.get $9
    i32.store offset=8
    local.get $9
    local.get $taskKey
    call $~lib/task/TaskBase#set:serveKey
    local.get $task
    local.set $9
    global.get $~lib/memory/__stack_pointer
    local.get $9
    i32.store offset=8
    local.get $9
    local.get $origin
    call $~lib/task/TaskBase#set:serveOrigin
   end
   local.get $e
   local.set $9
   global.get $~lib/memory/__stack_pointer
   local.get $9
   i32.store offset=12
   local.get $9
   call $~lib/thread/Executor#get:ready
   local.set $9
   global.get $~lib/memory/__stack_pointer
   local.get $9
   i32.store offset=8
   local.get $9
   local.get $awaited
   call $~lib/thread/SlotRing#push
   drop
  end
  global.get $~asyncLastStatus
  local.set $9
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $9
  return
 )
 (func $~lib/array/Array<~lib/thread/Request|null>#get:length (type $1) (param $this i32) (result i32)
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
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store
  local.get $1
  call $~lib/array/Array<~lib/thread/Request|null>#get:length_
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
  return
 )
 (func $~lib/array/Array<~lib/thread/Request|null>#__get (type $2) (param $this i32) (param $index i32) (result i32)
  (local $value i32)
  (local $3 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  local.get $index
  local.get $this
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $~lib/array/Array<~lib/thread/Request|null>#get:length_
  i32.ge_u
  if
   i32.const 256
   i32.const 464
   i32.const 114
   i32.const 42
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  local.get $this
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $~lib/array/Array<~lib/thread/Request|null>#get:dataStart
  local.get $index
  i32.const 2
  i32.shl
  i32.add
  i32.load
  local.tee $value
  i32.store offset=4
  i32.const 1
  drop
  i32.const 1
  i32.eqz
  drop
  local.get $value
  local.set $3
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $3
  return
 )
 (func $~lib/thread/requestAt (type $1) (param $index i32) (result i32)
  (local $table i32)
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
  global.get $~lib/thread/requests
  local.tee $table
  i32.store
  local.get $table
  i32.eqz
  if (result i32)
   i32.const 1
  else
   local.get $index
   i32.const 0
   i32.lt_s
  end
  if (result i32)
   i32.const 1
  else
   local.get $index
   local.get $table
   local.set $2
   global.get $~lib/memory/__stack_pointer
   local.get $2
   i32.store offset=4
   local.get $2
   call $~lib/array/Array<~lib/thread/Request|null>#get:length
   i32.ge_s
  end
  if
   i32.const 0
   local.set $2
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $2
   return
  end
  local.get $table
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  local.get $index
  call $~lib/array/Array<~lib/thread/Request|null>#__get
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
  return
 )
 (func $~lib/array/Array<i32>#constructor (type $2) (param $this i32) (param $length i32) (result i32)
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
   i32.const 20
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
  call $~lib/array/Array<i32>#set:buffer
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  i32.const 0
  call $~lib/array/Array<i32>#set:dataStart
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  i32.const 0
  call $~lib/array/Array<i32>#set:byteLength
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  i32.const 0
  call $~lib/array/Array<i32>#set:length_
  local.get $length
  i32.const 1073741820
  i32.const 2
  i32.shr_u
  i32.gt_u
  if
   i32.const 512
   i32.const 464
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
  call $~lib/array/Array<i32>#set:buffer
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  local.get $buffer
  call $~lib/array/Array<i32>#set:dataStart
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  local.get $bufferSize
  call $~lib/array/Array<i32>#set:byteLength
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store offset=4
  local.get $6
  local.get $length
  call $~lib/array/Array<i32>#set:length_
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $6
 )
 (func $~lib/array/Array<i32>#push (type $2) (param $this i32) (param $value i32) (result i32)
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
  call $~lib/array/Array<i32>#get:length_
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
  i32.const 0
  drop
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store
  local.get $4
  call $~lib/array/Array<i32>#get:dataStart
  local.get $oldLen
  i32.const 2
  i32.shl
  i32.add
  local.get $value
  i32.store
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store
  local.get $4
  local.get $len
  call $~lib/array/Array<i32>#set:length_
  local.get $len
  local.set $4
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $4
  return
 )
 (func $~lib/thread/__drainInbox (type $1) (param $e i32) (result i32)
  (local $last i32)
  (local $index i32)
  (local $index|3 i32)
  (local $word i32)
  (local $ptr i32)
  (local $funcIndex i32)
  (local $index|7 i32)
  (local $word|8 i32)
  (local $ptr|9 i32)
  (local $argSlot i32)
  (local $index|11 i32)
  (local $word|12 i32)
  (local $ptr|13 i32)
  (local $taskKey i32)
  (local $index|15 i32)
  (local $word|16 i32)
  (local $ptr|17 i32)
  (local $origin i32)
  (local $requestOrNull i32)
  (local $request i32)
  (local $funcIndex|21 i32)
  (local $argSlot|22 i32)
  (local $taskKey|23 i32)
  (local $free i32)
  (local $25 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 20
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.const 20
  memory.fill
  i32.const -1
  local.set $last
  block $while-break|0
   loop $while-continue|0
    i32.const 1
    if
     local.get $e
     local.set $25
     global.get $~lib/memory/__stack_pointer
     local.get $25
     i32.store offset=4
     local.get $25
     call $~lib/thread/Executor#get:inbox
     local.set $25
     global.get $~lib/memory/__stack_pointer
     local.get $25
     i32.store
     local.get $25
     call $~lib/thread/SlotRing#pop
     local.set $index
     local.get $index
     i32.const 0
     i32.lt_s
     if
      br $while-break|0
     end
     global.get $~lib/thread/__controlBase
     i32.const 0
     i32.ne
     if
      block $~lib/atomics/atomicLoad<i32>|inlined.14 (result i32)
       block $~lib/thread/requestWord|inlined.0 (result i32)
        local.get $index
        local.set $index|3
        global.get $~lib/thread/REQ_FUNC
        local.set $word
        global.get $~lib/thread/requestBase
        local.get $index|3
        global.get $~lib/thread/REQUEST_WORDS
        i32.mul
        local.get $word
        i32.add
        i32.const 2
        i32.shl
        i32.add
        br $~lib/thread/requestWord|inlined.0
       end
       local.set $ptr
       local.get $ptr
       i32.atomic.load
       br $~lib/atomics/atomicLoad<i32>|inlined.14
      end
      local.set $funcIndex
      block $~lib/atomics/atomicLoad<i32>|inlined.15 (result i32)
       block $~lib/thread/requestWord|inlined.1 (result i32)
        local.get $index
        local.set $index|7
        global.get $~lib/thread/REQ_ARG
        local.set $word|8
        global.get $~lib/thread/requestBase
        local.get $index|7
        global.get $~lib/thread/REQUEST_WORDS
        i32.mul
        local.get $word|8
        i32.add
        i32.const 2
        i32.shl
        i32.add
        br $~lib/thread/requestWord|inlined.1
       end
       local.set $ptr|9
       local.get $ptr|9
       i32.atomic.load
       br $~lib/atomics/atomicLoad<i32>|inlined.15
      end
      local.set $argSlot
      block $~lib/atomics/atomicLoad<i32>|inlined.16 (result i32)
       block $~lib/thread/requestWord|inlined.2 (result i32)
        local.get $index
        local.set $index|11
        global.get $~lib/thread/REQ_KEY
        local.set $word|12
        global.get $~lib/thread/requestBase
        local.get $index|11
        global.get $~lib/thread/REQUEST_WORDS
        i32.mul
        local.get $word|12
        i32.add
        i32.const 2
        i32.shl
        i32.add
        br $~lib/thread/requestWord|inlined.2
       end
       local.set $ptr|13
       local.get $ptr|13
       i32.atomic.load
       br $~lib/atomics/atomicLoad<i32>|inlined.16
      end
      local.set $taskKey
      block $~lib/atomics/atomicLoad<i32>|inlined.17 (result i32)
       block $~lib/thread/requestWord|inlined.3 (result i32)
        local.get $index
        local.set $index|15
        global.get $~lib/thread/REQ_ORIGIN
        local.set $word|16
        global.get $~lib/thread/requestBase
        local.get $index|15
        global.get $~lib/thread/REQUEST_WORDS
        i32.mul
        local.get $word|16
        i32.add
        i32.const 2
        i32.shl
        i32.add
        br $~lib/thread/requestWord|inlined.3
       end
       local.set $ptr|17
       local.get $ptr|17
       i32.atomic.load
       br $~lib/atomics/atomicLoad<i32>|inlined.17
      end
      local.set $origin
      local.get $index
      call $~lib/thread/blockFreeRequest
      local.get $e
      local.set $25
      global.get $~lib/memory/__stack_pointer
      local.get $25
      i32.store
      local.get $25
      local.get $funcIndex
      local.get $argSlot
      local.get $taskKey
      local.get $origin
      call $~lib/thread/__serveOne
      local.set $last
      br $while-continue|0
     end
     global.get $~lib/memory/__stack_pointer
     local.get $index
     call $~lib/thread/requestAt
     local.tee $requestOrNull
     i32.store offset=8
     local.get $requestOrNull
     i32.eqz
     if
      br $while-continue|0
     end
     global.get $~lib/memory/__stack_pointer
     local.get $requestOrNull
     local.tee $request
     i32.store offset=12
     local.get $request
     local.set $25
     global.get $~lib/memory/__stack_pointer
     local.get $25
     i32.store
     local.get $25
     call $~lib/thread/Request#get:funcIndex
     local.set $funcIndex|21
     local.get $request
     local.set $25
     global.get $~lib/memory/__stack_pointer
     local.get $25
     i32.store
     local.get $25
     call $~lib/thread/Request#get:argSlot
     local.set $argSlot|22
     local.get $request
     local.set $25
     global.get $~lib/memory/__stack_pointer
     local.get $25
     i32.store
     local.get $25
     call $~lib/thread/Request#get:taskKey
     local.set $taskKey|23
     global.get $~lib/memory/__stack_pointer
     global.get $~lib/thread/freeRequests
     local.tee $free
     i32.store offset=16
     local.get $free
     i32.eqz
     if
      global.get $~lib/memory/__stack_pointer
      i32.const 0
      i32.const 0
      call $~lib/array/Array<i32>#constructor
      local.tee $free
      i32.store offset=16
      local.get $free
      global.set $~lib/thread/freeRequests
     end
     local.get $free
     local.set $25
     global.get $~lib/memory/__stack_pointer
     local.get $25
     i32.store
     local.get $25
     local.get $index
     call $~lib/array/Array<i32>#push
     drop
     local.get $e
     local.set $25
     global.get $~lib/memory/__stack_pointer
     local.get $25
     i32.store
     local.get $25
     local.get $funcIndex|21
     local.get $argSlot|22
     local.get $taskKey|23
     i32.const 0
     call $~lib/thread/__serveOne
     local.set $last
     br $while-continue|0
    end
   end
  end
  local.get $last
  local.set $25
  global.get $~lib/memory/__stack_pointer
  i32.const 20
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $25
  return
 )
 (func $~lib/thread/driveReady (type $3) (param $e i32)
  (local $slot i32)
  (local $taskOrNull i32)
  (local $awaited i32)
  (local $4 i32)
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
  local.get $e
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  call $~lib/thread/Executor#get:ready
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store
  local.get $4
  call $~lib/thread/SlotRing#pop
  local.set $slot
  local.get $slot
  i32.const 0
  i32.lt_s
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 12
   i32.add
   global.set $~lib/memory/__stack_pointer
   return
  end
  global.get $~lib/memory/__stack_pointer
  local.get $slot
  call $~lib/task-stack/__taskAt
  local.tee $taskOrNull
  i32.store offset=8
  local.get $taskOrNull
  if
   local.get $taskOrNull
   local.set $4
   global.get $~lib/memory/__stack_pointer
   local.get $4
   i32.store
   local.get $4
   call $~lib/task/TaskBase#get:settled
   if
    global.get $~lib/memory/__stack_pointer
    i32.const 12
    i32.add
    global.set $~lib/memory/__stack_pointer
    return
   end
  end
  local.get $slot
  call $~lib/task-stack/__driveSlot
  i32.const -1
  local.set $awaited
  local.get $awaited
  i32.const 0
  i32.ge_s
  if
   local.get $e
   local.set $4
   global.get $~lib/memory/__stack_pointer
   local.get $4
   i32.store offset=4
   local.get $4
   call $~lib/thread/Executor#get:ready
   local.set $4
   global.get $~lib/memory/__stack_pointer
   local.get $4
   i32.store
   local.get $4
   local.get $awaited
   call $~lib/thread/SlotRing#push
   drop
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/thread/__mainStep__ (type $1) (param $e i32) (result i32)
  (local $1 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $e
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store
  local.get $1
  call $~lib/thread/__drainInbox
  drop
  local.get $e
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store
  local.get $1
  call $~lib/thread/driveReady
  i32.const 0
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
  return
 )
 (func $~lib/arraybuffer/ArrayBufferView#constructor (type $10) (param $this i32) (param $length i32) (param $alignLog2 i32) (result i32)
  (local $buffer i32)
  (local $4 i32)
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
   i32.const 12
   i32.const 3
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  i32.const 0
  call $~lib/arraybuffer/ArrayBufferView#set:buffer
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  i32.const 0
  call $~lib/arraybuffer/ArrayBufferView#set:dataStart
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  i32.const 0
  call $~lib/arraybuffer/ArrayBufferView#set:byteLength
  local.get $length
  i32.const 1073741820
  local.get $alignLog2
  i32.shr_u
  i32.gt_u
  if
   i32.const 512
   i32.const 592
   i32.const 19
   i32.const 57
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  local.get $length
  local.get $alignLog2
  i32.shl
  local.tee $length
  i32.const 1
  call $~lib/rt/itcms/__new
  local.tee $buffer
  i32.store offset=8
  i32.const 2
  global.get $~lib/shared/runtime/Runtime.Incremental
  i32.ne
  drop
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  local.get $buffer
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=12
  local.get $4
  call $~lib/arraybuffer/ArrayBufferView#set:buffer
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  local.get $buffer
  call $~lib/arraybuffer/ArrayBufferView#set:dataStart
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  local.get $length
  call $~lib/arraybuffer/ArrayBufferView#set:byteLength
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $4
 )
 (func $~lib/typedarray/Int32Array#constructor (type $2) (param $this i32) (param $length i32) (result i32)
  (local $2 i32)
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
   i32.const 12
   i32.const 16
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  global.get $~lib/memory/__stack_pointer
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  local.get $length
  i32.const 2
  call $~lib/arraybuffer/ArrayBufferView#constructor
  local.tee $this
  i32.store
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
 )
 (func $~lib/typedarray/Int32Array#__uset (type $6) (param $this i32) (param $index i32) (param $value i32)
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
  call $~lib/arraybuffer/ArrayBufferView#get:dataStart
  local.get $index
  i32.const 2
  i32.shl
  i32.add
  local.get $value
  i32.store
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/thread/SlotRing#constructor (type $2) (param $this i32) (param $capacity i32) (result i32)
  (local $capacity|2 i32)
  (local $words i32)
  (local $i i32)
  (local $5 i32)
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
   i32.const 15
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  local.get $this
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store offset=4
  local.get $5
  i32.const 0
  call $~lib/thread/SlotRing#set:base
  local.get $this
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store offset=4
  local.get $5
  i32.const 0
  call $~lib/thread/SlotRing#set:capacity
  local.get $this
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store offset=4
  local.get $5
  i32.const 0
  call $~lib/thread/SlotRing#set:signal
  local.get $this
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store offset=4
  local.get $5
  i32.const 0
  call $~lib/thread/SlotRing#set:anchor
  local.get $this
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store offset=4
  local.get $5
  local.get $capacity
  call $~lib/thread/SlotRing#set:capacity
  local.get $capacity
  i32.const 0
  i32.gt_s
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   block $~lib/thread/ringWords|inlined.19 (result i32)
    local.get $capacity
    local.set $capacity|2
    i32.const 3
    local.get $capacity|2
    global.get $~lib/thread/CELL_WORDS
    i32.mul
    i32.add
    br $~lib/thread/ringWords|inlined.19
   end
   call $~lib/typedarray/Int32Array#constructor
   local.tee $words
   i32.store offset=8
   i32.const 0
   local.set $i
   loop $for-loop|0
    local.get $i
    local.get $capacity
    i32.lt_s
    if
     local.get $words
     local.set $5
     global.get $~lib/memory/__stack_pointer
     local.get $5
     i32.store offset=4
     local.get $5
     global.get $~lib/thread/SLOTS
     local.get $i
     global.get $~lib/thread/CELL_WORDS
     i32.mul
     i32.add
     global.get $~lib/thread/VALUE_WORD
     i32.add
     i32.const 0
     call $~lib/typedarray/Int32Array#__uset
     local.get $words
     local.set $5
     global.get $~lib/memory/__stack_pointer
     local.get $5
     i32.store offset=4
     local.get $5
     global.get $~lib/thread/SLOTS
     local.get $i
     global.get $~lib/thread/CELL_WORDS
     i32.mul
     i32.add
     global.get $~lib/thread/SEQ_WORD
     i32.add
     local.get $i
     call $~lib/typedarray/Int32Array#__uset
     local.get $i
     i32.const 1
     i32.add
     local.set $i
     br $for-loop|0
    end
   end
   local.get $words
   local.set $5
   global.get $~lib/memory/__stack_pointer
   local.get $5
   i32.store offset=4
   local.get $5
   global.get $~lib/thread/HEAD
   i32.const 0
   call $~lib/typedarray/Int32Array#__uset
   local.get $words
   local.set $5
   global.get $~lib/memory/__stack_pointer
   local.get $5
   i32.store offset=4
   local.get $5
   global.get $~lib/thread/TAIL
   i32.const 0
   call $~lib/typedarray/Int32Array#__uset
   local.get $words
   local.set $5
   global.get $~lib/memory/__stack_pointer
   local.get $5
   i32.store offset=4
   local.get $5
   global.get $~lib/thread/CAPACITY_WORD
   local.get $capacity
   call $~lib/typedarray/Int32Array#__uset
   local.get $this
   local.set $5
   global.get $~lib/memory/__stack_pointer
   local.get $5
   i32.store offset=4
   local.get $5
   local.get $words
   local.set $5
   global.get $~lib/memory/__stack_pointer
   local.get $5
   i32.store offset=12
   local.get $5
   call $~lib/thread/SlotRing#set:anchor
   local.get $this
   local.set $5
   global.get $~lib/memory/__stack_pointer
   local.get $5
   i32.store offset=4
   local.get $5
   local.get $words
   local.set $5
   global.get $~lib/memory/__stack_pointer
   local.get $5
   i32.store offset=12
   local.get $5
   call $~lib/arraybuffer/ArrayBufferView#get:buffer
   call $~lib/thread/SlotRing#set:base
  end
  local.get $this
  local.set $5
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $5
 )
 (func $~lib/thread/Executor#constructor (type $7) (param $this i32) (param $id i32) (param $step i32) (param $capacity i32) (result i32)
  (local $4 i32)
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
   i32.const 17
   i32.const 14
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  i32.const 0
  call $~lib/thread/Executor#set:id
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  i32.const 0
  call $~lib/thread/Executor#set:ready
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  i32.const 0
  call $~lib/thread/Executor#set:inbox
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  i32.const 0
  call $~lib/thread/Executor#set:step
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  i32.const 0
  call $~lib/thread/Executor#set:stop
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  local.get $id
  call $~lib/thread/Executor#set:id
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  local.get $step
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=8
  local.get $4
  call $~lib/thread/Executor#set:step
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  i32.const 0
  local.get $capacity
  call $~lib/thread/SlotRing#constructor
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=8
  local.get $4
  call $~lib/thread/Executor#set:ready
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  i32.const 0
  local.get $capacity
  call $~lib/thread/SlotRing#constructor
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=8
  local.get $4
  call $~lib/thread/Executor#set:inbox
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $4
 )
 (func $~lib/thread/SlotRing.at (type $2) (param $base i32) (param $capacity i32) (result i32)
  (local $ring i32)
  (local $3 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.const 0
  call $~lib/thread/SlotRing#constructor
  local.tee $ring
  i32.store
  local.get $ring
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=4
  local.get $3
  local.get $base
  call $~lib/thread/SlotRing#set:base
  local.get $ring
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store offset=4
  local.get $3
  local.get $capacity
  call $~lib/thread/SlotRing#set:capacity
  local.get $ring
  local.set $3
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $3
  return
 )
 (func $~lib/thread/Executor.at (type $15) (param $id i32) (param $step i32) (param $readyBase i32) (param $inboxBase i32) (param $capacity i32) (param $signal i32) (result i32)
  (local $e i32)
  (local $ready i32)
  (local $inbox i32)
  (local $9 i32)
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
  i32.const 0
  local.get $id
  local.get $step
  local.set $9
  global.get $~lib/memory/__stack_pointer
  local.get $9
  i32.store
  local.get $9
  i32.const 0
  call $~lib/thread/Executor#constructor
  local.tee $e
  i32.store offset=4
  global.get $~lib/memory/__stack_pointer
  local.get $readyBase
  local.get $capacity
  call $~lib/thread/SlotRing.at
  local.tee $ready
  i32.store offset=8
  local.get $ready
  local.set $9
  global.get $~lib/memory/__stack_pointer
  local.get $9
  i32.store
  local.get $9
  local.get $signal
  call $~lib/thread/SlotRing#set:signal
  global.get $~lib/memory/__stack_pointer
  local.get $inboxBase
  local.get $capacity
  call $~lib/thread/SlotRing.at
  local.tee $inbox
  i32.store offset=12
  local.get $inbox
  local.set $9
  global.get $~lib/memory/__stack_pointer
  local.get $9
  i32.store
  local.get $9
  local.get $signal
  call $~lib/thread/SlotRing#set:signal
  local.get $e
  local.set $9
  global.get $~lib/memory/__stack_pointer
  local.get $9
  i32.store
  local.get $9
  local.get $ready
  local.set $9
  global.get $~lib/memory/__stack_pointer
  local.get $9
  i32.store offset=16
  local.get $9
  call $~lib/thread/Executor#set:ready
  local.get $e
  local.set $9
  global.get $~lib/memory/__stack_pointer
  local.get $9
  i32.store
  local.get $9
  local.get $inbox
  local.set $9
  global.get $~lib/memory/__stack_pointer
  local.get $9
  i32.store offset=16
  local.get $9
  call $~lib/thread/Executor#set:inbox
  local.get $e
  local.set $9
  global.get $~lib/memory/__stack_pointer
  i32.const 20
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $9
  return
 )
 (func $~lib/array/Array<~lib/thread/Executor|null>#__set (type $6) (param $this i32) (param $index i32) (param $value i32)
  (local $3 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $index
  local.get $this
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $~lib/array/Array<~lib/thread/Executor|null>#get:length_
  i32.ge_u
  if
   local.get $index
   i32.const 0
   i32.lt_s
   if
    i32.const 256
    i32.const 464
    i32.const 130
    i32.const 22
    call $~lib/builtins/abort
    unreachable
   end
   local.get $this
   local.get $index
   i32.const 1
   i32.add
   i32.const 2
   i32.const 1
   call $~lib/array/ensureCapacity
   local.get $this
   local.set $3
   global.get $~lib/memory/__stack_pointer
   local.get $3
   i32.store
   local.get $3
   local.get $index
   i32.const 1
   i32.add
   call $~lib/array/Array<~lib/thread/Executor|null>#set:length_
  end
  local.get $this
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $~lib/array/Array<~lib/thread/Executor|null>#get:dataStart
  local.get $index
  i32.const 2
  i32.shl
  i32.add
  local.get $value
  i32.store
  i32.const 1
  drop
  local.get $this
  local.get $value
  i32.const 1
  call $~lib/rt/itcms/__link
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/thread/bindExecutor (type $1) (param $id i32) (result i32)
  (local $table i32)
  (local $id|2 i32)
  (local $rec i32)
  (local $step i32)
  (local $rec|5 i32)
  (local $rec|6 i32)
  (local $capacity i32)
  (local $rec|8 i32)
  (local $rec|9 i32)
  (local $capacity|10 i32)
  (local $capacity|11 i32)
  (local $e i32)
  (local $13 i32)
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
  global.get $~lib/thread/executors
  local.tee $table
  i32.store
  local.get $table
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.const 0
   call $~lib/array/Array<~lib/thread/Executor|null>#constructor
   local.tee $table
   i32.store
   local.get $table
   global.set $~lib/thread/executors
  end
  loop $while-continue|0
   local.get $table
   local.set $13
   global.get $~lib/memory/__stack_pointer
   local.get $13
   i32.store offset=4
   local.get $13
   call $~lib/array/Array<~lib/thread/Executor|null>#get:length
   local.get $id
   i32.le_s
   if
    local.get $table
    local.set $13
    global.get $~lib/memory/__stack_pointer
    local.get $13
    i32.store offset=4
    local.get $13
    i32.const 0
    call $~lib/array/Array<~lib/thread/Executor|null>#push
    drop
    br $while-continue|0
   end
  end
  block $~lib/thread/recordBase|inlined.2 (result i32)
   local.get $id
   local.set $id|2
   global.get $~lib/thread/__controlBase
   global.get $~lib/thread/HEADER_BYTES
   i32.add
   local.get $id|2
   global.get $~lib/thread/__controlStride
   i32.mul
   i32.add
   br $~lib/thread/recordBase|inlined.2
  end
  local.set $rec
  global.get $~lib/memory/__stack_pointer
  i32.const 560
  local.tee $step
  i32.store offset=8
  global.get $~lib/thread/hasCustomStep
  if
   global.get $~lib/memory/__stack_pointer
   global.get $~lib/thread/customStep
   local.tee $step
   i32.store offset=8
  end
  global.get $~lib/memory/__stack_pointer
  local.get $id
  local.get $step
  local.set $13
  global.get $~lib/memory/__stack_pointer
  local.get $13
  i32.store offset=4
  local.get $13
  block $~lib/thread/readyBase|inlined.1 (result i32)
   local.get $rec
   local.set $rec|5
   local.get $rec|5
   br $~lib/thread/readyBase|inlined.1
  end
  block $~lib/thread/inboxBase|inlined.8 (result i32)
   local.get $rec
   local.set $rec|6
   local.get $rec|6
   block $~lib/thread/ringWords|inlined.16 (result i32)
    global.get $~lib/thread/__ringCapacity
    local.set $capacity
    i32.const 3
    local.get $capacity
    global.get $~lib/thread/CELL_WORDS
    i32.mul
    i32.add
    br $~lib/thread/ringWords|inlined.16
   end
   i32.const 2
   i32.shl
   i32.add
   br $~lib/thread/inboxBase|inlined.8
  end
  global.get $~lib/thread/__ringCapacity
  block $~lib/thread/signalBase|inlined.7 (result i32)
   local.get $rec
   local.set $rec|8
   block $~lib/thread/inboxBase|inlined.9 (result i32)
    local.get $rec|8
    local.set $rec|9
    local.get $rec|9
    block $~lib/thread/ringWords|inlined.17 (result i32)
     global.get $~lib/thread/__ringCapacity
     local.set $capacity|10
     i32.const 3
     local.get $capacity|10
     global.get $~lib/thread/CELL_WORDS
     i32.mul
     i32.add
     br $~lib/thread/ringWords|inlined.17
    end
    i32.const 2
    i32.shl
    i32.add
    br $~lib/thread/inboxBase|inlined.9
   end
   block $~lib/thread/ringWords|inlined.18 (result i32)
    global.get $~lib/thread/__ringCapacity
    local.set $capacity|11
    i32.const 3
    local.get $capacity|11
    global.get $~lib/thread/CELL_WORDS
    i32.mul
    i32.add
    br $~lib/thread/ringWords|inlined.18
   end
   i32.const 2
   i32.shl
   i32.add
   br $~lib/thread/signalBase|inlined.7
  end
  call $~lib/thread/Executor.at
  local.tee $e
  i32.store offset=12
  local.get $table
  local.set $13
  global.get $~lib/memory/__stack_pointer
  local.get $13
  i32.store offset=4
  local.get $13
  local.get $id
  local.get $e
  local.set $13
  global.get $~lib/memory/__stack_pointer
  local.get $13
  i32.store offset=16
  local.get $13
  call $~lib/array/Array<~lib/thread/Executor|null>#__set
  local.get $id
  i32.const 0
  i32.eq
  if
   local.get $e
   global.set $~lib/thread/mainExecutorInstance
  end
  local.get $e
  local.set $13
  global.get $~lib/memory/__stack_pointer
  i32.const 20
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $13
  return
 )
 (func $~lib/array/Array<~lib/thread/Executor|null>#__get (type $2) (param $this i32) (param $index i32) (result i32)
  (local $value i32)
  (local $3 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  local.get $index
  local.get $this
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $~lib/array/Array<~lib/thread/Executor|null>#get:length_
  i32.ge_u
  if
   i32.const 256
   i32.const 464
   i32.const 114
   i32.const 42
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  local.get $this
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $~lib/array/Array<~lib/thread/Executor|null>#get:dataStart
  local.get $index
  i32.const 2
  i32.shl
  i32.add
  i32.load
  local.tee $value
  i32.store offset=4
  i32.const 1
  drop
  i32.const 1
  i32.eqz
  drop
  local.get $value
  local.set $3
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $3
  return
 )
 (func $~lib/thread/__executorOf (type $1) (param $id i32) (result i32)
  (local $table i32)
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
  global.get $~lib/thread/executors
  local.tee $table
  i32.store
  local.get $table
  i32.eqz
  if (result i32)
   i32.const 1
  else
   local.get $id
   i32.const 0
   i32.lt_s
  end
  if (result i32)
   i32.const 1
  else
   local.get $id
   local.get $table
   local.set $2
   global.get $~lib/memory/__stack_pointer
   local.get $2
   i32.store offset=4
   local.get $2
   call $~lib/array/Array<~lib/thread/Executor|null>#get:length
   i32.ge_s
  end
  if
   i32.const 0
   local.set $2
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $2
   return
  end
  local.get $table
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  local.get $id
  call $~lib/array/Array<~lib/thread/Executor|null>#__get
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
  return
 )
 (func $~lib/thread/installWakeSink~anonymous|0 (type $0) (param $exec i32) (param $slot i32)
  (local $id i32)
  (local $rec i32)
  (local $rec|4 i32)
  (local $rec|5 i32)
  (local $capacity i32)
  (local $capacity|7 i32)
  (local $e i32)
  (local $9 i32)
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
  global.get $~lib/thread/__controlBase
  i32.const 0
  i32.ne
  if
   block $~lib/thread/recordBase|inlined.3 (result i32)
    local.get $exec
    local.set $id
    global.get $~lib/thread/__controlBase
    global.get $~lib/thread/HEADER_BYTES
    i32.add
    local.get $id
    global.get $~lib/thread/__controlStride
    i32.mul
    i32.add
    br $~lib/thread/recordBase|inlined.3
   end
   local.set $rec
   local.get $rec
   global.get $~lib/thread/__ringCapacity
   local.get $slot
   block $~lib/thread/signalBase|inlined.8 (result i32)
    local.get $rec
    local.set $rec|4
    block $~lib/thread/inboxBase|inlined.10 (result i32)
     local.get $rec|4
     local.set $rec|5
     local.get $rec|5
     block $~lib/thread/ringWords|inlined.20 (result i32)
      global.get $~lib/thread/__ringCapacity
      local.set $capacity
      i32.const 3
      local.get $capacity
      global.get $~lib/thread/CELL_WORDS
      i32.mul
      i32.add
      br $~lib/thread/ringWords|inlined.20
     end
     i32.const 2
     i32.shl
     i32.add
     br $~lib/thread/inboxBase|inlined.10
    end
    block $~lib/thread/ringWords|inlined.21 (result i32)
     global.get $~lib/thread/__ringCapacity
     local.set $capacity|7
     i32.const 3
     local.get $capacity|7
     global.get $~lib/thread/CELL_WORDS
     i32.mul
     i32.add
     br $~lib/thread/ringWords|inlined.21
    end
    i32.const 2
    i32.shl
    i32.add
    br $~lib/thread/signalBase|inlined.8
   end
   call $~lib/thread/blockPush
   drop
   global.get $~lib/memory/__stack_pointer
   i32.const 12
   i32.add
   global.set $~lib/memory/__stack_pointer
   return
  end
  global.get $~lib/memory/__stack_pointer
  local.get $exec
  call $~lib/thread/__executorOf
  local.tee $e
  i32.store
  local.get $e
  if
   local.get $e
   local.set $9
   global.get $~lib/memory/__stack_pointer
   local.get $9
   i32.store offset=8
   local.get $9
   call $~lib/thread/Executor#get:ready
   local.set $9
   global.get $~lib/memory/__stack_pointer
   local.get $9
   i32.store offset=4
   local.get $9
   local.get $slot
   call $~lib/thread/SlotRing#push
   drop
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/thread/installWakeSink (type $5)
  (local $0 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  i32.const 656
  local.set $0
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $0
  call $~lib/task/setWakeSink
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/thread/SlotRing#get:depth (type $1) (param $this i32) (result i32)
  (local $capacity i32)
  (local $base i32)
  (local $ptr i32)
  (local $ptr|4 i32)
  (local $depth i32)
  (local $6 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store
  local.get $6
  call $~lib/thread/SlotRing#get:capacity
  local.set $capacity
  local.get $capacity
  i32.const 0
  i32.le_s
  if
   i32.const 0
   local.set $6
   global.get $~lib/memory/__stack_pointer
   i32.const 4
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $6
   return
  end
  local.get $this
  local.set $6
  global.get $~lib/memory/__stack_pointer
  local.get $6
  i32.store
  local.get $6
  call $~lib/thread/SlotRing#get:base
  local.set $base
  block $~lib/atomics/atomicLoad<i32>|inlined.33 (result i32)
   local.get $base
   global.get $~lib/thread/TAIL_OFF
   i32.add
   local.set $ptr
   local.get $ptr
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.33
  end
  block $~lib/atomics/atomicLoad<i32>|inlined.34 (result i32)
   local.get $base
   global.get $~lib/thread/HEAD_OFF
   i32.add
   local.set $ptr|4
   local.get $ptr|4
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.34
  end
  i32.sub
  local.set $depth
  local.get $depth
  i32.const 0
  i32.gt_s
  if (result i32)
   local.get $depth
  else
   i32.const 0
  end
  local.set $6
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $6
  return
 )
 (func $~lib/thread/__workerMain (type $1) (param $id i32) (result i32)
  (local $here i32)
  (local $ptr i32)
  (local $total i32)
  (local $ptr|4 i32)
  (local $ptr|5 i32)
  (local $ptr|6 i32)
  (local $id|7 i32)
  (local $rec i32)
  (local $rec|9 i32)
  (local $rec|10 i32)
  (local $capacity i32)
  (local $capacity|12 i32)
  (local $sig i32)
  (local $ptr|14 i32)
  (local $arenaBase i32)
  (local $ptr|16 i32)
  (local $arenaSize i32)
  (local $heapBase i32)
  (local $e i32)
  (local $ptr|20 i32)
  (local $entry i32)
  (local $ptr|22 i32)
  (local $ptr|23 i32)
  (local $24 i32)
  (local $25 i32)
  (local $26 i32)
  (local $ptr|27 i32)
  (local $seen i32)
  (local $ptr|29 i32)
  (local $expect i32)
  (local $timeout i64)
  (local $ptr|32 i32)
  (local $value i32)
  (local $ptr|34 i32)
  (local $count i32)
  (local $ptr|36 i32)
  (local $count|37 i32)
  (local $38 i32)
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
  i32.const 1
  i32.eqz
  drop
  call $~lib/thread/controlBlockBase
  local.set $here
  local.get $here
  i32.const 0
  i32.eq
  if
   i32.const -2
   local.set $38
   global.get $~lib/memory/__stack_pointer
   i32.const 16
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $38
   return
  end
  block $~lib/atomics/atomicLoad<i32>|inlined.4 (result i32)
   local.get $here
   global.get $~lib/thread/H_TOTAL
   i32.const 2
   i32.shl
   i32.add
   local.set $ptr
   local.get $ptr
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.4
  end
  local.set $total
  local.get $id
  i32.const 0
  i32.le_s
  if (result i32)
   i32.const 1
  else
   local.get $id
   local.get $total
   i32.ge_s
  end
  if
   i32.const -1
   local.set $38
   global.get $~lib/memory/__stack_pointer
   i32.const 16
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $38
   return
  end
  local.get $here
  global.set $~lib/thread/__controlBase
  block $~lib/atomics/atomicLoad<i32>|inlined.5 (result i32)
   local.get $here
   global.get $~lib/thread/H_STRIDE
   i32.const 2
   i32.shl
   i32.add
   local.set $ptr|4
   local.get $ptr|4
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.5
  end
  global.set $~lib/thread/__controlStride
  block $~lib/atomics/atomicLoad<i32>|inlined.6 (result i32)
   local.get $here
   global.get $~lib/thread/H_CAPACITY
   i32.const 2
   i32.shl
   i32.add
   local.set $ptr|5
   local.get $ptr|5
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.6
  end
  global.set $~lib/thread/__ringCapacity
  local.get $total
  global.set $~lib/thread/__executorTotal
  block $~lib/atomics/atomicLoad<i32>|inlined.7 (result i32)
   local.get $here
   global.get $~lib/thread/H_REQUESTS
   i32.const 2
   i32.shl
   i32.add
   local.set $ptr|6
   local.get $ptr|6
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.7
  end
  global.set $~lib/thread/requestCount
  local.get $here
  global.get $~lib/thread/HEADER_BYTES
  i32.add
  local.get $total
  global.get $~lib/thread/__controlStride
  i32.mul
  i32.add
  global.set $~lib/thread/requestBase
  global.get $~lib/thread/requestBase
  global.get $~lib/thread/requestCount
  global.get $~lib/thread/REQUEST_WORDS
  i32.mul
  i32.const 4
  i32.mul
  i32.add
  global.set $~lib/thread/freeRingBase
  local.get $id
  global.set $~lib/thread/selfExec
  local.get $id
  call $~lib/task-stack/__setSelfExecutor
  block $~lib/thread/recordBase|inlined.1 (result i32)
   local.get $id
   local.set $id|7
   global.get $~lib/thread/__controlBase
   global.get $~lib/thread/HEADER_BYTES
   i32.add
   local.get $id|7
   global.get $~lib/thread/__controlStride
   i32.mul
   i32.add
   br $~lib/thread/recordBase|inlined.1
  end
  local.set $rec
  block $~lib/thread/signalBase|inlined.6 (result i32)
   local.get $rec
   local.set $rec|9
   block $~lib/thread/inboxBase|inlined.7 (result i32)
    local.get $rec|9
    local.set $rec|10
    local.get $rec|10
    block $~lib/thread/ringWords|inlined.14 (result i32)
     global.get $~lib/thread/__ringCapacity
     local.set $capacity
     i32.const 3
     local.get $capacity
     global.get $~lib/thread/CELL_WORDS
     i32.mul
     i32.add
     br $~lib/thread/ringWords|inlined.14
    end
    i32.const 2
    i32.shl
    i32.add
    br $~lib/thread/inboxBase|inlined.7
   end
   block $~lib/thread/ringWords|inlined.15 (result i32)
    global.get $~lib/thread/__ringCapacity
    local.set $capacity|12
    i32.const 3
    local.get $capacity|12
    global.get $~lib/thread/CELL_WORDS
    i32.mul
    i32.add
    br $~lib/thread/ringWords|inlined.15
   end
   i32.const 2
   i32.shl
   i32.add
   br $~lib/thread/signalBase|inlined.6
  end
  local.set $sig
  block $~lib/atomics/atomicLoad<i32>|inlined.8 (result i32)
   local.get $sig
   i32.const 4
   i32.add
   local.set $ptr|14
   local.get $ptr|14
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.8
  end
  local.set $arenaBase
  block $~lib/atomics/atomicLoad<i32>|inlined.9 (result i32)
   local.get $sig
   i32.const 8
   i32.add
   local.set $ptr|16
   local.get $ptr|16
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.9
  end
  local.set $arenaSize
  call $~lib/rt/common/__arenaHeapBase
  local.set $heapBase
  local.get $heapBase
  local.get $arenaBase
  i32.le_u
  if (result i32)
   i32.const 1
  else
   local.get $heapBase
   local.get $arenaBase
   local.get $arenaSize
   i32.add
   i32.ge_u
  end
  if
   i32.const -3
   local.set $38
   global.get $~lib/memory/__stack_pointer
   i32.const 16
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $38
   return
  end
  global.get $~lib/memory/__stack_pointer
  local.get $id
  call $~lib/thread/bindExecutor
  local.tee $e
  i32.store
  global.get $~lib/thread/sinkInstalled
  i32.eqz
  if
   call $~lib/thread/installWakeSink
   i32.const 1
   global.set $~lib/thread/sinkInstalled
  end
  block $~lib/atomics/atomicLoad<i32>|inlined.30 (result i32)
   local.get $sig
   i32.const 16
   i32.add
   local.set $ptr|20
   local.get $ptr|20
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.30
  end
  local.set $entry
  local.get $entry
  i32.const 0
  i32.ge_s
  if
   local.get $e
   local.set $38
   global.get $~lib/memory/__stack_pointer
   local.get $38
   i32.store offset=4
   local.get $38
   local.get $entry
   block $~lib/atomics/atomicLoad<i32>|inlined.31 (result i32)
    local.get $sig
    i32.const 20
    i32.add
    local.set $ptr|22
    local.get $ptr|22
    i32.atomic.load
    br $~lib/atomics/atomicLoad<i32>|inlined.31
   end
   i32.const 0
   i32.const 0
   call $~lib/thread/__serveOne
   drop
  end
  block $while-break|0
   loop $while-continue|0
    local.get $e
    local.set $38
    global.get $~lib/memory/__stack_pointer
    local.get $38
    i32.store offset=4
    local.get $38
    call $~lib/thread/Executor#get:stop
    i32.eqz
    if (result i32)
     block $~lib/atomics/atomicLoad<i32>|inlined.32 (result i32)
      local.get $sig
      i32.const 12
      i32.add
      local.set $ptr|23
      local.get $ptr|23
      i32.atomic.load
      br $~lib/atomics/atomicLoad<i32>|inlined.32
     end
     i32.const 2
     i32.ne
    else
     i32.const 0
    end
    if
     local.get $e
     local.set $38
     global.get $~lib/memory/__stack_pointer
     local.get $38
     i32.store offset=8
     local.get $38
     call $~lib/thread/Executor#get:inbox
     local.set $38
     global.get $~lib/memory/__stack_pointer
     local.get $38
     i32.store offset=4
     local.get $38
     call $~lib/thread/SlotRing#get:depth
     i32.const 0
     i32.gt_s
     if
      local.get $e
      local.set $38
      global.get $~lib/memory/__stack_pointer
      local.get $38
      i32.store offset=4
      local.get $38
      call $~lib/thread/__drainInbox
      drop
      br $while-continue|0
     end
     local.get $e
     local.set $38
     global.get $~lib/memory/__stack_pointer
     local.get $38
     i32.store offset=8
     local.get $38
     call $~lib/thread/Executor#get:ready
     local.set $38
     global.get $~lib/memory/__stack_pointer
     local.get $38
     i32.store offset=4
     local.get $38
     call $~lib/thread/SlotRing#get:depth
     i32.const 0
     i32.gt_s
     if
      global.get $~env
      local.set $25
      global.get $~lib/memory/__stack_pointer
      local.get $e
      local.set $38
      global.get $~lib/memory/__stack_pointer
      local.get $38
      i32.store offset=4
      local.get $38
      call $~lib/thread/Executor#get:step
      local.tee $24
      i32.store offset=12
      local.get $24
      i32.load offset=4
      global.set $~env
      local.get $e
      local.set $38
      global.get $~lib/memory/__stack_pointer
      local.get $38
      i32.store offset=4
      local.get $38
      i32.const 1
      global.set $~argumentsLength
      local.get $24
      i32.load
      call_indirect $0 (type $1)
      local.set $26
      local.get $25
      global.set $~env
      local.get $26
      if
       br $while-break|0
      end
      br $while-continue|0
     end
     block $~lib/atomics/atomicLoad<i32>|inlined.35 (result i32)
      local.get $sig
      local.set $ptr|27
      local.get $ptr|27
      i32.atomic.load
      br $~lib/atomics/atomicLoad<i32>|inlined.35
     end
     local.set $seen
     local.get $e
     local.set $38
     global.get $~lib/memory/__stack_pointer
     local.get $38
     i32.store offset=8
     local.get $38
     call $~lib/thread/Executor#get:inbox
     local.set $38
     global.get $~lib/memory/__stack_pointer
     local.get $38
     i32.store offset=4
     local.get $38
     call $~lib/thread/SlotRing#get:depth
     i32.const 0
     i32.gt_s
     if (result i32)
      i32.const 1
     else
      local.get $e
      local.set $38
      global.get $~lib/memory/__stack_pointer
      local.get $38
      i32.store offset=8
      local.get $38
      call $~lib/thread/Executor#get:ready
      local.set $38
      global.get $~lib/memory/__stack_pointer
      local.get $38
      i32.store offset=4
      local.get $38
      call $~lib/thread/SlotRing#get:depth
      i32.const 0
      i32.gt_s
     end
     if
      br $while-continue|0
     end
     block $~lib/atomics/atomicWait<i32>|inlined.0 (result i32)
      local.get $sig
      local.set $ptr|29
      local.get $seen
      local.set $expect
      i64.const -1
      local.set $timeout
      local.get $ptr|29
      local.get $expect
      local.get $timeout
      memory.atomic.wait32
      br $~lib/atomics/atomicWait<i32>|inlined.0
     end
     drop
     br $while-continue|0
    end
   end
  end
  local.get $sig
  i32.const 12
  i32.add
  local.set $ptr|32
  i32.const 2
  local.set $value
  local.get $ptr|32
  local.get $value
  i32.atomic.store
  block $~lib/atomics/atomicNotify|inlined.2 (result i32)
   local.get $sig
   i32.const 12
   i32.add
   local.set $ptr|34
   i32.const -1
   local.set $count
   local.get $ptr|34
   local.get $count
   memory.atomic.notify
   br $~lib/atomics/atomicNotify|inlined.2
  end
  drop
  block $~lib/atomics/atomicNotify|inlined.3 (result i32)
   local.get $sig
   local.set $ptr|36
   i32.const -1
   local.set $count|37
   local.get $ptr|36
   local.get $count|37
   memory.atomic.notify
   br $~lib/atomics/atomicNotify|inlined.3
  end
  drop
  global.get $~asyncLastStatus
  local.set $38
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $38
  return
 )
 (func $~lib/thread/__executorExit (type $1) (param $id i32) (result i32)
  (local $id|1 i32)
  (local $rec i32)
  (local $rec|3 i32)
  (local $capacity i32)
  (local $capacity|5 i32)
  (local $sig i32)
  (local $e i32)
  (local $ptr i32)
  (local $value i32)
  (local $ptr|10 i32)
  (local $count i32)
  (local $ptr|12 i32)
  (local $count|13 i32)
  (local $14 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/thread/__controlBase
  i32.const 0
  i32.eq
  if
   i32.const -1
   local.set $14
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $14
   return
  end
  local.get $id
  i32.const 0
  i32.lt_s
  if (result i32)
   i32.const 1
  else
   local.get $id
   global.get $~lib/thread/__executorTotal
   i32.ge_s
  end
  if
   i32.const -1
   local.set $14
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $14
   return
  end
  block $~lib/thread/signalBase|inlined.10 (result i32)
   block $~lib/thread/recordBase|inlined.5 (result i32)
    local.get $id
    local.set $id|1
    global.get $~lib/thread/__controlBase
    global.get $~lib/thread/HEADER_BYTES
    i32.add
    local.get $id|1
    global.get $~lib/thread/__controlStride
    i32.mul
    i32.add
    br $~lib/thread/recordBase|inlined.5
   end
   local.set $rec
   block $~lib/thread/inboxBase|inlined.12 (result i32)
    local.get $rec
    local.set $rec|3
    local.get $rec|3
    block $~lib/thread/ringWords|inlined.24 (result i32)
     global.get $~lib/thread/__ringCapacity
     local.set $capacity
     i32.const 3
     local.get $capacity
     global.get $~lib/thread/CELL_WORDS
     i32.mul
     i32.add
     br $~lib/thread/ringWords|inlined.24
    end
    i32.const 2
    i32.shl
    i32.add
    br $~lib/thread/inboxBase|inlined.12
   end
   block $~lib/thread/ringWords|inlined.25 (result i32)
    global.get $~lib/thread/__ringCapacity
    local.set $capacity|5
    i32.const 3
    local.get $capacity|5
    global.get $~lib/thread/CELL_WORDS
    i32.mul
    i32.add
    br $~lib/thread/ringWords|inlined.25
   end
   i32.const 2
   i32.shl
   i32.add
   br $~lib/thread/signalBase|inlined.10
  end
  local.set $sig
  global.get $~lib/memory/__stack_pointer
  local.get $id
  call $~lib/thread/__executorOf
  local.tee $e
  i32.store
  local.get $e
  if
   local.get $e
   local.set $14
   global.get $~lib/memory/__stack_pointer
   local.get $14
   i32.store offset=4
   local.get $14
   i32.const 1
   call $~lib/thread/Executor#set:stop
  end
  local.get $sig
  i32.const 12
  i32.add
  local.set $ptr
  i32.const 2
  local.set $value
  local.get $ptr
  local.get $value
  i32.atomic.store
  block $~lib/atomics/atomicNotify|inlined.4 (result i32)
   local.get $sig
   i32.const 12
   i32.add
   local.set $ptr|10
   i32.const -1
   local.set $count
   local.get $ptr|10
   local.get $count
   memory.atomic.notify
   br $~lib/atomics/atomicNotify|inlined.4
  end
  drop
  block $~lib/atomics/atomicNotify|inlined.5 (result i32)
   local.get $sig
   local.set $ptr|12
   i32.const -1
   local.set $count|13
   local.get $ptr|12
   local.get $count|13
   memory.atomic.notify
   br $~lib/atomics/atomicNotify|inlined.5
  end
  drop
  i32.const 0
  local.set $14
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $14
  return
 )
 (func $~lib/task/Task<i32>#__parkRecord (type $1) (param $this i32) (result i32)
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
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store
  local.get $1
  call $~lib/task/Task<i32>#get:recordValue
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
  return
 )
 (func $~lib/task/Task<i32>#__settleFromRecord (type $0) (param $this i32) (param $record i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  local.get $record
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  call $~lib/task/TaskRecord#get:payload
  call $~lib/task/Task<i32>#set:value
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  local.get $record
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  call $~lib/task/TaskRecord#get:status
  call $~lib/task/TaskBase#set:status
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  i32.const 1
  call $~lib/task/TaskBase#set:settled
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/function/Function<%28i32%2Ci32%29=>void>#__visit (type $0) (param $this i32) (param $cookie i32)
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
  call $~lib/function/Function<%28i32%2Ci32%29=>void>#get:_env
  local.get $cookie
  call $~lib/rt/itcms/__visit
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/array/Array<~lib/task/Waiter>#__visit (type $0) (param $this i32) (param $cookie i32)
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
  call $~lib/array/Array<~lib/task/Waiter>#get:dataStart
  local.set $cur
  local.get $cur
  local.get $this
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store
  local.get $5
  call $~lib/array/Array<~lib/task/Waiter>#get:length_
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
  call $~lib/array/Array<~lib/task/Waiter>#get:buffer
  local.get $cookie
  call $~lib/rt/itcms/__visit
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/array/Array<~lib/task/TaskBase|null>#__visit (type $0) (param $this i32) (param $cookie i32)
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
  call $~lib/array/Array<~lib/task/TaskBase|null>#get:dataStart
  local.set $cur
  local.get $cur
  local.get $this
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store
  local.get $5
  call $~lib/array/Array<~lib/task/TaskBase|null>#get:length_
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
  call $~lib/array/Array<~lib/task/TaskBase|null>#get:buffer
  local.get $cookie
  call $~lib/rt/itcms/__visit
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $"~lib/map/Map<i32,~lib/task-stack/RemotePark>#__visit" (type $0) (param $this i32) (param $cookie i32)
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
  call $"~lib/map/Map<i32,~lib/task-stack/RemotePark>#get:buckets"
  local.get $cookie
  call $~lib/rt/itcms/__visit
  local.get $this
  local.set $7
  global.get $~lib/memory/__stack_pointer
  local.get $7
  i32.store
  local.get $7
  call $"~lib/map/Map<i32,~lib/task-stack/RemotePark>#get:entries"
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
  call $"~lib/map/Map<i32,~lib/task-stack/RemotePark>#get:entriesOffset"
  block $"~lib/map/ENTRY_SIZE<i32,~lib/task-stack/RemotePark>|inlined.0" (result i32)
   i32.const 12
   br $"~lib/map/ENTRY_SIZE<i32,~lib/task-stack/RemotePark>|inlined.0"
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
    call $"~lib/map/MapEntry<i32,~lib/task-stack/RemotePark>#get:taggedNext"
    i32.const 1
    i32.and
    i32.eqz
    if
     i32.const 0
     drop
     i32.const 1
     drop
     local.get $entry
     call $"~lib/map/MapEntry<i32,~lib/task-stack/RemotePark>#get:value"
     local.set $val
     i32.const 0
     drop
     local.get $val
     local.get $cookie
     call $~lib/rt/itcms/__visit
    end
    local.get $cur
    block $"~lib/map/ENTRY_SIZE<i32,~lib/task-stack/RemotePark>|inlined.1" (result i32)
     i32.const 12
     br $"~lib/map/ENTRY_SIZE<i32,~lib/task-stack/RemotePark>|inlined.1"
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
 (func $~lib/array/Array<~lib/thread/Executor|null>#__visit (type $0) (param $this i32) (param $cookie i32)
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
  call $~lib/array/Array<~lib/thread/Executor|null>#get:dataStart
  local.set $cur
  local.get $cur
  local.get $this
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store
  local.get $5
  call $~lib/array/Array<~lib/thread/Executor|null>#get:length_
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
  call $~lib/array/Array<~lib/thread/Executor|null>#get:buffer
  local.get $cookie
  call $~lib/rt/itcms/__visit
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/array/Array<~lib/thread/Request|null>#__visit (type $0) (param $this i32) (param $cookie i32)
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
  call $~lib/array/Array<~lib/thread/Request|null>#get:dataStart
  local.set $cur
  local.get $cur
  local.get $this
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store
  local.get $5
  call $~lib/array/Array<~lib/thread/Request|null>#get:length_
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
  call $~lib/array/Array<~lib/thread/Request|null>#get:buffer
  local.get $cookie
  call $~lib/rt/itcms/__visit
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/array/Array<i32>#__visit (type $0) (param $this i32) (param $cookie i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  i32.const 0
  drop
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $~lib/array/Array<i32>#get:buffer
  local.get $cookie
  call $~lib/rt/itcms/__visit
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/function/Function<%28~lib/thread/Executor%29=>bool>#__visit (type $0) (param $this i32) (param $cookie i32)
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
  call $~lib/function/Function<%28~lib/thread/Executor%29=>bool>#get:_env
  local.get $cookie
  call $~lib/rt/itcms/__visit
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/object/Object#constructor (type $1) (param $this i32) (result i32)
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
 ;; custom section "tension.stackful-backend", size 5, contents: "fiber"
)
