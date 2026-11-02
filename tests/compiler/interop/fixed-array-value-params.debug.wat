(module
 (type $0 (func (result i32)))
 (type $1 (func (param i32 i32 i32 i32) (result i32)))
 (type $2 (func (param i32 i32 i32 i32 i32) (result i32)))
 (type $3 (func (param i32 i32 i32 i32)))
 (type $4 (func (param f64 f64 f64 f64 f64 f64 f64 f64) (result f64)))
 (type $5 (func (result f64)))
 (type $6 (func (param i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
 (global $~lib/memory/__data_end i32 (i32.const 8))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 32776))
 (global $~lib/memory/__heap_base i32 (i32.const 32776))
 (memory $0 0)
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "callWithLiteral" (func $interop/fixed-array-value-params/callWithLiteral))
 (export "callWithLocal" (func $interop/fixed-array-value-params/callWithLocal))
 (export "callIndexed" (func $interop/fixed-array-value-params/callIndexed))
 (export "copyAtCall" (func $interop/fixed-array-value-params/copyAtCall))
 (export "callRecord" (func $interop/fixed-array-value-params/callRecord))
 (export "twoArrays" (func $interop/fixed-array-value-params/twoArrays))
 (export "memory" (memory $0))
 (func $interop/fixed-array-value-params/sum (param $arr$0 i32) (param $arr$1 i32) (param $arr$2 i32) (param $arr$3 i32) (result i32)
  local.get $arr$0
  local.get $arr$1
  i32.add
  local.get $arr$2
  i32.add
  local.get $arr$3
  i32.add
  return
 )
 (func $interop/fixed-array-value-params/callWithLiteral (result i32)
  i32.const 10
  i32.const 20
  i32.const 30
  i32.const 40
  call $interop/fixed-array-value-params/sum
  return
 )
 (func $interop/fixed-array-value-params/callWithLocal (result i32)
  (local $arr$0 i32)
  (local $arr$1 i32)
  (local $arr$2 i32)
  (local $arr$3 i32)
  i32.const 1
  local.set $arr$0
  i32.const 2
  local.set $arr$1
  i32.const 3
  local.set $arr$2
  i32.const 4
  local.set $arr$3
  local.get $arr$0
  local.get $arr$1
  local.get $arr$2
  local.get $arr$3
  call $interop/fixed-array-value-params/sum
  return
 )
 (func $interop/fixed-array-value-params/at (param $arr$0 i32) (param $arr$1 i32) (param $arr$2 i32) (param $arr$3 i32) (param $i i32) (result i32)
  block $sroaSelOut_1 (result i32)
   block $sroaSel0_1
    block $sroaSel1_1
     block $sroaSel2_1
      block $sroaSel3_1
       local.get $i
       br_table $sroaSel0_1 $sroaSel1_1 $sroaSel2_1 $sroaSel3_1 $sroaSel3_1
      end
      local.get $arr$3
      br $sroaSelOut_1
     end
     local.get $arr$2
     br $sroaSelOut_1
    end
    local.get $arr$1
    br $sroaSelOut_1
   end
   local.get $arr$0
   br $sroaSelOut_1
  end
  return
 )
 (func $interop/fixed-array-value-params/callIndexed (result i32)
  (local $arr$0 i32)
  (local $arr$1 i32)
  (local $arr$2 i32)
  (local $arr$3 i32)
  i32.const 7
  local.set $arr$0
  i32.const 8
  local.set $arr$1
  i32.const 9
  local.set $arr$2
  i32.const 10
  local.set $arr$3
  local.get $arr$0
  local.get $arr$1
  local.get $arr$2
  local.get $arr$3
  i32.const 0
  call $interop/fixed-array-value-params/at
  i32.const 100
  i32.mul
  local.get $arr$0
  local.get $arr$1
  local.get $arr$2
  local.get $arr$3
  i32.const 3
  call $interop/fixed-array-value-params/at
  i32.add
  return
 )
 (func $interop/fixed-array-value-params/mutate (param $arr$0 i32) (param $arr$1 i32) (param $arr$2 i32) (param $arr$3 i32)
  i32.const 99
  local.set $arr$0
 )
 (func $interop/fixed-array-value-params/copyAtCall (result i32)
  (local $a$0 i32)
  (local $a$1 i32)
  (local $a$2 i32)
  (local $a$3 i32)
  i32.const 1
  local.set $a$0
  i32.const 2
  local.set $a$1
  i32.const 3
  local.set $a$2
  i32.const 4
  local.set $a$3
  local.get $a$0
  local.get $a$1
  local.get $a$2
  local.get $a$3
  call $interop/fixed-array-value-params/mutate
  local.get $a$0
  return
 )
 (func $interop/fixed-array-value-params/sumX (param $arr$0$x f64) (param $arr$0$y f64) (param $arr$1$x f64) (param $arr$1$y f64) (param $arr$2$x f64) (param $arr$2$y f64) (param $arr$3$x f64) (param $arr$3$y f64) (result f64)
  local.get $arr$0$x
  local.get $arr$1$x
  f64.add
  local.get $arr$2$x
  f64.add
  local.get $arr$3$x
  f64.add
  return
 )
 (func $interop/fixed-array-value-params/callRecord (result f64)
  (local $arr$0$x f64)
  (local $arr$0$y f64)
  (local $arr$1$x f64)
  (local $arr$1$y f64)
  (local $arr$2$x f64)
  (local $arr$2$y f64)
  (local $arr$3$x f64)
  (local $arr$3$y f64)
  f64.const 1.5
  local.set $arr$0$x
  f64.const 0
  local.set $arr$0$y
  f64.const 2.5
  local.set $arr$1$x
  f64.const 0
  local.set $arr$1$y
  f64.const 4
  local.set $arr$2$x
  f64.const 0
  local.set $arr$2$y
  f64.const 8
  local.set $arr$3$x
  f64.const 0
  local.set $arr$3$y
  local.get $arr$0$x
  local.get $arr$0$y
  local.get $arr$1$x
  local.get $arr$1$y
  local.get $arr$2$x
  local.get $arr$2$y
  local.get $arr$3$x
  local.get $arr$3$y
  call $interop/fixed-array-value-params/sumX
  return
 )
 (func $interop/fixed-array-value-params/dot (param $a$0 i32) (param $a$1 i32) (param $a$2 i32) (param $a$3 i32) (param $b$0 i32) (param $b$1 i32) (param $b$2 i32) (param $b$3 i32) (result i32)
  local.get $a$0
  local.get $b$0
  i32.mul
  local.get $a$1
  local.get $b$1
  i32.mul
  i32.add
  local.get $a$2
  local.get $b$2
  i32.mul
  i32.add
  local.get $a$3
  local.get $b$3
  i32.mul
  i32.add
  return
 )
 (func $interop/fixed-array-value-params/twoArrays (result i32)
  (local $a$0 i32)
  (local $a$1 i32)
  (local $a$2 i32)
  (local $a$3 i32)
  (local $b$0 i32)
  (local $b$1 i32)
  (local $b$2 i32)
  (local $b$3 i32)
  i32.const 1
  local.set $a$0
  i32.const 2
  local.set $a$1
  i32.const 3
  local.set $a$2
  i32.const 4
  local.set $a$3
  i32.const 10
  local.set $b$0
  i32.const 20
  local.set $b$1
  i32.const 30
  local.set $b$2
  i32.const 40
  local.set $b$3
  local.get $a$0
  local.get $a$1
  local.get $a$2
  local.get $a$3
  local.get $b$0
  local.get $b$1
  local.get $b$2
  local.get $b$3
  call $interop/fixed-array-value-params/dot
  return
 )
)
