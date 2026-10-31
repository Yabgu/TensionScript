(module
 (type $0 (func (param i32) (result i32)))
 (memory $0 0)
 (export "through" (func $interop/view-param/through))
 (export "memory" (memory $0))
 (func $interop/view-param/through (param $0 i32) (result i32)
  local.get $0
  f32.load offset=8
  i32.trunc_sat_f32_u
  local.get $0
  i32.load
  local.get $0
  i32.load offset=4
  i32.add
  i32.add
 )
)
