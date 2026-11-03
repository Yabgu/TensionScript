(module
 (type $0 (func (result f64)))
 (type $1 (func (param i32) (result f64)))
 (type $2 (func (param f64 f64 f64 f64 f64 f64 f64 f64) (result f64)))
 (type $3 (func (result f64 f64 f64 f64 f64 f64 f64 f64)))
 (global $~lib/memory/__data_end i32 (i32.const 8))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 32776))
 (global $~lib/memory/__heap_base i32 (i32.const 32776))
 (memory $0 0)
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "localConstant" (func $interop/fixed-array-record-literal-object/localConstant))
 (export "localSecondField" (func $interop/fixed-array-record-literal-object/localSecondField))
 (export "localReorderedNames" (func $interop/fixed-array-record-literal-object/localReorderedNames))
 (export "localRuntimeIndex" (func $interop/fixed-array-record-literal-object/localRuntimeIndex))
 (export "localOmittedField" (func $interop/fixed-array-record-literal-object/localOmittedField))
 (export "localDuplicateName" (func $interop/fixed-array-record-literal-object/localDuplicateName))
 (export "argument" (func $interop/fixed-array-record-literal-object/argument))
 (export "make" (func $interop/fixed-array-record-literal-object/make))
 (export "returnUnpacked" (func $interop/fixed-array-record-literal-object/returnUnpacked))
 (export "returnUnpackedLast" (func $interop/fixed-array-record-literal-object/returnUnpackedLast))
 (export "memory" (memory $0))
 (func $interop/fixed-array-record-literal-object/localConstant (result f64)
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
  return
 )
 (func $interop/fixed-array-record-literal-object/localSecondField (result f64)
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
  local.get $arr$3$y
  return
 )
 (func $interop/fixed-array-record-literal-object/localReorderedNames (result f64)
  (local $arr$0$x f64)
  (local $arr$0$y f64)
  f64.const 1
  local.set $arr$0$x
  f64.const 2
  local.set $arr$0$y
  local.get $arr$0$x
  f64.const 10
  f64.mul
  local.get $arr$0$y
  f64.add
  return
 )
 (func $interop/fixed-array-record-literal-object/localRuntimeIndex (param $i i32) (result f64)
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
  f64.const 0
  local.set $arr$0$y
  f64.const 30.5
  local.set $arr$1$x
  f64.const 0
  local.set $arr$1$y
  f64.const 50.5
  local.set $arr$2$x
  f64.const 0
  local.set $arr$2$y
  f64.const 70.5
  local.set $arr$3$x
  f64.const 0
  local.set $arr$3$y
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
 (func $interop/fixed-array-record-literal-object/localOmittedField (result f64)
  (local $arr$0$x f64)
  (local $arr$0$y f64)
  (local $arr$1$x f64)
  (local $arr$1$y f64)
  f64.const 10.5
  local.set $arr$0$x
  f64.const 0
  local.set $arr$0$y
  f64.const 30.5
  local.set $arr$1$x
  f64.const 40.5
  local.set $arr$1$y
  local.get $arr$0$x
  local.get $arr$0$y
  f64.const 1e3
  f64.mul
  f64.add
  return
 )
 (func $interop/fixed-array-record-literal-object/localDuplicateName (result f64)
  (local $arr$0$x f64)
  (local $arr$0$y f64)
  f64.const 2
  local.set $arr$0$x
  f64.const 0
  local.set $arr$0$y
  local.get $arr$0$x
  return
 )
 (func $interop/fixed-array-record-literal-object/sumX (param $arr$0$x f64) (param $arr$0$y f64) (param $arr$1$x f64) (param $arr$1$y f64) (param $arr$2$x f64) (param $arr$2$y f64) (param $arr$3$x f64) (param $arr$3$y f64) (result f64)
  local.get $arr$0$x
  local.get $arr$1$x
  f64.add
  local.get $arr$2$x
  f64.add
  local.get $arr$3$x
  f64.add
  return
 )
 (func $interop/fixed-array-record-literal-object/argument (result f64)
  f64.const 1
  f64.const 0
  f64.const 2
  f64.const 0
  f64.const 3
  f64.const 0
  f64.const 4
  f64.const 0
  call $interop/fixed-array-record-literal-object/sumX
  return
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
  return
 )
 (func $interop/fixed-array-record-literal-object/returnUnpacked (result f64)
  (local $arr$0$x f64)
  (local $arr$0$y f64)
  (local $arr$1$x f64)
  (local $arr$1$y f64)
  (local $arr$2$x f64)
  (local $arr$2$y f64)
  (local $arr$3$x f64)
  (local $arr$3$y f64)
  (local $8 (tuple f64 f64 f64 f64 f64 f64 f64 f64))
  call $interop/fixed-array-record-literal-object/make
  local.set $8
  local.get $8
  tuple.extract 8 0
  local.set $arr$0$x
  local.get $8
  tuple.extract 8 1
  local.set $arr$0$y
  local.get $8
  tuple.extract 8 2
  local.set $arr$1$x
  local.get $8
  tuple.extract 8 3
  local.set $arr$1$y
  local.get $8
  tuple.extract 8 4
  local.set $arr$2$x
  local.get $8
  tuple.extract 8 5
  local.set $arr$2$y
  local.get $8
  tuple.extract 8 6
  local.set $arr$3$x
  local.get $8
  tuple.extract 8 7
  local.set $arr$3$y
  local.get $arr$2$x
  return
 )
 (func $interop/fixed-array-record-literal-object/returnUnpackedLast (result f64)
  (local $arr$0$x f64)
  (local $arr$0$y f64)
  (local $arr$1$x f64)
  (local $arr$1$y f64)
  (local $arr$2$x f64)
  (local $arr$2$y f64)
  (local $arr$3$x f64)
  (local $arr$3$y f64)
  (local $8 (tuple f64 f64 f64 f64 f64 f64 f64 f64))
  call $interop/fixed-array-record-literal-object/make
  local.set $8
  local.get $8
  tuple.extract 8 0
  local.set $arr$0$x
  local.get $8
  tuple.extract 8 1
  local.set $arr$0$y
  local.get $8
  tuple.extract 8 2
  local.set $arr$1$x
  local.get $8
  tuple.extract 8 3
  local.set $arr$1$y
  local.get $8
  tuple.extract 8 4
  local.set $arr$2$x
  local.get $8
  tuple.extract 8 5
  local.set $arr$2$y
  local.get $8
  tuple.extract 8 6
  local.set $arr$3$x
  local.get $8
  tuple.extract 8 7
  local.set $arr$3$y
  local.get $arr$3$y
  return
 )
)
