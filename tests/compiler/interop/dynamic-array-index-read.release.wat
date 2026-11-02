(module
 (type $0 (func (param i32 i32) (result f64)))
 (type $1 (func (param i32 i32) (result i32)))
 (type $2 (func (param i32 i32 i32 i32)))
 (type $3 (func (param i32) (result f64)))
 (type $4 (func (result i32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (memory $0 1)
 (data $0 (i32.const 1036) "|")
 (data $0.1 (i32.const 1048) "\02\00\00\00h\00\00\00d\00y\00n\00a\00m\00i\00c\00 \00a\00r\00r\00a\00y\00 \00l\00e\00n\00g\00t\00h\00 \00e\00x\00c\00e\00e\00d\00s\00 \00i\003\002\00.\00M\00A\00X\00 \00(\002\00,\001\004\007\00,\004\008\003\00,\006\004\007\00)")
 (data $1 (i32.const 1164) "\\")
 (data $1.1 (i32.const 1176) "\02\00\00\00F\00\00\00i\00n\00t\00e\00r\00o\00p\00/\00d\00y\00n\00a\00m\00i\00c\00-\00a\00r\00r\00a\00y\00-\00i\00n\00d\00e\00x\00-\00r\00e\00a\00d\00.\00t\00s")
 (data $2 (i32.const 1260) "\\")
 (data $2.1 (i32.const 1272) "\02\00\00\00B\00\00\00d\00y\00n\00a\00m\00i\00c\00 \00a\00r\00r\00a\00y\00 \00i\00n\00d\00e\00x\00 \00o\00u\00t\00 \00o\00f\00 \00b\00o\00u\00n\00d\00s")
 (export "readU32" (func $interop/dynamic-array-index-read/readU32))
 (export "readF64" (func $interop/dynamic-array-index-read/readF64))
 (export "readI8" (func $interop/dynamic-array-index-read/readI8))
 (export "readX" (func $interop/dynamic-array-index-read/readX))
 (export "readY" (func $interop/dynamic-array-index-read/readY))
 (export "viaLocal" (func $interop/dynamic-array-index-read/viaLocal))
 (export "sumX" (func $interop/dynamic-array-index-read/sumX))
 (export "run" (func $interop/dynamic-array-index-read/run))
 (export "memory" (memory $0))
 (func $interop/dynamic-array-index-read/viaLocal (param $0 i32) (param $1 i32) (result f64)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 64
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.load
  local.get $1
  i32.le_u
  if
   i32.const 1280
   i32.const 1184
   i32.const 65
   i32.const 13
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
  f64.load
 )
 (func $interop/dynamic-array-index-read/sumX (param $0 i32) (result f64)
  (local $1 i32)
  (local $2 f64)
  (local $3 i32)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 71
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.load
  local.set $3
  loop $for-loop|0
   local.get $1
   local.get $3
   i32.lt_s
   if
    local.get $1
    local.get $0
    i32.load
    i32.ge_u
    if
     i32.const 1280
     i32.const 1184
     i32.const 74
     i32.const 13
     call $~lib/builtins/abort
     unreachable
    end
    local.get $2
    local.get $0
    i32.const 8
    i32.add
    local.get $1
    i32.const 4
    i32.shl
    i32.add
    f64.load
    f64.add
    local.set $2
    local.get $1
    i32.const 1
    i32.add
    local.set $1
    br $for-loop|0
   end
  end
  local.get $2
 )
 (func $interop/dynamic-array-index-read/run (result i32)
  i32.const 1
 )
 (func $interop/dynamic-array-index-read/readY (param $0 i32) (param $1 i32) (result f64)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 57
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.load
  local.get $1
  i32.le_u
  if
   i32.const 1280
   i32.const 1184
   i32.const 58
   i32.const 10
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
  f64.load offset=8
 )
 (func $interop/dynamic-array-index-read/readX (param $0 i32) (param $1 i32) (result f64)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 52
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.load
  local.get $1
  i32.le_u
  if
   i32.const 1280
   i32.const 1184
   i32.const 53
   i32.const 10
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
  f64.load
 )
 (func $interop/dynamic-array-index-read/readU32 (param $0 i32) (param $1 i32) (result i32)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 35
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.load
  local.get $1
  i32.le_u
  if
   i32.const 1280
   i32.const 1184
   i32.const 36
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
  i32.load
 )
 (func $interop/dynamic-array-index-read/readI8 (param $0 i32) (param $1 i32) (result i32)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 45
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.load
  local.get $1
  i32.le_u
  if
   i32.const 1280
   i32.const 1184
   i32.const 46
   i32.const 10
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.const 4
  i32.add
  local.get $1
  i32.add
  i32.load8_s
 )
 (func $interop/dynamic-array-index-read/readF64 (param $0 i32) (param $1 i32) (result f64)
  local.get $0
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 1056
   i32.const 1184
   i32.const 40
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  i32.load
  local.get $1
  i32.le_u
  if
   i32.const 1280
   i32.const 1184
   i32.const 41
   i32.const 10
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
  f64.load
 )
)
