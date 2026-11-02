(module
 (type $0 (func (result i32)))
 (type $1 (func (result f64)))
 (type $2 (func (param i32 i32) (result i32)))
 (type $3 (func (param i32) (result i32)))
 (memory $0 0)
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
 (func $interop/fixed-array-value-local/zeroed (result i32)
  i32.const 5
 )
 (func $interop/fixed-array-value-local/writeConst (result i32)
  i32.const 34
 )
 (func $interop/fixed-array-value-local/wide (result f64)
  f64.const 2.5
 )
 (func $interop/fixed-array-value-local/twoRuntime (param $0 i32) (param $1 i32) (result i32)
  block $sroaSelOut_2 (result i32)
   block $sroaSel0_2
    block $sroaSel1_2
     block $sroaSel2_2
      block $sroaSel3_2
       local.get $0
       br_table $sroaSel0_2 $sroaSel1_2 $sroaSel2_2 $sroaSel3_2
      end
      i32.const 40
      br $sroaSelOut_2
     end
     i32.const 30
     br $sroaSelOut_2
    end
    i32.const 20
    br $sroaSelOut_2
   end
   i32.const 10
  end
  local.set $0
  block $sroaSelOut_3 (result i32)
   block $sroaSel0_3
    block $sroaSel1_3
     block $sroaSel2_3
      block $sroaSel3_3
       local.get $1
       br_table $sroaSel0_3 $sroaSel1_3 $sroaSel2_3 $sroaSel3_3
      end
      i32.const 40
      br $sroaSelOut_3
     end
     i32.const 30
     br $sroaSelOut_3
    end
    i32.const 20
    br $sroaSelOut_3
   end
   i32.const 10
  end
  local.get $0
  i32.add
 )
 (func $interop/fixed-array-value-local/readRuntime (param $0 i32) (result i32)
  block $sroaSelOut_1 (result i32)
   block $sroaSel0_1
    block $sroaSel1_1
     block $sroaSel2_1
      block $sroaSel3_1
       local.get $0
       br_table $sroaSel0_1 $sroaSel1_1 $sroaSel2_1 $sroaSel3_1
      end
      i32.const 40
      br $sroaSelOut_1
     end
     i32.const 30
     br $sroaSelOut_1
    end
    i32.const 20
    br $sroaSelOut_1
   end
   i32.const 10
  end
 )
 (func $interop/fixed-array-value-local/narrow (result i32)
  i32.const 8
 )
 (func $interop/fixed-array-value-local/literalLast (result i32)
  i32.const 40
 )
 (func $interop/fixed-array-value-local/literal (result i32)
  i32.const 3010
 )
 (func $interop/fixed-array-value-local/largeConstant (result i32)
  i32.const 16
 )
 (func $interop/fixed-array-value-local/copyIndependence (result i32)
  i32.const 199
 )
 (func $interop/fixed-array-value-local/assignIndependence (result i32)
  i32.const 377
 )
)
