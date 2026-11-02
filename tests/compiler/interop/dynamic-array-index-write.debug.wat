(module
 (type $0 (func (param i32 i32 f64)))
 (type $1 (func (param i32 i32) (result i32)))
 (type $2 (func (param i32 i32 i32)))
 (type $3 (func (param i32 f64)))
 (type $4 (func (param i32 i32 i32 i32)))
 (type $5 (func (param i32) (result f64)))
 (type $6 (func (param i32 i32 i32) (result i32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (global $~lib/memory/__data_end i32 (i32.const 332))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 33100))
 (global $~lib/memory/__heap_base i32 (i32.const 33100))
 (memory $0 1)
 (data $0 (i32.const 12) "|\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00h\00\00\00d\00y\00n\00a\00m\00i\00c\00 \00a\00r\00r\00a\00y\00 \00l\00e\00n\00g\00t\00h\00 \00e\00x\00c\00e\00e\00d\00s\00 \00i\003\002\00.\00M\00A\00X\00 \00(\002\00,\001\004\007\00,\004\008\003\00,\006\004\007\00)\00\00\00\00\00")
 (data $1 (i32.const 140) "\\\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00H\00\00\00i\00n\00t\00e\00r\00o\00p\00/\00d\00y\00n\00a\00m\00i\00c\00-\00a\00r\00r\00a\00y\00-\00i\00n\00d\00e\00x\00-\00w\00r\00i\00t\00e\00.\00t\00s\00\00\00\00\00")
 (data $2 (i32.const 236) "\\\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00B\00\00\00d\00y\00n\00a\00m\00i\00c\00 \00a\00r\00r\00a\00y\00 \00i\00n\00d\00e\00x\00 \00o\00u\00t\00 \00o\00f\00 \00b\00o\00u\00n\00d\00s\00\00\00\00\00\00\00\00\00\00\00")
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "writeU32" (func $interop/dynamic-array-index-write/writeU32))
 (export "writeF64" (func $interop/dynamic-array-index-write/writeF64))
 (export "writeX" (func $interop/dynamic-array-index-write/writeX))
 (export "writeY" (func $interop/dynamic-array-index-write/writeY))
 (export "addU32" (func $interop/dynamic-array-index-write/addU32))
 (export "addField" (func $interop/dynamic-array-index-write/addField))
 (export "postInc" (func $interop/dynamic-array-index-write/postInc))
 (export "preInc" (func $interop/dynamic-array-index-write/preInc))
 (export "postDec" (func $interop/dynamic-array-index-write/postDec))
 (export "preDec" (func $interop/dynamic-array-index-write/preDec))
 (export "assignAsValue" (func $interop/dynamic-array-index-write/assignAsValue))
 (export "memory" (memory $0))
 (func $interop/dynamic-array-index-write/writeU32 (param $p i32) (param $i i32) (param $v i32)
  (local $3 i32)
  (local $a i32)
  (local $n i32)
  (local $6 i32)
  (local $7 i32)
  local.get $p
  local.set $3
  local.get $3
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 25
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $3
  local.set $a
  local.get $a
  i32.load
  local.set $n
  local.get $a
  local.set $6
  local.get $i
  local.set $7
  local.get $7
  local.get $6
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 26
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $6
  i32.const 4
  i32.add
  local.get $7
  i32.const 4
  i32.mul
  i32.add
  local.get $v
  i32.store
 )
 (func $interop/dynamic-array-index-write/writeF64 (param $p i32) (param $i i32) (param $v f64)
  (local $3 i32)
  (local $a i32)
  (local $n i32)
  (local $6 i32)
  (local $7 i32)
  local.get $p
  local.set $3
  local.get $3
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 30
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $3
  local.set $a
  local.get $a
  i32.load
  local.set $n
  local.get $a
  local.set $6
  local.get $i
  local.set $7
  local.get $7
  local.get $6
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 31
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $6
  i32.const 8
  i32.add
  local.get $7
  i32.const 8
  i32.mul
  i32.add
  local.get $v
  f64.store
 )
 (func $interop/dynamic-array-index-write/BodyState#set:x (param $this i32) (param $x f64)
  local.get $this
  local.get $x
  f64.store
 )
 (func $interop/dynamic-array-index-write/writeX (param $p i32) (param $i i32) (param $v f64)
  (local $3 i32)
  (local $y i32)
  (local $n i32)
  (local $6 i32)
  (local $7 i32)
  local.get $p
  local.set $3
  local.get $3
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 37
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $3
  local.set $y
  local.get $y
  i32.load
  local.set $n
  local.get $y
  local.set $6
  local.get $i
  local.set $7
  local.get $7
  local.get $6
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 38
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $6
  i32.const 8
  i32.add
  local.get $7
  i32.const 16
  i32.mul
  i32.add
  local.get $v
  call $interop/dynamic-array-index-write/BodyState#set:x
 )
 (func $interop/dynamic-array-index-write/BodyState#set:y (param $this i32) (param $y f64)
  local.get $this
  local.get $y
  f64.store offset=8
 )
 (func $interop/dynamic-array-index-write/writeY (param $p i32) (param $i i32) (param $v f64)
  (local $3 i32)
  (local $y i32)
  (local $n i32)
  (local $6 i32)
  (local $7 i32)
  local.get $p
  local.set $3
  local.get $3
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 43
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $3
  local.set $y
  local.get $y
  i32.load
  local.set $n
  local.get $y
  local.set $6
  local.get $i
  local.set $7
  local.get $7
  local.get $6
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 44
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $6
  i32.const 8
  i32.add
  local.get $7
  i32.const 16
  i32.mul
  i32.add
  local.get $v
  call $interop/dynamic-array-index-write/BodyState#set:y
 )
 (func $interop/dynamic-array-index-write/addU32 (param $p i32) (param $i i32) (param $v i32)
  (local $3 i32)
  (local $a i32)
  (local $n i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  local.get $p
  local.set $3
  local.get $3
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 50
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $3
  local.set $a
  local.get $a
  i32.load
  local.set $n
  local.get $a
  local.set $8
  local.get $i
  local.set $9
  local.get $9
  local.get $8
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 51
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $8
  i32.const 4
  i32.add
  local.get $9
  i32.const 4
  i32.mul
  i32.add
  local.get $a
  local.set $6
  local.get $i
  local.set $7
  local.get $7
  local.get $6
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 51
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $6
  i32.const 4
  i32.add
  local.get $7
  i32.const 4
  i32.mul
  i32.add
  i32.load
  local.get $v
  i32.add
  i32.store
 )
 (func $interop/dynamic-array-index-write/BodyState#get:y (param $this i32) (result f64)
  local.get $this
  f64.load offset=8
 )
 (func $interop/dynamic-array-index-write/addField (param $p i32) (param $i i32) (param $v f64)
  (local $3 i32)
  (local $y i32)
  (local $n i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  local.get $p
  local.set $3
  local.get $3
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 55
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $3
  local.set $y
  local.get $y
  i32.load
  local.set $n
  local.get $y
  local.set $8
  local.get $i
  local.set $9
  local.get $9
  local.get $8
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 56
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $8
  i32.const 8
  i32.add
  local.get $9
  i32.const 16
  i32.mul
  i32.add
  local.get $y
  local.set $6
  local.get $i
  local.set $7
  local.get $7
  local.get $6
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 56
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $6
  i32.const 8
  i32.add
  local.get $7
  i32.const 16
  i32.mul
  i32.add
  call $interop/dynamic-array-index-write/BodyState#get:y
  local.get $v
  f64.add
  call $interop/dynamic-array-index-write/BodyState#set:y
 )
 (func $interop/dynamic-array-index-write/postInc (param $p i32) (param $i i32) (result i32)
  (local $2 i32)
  (local $a i32)
  (local $n i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  local.get $p
  local.set $2
  local.get $2
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 62
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $2
  local.set $a
  local.get $a
  i32.load
  local.set $n
  local.get $a
  local.set $8
  local.get $i
  local.set $9
  local.get $9
  local.get $8
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 63
   i32.const 10
   call $~lib/builtins/abort
   unreachable
  end
  local.get $8
  i32.const 4
  i32.add
  local.get $9
  i32.const 4
  i32.mul
  i32.add
  local.get $a
  local.set $5
  local.get $i
  local.set $6
  local.get $6
  local.get $5
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 63
   i32.const 10
   call $~lib/builtins/abort
   unreachable
  end
  local.get $5
  i32.const 4
  i32.add
  local.get $6
  i32.const 4
  i32.mul
  i32.add
  i32.load
  local.tee $7
  i32.const 1
  i32.add
  i32.store
  local.get $7
  return
 )
 (func $interop/dynamic-array-index-write/preInc (param $p i32) (param $i i32) (result i32)
  (local $2 i32)
  (local $a i32)
  (local $n i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  local.get $p
  local.set $2
  local.get $2
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 67
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $2
  local.set $a
  local.get $a
  i32.load
  local.set $n
  local.get $a
  local.set $7
  local.get $i
  local.set $8
  local.get $8
  local.get $7
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 68
   i32.const 12
   call $~lib/builtins/abort
   unreachable
  end
  local.get $a
  local.set $5
  local.get $i
  local.set $6
  local.get $6
  local.get $5
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 68
   i32.const 12
   call $~lib/builtins/abort
   unreachable
  end
  local.get $5
  i32.const 4
  i32.add
  local.get $6
  i32.const 4
  i32.mul
  i32.add
  i32.load
  i32.const 1
  i32.add
  local.set $9
  local.get $7
  i32.const 4
  i32.add
  local.get $8
  i32.const 4
  i32.mul
  i32.add
  local.get $9
  i32.store
  local.get $9
  return
 )
 (func $interop/dynamic-array-index-write/postDec (param $p i32) (param $i i32) (result i32)
  (local $2 i32)
  (local $a i32)
  (local $n i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  local.get $p
  local.set $2
  local.get $2
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 72
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $2
  local.set $a
  local.get $a
  i32.load
  local.set $n
  local.get $a
  local.set $8
  local.get $i
  local.set $9
  local.get $9
  local.get $8
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 73
   i32.const 10
   call $~lib/builtins/abort
   unreachable
  end
  local.get $8
  i32.const 4
  i32.add
  local.get $9
  i32.const 4
  i32.mul
  i32.add
  local.get $a
  local.set $5
  local.get $i
  local.set $6
  local.get $6
  local.get $5
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 73
   i32.const 10
   call $~lib/builtins/abort
   unreachable
  end
  local.get $5
  i32.const 4
  i32.add
  local.get $6
  i32.const 4
  i32.mul
  i32.add
  i32.load
  local.tee $7
  i32.const 1
  i32.sub
  i32.store
  local.get $7
  return
 )
 (func $interop/dynamic-array-index-write/preDec (param $p i32) (param $i i32) (result i32)
  (local $2 i32)
  (local $a i32)
  (local $n i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  local.get $p
  local.set $2
  local.get $2
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 77
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $2
  local.set $a
  local.get $a
  i32.load
  local.set $n
  local.get $a
  local.set $7
  local.get $i
  local.set $8
  local.get $8
  local.get $7
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 78
   i32.const 12
   call $~lib/builtins/abort
   unreachable
  end
  local.get $a
  local.set $5
  local.get $i
  local.set $6
  local.get $6
  local.get $5
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 78
   i32.const 12
   call $~lib/builtins/abort
   unreachable
  end
  local.get $5
  i32.const 4
  i32.add
  local.get $6
  i32.const 4
  i32.mul
  i32.add
  i32.load
  i32.const 1
  i32.sub
  local.set $9
  local.get $7
  i32.const 4
  i32.add
  local.get $8
  i32.const 4
  i32.mul
  i32.add
  local.get $9
  i32.store
  local.get $9
  return
 )
 (func $interop/dynamic-array-index-write/assignAsValue (param $p i32) (param $i i32) (param $v i32) (result i32)
  (local $3 i32)
  (local $a i32)
  (local $n i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  local.get $p
  local.set $3
  local.get $3
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 84
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $3
  local.set $a
  local.get $a
  i32.load
  local.set $n
  local.get $a
  local.set $6
  local.get $i
  local.set $7
  local.get $7
  local.get $6
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 85
   i32.const 10
   call $~lib/builtins/abort
   unreachable
  end
  local.get $v
  local.set $8
  local.get $6
  i32.const 4
  i32.add
  local.get $7
  i32.const 4
  i32.mul
  i32.add
  local.get $8
  i32.store
  local.get $8
  return
 )
)
