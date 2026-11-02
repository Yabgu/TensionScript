(module
 (type $0 (func (param i32 i32 f64)))
 (type $1 (func (param i32 i32) (result i32)))
 (type $2 (func (param i32 i32 i32)))
 (type $3 (func (param i32 i32) (result f64)))
 (type $4 (func (result i32)))
 (type $5 (func (param i32 i32 i32) (result i32)))
 (memory $0 0)
 (export "writeU32" (func $interop/array-star-index-write/writeU32))
 (export "writeF64" (func $interop/array-star-index-write/writeF64))
 (export "writeU16" (func $interop/array-star-index-write/writeU16))
 (export "writeX" (func $interop/array-star-index-write/writeX))
 (export "writeY" (func $interop/array-star-index-write/writeY))
 (export "addU32" (func $interop/array-star-index-write/addU32))
 (export "addField" (func $interop/array-star-index-write/addField))
 (export "postInc" (func $interop/array-star-index-write/postInc))
 (export "preInc" (func $interop/array-star-index-write/preInc))
 (export "postDec" (func $interop/array-star-index-write/postDec))
 (export "preDec" (func $interop/array-star-index-write/preDec))
 (export "postFieldInc" (func $interop/array-star-index-write/postFieldInc))
 (export "preFieldInc" (func $interop/array-star-index-write/preFieldInc))
 (export "assignAsValue" (func $interop/array-star-index-write/assignAsValue))
 (export "run" (func $interop/array-star-index-write/run))
 (export "memory" (memory $0))
 (func $interop/array-star-index-write/writeY (param $0 i32) (param $1 i32) (param $2 f64)
  local.get $0
  local.get $1
  i32.const 4
  i32.shl
  i32.add
  local.get $2
  f64.store offset=8
 )
 (func $interop/array-star-index-write/writeX (param $0 i32) (param $1 i32) (param $2 f64)
  local.get $0
  local.get $1
  i32.const 4
  i32.shl
  i32.add
  local.get $2
  f64.store
 )
 (func $interop/array-star-index-write/writeU32 (param $0 i32) (param $1 i32) (param $2 i32)
  local.get $0
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  local.get $2
  i32.store
 )
 (func $interop/array-star-index-write/writeU16 (param $0 i32) (param $1 i32) (param $2 i32)
  local.get $0
  local.get $1
  i32.const 1
  i32.shl
  i32.add
  local.get $2
  i32.store16
 )
 (func $interop/array-star-index-write/writeF64 (param $0 i32) (param $1 i32) (param $2 f64)
  local.get $0
  local.get $1
  i32.const 3
  i32.shl
  i32.add
  local.get $2
  f64.store
 )
 (func $interop/array-star-index-write/run (result i32)
  i32.const 1
 )
 (func $interop/array-star-index-write/preInc (param $0 i32) (param $1 i32) (result i32)
  local.get $0
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  local.tee $0
  i32.load
  i32.const 1
  i32.add
  local.set $1
  local.get $0
  local.get $1
  i32.store
  local.get $1
 )
 (func $interop/array-star-index-write/preFieldInc (param $0 i32) (param $1 i32) (result f64)
  (local $2 f64)
  local.get $0
  local.get $1
  i32.const 4
  i32.shl
  i32.add
  local.tee $0
  f64.load offset=8
  f64.const 1
  f64.add
  local.set $2
  local.get $0
  local.get $2
  f64.store offset=8
  local.get $2
 )
 (func $interop/array-star-index-write/preDec (param $0 i32) (param $1 i32) (result i32)
  local.get $0
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  local.tee $0
  i32.load
  i32.const 1
  i32.sub
  local.set $1
  local.get $0
  local.get $1
  i32.store
  local.get $1
 )
 (func $interop/array-star-index-write/postInc (param $0 i32) (param $1 i32) (result i32)
  local.get $0
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  local.tee $0
  i32.load
  local.set $1
  local.get $0
  local.get $1
  i32.const 1
  i32.add
  i32.store
  local.get $1
 )
 (func $interop/array-star-index-write/postFieldInc (param $0 i32) (param $1 i32) (result f64)
  (local $2 f64)
  local.get $0
  local.get $1
  i32.const 4
  i32.shl
  i32.add
  local.tee $0
  f64.load offset=8
  local.set $2
  local.get $0
  local.get $2
  f64.const 1
  f64.add
  f64.store offset=8
  local.get $2
 )
 (func $interop/array-star-index-write/postDec (param $0 i32) (param $1 i32) (result i32)
  local.get $0
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  local.tee $0
  i32.load
  local.set $1
  local.get $0
  local.get $1
  i32.const 1
  i32.sub
  i32.store
  local.get $1
 )
 (func $interop/array-star-index-write/assignAsValue (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  local.get $0
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  local.get $2
  i32.store
  local.get $2
 )
 (func $interop/array-star-index-write/addU32 (param $0 i32) (param $1 i32) (param $2 i32)
  local.get $0
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  local.tee $0
  local.get $0
  i32.load
  local.get $2
  i32.add
  i32.store
 )
 (func $interop/array-star-index-write/addField (param $0 i32) (param $1 i32) (param $2 f64)
  local.get $0
  local.get $1
  i32.const 4
  i32.shl
  i32.add
  local.tee $0
  local.get $0
  f64.load offset=8
  local.get $2
  f64.add
  f64.store offset=8
 )
)
