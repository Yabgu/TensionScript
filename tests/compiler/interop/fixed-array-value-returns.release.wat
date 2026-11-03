(module
 (type $0 (func (result i32)))
 (type $1 (func (result f64)))
 (memory $0 0)
 (export "scalarReturn" (func $interop/fixed-array-value-returns/scalarReturn))
 (export "scalarReturnAll" (func $interop/fixed-array-value-returns/scalarReturnAll))
 (export "returnIsACopy" (func $interop/fixed-array-value-returns/returnIsACopy))
 (export "recordReturnX" (func $interop/fixed-array-value-returns/recordReturnX))
 (export "recordReturnLast" (func $interop/fixed-array-value-returns/recordReturnLast))
 (export "recordReturnSum" (func $interop/fixed-array-value-returns/recordReturnSum))
 (export "memory" (memory $0))
 (func $interop/fixed-array-value-returns/scalarReturnAll (result i32)
  i32.const 43210
 )
 (func $interop/fixed-array-value-returns/scalarReturn (result i32)
  i32.const 30
 )
 (func $interop/fixed-array-value-returns/returnIsACopy (result i32)
  i32.const 10
 )
 (func $interop/fixed-array-value-returns/recordReturnX (result f64)
  f64.const 50
 )
 (func $interop/fixed-array-value-returns/recordReturnSum (result f64)
  f64.const 81
 )
 (func $interop/fixed-array-value-returns/recordReturnLast (result f64)
  f64.const 8
 )
)
