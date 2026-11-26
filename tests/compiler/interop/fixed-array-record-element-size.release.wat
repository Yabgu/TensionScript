(module
 (type $0 (func (result i32)))
 (memory $0 0)
 (export "sizes" (func $interop/fixed-array-record-element-size/sizes))
 (export "memory" (memory $0))
 (func $interop/fixed-array-record-element-size/sizes (result i32)
  i32.const 144
 )
 ;; custom section "tension.stackful-backend", size 5, contents: "fiber"
 ;; custom section "tension.requires", size 39
)
