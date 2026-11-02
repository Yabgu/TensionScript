(module
 (type $0 (func (result i32)))
 (type $1 (func))
 (type $2 (func (param i32) (result i32)))
 (type $3 (func (param i32 i32) (result i32)))
 (type $4 (func (result f64)))
 (global $~lib/memory/__data_end i32 (i32.const 8))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 32776))
 (global $~lib/memory/__heap_base i32 (i32.const 32776))
 (memory $0 0)
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "literal" (func $interop/fixed-array-value-local/literal))
 (export "literalLast" (func $interop/fixed-array-value-local/literalLast))
 (export "zeroed" (func $interop/fixed-array-value-local/zeroed))
 (export "writeConst" (func $interop/fixed-array-value-local/writeConst))
 (export "readRuntime" (func $interop/fixed-array-value-local/readRuntime))
 (export "twoRuntime" (func $interop/fixed-array-value-local/twoRuntime))
 (export "copyIndependence" (func $interop/fixed-array-value-local/copyIndependence))
 (export "assignIndependence" (func $interop/fixed-array-value-local/assignIndependence))
 (export "narrow" (func $interop/fixed-array-value-local/narrow))
 (export "wide" (func $interop/fixed-array-value-local/wide))
 (export "largeConstant" (func $interop/fixed-array-value-local/largeConstant))
 (export "memory" (memory $0))
 (start $~start)
 (func $start:interop/fixed-array-value-local
  i32.const 16
  i32.const 16
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
 )
 (func $interop/fixed-array-value-local/literal (result i32)
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
  local.get $arr$2
  i32.const 100
  i32.mul
  local.get $arr$0
  i32.add
  return
 )
 (func $interop/fixed-array-value-local/literalLast (result i32)
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
  local.get $arr$3
  return
 )
 (func $interop/fixed-array-value-local/zeroed (result i32)
  (local $arr$0 i32)
  (local $arr$1 i32)
  (local $arr$2 i32)
  (local $arr$3 i32)
  i32.const 5
  local.set $arr$1
  local.get $arr$0
  local.get $arr$1
  i32.add
  local.get $arr$2
  i32.add
  return
 )
 (func $interop/fixed-array-value-local/writeConst (result i32)
  (local $arr$0 i32)
  (local $arr$1 i32)
  (local $arr$2 i32)
  (local $arr$3 i32)
  i32.const 42
  local.set $arr$2
  i32.const 8
  local.set $arr$0
  local.get $arr$2
  local.get $arr$0
  i32.sub
  return
 )
 (func $interop/fixed-array-value-local/readRuntime (param $i i32) (result i32)
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
 (func $interop/fixed-array-value-local/twoRuntime (param $i i32) (param $j i32) (result i32)
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
  block $sroaSelOut_2 (result i32)
   block $sroaSel0_2
    block $sroaSel1_2
     block $sroaSel2_2
      block $sroaSel3_2
       local.get $i
       br_table $sroaSel0_2 $sroaSel1_2 $sroaSel2_2 $sroaSel3_2 $sroaSel3_2
      end
      local.get $arr$3
      br $sroaSelOut_2
     end
     local.get $arr$2
     br $sroaSelOut_2
    end
    local.get $arr$1
    br $sroaSelOut_2
   end
   local.get $arr$0
   br $sroaSelOut_2
  end
  block $sroaSelOut_3 (result i32)
   block $sroaSel0_3
    block $sroaSel1_3
     block $sroaSel2_3
      block $sroaSel3_3
       local.get $j
       br_table $sroaSel0_3 $sroaSel1_3 $sroaSel2_3 $sroaSel3_3 $sroaSel3_3
      end
      local.get $arr$3
      br $sroaSelOut_3
     end
     local.get $arr$2
     br $sroaSelOut_3
    end
    local.get $arr$1
    br $sroaSelOut_3
   end
   local.get $arr$0
   br $sroaSelOut_3
  end
  i32.add
  return
 )
 (func $interop/fixed-array-value-local/copyIndependence (result i32)
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
  local.get $a$0
  local.set $b$0
  local.get $a$1
  local.set $b$1
  local.get $a$2
  local.set $b$2
  local.get $a$3
  local.set $b$3
  i32.const 99
  local.set $b$0
  local.get $a$0
  i32.const 100
  i32.mul
  local.get $b$0
  i32.add
  return
 )
 (func $interop/fixed-array-value-local/assignIndependence (result i32)
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
  i32.const 0
  local.set $b$0
  i32.const 0
  local.set $b$1
  i32.const 0
  local.set $b$2
  i32.const 0
  local.set $b$3
  local.get $a$0
  local.set $b$0
  local.get $a$1
  local.set $b$1
  local.get $a$2
  local.set $b$2
  local.get $a$3
  local.set $b$3
  i32.const 77
  local.set $b$2
  local.get $a$2
  i32.const 100
  i32.mul
  local.get $b$2
  i32.add
  return
 )
 (func $interop/fixed-array-value-local/narrow (result i32)
  (local $arr$0 i32)
  (local $arr$1 i32)
  (local $arr$2 i32)
  (local $arr$3 i32)
  (local $arr$4 i32)
  (local $arr$5 i32)
  (local $arr$6 i32)
  (local $arr$7 i32)
  i32.const 1
  local.set $arr$0
  i32.const 2
  local.set $arr$1
  i32.const 3
  local.set $arr$2
  i32.const 4
  local.set $arr$3
  i32.const 5
  local.set $arr$4
  i32.const 6
  local.set $arr$5
  i32.const 7
  local.set $arr$6
  i32.const 8
  local.set $arr$7
  local.get $arr$7
  i32.const 255
  i32.and
  return
 )
 (func $interop/fixed-array-value-local/wide (result f64)
  (local $arr$0 f64)
  (local $arr$1 f64)
  f64.const 1.5
  local.set $arr$0
  f64.const 2.5
  local.set $arr$1
  local.get $arr$1
  return
 )
 (func $interop/fixed-array-value-local/largeConstant (result i32)
  (local $arr$0 i32)
  (local $arr$1 i32)
  (local $arr$2 i32)
  (local $arr$3 i32)
  (local $arr$4 i32)
  (local $arr$5 i32)
  (local $arr$6 i32)
  (local $arr$7 i32)
  (local $arr$8 i32)
  (local $arr$9 i32)
  (local $arr$10 i32)
  (local $arr$11 i32)
  (local $arr$12 i32)
  (local $arr$13 i32)
  (local $arr$14 i32)
  (local $arr$15 i32)
  i32.const 1
  local.set $arr$0
  i32.const 2
  local.set $arr$1
  i32.const 3
  local.set $arr$2
  i32.const 4
  local.set $arr$3
  i32.const 5
  local.set $arr$4
  i32.const 6
  local.set $arr$5
  i32.const 7
  local.set $arr$6
  i32.const 8
  local.set $arr$7
  i32.const 9
  local.set $arr$8
  i32.const 10
  local.set $arr$9
  i32.const 11
  local.set $arr$10
  i32.const 12
  local.set $arr$11
  i32.const 13
  local.set $arr$12
  i32.const 14
  local.set $arr$13
  i32.const 15
  local.set $arr$14
  i32.const 16
  local.set $arr$15
  local.get $arr$15
  return
 )
 (func $~start
  call $start:interop/fixed-array-value-local
 )
)
