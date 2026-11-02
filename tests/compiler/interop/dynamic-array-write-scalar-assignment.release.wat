(module
 (type $0 (func (param i32 i32 i32)))
 (type $1 (func (param i32 i32 i32 i32)))
 (type $2 (func (param i32 i32 i32) (result i32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (memory $0 1)
 (data $0 (i32.const 1036) "|")
 (data $0.1 (i32.const 1048) "\02\00\00\00h\00\00\00d\00y\00n\00a\00m\00i\00c\00 \00a\00r\00r\00a\00y\00 \00l\00e\00n\00g\00t\00h\00 \00e\00x\00c\00e\00e\00d\00s\00 \00i\003\002\00.\00M\00A\00X\00 \00(\002\00,\001\004\007\00,\004\008\003\00,\006\004\007\00)")
 (data $1 (i32.const 1164) "|")
 (data $1.1 (i32.const 1176) "\02\00\00\00`\00\00\00i\00n\00t\00e\00r\00o\00p\00/\00d\00y\00n\00a\00m\00i\00c\00-\00a\00r\00r\00a\00y\00-\00w\00r\00i\00t\00e\00-\00s\00c\00a\00l\00a\00r\00-\00a\00s\00s\00i\00g\00n\00m\00e\00n\00t\00.\00t\00s")
 (data $2 (i32.const 1292) "\\")
 (data $2.1 (i32.const 1304) "\02\00\00\00B\00\00\00d\00y\00n\00a\00m\00i\00c\00 \00a\00r\00r\00a\00y\00 \00i\00n\00d\00e\00x\00 \00o\00u\00t\00 \00o\00f\00 \00b\00o\00u\00n\00d\00s")
 (export "assignScalar" (func $interop/dynamic-array-write-scalar-assignment/assignScalar))
 (export "assignScalarAsValue" (func $interop/dynamic-array-write-scalar-assignment/assignScalarAsValue))
 (export "compoundScalar" (func $interop/dynamic-array-write-scalar-assignment/compoundScalar))
 (export "assignWidth1" (func $interop/dynamic-array-write-scalar-assignment/assignWidth1))
 (export "memory" (memory $0))
 (func $interop/dynamic-array-write-scalar-assignment/compoundScalar (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 22
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
  i32.const 1312
  i32.const 1184
  i32.const 23
  i32.const 3
  call $~lib/builtins/abort
  unreachable
 )
 (func $interop/dynamic-array-write-scalar-assignment/assignWidth1 (param $0 i32) (param $1 i32) (param $2 i32)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 29
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  local.get $0
  i32.load
  i32.ge_u
  if
   i32.const 1312
   i32.const 1184
   i32.const 30
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 4
  i32.add
  local.get $1
  i32.add
  local.get $2
  i32.store8
 )
 (func $interop/dynamic-array-write-scalar-assignment/assignScalarAsValue (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 17
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  local.get $0
  i32.load
  i32.ge_u
  if
   i32.const 1312
   i32.const 1184
   i32.const 18
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
 (func $interop/dynamic-array-write-scalar-assignment/assignScalar (param $0 i32) (param $1 i32) (param $2 i32)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 12
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  local.get $0
  i32.load
  i32.ge_u
  if
   i32.const 1312
   i32.const 1184
   i32.const 13
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
)
