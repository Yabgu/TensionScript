(module
 (type $0 (func (result f64)))
 (type $1 (func (param i32) (result f64)))
 (type $2 (func (param i32 f64) (result f64)))
 (global $~lib/memory/__data_end i32 (i32.const 8))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 32776))
 (global $~lib/memory/__heap_base i32 (i32.const 32776))
 (memory $0 0)
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "constant" (func $interop/fixed-array-record-element-local/constant))
 (export "constantSecondField" (func $interop/fixed-array-record-element-local/constantSecondField))
 (export "runtime" (func $interop/fixed-array-record-element-local/runtime))
 (export "runtimeWrite" (func $interop/fixed-array-record-element-local/runtimeWrite))
 (export "copyIndependence" (func $interop/fixed-array-record-element-local/copyIndependence))
 (export "bodyState" (func $interop/fixed-array-record-element-local/bodyState))
 (export "memory" (memory $0))
 (func $interop/fixed-array-record-element-local/constant (result f64)
  (local $arr$0$x f64)
  (local $arr$0$y f64)
  (local $arr$1$x f64)
  (local $arr$1$y f64)
  (local $arr$2$x f64)
  (local $arr$2$y f64)
  (local $arr$3$x f64)
  (local $arr$3$y f64)
  f64.const 10.5
  local.set $arr$0$x
  f64.const 20.5
  local.set $arr$0$y
  f64.const 30.5
  local.set $arr$1$x
  f64.const 40.5
  local.set $arr$1$y
  f64.const 50.5
  local.set $arr$2$x
  f64.const 60.5
  local.set $arr$2$y
  f64.const 70.5
  local.set $arr$3$x
  f64.const 80.5
  local.set $arr$3$y
  local.get $arr$2$x
  f64.const 1e3
  f64.mul
  local.get $arr$2$y
  f64.add
  return
 )
 (func $interop/fixed-array-record-element-local/constantSecondField (result f64)
  (local $arr$0$x f64)
  (local $arr$0$y f64)
  (local $arr$1$x f64)
  (local $arr$1$y f64)
  (local $arr$2$x f64)
  (local $arr$2$y f64)
  (local $arr$3$x f64)
  (local $arr$3$y f64)
  f64.const 30.5
  local.set $arr$1$x
  f64.const 40.5
  local.set $arr$1$y
  local.get $arr$1$y
  return
 )
 (func $interop/fixed-array-record-element-local/runtime (param $i i32) (result f64)
  (local $arr$0$x f64)
  (local $arr$0$y f64)
  (local $arr$1$x f64)
  (local $arr$1$y f64)
  (local $arr$2$x f64)
  (local $arr$2$y f64)
  (local $arr$3$x f64)
  (local $arr$3$y f64)
  f64.const 10.5
  local.set $arr$0$x
  f64.const 30.5
  local.set $arr$1$x
  f64.const 50.5
  local.set $arr$2$x
  f64.const 70.5
  local.set $arr$3$x
  block $sroaLeafOut_1 (result f64)
   block $sroaLeaf0_1
    block $sroaLeaf1_1
     block $sroaLeaf2_1
      block $sroaLeaf3_1
       local.get $i
       br_table $sroaLeaf0_1 $sroaLeaf1_1 $sroaLeaf2_1 $sroaLeaf3_1 $sroaLeaf3_1
      end
      local.get $arr$3$x
      br $sroaLeafOut_1
     end
     local.get $arr$2$x
     br $sroaLeafOut_1
    end
    local.get $arr$1$x
    br $sroaLeafOut_1
   end
   local.get $arr$0$x
   br $sroaLeafOut_1
  end
  return
 )
 (func $interop/fixed-array-record-element-local/runtimeWrite (param $i i32) (param $v f64) (result f64)
  (local $arr$0$x f64)
  (local $arr$0$y f64)
  (local $arr$1$x f64)
  (local $arr$1$y f64)
  (local $arr$2$x f64)
  (local $arr$2$y f64)
  (local $arr$3$x f64)
  (local $arr$3$y f64)
  (local $10 f64)
  block $sroaStoreOut_2
   local.get $v
   local.set $10
   block $sroaStore0_2
    block $sroaStore1_2
     block $sroaStore2_2
      block $sroaStore3_2
       local.get $i
       br_table $sroaStore0_2 $sroaStore1_2 $sroaStore2_2 $sroaStore3_2 $sroaStore3_2
      end
      local.get $10
      local.set $arr$3$x
      br $sroaStoreOut_2
     end
     local.get $10
     local.set $arr$2$x
     br $sroaStoreOut_2
    end
    local.get $10
    local.set $arr$1$x
    br $sroaStoreOut_2
   end
   local.get $10
   local.set $arr$0$x
  end
  block $sroaLeafOut_3 (result f64)
   block $sroaLeaf0_3
    block $sroaLeaf1_3
     block $sroaLeaf2_3
      block $sroaLeaf3_3
       local.get $i
       br_table $sroaLeaf0_3 $sroaLeaf1_3 $sroaLeaf2_3 $sroaLeaf3_3 $sroaLeaf3_3
      end
      local.get $arr$3$x
      br $sroaLeafOut_3
     end
     local.get $arr$2$x
     br $sroaLeafOut_3
    end
    local.get $arr$1$x
    br $sroaLeafOut_3
   end
   local.get $arr$0$x
   br $sroaLeafOut_3
  end
  return
 )
 (func $interop/fixed-array-record-element-local/copyIndependence (result f64)
  (local $a$0$x f64)
  (local $a$0$y f64)
  (local $a$1$x f64)
  (local $a$1$y f64)
  (local $a$2$x f64)
  (local $a$2$y f64)
  (local $a$3$x f64)
  (local $a$3$y f64)
  (local $b$0$x f64)
  (local $b$0$y f64)
  (local $b$1$x f64)
  (local $b$1$y f64)
  (local $b$2$x f64)
  (local $b$2$y f64)
  (local $b$3$x f64)
  (local $b$3$y f64)
  f64.const 10.5
  local.set $a$0$x
  f64.const 30.5
  local.set $a$1$x
  f64.const 50.5
  local.set $a$2$x
  f64.const 70.5
  local.set $a$3$x
  local.get $a$0$x
  local.set $b$0$x
  local.get $a$0$y
  local.set $b$0$y
  local.get $a$1$x
  local.set $b$1$x
  local.get $a$1$y
  local.set $b$1$y
  local.get $a$2$x
  local.set $b$2$x
  local.get $a$2$y
  local.set $b$2$y
  local.get $a$3$x
  local.set $b$3$x
  local.get $a$3$y
  local.set $b$3$y
  f64.const 99.5
  local.set $b$2$x
  local.get $a$2$x
  f64.const 1e3
  f64.mul
  local.get $b$2$x
  f64.add
  return
 )
 (func $interop/fixed-array-record-element-local/bodyState (result f64)
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
  local.get $arr$1$x
  return
 )
)
