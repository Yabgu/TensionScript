(module
 (type $0 (func (param i32 i32 f64)))
 (type $1 (func (param i32 i32) (result i32)))
 (type $2 (func (param i32 i32 i32)))
 (type $3 (func (param i32 i32 i32 i32)))
 (type $4 (func (param i32 i32 i32) (result i32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (memory $0 1)
 (data $0 (i32.const 1036) "|")
 (data $0.1 (i32.const 1048) "\02\00\00\00h\00\00\00d\00y\00n\00a\00m\00i\00c\00 \00a\00r\00r\00a\00y\00 \00l\00e\00n\00g\00t\00h\00 \00e\00x\00c\00e\00e\00d\00s\00 \00i\003\002\00.\00M\00A\00X\00 \00(\002\00,\001\004\007\00,\004\008\003\00,\006\004\007\00)")
 (data $1 (i32.const 1164) "\\")
 (data $1.1 (i32.const 1176) "\02\00\00\00H\00\00\00i\00n\00t\00e\00r\00o\00p\00/\00d\00y\00n\00a\00m\00i\00c\00-\00a\00r\00r\00a\00y\00-\00i\00n\00d\00e\00x\00-\00w\00r\00i\00t\00e\00.\00t\00s")
 (data $2 (i32.const 1260) "\\")
 (data $2.1 (i32.const 1272) "\02\00\00\00B\00\00\00d\00y\00n\00a\00m\00i\00c\00 \00a\00r\00r\00a\00y\00 \00i\00n\00d\00e\00x\00 \00o\00u\00t\00 \00o\00f\00 \00b\00o\00u\00n\00d\00s")
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
 (func $interop/dynamic-array-index-write/writeY (param $0 i32) (param $1 i32) (param $2 f64)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 43
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  local.get $0
  i32.load
  i32.ge_u
  if
   i32.const 1280
   i32.const 1184
   i32.const 44
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 8
  i32.add
  local.get $1
  i32.const 4
  i32.shl
  i32.add
  local.get $2
  f64.store offset=8
 )
 (func $interop/dynamic-array-index-write/writeX (param $0 i32) (param $1 i32) (param $2 f64)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 37
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  local.get $0
  i32.load
  i32.ge_u
  if
   i32.const 1280
   i32.const 1184
   i32.const 38
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 8
  i32.add
  local.get $1
  i32.const 4
  i32.shl
  i32.add
  local.get $2
  f64.store
 )
 (func $interop/dynamic-array-index-write/writeU32 (param $0 i32) (param $1 i32) (param $2 i32)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 25
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  local.get $0
  i32.load
  i32.ge_u
  if
   i32.const 1280
   i32.const 1184
   i32.const 26
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 4
  i32.add
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  local.get $2
  i32.store
 )
 (func $interop/dynamic-array-index-write/writeF64 (param $0 i32) (param $1 i32) (param $2 f64)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 30
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  local.get $0
  i32.load
  i32.ge_u
  if
   i32.const 1280
   i32.const 1184
   i32.const 31
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 8
  i32.add
  local.get $1
  i32.const 3
  i32.shl
  i32.add
  local.get $2
  f64.store
 )
 (func $interop/dynamic-array-index-write/preInc (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 67
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  block $folding-inner0
   local.get $1
   local.get $0
   i32.load
   i32.ge_u
   local.tee $2
   br_if $folding-inner0
   local.get $2
   br_if $folding-inner0
   local.get $0
   i32.const 4
   i32.add
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
   return
  end
  i32.const 1280
  i32.const 1184
  i32.const 68
  i32.const 12
  call $~lib/builtins/abort
  unreachable
 )
 (func $interop/dynamic-array-index-write/preDec (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 77
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  block $folding-inner0
   local.get $1
   local.get $0
   i32.load
   i32.ge_u
   local.tee $2
   br_if $folding-inner0
   local.get $2
   br_if $folding-inner0
   local.get $0
   i32.const 4
   i32.add
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
   return
  end
  i32.const 1280
  i32.const 1184
  i32.const 78
  i32.const 12
  call $~lib/builtins/abort
  unreachable
 )
 (func $interop/dynamic-array-index-write/postInc (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 62
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  block $folding-inner0
   local.get $1
   local.get $0
   i32.load
   i32.ge_u
   local.tee $2
   br_if $folding-inner0
   local.get $2
   br_if $folding-inner0
   local.get $0
   i32.const 4
   i32.add
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
   return
  end
  i32.const 1280
  i32.const 1184
  i32.const 63
  i32.const 10
  call $~lib/builtins/abort
  unreachable
 )
 (func $interop/dynamic-array-index-write/postDec (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 72
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  block $folding-inner0
   local.get $1
   local.get $0
   i32.load
   i32.ge_u
   local.tee $2
   br_if $folding-inner0
   local.get $2
   br_if $folding-inner0
   local.get $0
   i32.const 4
   i32.add
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
   return
  end
  i32.const 1280
  i32.const 1184
  i32.const 73
  i32.const 10
  call $~lib/builtins/abort
  unreachable
 )
 (func $interop/dynamic-array-index-write/assignAsValue (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 84
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  local.get $0
  i32.load
  i32.ge_u
  if
   i32.const 1280
   i32.const 1184
   i32.const 85
   i32.const 10
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 4
  i32.add
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  local.get $2
  i32.store
  local.get $2
 )
 (func $interop/dynamic-array-index-write/addU32 (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 50
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  block $folding-inner0
   local.get $1
   local.get $0
   i32.load
   i32.ge_u
   local.tee $3
   br_if $folding-inner0
   local.get $3
   br_if $folding-inner0
   local.get $0
   i32.const 4
   i32.add
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
   return
  end
  i32.const 1280
  i32.const 1184
  i32.const 51
  i32.const 3
  call $~lib/builtins/abort
  unreachable
 )
 (func $interop/dynamic-array-index-write/addField (param $0 i32) (param $1 i32) (param $2 f64)
  (local $3 i32)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 55
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  block $folding-inner0
   local.get $1
   local.get $0
   i32.load
   i32.ge_u
   local.tee $3
   br_if $folding-inner0
   local.get $3
   br_if $folding-inner0
   local.get $0
   i32.const 8
   i32.add
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
   return
  end
  i32.const 1280
  i32.const 1184
  i32.const 56
  i32.const 3
  call $~lib/builtins/abort
  unreachable
 )
)
