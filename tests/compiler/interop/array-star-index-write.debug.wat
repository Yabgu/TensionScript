(module
 (type $0 (func (param i32 i32 f64)))
 (type $1 (func (param i32 i32) (result i32)))
 (type $2 (func (param i32 i32 i32)))
 (type $3 (func))
 (type $4 (func (param i32 f64)))
 (type $5 (func (param i32 i32) (result f64)))
 (type $6 (func (param i32) (result f64)))
 (type $7 (func (param i32 i32 i32) (result i32)))
 (type $8 (func (result i32)))
 (global $~lib/memory/__data_end i32 (i32.const 8))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 32776))
 (global $~lib/memory/__heap_base i32 (i32.const 32776))
 (memory $0 0)
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
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
 (start $~start)
 (func $start:interop/array-star-index-write
  i32.const 16
  i32.const 16
  i32.eq
  drop
 )
 (func $interop/array-star-index-write/writeU32 (param $p i32) (param $i i32) (param $v i32)
  (local $a i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 4
  i32.mul
  i32.add
  local.get $v
  i32.store
 )
 (func $interop/array-star-index-write/writeF64 (param $p i32) (param $i i32) (param $v f64)
  (local $a i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 8
  i32.mul
  i32.add
  local.get $v
  f64.store
 )
 (func $interop/array-star-index-write/writeU16 (param $p i32) (param $i i32) (param $v i32)
  (local $a i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 2
  i32.mul
  i32.add
  local.get $v
  i32.store16
 )
 (func $interop/array-star-index-write/BodyState#set:x (param $this i32) (param $x f64)
  local.get $this
  local.get $x
  f64.store
 )
 (func $interop/array-star-index-write/writeX (param $p i32) (param $i i32) (param $v f64)
  (local $y i32)
  local.get $p
  local.set $y
  local.get $y
  local.get $i
  i32.const 16
  i32.mul
  i32.add
  local.get $v
  call $interop/array-star-index-write/BodyState#set:x
 )
 (func $interop/array-star-index-write/BodyState#set:y (param $this i32) (param $y f64)
  local.get $this
  local.get $y
  f64.store offset=8
 )
 (func $interop/array-star-index-write/writeY (param $p i32) (param $i i32) (param $v f64)
  (local $y i32)
  local.get $p
  local.set $y
  local.get $y
  local.get $i
  i32.const 16
  i32.mul
  i32.add
  local.get $v
  call $interop/array-star-index-write/BodyState#set:y
 )
 (func $interop/array-star-index-write/addU32 (param $p i32) (param $i i32) (param $v i32)
  (local $a i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 4
  i32.mul
  i32.add
  local.get $a
  local.get $i
  i32.const 4
  i32.mul
  i32.add
  i32.load
  local.get $v
  i32.add
  i32.store
 )
 (func $interop/array-star-index-write/BodyState#get:y (param $this i32) (result f64)
  local.get $this
  f64.load offset=8
 )
 (func $interop/array-star-index-write/addField (param $p i32) (param $i i32) (param $v f64)
  (local $y i32)
  local.get $p
  local.set $y
  local.get $y
  local.get $i
  i32.const 16
  i32.mul
  i32.add
  local.get $y
  local.get $i
  i32.const 16
  i32.mul
  i32.add
  call $interop/array-star-index-write/BodyState#get:y
  local.get $v
  f64.add
  call $interop/array-star-index-write/BodyState#set:y
 )
 (func $interop/array-star-index-write/postInc (param $p i32) (param $i i32) (result i32)
  (local $a i32)
  (local $3 i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 4
  i32.mul
  i32.add
  local.get $a
  local.get $i
  i32.const 4
  i32.mul
  i32.add
  i32.load
  local.tee $3
  i32.const 1
  i32.add
  i32.store
  local.get $3
  return
 )
 (func $interop/array-star-index-write/preInc (param $p i32) (param $i i32) (result i32)
  (local $a i32)
  (local $3 i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 4
  i32.mul
  i32.add
  i32.load
  i32.const 1
  i32.add
  local.set $3
  local.get $a
  local.get $i
  i32.const 4
  i32.mul
  i32.add
  local.get $3
  i32.store
  local.get $3
  return
 )
 (func $interop/array-star-index-write/postDec (param $p i32) (param $i i32) (result i32)
  (local $a i32)
  (local $3 i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 4
  i32.mul
  i32.add
  local.get $a
  local.get $i
  i32.const 4
  i32.mul
  i32.add
  i32.load
  local.tee $3
  i32.const 1
  i32.sub
  i32.store
  local.get $3
  return
 )
 (func $interop/array-star-index-write/preDec (param $p i32) (param $i i32) (result i32)
  (local $a i32)
  (local $3 i32)
  local.get $p
  local.set $a
  local.get $a
  local.get $i
  i32.const 4
  i32.mul
  i32.add
  i32.load
  i32.const 1
  i32.sub
  local.set $3
  local.get $a
  local.get $i
  i32.const 4
  i32.mul
  i32.add
  local.get $3
  i32.store
  local.get $3
  return
 )
 (func $interop/array-star-index-write/postFieldInc (param $p i32) (param $i i32) (result f64)
  (local $y i32)
  (local $3 f64)
  local.get $p
  local.set $y
  local.get $y
  local.get $i
  i32.const 16
  i32.mul
  i32.add
  local.get $y
  local.get $i
  i32.const 16
  i32.mul
  i32.add
  call $interop/array-star-index-write/BodyState#get:y
  local.tee $3
  f64.const 1
  f64.add
  call $interop/array-star-index-write/BodyState#set:y
  local.get $3
  return
 )
 (func $interop/array-star-index-write/preFieldInc (param $p i32) (param $i i32) (result f64)
  (local $y i32)
  (local $3 f64)
  local.get $p
  local.set $y
  local.get $y
  local.get $i
  i32.const 16
  i32.mul
  i32.add
  local.get $y
  local.get $i
  i32.const 16
  i32.mul
  i32.add
  call $interop/array-star-index-write/BodyState#get:y
  f64.const 1
  f64.add
  local.tee $3
  call $interop/array-star-index-write/BodyState#set:y
  local.get $3
  return
 )
 (func $interop/array-star-index-write/assignAsValue (param $p i32) (param $i i32) (param $v i32) (result i32)
  (local $a i32)
  (local $4 i32)
  local.get $p
  local.set $a
  local.get $v
  local.set $4
  local.get $a
  local.get $i
  i32.const 4
  i32.mul
  i32.add
  local.get $4
  i32.store
  local.get $4
  return
 )
 (func $interop/array-star-index-write/run (result i32)
  i32.const 16
  i32.const 16
  i32.eq
  return
 )
 (func $~start
  call $start:interop/array-star-index-write
 )
)
