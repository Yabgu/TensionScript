(module
 (type $0 (func (result i32)))
 (memory $0 0)
 (export "run" (func $interop/sizeof/run))
 (export "memory" (memory $0))
 (func $interop/sizeof/run (result i32)
  i32.const 80
 )
 ;; custom section "tension.stackful-backend", size 5, contents: "fiber"
 ;; custom section "tension.requires", size 39
)
