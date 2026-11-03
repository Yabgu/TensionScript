(module
 (type $0 (func (result f64)))
 (type $1 (func (result f64 f64 f64 f64 f64 f64 f64 f64)))
 (type $2 (func (param i32) (result f64)))
 (memory $0 0)
 (export "localConstant" (func $interop/fixed-array-record-literal-object/returnUnpacked))
 (export "localSecondField" (func $interop/fixed-array-record-literal-object/returnUnpackedLast))
 (export "localReorderedNames" (func $interop/fixed-array-record-literal-object/localReorderedNames))
 (export "localRuntimeIndex" (func $interop/fixed-array-record-literal-object/localRuntimeIndex))
 (export "localOmittedField" (func $interop/fixed-array-record-literal-object/localOmittedField))
 (export "localDuplicateName" (func $interop/fixed-array-record-literal-object/localDuplicateName))
 (export "argument" (func $interop/fixed-array-record-literal-object/argument))
 (export "make" (func $interop/fixed-array-record-literal-object/make))
 (export "returnUnpacked" (func $interop/fixed-array-record-literal-object/returnUnpacked))
 (export "returnUnpackedLast" (func $interop/fixed-array-record-literal-object/returnUnpackedLast))
 (export "memory" (memory $0))
 (func $interop/fixed-array-record-literal-object/returnUnpackedLast (result f64)
  f64.const 80.5
 )
 (func $interop/fixed-array-record-literal-object/returnUnpacked (result f64)
  f64.const 50.5
 )
 (func $interop/fixed-array-record-literal-object/make (result f64 f64 f64 f64 f64 f64 f64 f64)
  f64.const 10.5
  f64.const 20.5
  f64.const 30.5
  f64.const 40.5
  f64.const 50.5
  f64.const 60.5
  f64.const 70.5
  f64.const 80.5
  tuple.make 8
 )
 (func $interop/fixed-array-record-literal-object/localRuntimeIndex (param $0 i32) (result f64)
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
 (func $interop/fixed-array-record-literal-object/localReorderedNames (result f64)
  f64.const 12
 )
 (func $interop/fixed-array-record-literal-object/localOmittedField (result f64)
  f64.const 10.5
 )
 (func $interop/fixed-array-record-literal-object/localDuplicateName (result f64)
  f64.const 2
 )
 (func $interop/fixed-array-record-literal-object/argument (result f64)
  f64.const 10
 )
)
