(module
 (type $0 (func))
 (global $~lib/memory/__data_end i32 (i32.const 8))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 32776))
 (global $~lib/memory/__heap_base i32 (i32.const 32776))
 (memory $0 0)
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "run" (func $interop/inline-nesting-layout/run))
 (export "memory" (memory $0))
 (start $~start)
 (func $start:interop/inline-nesting-layout
  i32.const 8
  i32.const 8
  i32.eq
  drop
  i32.const 2
  i32.const 2
  i32.eq
  drop
  i32.const 16
  i32.const 16
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
  i32.const 12
  i32.const 12
  i32.eq
  drop
  i32.const 2
  i32.const 2
  i32.eq
  drop
  i32.const 12
  i32.const 12
  i32.eq
  drop
  i32.const 4
  i32.const 4
  i32.eq
  drop
  i32.const 8
  i32.const 8
  i32.eq
  drop
  i32.const 16
  i32.const 12
  i32.sub
  i32.const 8
  i32.const 4
  i32.sub
  i32.eq
  drop
  i32.const 16
  i32.const 16
  i32.eq
  drop
  i32.const 4
  i32.const 4
  i32.eq
  drop
  i32.const 12
  i32.const 12
  i32.eq
  drop
  i32.const 8
  i32.const 8
  i32.eq
  drop
  i32.const 8
  i32.const 8
  i32.eq
  drop
  i32.const 16
  i32.const 16
  i32.eq
  drop
  i32.const 24
  i32.const 24
  i32.eq
  drop
 )
 (func $interop/inline-nesting-layout/run
 )
 (func $~start
  call $start:interop/inline-nesting-layout
 )
)
