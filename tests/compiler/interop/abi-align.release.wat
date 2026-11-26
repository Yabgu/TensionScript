(module
 (type $0 (func (result i32)))
 (memory $0 0)
 (export "run" (func $interop/abi-align/run))
 (export "memory" (memory $0))
 (func $interop/abi-align/run (result i32)
  i32.const 40
 )
 ;; custom section "tension.stackful-backend", size 5, contents: "fiber"
 ;; custom section "tension.requires", size 39
)
