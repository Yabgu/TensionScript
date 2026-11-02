(module
 (type $0 (func (param i32 i32) (result f64)))
 (type $1 (func (param i32 i32) (result i32)))
 (type $2 (func (param i32) (result i32)))
 (memory $0 0)
 (export "readU32" (func $interop/array-star-index-read/readU32))
 (export "readF64" (func $interop/array-star-index-read/readF64))
 (export "readU32At2" (func $interop/array-star-index-read/readU32At2))
 (export "readX" (func $interop/array-star-index-read/viaLocal))
 (export "readY" (func $interop/array-star-index-read/readY))
 (export "viaLocal" (func $interop/array-star-index-read/viaLocal))
 (export "sum" (func $interop/array-star-index-read/sum))
 (export "sumX" (func $interop/array-star-index-read/sumX))
 (export "readI8" (func $interop/array-star-index-read/readI8))
 (export "readU16" (func $interop/array-star-index-read/readU16))
 (export "memory" (memory $0))
 (func $interop/array-star-index-read/viaLocal (param $0 i32) (param $1 i32) (result f64)
  local.get $0
  local.get $1
  i32.const 4
  i32.shl
  i32.add
  f64.load
 )
 (func $interop/array-star-index-read/sumX (param $0 i32) (param $1 i32) (result f64)
  (local $2 i32)
  (local $3 f64)
  loop $for-loop|0
   local.get $1
   local.get $2
   i32.gt_s
   if
    local.get $3
    local.get $0
    local.get $2
    i32.const 4
    i32.shl
    i32.add
    f64.load
    f64.add
    local.set $3
    local.get $2
    i32.const 1
    i32.add
    local.set $2
    br $for-loop|0
   end
  end
  local.get $3
 )
 (func $interop/array-star-index-read/sum (param $0 i32) (param $1 i32) (result f64)
  (local $2 i32)
  (local $3 f64)
  loop $for-loop|0
   local.get $1
   local.get $2
   i32.gt_s
   if
    local.get $3
    local.get $0
    local.get $2
    i32.const 3
    i32.shl
    i32.add
    f64.load
    f64.add
    local.set $3
    local.get $2
    i32.const 1
    i32.add
    local.set $2
    br $for-loop|0
   end
  end
  local.get $3
 )
 (func $interop/array-star-index-read/readY (param $0 i32) (param $1 i32) (result f64)
  local.get $0
  local.get $1
  i32.const 4
  i32.shl
  i32.add
  f64.load offset=8
 )
 (func $interop/array-star-index-read/readU32At2 (param $0 i32) (result i32)
  local.get $0
  i32.load offset=8
 )
 (func $interop/array-star-index-read/readU32 (param $0 i32) (param $1 i32) (result i32)
  local.get $0
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  i32.load
 )
 (func $interop/array-star-index-read/readU16 (param $0 i32) (param $1 i32) (result i32)
  local.get $0
  local.get $1
  i32.const 1
  i32.shl
  i32.add
  i32.load16_u
 )
 (func $interop/array-star-index-read/readI8 (param $0 i32) (param $1 i32) (result i32)
  local.get $0
  local.get $1
  i32.add
  i32.load8_s
 )
 (func $interop/array-star-index-read/readF64 (param $0 i32) (param $1 i32) (result f64)
  local.get $0
  local.get $1
  i32.const 3
  i32.shl
  i32.add
  f64.load
 )
)
