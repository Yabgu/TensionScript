(module
 (type $0 (func (param i32) (result i32)))
 (type $1 (func (param i32 i32)))
 (type $2 (func (result i32)))
 (type $3 (func))
 (type $4 (func (param i32 i32) (result i32)))
 (type $5 (func (param i32 i32 i32 i32)))
 (type $6 (func (param i32 i32 i64) (result i32)))
 (type $7 (func (param i32 i32 i32) (result i32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (import "env" "__executorCount" (func $~lib/thread/__executorCount (result i32)))
 (import "env" "__startThread" (func $~lib/thread/__startThread (param i32) (result i32)))
 (global $~lib/native/ASC_FEATURE_THREADS i32 (i32.const 1))
 (global $~lib/rt/common/ARENA_END (mut i32) (i32.const 0))
 (global $~lib/rt/common/ARENA_BASE_CONFIGURED (mut i32) (i32.const 0))
 (global $~lib/rt/common/HEAP_BASE (mut i32) (i32.const 0))
 (global $~lib/rt/common/ARENA_END_CONFIGURED (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/total (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/state (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/white (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/visitCount (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/ARENA_FROM_SPACE (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/fromSpace (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/ARENA_TO_SPACE (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/toSpace (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/ARENA_PIN_SPACE (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/pinSpace (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/iter (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/threshold (mut i32) (i32.const 0))
 (global $~lib/rt/tlsf/ROOT (mut i32) (i32.const 0))
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
 (global $~lib/task/__wakeSink (mut i32) (i32.const 192))
 (global $~lib/task/inlinePolicyInstance (mut i32) (i32.const 0))
 (global $~lib/task-stack/tasks (mut i32) (i32.const 0))
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
 (global $~lib/memory/__data_end i32 (i32.const 316))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 33084))
 (global $~lib/memory/__heap_base i32 (i32.const 33084))
 (memory $0 1 10 shared)
 (data $0 (i32.const 16) "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $1 (i32.const 48) "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $2 (i32.const 80) "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $3 (i32.const 108) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00t\00l\00s\00f\00.\00t\00s\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $4 (i32.const 172) "\1c\00\00\00\00\00\00\00\00\00\00\00\04\00\00\00\08\00\00\00\01\00\00\00\00\00\00\00\00\00\00\00")
 (data $5 (i32.const 204) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00$\00\00\00I\00n\00d\00e\00x\00 \00o\00u\00t\00 \00o\00f\00 \00r\00a\00n\00g\00e\00\00\00\00\00\00\00\00\00")
 (data $6 (i32.const 268) ",\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00\1a\00\00\00~\00l\00i\00b\00/\00a\00r\00r\00a\00y\00.\00t\00s\00\00\00")
 (table $0 2 2 funcref)
 (table $$starts 0 0 funcref)
 (elem $0 (table $0) (i32.const 1) func $~lib/task/noopWake)
 (export "__arenaInit" (func $~lib/rt/tlsf/__arenaInit))
 (export "__arenaHeapBase" (func $~lib/rt/common/__arenaHeapBase))
 (export "__arenaEnd" (func $~lib/rt/common/__arenaEnd))
 (export "__threadInit" (func $~lib/thread/__threadInit))
 (export "__threadJoin" (func $~lib/thread/__threadJoin))
 (export "__workerMain" (func $~lib/thread/__workerMainPlain))
 (export "__spawnThread" (func $~lib/thread/__spawnThread))
 (export "__executorExit" (func $~lib/thread/__executorExit))
 (export "__mainArenaBase" (func $~lib/thread/__mainArenaBase))
 (export "__mainArenaSize" (func $~lib/thread/__mainArenaSize))
 (export "__workerArenaBase" (func $~lib/thread/__workerArenaBase))
 (export "__workerArenaSize" (func $~lib/thread/__workerArenaSize))
 (export "__heapBase" (global $~lib/thread/__heapBase))
 (export "__controlBase" (global $~lib/thread/__controlBase))
 (export "__controlStride" (global $~lib/thread/__controlStride))
 (export "__ringCapacity" (global $~lib/thread/__ringCapacity))
 (export "__executorTotal" (global $~lib/thread/__executorTotal))
 (export "memory" (memory $0))
 (export "$starts" (table $$starts))
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
 (func $~lib/rt/common/initialHeapBase (result i32)
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
 (func $~lib/rt/common/noteArena (param $end i32) (param $heap i32)
  local.get $end
  global.set $~lib/rt/common/ARENA_END_CONFIGURED
  local.get $heap
  global.set $~lib/rt/common/ARENA_BASE_CONFIGURED
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
  local.get $end
  local.get $heap
  call $~lib/rt/common/noteArena
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
 (func $~lib/rt/itcms/initialFromSpace (result i32)
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
  i32.const 16
  call $~lib/rt/itcms/initLazy
  return
 )
 (func $~lib/rt/itcms/initialToSpace (result i32)
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
  i32.const 48
  call $~lib/rt/itcms/initLazy
  return
 )
 (func $~lib/rt/itcms/initialPinSpace (result i32)
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
  i32.const 80
  call $~lib/rt/itcms/initLazy
  return
 )
 (func $~lib/rt/itcms/noteArenaSpaces
  global.get $~lib/rt/itcms/fromSpace
  global.set $~lib/rt/itcms/ARENA_FROM_SPACE
  global.get $~lib/rt/itcms/toSpace
  global.set $~lib/rt/itcms/ARENA_TO_SPACE
  global.get $~lib/rt/itcms/pinSpace
  global.set $~lib/rt/itcms/ARENA_PIN_SPACE
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
 (func $~lib/task/noopWake (param $exec i32) (param $slot i32)
 )
 (func $~lib/thread/initRingWords (param $base i32) (param $capacity i32)
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
 (func $~lib/thread/__threadInit (param $capacity i32) (result i32)
  (local $total i32)
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
  local.get $capacity
  i32.const 0
  i32.le_s
  if
   global.get $~lib/thread/DEFAULT_CAPACITY
   local.set $capacity
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
 (func $~lib/thread/__threadJoin (param $id i32) (result i32)
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
  block $~lib/thread/signalBase|inlined.3 (result i32)
   block $~lib/thread/recordBase|inlined.0 (result i32)
    local.get $id
    local.set $id|1
    global.get $~lib/thread/__controlBase
    global.get $~lib/thread/HEADER_BYTES
    i32.add
    local.get $id|1
    global.get $~lib/thread/__controlStride
    i32.mul
    i32.add
    br $~lib/thread/recordBase|inlined.0
   end
   local.set $rec
   block $~lib/thread/inboxBase|inlined.4 (result i32)
    local.get $rec
    local.set $rec|3
    local.get $rec|3
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
    local.set $capacity|5
    i32.const 3
    local.get $capacity|5
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
  i32.const 12
  i32.add
  local.set $addr
  loop $while-continue|0
   i32.const 1
   if
    block $~lib/atomics/atomicLoad<i32>|inlined.0 (result i32)
     local.get $addr
     local.set $ptr
     local.get $ptr
     i32.atomic.load
     br $~lib/atomics/atomicLoad<i32>|inlined.0
    end
    local.set $state
    local.get $state
    i32.const 2
    i32.eq
    if
     i32.const 0
     return
    end
    block $~lib/atomics/atomicWait<i32>|inlined.0 (result i32)
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
     br $~lib/atomics/atomicWait<i32>|inlined.0
    end
    drop
    br $while-continue|0
   end
  end
  unreachable
 )
 (func $~lib/thread/controlBlockBase (result i32)
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
  block $~lib/atomics/atomicLoad<i32>|inlined.1 (result i32)
   local.get $here
   global.get $~lib/thread/H_MAGIC
   i32.const 2
   i32.shl
   i32.add
   local.set $ptr
   local.get $ptr
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.1
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
 (func $~lib/thread/__workerMainPlain (param $id i32) (result i32)
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
  (local $ptr|19 i32)
  (local $entry i32)
  (local $status i32)
  (local $ptr|22 i32)
  (local $ptr|23 i32)
  (local $value i32)
  (local $ptr|25 i32)
  (local $count i32)
  (local $ptr|27 i32)
  (local $count|28 i32)
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
   return
  end
  block $~lib/atomics/atomicLoad<i32>|inlined.2 (result i32)
   local.get $here
   global.get $~lib/thread/H_TOTAL
   i32.const 2
   i32.shl
   i32.add
   local.set $ptr
   local.get $ptr
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.2
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
   return
  end
  local.get $here
  global.set $~lib/thread/__controlBase
  block $~lib/atomics/atomicLoad<i32>|inlined.3 (result i32)
   local.get $here
   global.get $~lib/thread/H_STRIDE
   i32.const 2
   i32.shl
   i32.add
   local.set $ptr|4
   local.get $ptr|4
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.3
  end
  global.set $~lib/thread/__controlStride
  block $~lib/atomics/atomicLoad<i32>|inlined.4 (result i32)
   local.get $here
   global.get $~lib/thread/H_CAPACITY
   i32.const 2
   i32.shl
   i32.add
   local.set $ptr|5
   local.get $ptr|5
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.4
  end
  global.set $~lib/thread/__ringCapacity
  local.get $total
  global.set $~lib/thread/__executorTotal
  block $~lib/atomics/atomicLoad<i32>|inlined.5 (result i32)
   local.get $here
   global.get $~lib/thread/H_REQUESTS
   i32.const 2
   i32.shl
   i32.add
   local.set $ptr|6
   local.get $ptr|6
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.5
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
  block $~lib/thread/signalBase|inlined.4 (result i32)
   local.get $rec
   local.set $rec|9
   block $~lib/thread/inboxBase|inlined.5 (result i32)
    local.get $rec|9
    local.set $rec|10
    local.get $rec|10
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
    local.set $capacity|12
    i32.const 3
    local.get $capacity|12
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
  local.set $sig
  block $~lib/atomics/atomicLoad<i32>|inlined.6 (result i32)
   local.get $sig
   i32.const 4
   i32.add
   local.set $ptr|14
   local.get $ptr|14
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.6
  end
  local.set $arenaBase
  block $~lib/atomics/atomicLoad<i32>|inlined.7 (result i32)
   local.get $sig
   i32.const 8
   i32.add
   local.set $ptr|16
   local.get $ptr|16
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.7
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
   return
  end
  block $~lib/atomics/atomicLoad<i32>|inlined.8 (result i32)
   local.get $sig
   i32.const 16
   i32.add
   local.set $ptr|19
   local.get $ptr|19
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.8
  end
  local.set $entry
  i32.const 0
  local.set $status
  local.get $entry
  i32.const 0
  i32.ge_s
  if
   block $~lib/atomics/atomicLoad<i32>|inlined.9 (result i32)
    local.get $sig
    i32.const 20
    i32.add
    local.set $ptr|22
    local.get $ptr|22
    i32.atomic.load
    br $~lib/atomics/atomicLoad<i32>|inlined.9
   end
   global.set $~lib/thread/servingArg
   i32.const 0
   global.set $~lib/thread/servingKey
   i32.const 0
   global.set $~lib/thread/servingOrigin
   local.get $entry
   call_indirect $$starts (type $2)
   local.set $status
  end
  local.get $sig
  i32.const 12
  i32.add
  local.set $ptr|23
  i32.const 2
  local.set $value
  local.get $ptr|23
  local.get $value
  i32.atomic.store
  block $~lib/atomics/atomicNotify|inlined.0 (result i32)
   local.get $sig
   i32.const 12
   i32.add
   local.set $ptr|25
   i32.const -1
   local.set $count
   local.get $ptr|25
   local.get $count
   memory.atomic.notify
   br $~lib/atomics/atomicNotify|inlined.0
  end
  drop
  block $~lib/atomics/atomicNotify|inlined.1 (result i32)
   local.get $sig
   local.set $ptr|27
   i32.const -1
   local.set $count|28
   local.get $ptr|27
   local.get $count|28
   memory.atomic.notify
   br $~lib/atomics/atomicNotify|inlined.1
  end
  drop
  local.get $status
  return
 )
 (func $~lib/thread/__spawnThread (param $id i32) (param $entryIndex i32) (param $argSlot i32) (result i32)
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
   block $~lib/thread/recordBase|inlined.2 (result i32)
    local.get $id
    local.set $id|3
    global.get $~lib/thread/__controlBase
    global.get $~lib/thread/HEADER_BYTES
    i32.add
    local.get $id|3
    global.get $~lib/thread/__controlStride
    i32.mul
    i32.add
    br $~lib/thread/recordBase|inlined.2
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
  block $~lib/atomics/atomicLoad<i32>|inlined.10 (result i32)
   local.get $sig
   i32.const 12
   i32.add
   local.set $ptr
   local.get $ptr
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.10
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
 (func $~lib/array/Array<~lib/thread/Executor|null>#get:length_ (param $this i32) (result i32)
  local.get $this
  i32.load offset=12
 )
 (func $~lib/array/Array<~lib/thread/Executor|null>#get:dataStart (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/thread/Executor#set:stop (param $this i32) (param $stop i32)
  local.get $this
  local.get $stop
  i32.store8 offset=16
 )
 (func $~lib/thread/__mainArenaBase (result i32)
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
  block $~lib/atomics/atomicLoad<i32>|inlined.11 (result i32)
   block $~lib/thread/signalBase|inlined.7 (result i32)
    global.get $~lib/thread/__controlBase
    global.get $~lib/thread/HEADER_BYTES
    i32.add
    local.set $rec
    block $~lib/thread/inboxBase|inlined.8 (result i32)
     local.get $rec
     local.set $rec|1
     local.get $rec|1
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
    block $~lib/thread/ringWords|inlined.17 (result i32)
     global.get $~lib/thread/__ringCapacity
     local.set $capacity|3
     i32.const 3
     local.get $capacity|3
     global.get $~lib/thread/CELL_WORDS
     i32.mul
     i32.add
     br $~lib/thread/ringWords|inlined.17
    end
    i32.const 2
    i32.shl
    i32.add
    br $~lib/thread/signalBase|inlined.7
   end
   i32.const 4
   i32.add
   local.set $ptr
   local.get $ptr
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.11
  end
  return
 )
 (func $~lib/thread/__mainArenaSize (result i32)
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
  block $~lib/atomics/atomicLoad<i32>|inlined.12 (result i32)
   block $~lib/thread/signalBase|inlined.8 (result i32)
    global.get $~lib/thread/__controlBase
    global.get $~lib/thread/HEADER_BYTES
    i32.add
    local.set $rec
    block $~lib/thread/inboxBase|inlined.9 (result i32)
     local.get $rec
     local.set $rec|1
     local.get $rec|1
     block $~lib/thread/ringWords|inlined.18 (result i32)
      global.get $~lib/thread/__ringCapacity
      local.set $capacity
      i32.const 3
      local.get $capacity
      global.get $~lib/thread/CELL_WORDS
      i32.mul
      i32.add
      br $~lib/thread/ringWords|inlined.18
     end
     i32.const 2
     i32.shl
     i32.add
     br $~lib/thread/inboxBase|inlined.9
    end
    block $~lib/thread/ringWords|inlined.19 (result i32)
     global.get $~lib/thread/__ringCapacity
     local.set $capacity|3
     i32.const 3
     local.get $capacity|3
     global.get $~lib/thread/CELL_WORDS
     i32.mul
     i32.add
     br $~lib/thread/ringWords|inlined.19
    end
    i32.const 2
    i32.shl
    i32.add
    br $~lib/thread/signalBase|inlined.8
   end
   i32.const 8
   i32.add
   local.set $ptr
   local.get $ptr
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.12
  end
  return
 )
 (func $~lib/thread/__workerArenaBase (param $id i32) (result i32)
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
  block $~lib/atomics/atomicLoad<i32>|inlined.13 (result i32)
   local.get $here
   global.get $~lib/thread/H_TOTAL
   i32.const 2
   i32.shl
   i32.add
   local.set $ptr
   local.get $ptr
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.13
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
  block $~lib/atomics/atomicLoad<i32>|inlined.14 (result i32)
   local.get $here
   global.get $~lib/thread/H_STRIDE
   i32.const 2
   i32.shl
   i32.add
   local.set $ptr|4
   local.get $ptr|4
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.14
  end
  local.set $stride
  block $~lib/atomics/atomicLoad<i32>|inlined.15 (result i32)
   local.get $here
   global.get $~lib/thread/H_CAPACITY
   i32.const 2
   i32.shl
   i32.add
   local.set $ptr|6
   local.get $ptr|6
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.15
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
  block $~lib/thread/ringWords|inlined.20 (result i32)
   local.get $capacity
   local.set $capacity|9
   i32.const 3
   local.get $capacity|9
   global.get $~lib/thread/CELL_WORDS
   i32.mul
   i32.add
   br $~lib/thread/ringWords|inlined.20
  end
  i32.mul
  i32.const 2
  i32.shl
  i32.add
  local.set $sig
  block $~lib/atomics/atomicLoad<i32>|inlined.16 (result i32)
   local.get $sig
   i32.const 4
   i32.add
   local.set $ptr|11
   local.get $ptr|11
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.16
  end
  return
 )
 (func $~lib/thread/__workerArenaSize (param $id i32) (result i32)
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
  block $~lib/atomics/atomicLoad<i32>|inlined.17 (result i32)
   local.get $here
   global.get $~lib/thread/H_TOTAL
   i32.const 2
   i32.shl
   i32.add
   local.set $ptr
   local.get $ptr
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.17
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
  block $~lib/atomics/atomicLoad<i32>|inlined.18 (result i32)
   local.get $here
   global.get $~lib/thread/H_STRIDE
   i32.const 2
   i32.shl
   i32.add
   local.set $ptr|4
   local.get $ptr|4
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.18
  end
  local.set $stride
  block $~lib/atomics/atomicLoad<i32>|inlined.19 (result i32)
   local.get $here
   global.get $~lib/thread/H_CAPACITY
   i32.const 2
   i32.shl
   i32.add
   local.set $ptr|6
   local.get $ptr|6
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.19
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
  block $~lib/thread/ringWords|inlined.21 (result i32)
   local.get $capacity
   local.set $capacity|9
   i32.const 3
   local.get $capacity|9
   global.get $~lib/thread/CELL_WORDS
   i32.mul
   i32.add
   br $~lib/thread/ringWords|inlined.21
  end
  i32.mul
  i32.const 2
  i32.shl
  i32.add
  local.set $sig
  block $~lib/atomics/atomicLoad<i32>|inlined.20 (result i32)
   local.get $sig
   i32.const 8
   i32.add
   local.set $ptr|11
   local.get $ptr|11
   i32.atomic.load
   br $~lib/atomics/atomicLoad<i32>|inlined.20
  end
  return
 )
 (func $~start
  call $start:features/threads
  call $~lib/rt/common/initialHeapBase
  global.set $~lib/rt/common/HEAP_BASE
  call $~lib/rt/itcms/initialFromSpace
  global.set $~lib/rt/itcms/fromSpace
  call $~lib/rt/itcms/initialToSpace
  global.set $~lib/rt/itcms/toSpace
  call $~lib/rt/itcms/initialPinSpace
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
 (func $~stack_check
  global.get $~lib/memory/__stack_pointer
  global.get $~lib/memory/__data_end
  i32.lt_s
  if
   i32.const 33104
   i32.const 33152
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
 )
 (func $~lib/array/Array<~lib/thread/Executor|null>#get:length (param $this i32) (result i32)
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
 (func $~lib/array/Array<~lib/thread/Executor|null>#__get (param $this i32) (param $index i32) (result i32)
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
   i32.const 224
   i32.const 288
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
 (func $~lib/thread/__executorOf (param $id i32) (result i32)
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
 (func $~lib/thread/__executorExit (param $id i32) (result i32)
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
  block $~lib/thread/signalBase|inlined.6 (result i32)
   block $~lib/thread/recordBase|inlined.3 (result i32)
    local.get $id
    local.set $id|1
    global.get $~lib/thread/__controlBase
    global.get $~lib/thread/HEADER_BYTES
    i32.add
    local.get $id|1
    global.get $~lib/thread/__controlStride
    i32.mul
    i32.add
    br $~lib/thread/recordBase|inlined.3
   end
   local.set $rec
   block $~lib/thread/inboxBase|inlined.7 (result i32)
    local.get $rec
    local.set $rec|3
    local.get $rec|3
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
    local.set $capacity|5
    i32.const 3
    local.get $capacity|5
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
  block $~lib/atomics/atomicNotify|inlined.2 (result i32)
   local.get $sig
   i32.const 12
   i32.add
   local.set $ptr|10
   i32.const -1
   local.set $count
   local.get $ptr|10
   local.get $count
   memory.atomic.notify
   br $~lib/atomics/atomicNotify|inlined.2
  end
  drop
  block $~lib/atomics/atomicNotify|inlined.3 (result i32)
   local.get $sig
   local.set $ptr|12
   i32.const -1
   local.set $count|13
   local.get $ptr|12
   local.get $count|13
   memory.atomic.notify
   br $~lib/atomics/atomicNotify|inlined.3
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
)
