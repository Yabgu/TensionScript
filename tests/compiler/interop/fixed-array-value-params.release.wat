(module
 (type $0 (func (result i32)))
 (type $1 (func (result f64)))
 (memory $0 0)
 (export "callWithLiteral" (func $interop/fixed-array-value-params/callWithLiteral))
 (export "callWithLocal" (func $interop/fixed-array-value-params/callWithLocal))
 (export "callIndexed" (func $interop/fixed-array-value-params/callIndexed))
 (export "copyAtCall" (func $interop/fixed-array-value-params/copyAtCall))
 (export "callRecord" (func $interop/fixed-array-value-params/callRecord))
 (export "twoArrays" (func $interop/fixed-array-value-params/twoArrays))
 (export "memory" (memory $0))
 (func $interop/fixed-array-value-params/twoArrays (result i32)
  i32.const 300
 )
 (func $interop/fixed-array-value-params/copyAtCall (result i32)
  i32.const 1
 )
 (func $interop/fixed-array-value-params/callWithLocal (result i32)
  i32.const 10
 )
 (func $interop/fixed-array-value-params/callWithLiteral (result i32)
  i32.const 100
 )
 (func $interop/fixed-array-value-params/callRecord (result f64)
  f64.const 16
 )
 (func $interop/fixed-array-value-params/callIndexed (result i32)
  i32.const 710
 )
)
