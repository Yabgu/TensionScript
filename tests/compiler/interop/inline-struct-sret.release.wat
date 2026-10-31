(module
 (type $0 (func (result i32)))
 (type $1 (func))
 (type $2 (func (param i32 i32 i32 i32)))
 (type $3 (func (param i32) (result i32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (global $interop/inline-struct-sret/callCount (mut i32) (i32.const 0))
 (global $~sretStackPointer (mut i32) (i32.const 1024))
 (memory $0 1)
 (data $1 (i32.const 5132) "\ac")
 (data $1.1 (i32.const 5144) "\02\00\00\00\9a\00\00\00s\00r\00e\00t\00 \00s\00t\00a\00c\00k\00 \00o\00v\00e\00r\00f\00l\00o\00w\00:\00 \00t\00h\00e\00 \00s\00t\00a\00t\00i\00c\00 \00c\00a\00l\00l\00-\00t\00e\00m\00p\00 \00r\00e\00g\00i\00o\00n\00 \00i\00s\00 \004\00 \00K\00B\00;\00 \00s\00e\00e\00 \00-\00-\00s\00r\00e\00t\00S\00t\00a\00c\00k\00S\00i\00z\00e")
 (data $2 (i32.const 5308) "L")
 (data $2.1 (i32.const 5320) "\02\00\00\00:\00\00\00i\00n\00t\00e\00r\00o\00p\00/\00i\00n\00l\00i\00n\00e\00-\00s\00t\00r\00u\00c\00t\00-\00s\00r\00e\00t\00.\00t\00s")
 (data $3 (i32.const 5388) "<")
 (data $3.1 (i32.const 5400) "\02\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00t\00l\00s\00f\00.\00t\00s")
 (data $4 (i32.const 5452) "<")
 (data $4.1 (i32.const 5464) "\02\00\00\00(\00\00\00A\00l\00l\00o\00c\00a\00t\00i\00o\00n\00 \00t\00o\00o\00 \00l\00a\00r\00g\00e")
 (export "run" (func $interop/inline-struct-sret/run))
 (export "memory" (memory $0))
 (start $~start)
 (func $interop/inline-struct-sret/readField (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
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
   i32.const 54
   i32.const 10
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  local.get $0
  i32.store
  local.get $1
  local.get $0
  i32.const 1
  i32.add
  i32.store offset=4
  local.get $1
  i32.load
  local.get $1
  global.set $~sretStackPointer
 )
 (func $interop/inline-struct-sret/discard (result i32)
  (local $0 i32)
  (local $1 i32)
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
   i32.const 66
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 10
  i32.store
  local.get $0
  i32.const 11
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
   i32.const 67
   i32.const 10
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 10
  i32.store
  local.get $0
  i32.const 11
  i32.store offset=4
  local.get $0
  i32.load offset=4
  local.get $0
  global.set $~sretStackPointer
 )
 (func $interop/inline-struct-sret/inferredCopy (result i32)
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
   i32.const 89
   i32.const 11
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 4
  i32.store
  local.get $0
  i32.const 5
  i32.store offset=4
  local.get $0
  i32.load
  local.get $0
  i32.load offset=4
  local.set $2
  local.get $0
  global.set $~sretStackPointer
  i32.const 10
  i32.mul
  local.get $2
  i32.add
 )
 (func $interop/inline-struct-sret/copyOut (result i32)
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
   i32.const 59
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 7
  i32.store
  local.get $0
  i32.const 8
  i32.store offset=4
  local.get $0
  i32.load
  local.get $0
  i32.load offset=4
  local.set $2
  local.get $0
  global.set $~sretStackPointer
  i32.const 100
  i32.mul
  local.get $2
  i32.add
 )
 (func $~start
  call $start:interop/inline-struct-sret
 )
 (func $start:interop/inline-struct-sret
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  i32.const 41
  call $interop/inline-struct-sret/readField
  i32.const 41
  i32.ne
  if
   i32.const 0
   i32.const 5328
   i32.const 129
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  i32.const 0
  call $interop/inline-struct-sret/readField
  if
   i32.const 0
   i32.const 5328
   i32.const 130
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  call $interop/inline-struct-sret/copyOut
  i32.const 708
  i32.ne
  if
   i32.const 0
   i32.const 5328
   i32.const 131
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  call $interop/inline-struct-sret/discard
  i32.const 11
  i32.ne
  if
   i32.const 0
   i32.const 5328
   i32.const 133
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  call $interop/inline-struct-sret/discard
  i32.const 11
  i32.ne
  if
   i32.const 0
   i32.const 5328
   i32.const 134
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
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
   i32.const 135
   i32.const 8
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 0
  i32.store
  local.get $0
  i32.const 0
  i32.store offset=4
  local.get $0
  i32.load
  local.get $0
  global.set $~sretStackPointer
  if
   i32.const 0
   i32.const 5328
   i32.const 135
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
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
   i32.const 136
   i32.const 8
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 0
  i32.store
  local.get $0
  i32.const 0
  i32.store offset=4
  local.get $0
  i32.load offset=4
  local.get $0
  global.set $~sretStackPointer
  if
   i32.const 0
   i32.const 5328
   i32.const 136
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  call $interop/inline-struct-sret/inferredCopy
  i32.const 45
  i32.ne
  if
   i32.const 0
   i32.const 5328
   i32.const 140
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  i32.const 0
  global.set $interop/inline-struct-sret/callCount
  global.get $~sretStackPointer
  local.tee $1
  i32.const 16
  i32.add
  local.tee $0
  global.set $~sretStackPointer
  local.get $0
  i32.const 5120
  i32.gt_s
  if
   i32.const 5152
   i32.const 5328
   i32.const 112
   i32.const 11
   call $~lib/builtins/abort
   unreachable
  end
  global.get $interop/inline-struct-sret/callCount
  i32.const 1
  i32.add
  global.set $interop/inline-struct-sret/callCount
  local.get $1
  i32.const 6
  i32.store
  local.get $1
  i32.const 7
  i32.store offset=4
  local.get $1
  i32.load
  local.set $0
  local.get $1
  i32.load offset=4
  local.set $2
  local.get $1
  global.set $~sretStackPointer
  global.get $interop/inline-struct-sret/callCount
  i32.const 1000
  i32.mul
  local.get $0
  i32.const 10
  i32.mul
  i32.add
  local.get $2
  i32.add
  i32.const 1067
  i32.ne
  if
   i32.const 0
   i32.const 5328
   i32.const 141
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
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
   i32.const 146
   i32.const 18
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 5
  i32.store
  local.get $0
  i32.const 6
  i32.store offset=4
  local.get $0
  i32.load offset=4
  local.get $0
  global.set $~sretStackPointer
  call $interop/inline-struct-sret/readField
  i32.const 6
  i32.ne
  if
   i32.const 0
   i32.const 5328
   i32.const 146
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
 )
 (func $interop/inline-struct-sret/run (result i32)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  i32.const 41
  call $interop/inline-struct-sret/readField
  call $interop/inline-struct-sret/copyOut
  i32.add
  call $interop/inline-struct-sret/discard
  i32.add
  local.set $0
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
   i32.const 121
   i32.const 12
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  i32.const 0
  i32.store
  local.get $1
  i32.const 0
  i32.store offset=4
  local.get $1
  i32.load
  local.set $2
  local.get $1
  global.set $~sretStackPointer
  global.get $~sretStackPointer
  local.tee $1
  i32.const 16
  i32.add
  local.tee $3
  global.set $~sretStackPointer
  local.get $3
  i32.const 5120
  i32.gt_s
  if
   i32.const 5152
   i32.const 5328
   i32.const 121
   i32.const 23
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  i32.const 0
  i32.store
  local.get $1
  i32.const 0
  i32.store offset=4
  local.get $1
  i32.load offset=4
  local.set $3
  local.get $1
  global.set $~sretStackPointer
  call $interop/inline-struct-sret/inferredCopy
  local.get $0
  local.get $2
  local.get $3
  i32.add
  i32.add
  i32.const 35
  i32.add
  i32.add
 )
)
