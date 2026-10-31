(module
 (type $0 (func (result i32)))
 (type $1 (func (param i32 i32 i32 i32)))
 (type $2 (func (param i32 i32 i32) (result i32)))
 (type $3 (func))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (global $~sretStackPointer (mut i32) (i32.const 1024))
 (memory $0 1)
 (data $1 (i32.const 5132) "\ac")
 (data $1.1 (i32.const 5144) "\02\00\00\00\9a\00\00\00s\00r\00e\00t\00 \00s\00t\00a\00c\00k\00 \00o\00v\00e\00r\00f\00l\00o\00w\00:\00 \00t\00h\00e\00 \00s\00t\00a\00t\00i\00c\00 \00c\00a\00l\00l\00-\00t\00e\00m\00p\00 \00r\00e\00g\00i\00o\00n\00 \00i\00s\00 \004\00 \00K\00B\00;\00 \00s\00e\00e\00 \00-\00-\00s\00r\00e\00t\00S\00t\00a\00c\00k\00S\00i\00z\00e")
 (data $2 (i32.const 5308) "\\")
 (data $2.1 (i32.const 5320) "\02\00\00\00L\00\00\00i\00n\00t\00e\00r\00o\00p\00/\00i\00n\00l\00i\00n\00e\00-\00s\00t\00r\00u\00c\00t\00-\00s\00r\00e\00t\00-\00c\00o\00m\00b\00i\00n\00e\00d\00.\00t\00s")
 (export "run" (func $interop/inline-struct-sret-combined/run))
 (export "memory" (memory $0))
 (start $~start)
 (func $interop/inline-struct-sret-combined/combined (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  (local $3 i32)
  (local $4 i32)
  global.get $~sretStackPointer
  local.tee $3
  i32.const 16
  i32.add
  local.tee $4
  global.set $~sretStackPointer
  local.get $4
  i32.const 5120
  i32.gt_s
  if
   i32.const 5152
   i32.const 5328
   i32.const 33
   i32.const 16
   call $~lib/builtins/abort
   unreachable
  end
  local.get $3
  local.get $0
  local.get $2
  i32.add
  i32.store
  local.get $3
  local.get $1
  i32.const 1
  i32.shl
  i32.store offset=4
  local.get $3
  i32.load
  local.get $3
  i32.load offset=4
  local.set $1
  local.get $3
  global.set $~sretStackPointer
  i32.const 1000
  i32.mul
  local.get $1
  i32.add
 )
 (func $interop/inline-struct-sret-combined/nested (result i32)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  global.get $~sretStackPointer
  local.tee $0
  i32.const 16
  i32.add
  local.tee $1
  global.set $~sretStackPointer
  local.get $1
  i32.const 5120
  i32.gt_s
  if
   i32.const 5152
   i32.const 5328
   i32.const 43
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 5
  i32.store
  local.get $0
  i32.const 8
  i32.store offset=4
  local.get $0
  global.set $~sretStackPointer
  global.get $~sretStackPointer
  local.tee $0
  i32.const 16
  i32.add
  local.tee $1
  global.set $~sretStackPointer
  local.get $1
  i32.const 5120
  i32.gt_s
  if
   i32.const 5152
   i32.const 5328
   i32.const 44
   i32.const 10
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 8
  i32.store
  local.get $0
  i32.const 8
  i32.store offset=4
  local.get $0
  i32.load
  local.set $1
  local.get $0
  global.set $~sretStackPointer
  i32.const 4
  i32.const 4
  i32.const 4
  call $interop/inline-struct-sret-combined/combined
  local.get $1
  i32.add
  global.get $~sretStackPointer
  local.tee $1
  i32.const 16
  i32.add
  local.tee $2
  global.set $~sretStackPointer
  local.get $2
  i32.const 5120
  i32.gt_s
  if
   i32.const 5152
   i32.const 5328
   i32.const 44
   i32.const 52
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  i32.const 8
  i32.store
  local.get $1
  i32.const 8
  i32.store offset=4
  local.get $1
  i32.load offset=4
  local.get $1
  global.set $~sretStackPointer
  i32.sub
 )
 (func $~start
  i32.const 2
  i32.const 3
  i32.const 10
  call $interop/inline-struct-sret-combined/combined
  i32.const 12006
  i32.ne
  if
   i32.const 0
   i32.const 5328
   i32.const 53
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  i32.const 0
  i32.const 0
  i32.const 0
  call $interop/inline-struct-sret-combined/combined
  if
   i32.const 0
   i32.const 5328
   i32.const 54
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  i32.const -1
  i32.const -2
  i32.const 1
  call $interop/inline-struct-sret-combined/combined
  i32.const -4
  i32.ne
  if
   i32.const 0
   i32.const 5328
   i32.const 55
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  call $interop/inline-struct-sret-combined/nested
  i32.const 8008
  i32.ne
  if
   i32.const 0
   i32.const 5328
   i32.const 57
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
 )
 (func $interop/inline-struct-sret-combined/run (result i32)
  i32.const 2
  i32.const 3
  i32.const 10
  call $interop/inline-struct-sret-combined/combined
  i32.const 0
  i32.const 0
  i32.const 0
  call $interop/inline-struct-sret-combined/combined
  i32.add
  call $interop/inline-struct-sret-combined/nested
  i32.add
 )
)
