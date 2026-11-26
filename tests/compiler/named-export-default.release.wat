(module
 (type $0 (func (result i32)))
 (memory $0 0)
 (export "default" (func $named-export-default/get3))
 (export "memory" (memory $0))
 (func $named-export-default/get3 (result i32)
  i32.const 3
 )
 ;; custom section "tension.stackful-backend", size 5, contents: "fiber"
 ;; custom section "tension.requires", size 39
)
