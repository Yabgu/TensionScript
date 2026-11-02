(module
 (type $0 (func (param i32 i32) (result f64)))
 (type $1 (func (param i32 i32) (result i32)))
 (type $2 (func))
 (type $3 (func (param i32) (result f64)))
 (type $4 (func (param i32) (result i32)))
 (global $~lib/memory/__data_end i32 (i32.const 8))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 32776))
 (global $~lib/memory/__heap_base i32 (i32.const 32776))
 (memory $0 0)
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "readU32" (func $interop/array-star-index-read/readU32))
 (export "readF64" (func $interop/array-star-index-read/readF64))
 (export "readU32At2" (func $interop/array-star-index-read/readU32At2))
 (export "readX" (func $interop/array-star-index-read/readX))
 (export "readY" (func $interop/array-star-index-read/readY))
 (export "viaLocal" (func $interop/array-star-index-read/viaLocal))
 (export "sum" (func $interop/array-star-index-read/sum))
 (export "sumX" (func $interop/array-star-index-read/sumX))
 (export "readI8" (func $interop/array-star-index-read/readI8))
 (export "readU16" (func $interop/array-star-index-read/readU16))
 (export "memory" (memory $0))
 (start $~start)
 (func $start:interop/array-star-index-read
  i32.const 16
  i32.const 16
  i32.eq
  drop
 )
 (func $interop/array-star-index-read/readU32 (param $p i32) (param $i i32) (result i32)
  (local $a i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 4
  i32.mul
  i32.add
  i32.load
  return
 )
 (func $interop/array-star-index-read/readF64 (param $p i32) (param $i i32) (result f64)
  (local $a i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 8
  i32.mul
  i32.add
  f64.load
  return
 )
 (func $interop/array-star-index-read/readU32At2 (param $p i32) (result i32)
  (local $a i32)
  local.get $p
  local.set $a
  local.get $a
  i32.const 2
  i32.const 4
  i32.mul
  i32.add
  i32.load
  return
 )
 (func $interop/array-star-index-read/BodyState#get:x (param $this i32) (result f64)
  local.get $this
  f64.load
 )
 (func $interop/array-star-index-read/readX (param $p i32) (param $i i32) (result f64)
  (local $y i32)
  local.get $p
  local.set $y
  local.get $y
  local.get $i
  i32.const 16
  i32.mul
  i32.add
  call $interop/array-star-index-read/BodyState#get:x
  return
 )
 (func $interop/array-star-index-read/BodyState#get:y (param $this i32) (result f64)
  local.get $this
  f64.load offset=8
 )
 (func $interop/array-star-index-read/readY (param $p i32) (param $i i32) (result f64)
  (local $y i32)
  local.get $p
  local.set $y
  local.get $y
  local.get $i
  i32.const 16
  i32.mul
  i32.add
  call $interop/array-star-index-read/BodyState#get:y
  return
 )
 (func $interop/array-star-index-read/viaLocal (param $p i32) (param $i i32) (result f64)
  (local $y i32)
  (local $b i32)
  local.get $p
  local.set $y
  local.get $y
  local.get $i
  i32.const 16
  i32.mul
  i32.add
  local.set $b
  local.get $b
  call $interop/array-star-index-read/BodyState#get:x
  return
 )
 (func $interop/array-star-index-read/sum (param $p i32) (param $n i32) (result f64)
  (local $a i32)
  (local $s f64)
  (local $i i32)
  local.get $p
  local.set $a
  f64.const 0
  local.set $s
  i32.const 0
  local.set $i
  loop $for-loop|0
   local.get $i
   local.get $n
   i32.lt_s
   if
    local.get $s
    local.get $a
    local.get $i
    i32.const 8
    i32.mul
    i32.add
    f64.load
    f64.add
    local.set $s
    local.get $i
    i32.const 1
    i32.add
    local.set $i
    br $for-loop|0
   end
  end
  local.get $s
  return
 )
 (func $interop/array-star-index-read/sumX (param $p i32) (param $n i32) (result f64)
  (local $y i32)
  (local $s f64)
  (local $i i32)
  local.get $p
  local.set $y
  f64.const 0
  local.set $s
  i32.const 0
  local.set $i
  loop $for-loop|0
   local.get $i
   local.get $n
   i32.lt_s
   if
    local.get $s
    local.get $y
    local.get $i
    i32.const 16
    i32.mul
    i32.add
    call $interop/array-star-index-read/BodyState#get:x
    f64.add
    local.set $s
    local.get $i
    i32.const 1
    i32.add
    local.set $i
    br $for-loop|0
   end
  end
  local.get $s
  return
 )
 (func $interop/array-star-index-read/readI8 (param $p i32) (param $i i32) (result i32)
  (local $a i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 1
  i32.mul
  i32.add
  i32.load8_s
  return
 )
 (func $interop/array-star-index-read/readU16 (param $p i32) (param $i i32) (result i32)
  (local $a i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 2
  i32.mul
  i32.add
  i32.load16_u
  return
 )
 (func $~start
  call $start:interop/array-star-index-read
 )
)
