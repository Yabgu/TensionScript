(module
 (type $0 (func (param i32 i32 i32)))
 (type $1 (func (param i32 i32 i32 i32)))
 (type $2 (func (param i32 i32 i32) (result i32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (global $~lib/memory/__data_end i32 (i32.const 364))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 33132))
 (global $~lib/memory/__heap_base i32 (i32.const 33132))
 (memory $0 1)
 (data $0 (i32.const 12) "|\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00h\00\00\00d\00y\00n\00a\00m\00i\00c\00 \00a\00r\00r\00a\00y\00 \00l\00e\00n\00g\00t\00h\00 \00e\00x\00c\00e\00e\00d\00s\00 \00i\003\002\00.\00M\00A\00X\00 \00(\002\00,\001\004\007\00,\004\008\003\00,\006\004\007\00)\00\00\00\00\00")
 (data $1 (i32.const 140) "|\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00`\00\00\00i\00n\00t\00e\00r\00o\00p\00/\00d\00y\00n\00a\00m\00i\00c\00-\00a\00r\00r\00a\00y\00-\00w\00r\00i\00t\00e\00-\00s\00c\00a\00l\00a\00r\00-\00a\00s\00s\00i\00g\00n\00m\00e\00n\00t\00.\00t\00s\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $2 (i32.const 268) "\\\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00B\00\00\00d\00y\00n\00a\00m\00i\00c\00 \00a\00r\00r\00a\00y\00 \00i\00n\00d\00e\00x\00 \00o\00u\00t\00 \00o\00f\00 \00b\00o\00u\00n\00d\00s\00\00\00\00\00\00\00\00\00\00\00")
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "assignScalar" (func $interop/dynamic-array-write-scalar-assignment/assignScalar))
 (export "assignScalarAsValue" (func $interop/dynamic-array-write-scalar-assignment/assignScalarAsValue))
 (export "compoundScalar" (func $interop/dynamic-array-write-scalar-assignment/compoundScalar))
 (export "assignWidth1" (func $interop/dynamic-array-write-scalar-assignment/assignWidth1))
 (export "memory" (memory $0))
 (func $interop/dynamic-array-write-scalar-assignment/assignScalar (param $p i32) (param $i i32) (param $v i32)
  (local $3 i32)
  (local $a i32)
  (local $n i32)
  local.get $p
  local.set $3
  local.get $3
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 12
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $3
  local.set $a
  local.get $a
  i32.load
  local.set $n
  local.get $i
  local.get $a
  i32.load
  i32.ge_u
  if
   i32.const 288
   i32.const 160
   i32.const 13
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $a
  i32.const 4
  i32.add
  local.get $i
  i32.const 4
  i32.mul
  i32.add
  local.get $v
  i32.store
 )
 (func $interop/dynamic-array-write-scalar-assignment/assignScalarAsValue (param $p i32) (param $i i32) (param $v i32) (result i32)
  (local $3 i32)
  (local $a i32)
  (local $n i32)
  (local $6 i32)
  local.get $p
  local.set $3
  local.get $3
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 17
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $3
  local.set $a
  local.get $a
  i32.load
  local.set $n
  local.get $i
  local.get $a
  i32.load
  i32.ge_u
  if
   i32.const 288
   i32.const 160
   i32.const 18
   i32.const 10
   call $~lib/builtins/abort
   unreachable
  end
  local.get $v
  local.set $6
  local.get $a
  i32.const 4
  i32.add
  local.get $i
  i32.const 4
  i32.mul
  i32.add
  local.get $6
  i32.store
  local.get $6
  return
 )
 (func $interop/dynamic-array-write-scalar-assignment/compoundScalar (param $p i32) (param $i i32) (param $v i32)
  (local $3 i32)
  (local $a i32)
  (local $n i32)
  local.get $p
  local.set $3
  local.get $3
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 22
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $3
  local.set $a
  local.get $a
  i32.load
  local.set $n
  local.get $i
  local.get $a
  i32.load
  i32.ge_u
  if
   i32.const 288
   i32.const 160
   i32.const 23
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $a
  i32.const 4
  i32.add
  local.get $i
  i32.const 4
  i32.mul
  i32.add
  local.get $i
  local.get $a
  i32.load
  i32.ge_u
  if
   i32.const 288
   i32.const 160
   i32.const 23
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $a
  i32.const 4
  i32.add
  local.get $i
  i32.const 4
  i32.mul
  i32.add
  i32.load
  local.get $v
  i32.add
  i32.store
 )
 (func $interop/dynamic-array-write-scalar-assignment/assignWidth1 (param $p i32) (param $i i32) (param $v i32)
  (local $3 i32)
  (local $a i32)
  (local $n i32)
  local.get $p
  local.set $3
  local.get $3
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 29
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $3
  local.set $a
  local.get $a
  i32.load
  local.set $n
  local.get $i
  local.get $a
  i32.load
  i32.ge_u
  if
   i32.const 288
   i32.const 160
   i32.const 30
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $a
  i32.const 4
  i32.add
  local.get $i
  i32.const 1
  i32.mul
  i32.add
  local.get $v
  i32.store8
 )
)
