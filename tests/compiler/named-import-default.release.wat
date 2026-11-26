(module
 (type $0 (func (result i32)))
 (memory $0 0)
 (export "getValue" (func $named-import-default/getValue))
 (export "memory" (memory $0))
 (func $named-import-default/getValue (result i32)
  i32.const 3
 )
 ;; custom section "tension.stackful-backend", size 5, contents: "fiber"
 ;; custom section "tension.requires", size 39
)
