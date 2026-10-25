(module
 (type $0 (func (result f32)))
 (type $1 (func (param i32) (result f32)))
 (type $2 (func (param i32 i32 i32 i32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (import "env" "host_sum" (func $interop/inline-struct-external-param-reentrancy/host_sum (param i32) (result f32)))
 (import "env" "host_cb" (func $interop/inline-struct-external-param-reentrancy/host_cb (param i32) (result f32)))
 (global $~sretStackPointer (mut i32) (i32.const 1024))
 (memory $0 1)
 (data $1 (i32.const 5132) "\ac")
 (data $1.1 (i32.const 5144) "\02\00\00\00\9a\00\00\00s\00r\00e\00t\00 \00s\00t\00a\00c\00k\00 \00o\00v\00e\00r\00f\00l\00o\00w\00:\00 \00t\00h\00e\00 \00s\00t\00a\00t\00i\00c\00 \00c\00a\00l\00l\00-\00t\00e\00m\00p\00 \00r\00e\00g\00i\00o\00n\00 \00i\00s\00 \004\00 \00K\00B\00;\00 \00s\00e\00e\00 \00-\00-\00s\00r\00e\00t\00S\00t\00a\00c\00k\00S\00i\00z\00e")
 (data $2 (i32.const 5308) "|")
 (data $2.1 (i32.const 5320) "\02\00\00\00d\00\00\00i\00n\00t\00e\00r\00o\00p\00/\00i\00n\00l\00i\00n\00e\00-\00s\00t\00r\00u\00c\00t\00-\00e\00x\00t\00e\00r\00n\00a\00l\00-\00p\00a\00r\00a\00m\00-\00r\00e\00e\00n\00t\00r\00a\00n\00c\00y\00.\00t\00s")
 (export "callback" (func $interop/inline-struct-external-param-reentrancy/callback))
 (export "outer" (func $interop/inline-struct-external-param-reentrancy/outer))
 (export "memory" (memory $0))
 (func $interop/inline-struct-external-param-reentrancy/outer (result f32)
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
   i32.const 5152
   i32.const 5328
   i32.const 51
   i32.const 10
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 1024
  i32.add
  local.tee $2
  f32.const 1
  f32.store
  local.get $2
  f32.const 2
  f32.store offset=4
  local.get $2
  call $interop/inline-struct-external-param-reentrancy/host_cb
  local.get $0
  global.set $~sretStackPointer
 )
 (func $interop/inline-struct-external-param-reentrancy/callback (result f32)
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
   i32.const 5152
   i32.const 5328
   i32.const 44
   i32.const 10
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 1024
  i32.add
  local.tee $2
  f32.const 100
  f32.store
  local.get $2
  f32.const 1
  f32.store offset=4
  local.get $2
  call $interop/inline-struct-external-param-reentrancy/host_sum
  local.get $0
  global.set $~sretStackPointer
 )
)
