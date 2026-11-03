(module
 (type $0 (func (result i32)))
 (type $1 (func (result f64)))
 (type $2 (func (result i32 i32 i32 i32)))
 (type $3 (func (result f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64)))
 (global $~lib/memory/__data_end i32 (i32.const 8))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 32776))
 (global $~lib/memory/__heap_base i32 (i32.const 32776))
 (memory $0 0)
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "scalarReturn" (func $interop/fixed-array-value-returns/scalarReturn))
 (export "scalarReturnAll" (func $interop/fixed-array-value-returns/scalarReturnAll))
 (export "returnIsACopy" (func $interop/fixed-array-value-returns/returnIsACopy))
 (export "recordReturnX" (func $interop/fixed-array-value-returns/recordReturnX))
 (export "recordReturnLast" (func $interop/fixed-array-value-returns/recordReturnLast))
 (export "recordReturnSum" (func $interop/fixed-array-value-returns/recordReturnSum))
 (export "memory" (memory $0))
 (func $interop/fixed-array-value-returns/make (result i32 i32 i32 i32)
  (local $arr$0 i32)
  (local $arr$1 i32)
  (local $arr$2 i32)
  (local $arr$3 i32)
  i32.const 10
  local.set $arr$0
  i32.const 20
  local.set $arr$1
  i32.const 30
  local.set $arr$2
  i32.const 40
  local.set $arr$3
  local.get $arr$0
  local.get $arr$1
  local.get $arr$2
  local.get $arr$3
  tuple.make 4
  return
 )
 (func $interop/fixed-array-value-returns/scalarReturn (result i32)
  (local $arr$0 i32)
  (local $arr$1 i32)
  (local $arr$2 i32)
  (local $arr$3 i32)
  (local $4 (tuple i32 i32 i32 i32))
  call $interop/fixed-array-value-returns/make
  local.set $4
  local.get $4
  tuple.extract 4 0
  local.set $arr$0
  local.get $4
  tuple.extract 4 1
  local.set $arr$1
  local.get $4
  tuple.extract 4 2
  local.set $arr$2
  local.get $4
  tuple.extract 4 3
  local.set $arr$3
  local.get $arr$2
  return
 )
 (func $interop/fixed-array-value-returns/scalarReturnAll (result i32)
  (local $arr$0 i32)
  (local $arr$1 i32)
  (local $arr$2 i32)
  (local $arr$3 i32)
  (local $4 (tuple i32 i32 i32 i32))
  call $interop/fixed-array-value-returns/make
  local.set $4
  local.get $4
  tuple.extract 4 0
  local.set $arr$0
  local.get $4
  tuple.extract 4 1
  local.set $arr$1
  local.get $4
  tuple.extract 4 2
  local.set $arr$2
  local.get $4
  tuple.extract 4 3
  local.set $arr$3
  local.get $arr$0
  local.get $arr$1
  i32.const 10
  i32.mul
  i32.add
  local.get $arr$2
  i32.const 100
  i32.mul
  i32.add
  local.get $arr$3
  i32.const 1000
  i32.mul
  i32.add
  return
 )
 (func $interop/fixed-array-value-returns/returnIsACopy (result i32)
  (local $arr$0 i32)
  (local $arr$1 i32)
  (local $arr$2 i32)
  (local $arr$3 i32)
  (local $4 (tuple i32 i32 i32 i32))
  (local $again$0 i32)
  (local $again$1 i32)
  (local $again$2 i32)
  (local $again$3 i32)
  (local $9 (tuple i32 i32 i32 i32))
  call $interop/fixed-array-value-returns/make
  local.set $4
  local.get $4
  tuple.extract 4 0
  local.set $arr$0
  local.get $4
  tuple.extract 4 1
  local.set $arr$1
  local.get $4
  tuple.extract 4 2
  local.set $arr$2
  local.get $4
  tuple.extract 4 3
  local.set $arr$3
  i32.const 99
  local.set $arr$0
  call $interop/fixed-array-value-returns/make
  local.set $9
  local.get $9
  tuple.extract 4 0
  local.set $again$0
  local.get $9
  tuple.extract 4 1
  local.set $again$1
  local.get $9
  tuple.extract 4 2
  local.set $again$2
  local.get $9
  tuple.extract 4 3
  local.set $again$3
  local.get $again$0
  return
 )
 (func $interop/fixed-array-value-returns/makeStates (result f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64)
  (local $arr$0$x f64)
  (local $arr$0$y f64)
  (local $arr$0$vx f64)
  (local $arr$0$vy f64)
  (local $arr$1$x f64)
  (local $arr$1$y f64)
  (local $arr$1$vx f64)
  (local $arr$1$vy f64)
  (local $arr$2$x f64)
  (local $arr$2$y f64)
  (local $arr$2$vx f64)
  (local $arr$2$vy f64)
  (local $arr$3$x f64)
  (local $arr$3$y f64)
  (local $arr$3$vx f64)
  (local $arr$3$vy f64)
  f64.const 10
  local.set $arr$0$x
  f64.const 20
  local.set $arr$0$y
  f64.const 1
  local.set $arr$0$vx
  f64.const 2
  local.set $arr$0$vy
  f64.const 30
  local.set $arr$1$x
  f64.const 40
  local.set $arr$1$y
  f64.const 3
  local.set $arr$1$vx
  f64.const 4
  local.set $arr$1$vy
  f64.const 50
  local.set $arr$2$x
  f64.const 60
  local.set $arr$2$y
  f64.const 5
  local.set $arr$2$vx
  f64.const 6
  local.set $arr$2$vy
  f64.const 70
  local.set $arr$3$x
  f64.const 80
  local.set $arr$3$y
  f64.const 7
  local.set $arr$3$vx
  f64.const 8
  local.set $arr$3$vy
  local.get $arr$0$x
  local.get $arr$0$y
  local.get $arr$0$vx
  local.get $arr$0$vy
  local.get $arr$1$x
  local.get $arr$1$y
  local.get $arr$1$vx
  local.get $arr$1$vy
  local.get $arr$2$x
  local.get $arr$2$y
  local.get $arr$2$vx
  local.get $arr$2$vy
  local.get $arr$3$x
  local.get $arr$3$y
  local.get $arr$3$vx
  local.get $arr$3$vy
  tuple.make 16
  return
 )
 (func $interop/fixed-array-value-returns/recordReturnX (result f64)
  (local $arr$0$x f64)
  (local $arr$0$y f64)
  (local $arr$0$vx f64)
  (local $arr$0$vy f64)
  (local $arr$1$x f64)
  (local $arr$1$y f64)
  (local $arr$1$vx f64)
  (local $arr$1$vy f64)
  (local $arr$2$x f64)
  (local $arr$2$y f64)
  (local $arr$2$vx f64)
  (local $arr$2$vy f64)
  (local $arr$3$x f64)
  (local $arr$3$y f64)
  (local $arr$3$vx f64)
  (local $arr$3$vy f64)
  (local $16 (tuple f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64))
  call $interop/fixed-array-value-returns/makeStates
  local.set $16
  local.get $16
  tuple.extract 16 0
  local.set $arr$0$x
  local.get $16
  tuple.extract 16 1
  local.set $arr$0$y
  local.get $16
  tuple.extract 16 2
  local.set $arr$0$vx
  local.get $16
  tuple.extract 16 3
  local.set $arr$0$vy
  local.get $16
  tuple.extract 16 4
  local.set $arr$1$x
  local.get $16
  tuple.extract 16 5
  local.set $arr$1$y
  local.get $16
  tuple.extract 16 6
  local.set $arr$1$vx
  local.get $16
  tuple.extract 16 7
  local.set $arr$1$vy
  local.get $16
  tuple.extract 16 8
  local.set $arr$2$x
  local.get $16
  tuple.extract 16 9
  local.set $arr$2$y
  local.get $16
  tuple.extract 16 10
  local.set $arr$2$vx
  local.get $16
  tuple.extract 16 11
  local.set $arr$2$vy
  local.get $16
  tuple.extract 16 12
  local.set $arr$3$x
  local.get $16
  tuple.extract 16 13
  local.set $arr$3$y
  local.get $16
  tuple.extract 16 14
  local.set $arr$3$vx
  local.get $16
  tuple.extract 16 15
  local.set $arr$3$vy
  local.get $arr$2$x
  return
 )
 (func $interop/fixed-array-value-returns/recordReturnLast (result f64)
  (local $arr$0$x f64)
  (local $arr$0$y f64)
  (local $arr$0$vx f64)
  (local $arr$0$vy f64)
  (local $arr$1$x f64)
  (local $arr$1$y f64)
  (local $arr$1$vx f64)
  (local $arr$1$vy f64)
  (local $arr$2$x f64)
  (local $arr$2$y f64)
  (local $arr$2$vx f64)
  (local $arr$2$vy f64)
  (local $arr$3$x f64)
  (local $arr$3$y f64)
  (local $arr$3$vx f64)
  (local $arr$3$vy f64)
  (local $16 (tuple f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64))
  call $interop/fixed-array-value-returns/makeStates
  local.set $16
  local.get $16
  tuple.extract 16 0
  local.set $arr$0$x
  local.get $16
  tuple.extract 16 1
  local.set $arr$0$y
  local.get $16
  tuple.extract 16 2
  local.set $arr$0$vx
  local.get $16
  tuple.extract 16 3
  local.set $arr$0$vy
  local.get $16
  tuple.extract 16 4
  local.set $arr$1$x
  local.get $16
  tuple.extract 16 5
  local.set $arr$1$y
  local.get $16
  tuple.extract 16 6
  local.set $arr$1$vx
  local.get $16
  tuple.extract 16 7
  local.set $arr$1$vy
  local.get $16
  tuple.extract 16 8
  local.set $arr$2$x
  local.get $16
  tuple.extract 16 9
  local.set $arr$2$y
  local.get $16
  tuple.extract 16 10
  local.set $arr$2$vx
  local.get $16
  tuple.extract 16 11
  local.set $arr$2$vy
  local.get $16
  tuple.extract 16 12
  local.set $arr$3$x
  local.get $16
  tuple.extract 16 13
  local.set $arr$3$y
  local.get $16
  tuple.extract 16 14
  local.set $arr$3$vx
  local.get $16
  tuple.extract 16 15
  local.set $arr$3$vy
  local.get $arr$3$vy
  return
 )
 (func $interop/fixed-array-value-returns/recordReturnSum (result f64)
  (local $arr$0$x f64)
  (local $arr$0$y f64)
  (local $arr$0$vx f64)
  (local $arr$0$vy f64)
  (local $arr$1$x f64)
  (local $arr$1$y f64)
  (local $arr$1$vx f64)
  (local $arr$1$vy f64)
  (local $arr$2$x f64)
  (local $arr$2$y f64)
  (local $arr$2$vx f64)
  (local $arr$2$vy f64)
  (local $arr$3$x f64)
  (local $arr$3$y f64)
  (local $arr$3$vx f64)
  (local $arr$3$vy f64)
  (local $16 (tuple f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 f64))
  call $interop/fixed-array-value-returns/makeStates
  local.set $16
  local.get $16
  tuple.extract 16 0
  local.set $arr$0$x
  local.get $16
  tuple.extract 16 1
  local.set $arr$0$y
  local.get $16
  tuple.extract 16 2
  local.set $arr$0$vx
  local.get $16
  tuple.extract 16 3
  local.set $arr$0$vy
  local.get $16
  tuple.extract 16 4
  local.set $arr$1$x
  local.get $16
  tuple.extract 16 5
  local.set $arr$1$y
  local.get $16
  tuple.extract 16 6
  local.set $arr$1$vx
  local.get $16
  tuple.extract 16 7
  local.set $arr$1$vy
  local.get $16
  tuple.extract 16 8
  local.set $arr$2$x
  local.get $16
  tuple.extract 16 9
  local.set $arr$2$y
  local.get $16
  tuple.extract 16 10
  local.set $arr$2$vx
  local.get $16
  tuple.extract 16 11
  local.set $arr$2$vy
  local.get $16
  tuple.extract 16 12
  local.set $arr$3$x
  local.get $16
  tuple.extract 16 13
  local.set $arr$3$y
  local.get $16
  tuple.extract 16 14
  local.set $arr$3$vx
  local.get $16
  tuple.extract 16 15
  local.set $arr$3$vy
  local.get $arr$0$x
  local.get $arr$1$vx
  f64.add
  local.get $arr$2$y
  f64.add
  local.get $arr$3$vy
  f64.add
  return
 )
)
