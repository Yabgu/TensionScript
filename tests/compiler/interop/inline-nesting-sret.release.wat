(module
 (type $0 (func (result f32)))
 (type $1 (func (param i32 i32 i32 i32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (global $~sretStackPointer (mut i32) (i32.const 1024))
 (memory $0 1)
 (data $1 (i32.const 5132) "<")
 (data $1.1 (i32.const 5144) "\02\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00t\00l\00s\00f\00.\00t\00s")
 (data $2 (i32.const 5196) "<")
 (data $2.1 (i32.const 5208) "\02\00\00\00(\00\00\00A\00l\00l\00o\00c\00a\00t\00i\00o\00n\00 \00t\00o\00o\00 \00l\00a\00r\00g\00e")
 (data $3 (i32.const 5260) "\ac")
 (data $3.1 (i32.const 5272) "\02\00\00\00\9a\00\00\00s\00r\00e\00t\00 \00s\00t\00a\00c\00k\00 \00o\00v\00e\00r\00f\00l\00o\00w\00:\00 \00t\00h\00e\00 \00s\00t\00a\00t\00i\00c\00 \00c\00a\00l\00l\00-\00t\00e\00m\00p\00 \00r\00e\00g\00i\00o\00n\00 \00i\00s\00 \004\00 \00K\00B\00;\00 \00s\00e\00e\00 \00-\00-\00s\00r\00e\00t\00S\00t\00a\00c\00k\00S\00i\00z\00e")
 (data $4 (i32.const 5436) "L")
 (data $4.1 (i32.const 5448) "\02\00\00\00<\00\00\00i\00n\00t\00e\00r\00o\00p\00/\00i\00n\00l\00i\00n\00e\00-\00n\00e\00s\00t\00i\00n\00g\00-\00s\00r\00e\00t\00.\00t\00s")
 (export "read_flat" (func $interop/inline-nesting-sret/read_flat))
 (export "read_nested" (func $interop/inline-nesting-sret/read_nested))
 (export "read_zero" (func $interop/inline-nesting-sret/read_zero))
 (export "read_deep" (func $interop/inline-nesting-sret/read_deep))
 (export "use_roundtrip" (func $interop/inline-nesting-sret/use_roundtrip))
 (export "memory" (memory $0))
 (func $interop/inline-nesting-sret/use_roundtrip (result f32)
  (local $0 i32)
  (local $1 f32)
  (local $2 f32)
  (local $3 i32)
  global.get $~sretStackPointer
  local.tee $0
  i32.const 16
  i32.add
  local.tee $3
  global.set $~sretStackPointer
  local.get $3
  i32.const 5120
  i32.gt_s
  if
   i32.const 5280
   i32.const 5456
   i32.const 99
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 1
  i32.store
  local.get $0
  f32.const 2
  f32.store offset=4
  local.get $0
  f32.const 3
  f32.store offset=8
  local.get $0
  i32.load
  local.get $0
  f32.load offset=4
  local.set $1
  local.get $0
  f32.load offset=8
  local.set $2
  local.get $0
  global.set $~sretStackPointer
  f32.convert_i32_u
  local.get $1
  f32.add
  local.get $2
  f32.add
 )
 (func $interop/inline-nesting-sret/read_zero (result f32)
  (local $0 i32)
  (local $1 f32)
  (local $2 f32)
  (local $3 i32)
  global.get $~sretStackPointer
  local.tee $0
  i32.const 16
  i32.add
  local.tee $3
  global.set $~sretStackPointer
  local.get $3
  i32.const 5120
  i32.gt_s
  if
   i32.const 5280
   i32.const 5456
   i32.const 68
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 0
  i32.store
  local.get $0
  f32.const 0
  f32.store offset=4
  local.get $0
  f32.const 0
  f32.store offset=8
  local.get $0
  i32.load
  local.get $0
  f32.load offset=4
  local.set $1
  local.get $0
  f32.load offset=8
  local.set $2
  local.get $0
  global.set $~sretStackPointer
  f32.convert_i32_u
  local.get $1
  f32.add
  local.get $2
  f32.add
 )
 (func $interop/inline-nesting-sret/read_nested (result f32)
  (local $0 i32)
  (local $1 f32)
  (local $2 f32)
  (local $3 i32)
  global.get $~sretStackPointer
  local.tee $0
  i32.const 16
  i32.add
  local.tee $3
  global.set $~sretStackPointer
  local.get $3
  i32.const 5120
  i32.gt_s
  if
   i32.const 5280
   i32.const 5456
   i32.const 57
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 7
  i32.store
  local.get $0
  f32.const 1.5
  f32.store offset=4
  local.get $0
  f32.const 2.5
  f32.store offset=8
  local.get $0
  i32.load
  local.get $0
  f32.load offset=4
  local.set $1
  local.get $0
  f32.load offset=8
  local.set $2
  local.get $0
  global.set $~sretStackPointer
  f32.convert_i32_u
  local.get $1
  f32.add
  local.get $2
  f32.add
 )
 (func $interop/inline-nesting-sret/read_flat (result f32)
  (local $0 i32)
  (local $1 f32)
  (local $2 i32)
  global.get $~sretStackPointer
  local.tee $0
  i32.const 16
  i32.add
  local.tee $2
  global.set $~sretStackPointer
  local.get $2
  i32.const 5120
  i32.gt_s
  if
   i32.const 5280
   i32.const 5456
   i32.const 43
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 7
  i32.store
  local.get $0
  f32.const 1.5
  f32.store offset=4
  local.get $0
  i32.load
  local.get $0
  f32.load offset=4
  local.set $1
  local.get $0
  global.set $~sretStackPointer
  f32.convert_i32_u
  local.get $1
  f32.add
 )
 (func $interop/inline-nesting-sret/read_deep (result f32)
  (local $0 i32)
  (local $1 i32)
  (local $2 f32)
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
   i32.const 5280
   i32.const 5456
   i32.const 84
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  f32.const 3.140000104904175
  f32.store
  local.get $0
  f32.load
  local.get $0
  global.set $~sretStackPointer
 )
)
