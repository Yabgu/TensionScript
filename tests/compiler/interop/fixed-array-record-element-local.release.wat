(module
 (type $0 (func (result f64)))
 (type $1 (func (param i32 f64) (result f64)))
 (type $2 (func (param i32) (result f64)))
 (memory $0 0)
 (export "constant" (func $interop/fixed-array-record-element-local/constant))
 (export "constantSecondField" (func $interop/fixed-array-record-element-local/constantSecondField))
 (export "runtime" (func $interop/fixed-array-record-element-local/runtime))
 (export "runtimeWrite" (func $interop/fixed-array-record-element-local/runtimeWrite))
 (export "copyIndependence" (func $interop/fixed-array-record-element-local/copyIndependence))
 (export "bodyState" (func $interop/fixed-array-record-element-local/bodyState))
 (export "memory" (memory $0))
 (func $interop/fixed-array-record-element-local/runtimeWrite (param $0 i32) (param $1 f64) (result f64)
  (local $2 f64)
  (local $3 f64)
  (local $4 f64)
  (local $5 f64)
  block $sroaStoreOut_2
   block $sroaStore0_2
    block $sroaStore1_2
     block $sroaStore2_2
      block $sroaStore3_2
       local.get $0
       br_table $sroaStore0_2 $sroaStore1_2 $sroaStore2_2 $sroaStore3_2
      end
      local.get $1
      local.set $2
      br $sroaStoreOut_2
     end
     local.get $1
     local.set $3
     br $sroaStoreOut_2
    end
    local.get $1
    local.set $4
    br $sroaStoreOut_2
   end
   local.get $1
   local.set $5
  end
  block $sroaLeafOut_3 (result f64)
   block $sroaLeaf0_3
    block $sroaLeaf1_3
     block $sroaLeaf2_3
      block $sroaLeaf3_3
       local.get $0
       br_table $sroaLeaf0_3 $sroaLeaf1_3 $sroaLeaf2_3 $sroaLeaf3_3
      end
      local.get $2
      br $sroaLeafOut_3
     end
     local.get $3
     br $sroaLeafOut_3
    end
    local.get $4
    br $sroaLeafOut_3
   end
   local.get $5
  end
 )
 (func $interop/fixed-array-record-element-local/runtime (param $0 i32) (result f64)
  block $sroaLeafOut_1 (result f64)
   block $sroaLeaf0_1
    block $sroaLeaf1_1
     block $sroaLeaf2_1
      block $sroaLeaf3_1
       local.get $0
       br_table $sroaLeaf0_1 $sroaLeaf1_1 $sroaLeaf2_1 $sroaLeaf3_1
      end
      f64.const 70.5
      br $sroaLeafOut_1
     end
     f64.const 50.5
     br $sroaLeafOut_1
    end
    f64.const 30.5
    br $sroaLeafOut_1
   end
   f64.const 10.5
  end
 )
 (func $interop/fixed-array-record-element-local/copyIndependence (result f64)
  f64.const 50599.5
 )
 (func $interop/fixed-array-record-element-local/constantSecondField (result f64)
  f64.const 40.5
 )
 (func $interop/fixed-array-record-element-local/constant (result f64)
  f64.const 50560.5
 )
 (func $interop/fixed-array-record-element-local/bodyState (result f64)
  f64.const 30
 )
)
