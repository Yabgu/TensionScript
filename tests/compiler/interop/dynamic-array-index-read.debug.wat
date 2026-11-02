(module
 (type $0 (func (param i32 i32) (result f64)))
 (type $1 (func (param i32) (result f64)))
 (type $2 (func))
 (type $3 (func (param i32 i32) (result i32)))
 (type $4 (func (param i32 i32 i32 i32)))
 (type $5 (func (result i32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (global $~lib/memory/__data_end i32 (i32.const 332))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 33100))
 (global $~lib/memory/__heap_base i32 (i32.const 33100))
 (memory $0 1)
 (data $0 (i32.const 12) "|\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00h\00\00\00d\00y\00n\00a\00m\00i\00c\00 \00a\00r\00r\00a\00y\00 \00l\00e\00n\00g\00t\00h\00 \00e\00x\00c\00e\00e\00d\00s\00 \00i\003\002\00.\00M\00A\00X\00 \00(\002\00,\001\004\007\00,\004\008\003\00,\006\004\007\00)\00\00\00\00\00")
 (data $1 (i32.const 140) "\\\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00F\00\00\00i\00n\00t\00e\00r\00o\00p\00/\00d\00y\00n\00a\00m\00i\00c\00-\00a\00r\00r\00a\00y\00-\00i\00n\00d\00e\00x\00-\00r\00e\00a\00d\00.\00t\00s\00\00\00\00\00\00\00")
 (data $2 (i32.const 236) "\\\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00B\00\00\00d\00y\00n\00a\00m\00i\00c\00 \00a\00r\00r\00a\00y\00 \00i\00n\00d\00e\00x\00 \00o\00u\00t\00 \00o\00f\00 \00b\00o\00u\00n\00d\00s\00\00\00\00\00\00\00\00\00\00\00")
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "readU32" (func $interop/dynamic-array-index-read/readU32))
 (export "readF64" (func $interop/dynamic-array-index-read/readF64))
 (export "readI8" (func $interop/dynamic-array-index-read/readI8))
 (export "readX" (func $interop/dynamic-array-index-read/readX))
 (export "readY" (func $interop/dynamic-array-index-read/readY))
 (export "viaLocal" (func $interop/dynamic-array-index-read/viaLocal))
 (export "sumX" (func $interop/dynamic-array-index-read/sumX))
 (export "run" (func $interop/dynamic-array-index-read/run))
 (export "memory" (memory $0))
 (start $~start)
 (func $start:interop/dynamic-array-index-read
  i32.const 16
  i32.const 16
  i32.eq
  drop
 )
 (func $interop/dynamic-array-index-read/readU32 (param $p i32) (param $i i32) (result i32)
  (local $2 i32)
  (local $a i32)
  (local $n i32)
  local.get $p
  local.set $2
  local.get $2
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 35
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $2
  local.set $a
  local.get $a
  i32.load
  local.set $n
  local.get $i
  local.get $a
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 36
   i32.const 10
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
  return
 )
 (func $interop/dynamic-array-index-read/readF64 (param $p i32) (param $i i32) (result f64)
  (local $2 i32)
  (local $a i32)
  (local $n i32)
  local.get $p
  local.set $2
  local.get $2
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 40
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $2
  local.set $a
  local.get $a
  i32.load
  local.set $n
  local.get $i
  local.get $a
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 41
   i32.const 10
   call $~lib/builtins/abort
   unreachable
  end
  local.get $a
  i32.const 8
  i32.add
  local.get $i
  i32.const 8
  i32.mul
  i32.add
  f64.load
  return
 )
 (func $interop/dynamic-array-index-read/readI8 (param $p i32) (param $i i32) (result i32)
  (local $2 i32)
  (local $a i32)
  (local $n i32)
  local.get $p
  local.set $2
  local.get $2
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 45
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $2
  local.set $a
  local.get $a
  i32.load
  local.set $n
  local.get $i
  local.get $a
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 46
   i32.const 10
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
  i32.load8_s
  return
 )
 (func $interop/dynamic-array-index-read/BodyState#get:x (param $this i32) (result f64)
  local.get $this
  f64.load
 )
 (func $interop/dynamic-array-index-read/readX (param $p i32) (param $i i32) (result f64)
  (local $2 i32)
  (local $y i32)
  (local $n i32)
  local.get $p
  local.set $2
  local.get $2
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 52
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $2
  local.set $y
  local.get $y
  i32.load
  local.set $n
  local.get $i
  local.get $y
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 53
   i32.const 10
   call $~lib/builtins/abort
   unreachable
  end
  local.get $y
  i32.const 8
  i32.add
  local.get $i
  i32.const 16
  i32.mul
  i32.add
  call $interop/dynamic-array-index-read/BodyState#get:x
  return
 )
 (func $interop/dynamic-array-index-read/BodyState#get:y (param $this i32) (result f64)
  local.get $this
  f64.load offset=8
 )
 (func $interop/dynamic-array-index-read/readY (param $p i32) (param $i i32) (result f64)
  (local $2 i32)
  (local $y i32)
  (local $n i32)
  local.get $p
  local.set $2
  local.get $2
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 57
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $2
  local.set $y
  local.get $y
  i32.load
  local.set $n
  local.get $i
  local.get $y
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 58
   i32.const 10
   call $~lib/builtins/abort
   unreachable
  end
  local.get $y
  i32.const 8
  i32.add
  local.get $i
  i32.const 16
  i32.mul
  i32.add
  call $interop/dynamic-array-index-read/BodyState#get:y
  return
 )
 (func $interop/dynamic-array-index-read/viaLocal (param $p i32) (param $i i32) (result f64)
  (local $2 i32)
  (local $y i32)
  (local $n i32)
  (local $b i32)
  local.get $p
  local.set $2
  local.get $2
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 64
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $2
  local.set $y
  local.get $y
  i32.load
  local.set $n
  local.get $i
  local.get $y
  i32.load
  i32.ge_u
  if
   i32.const 256
   i32.const 160
   i32.const 65
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $y
  i32.const 8
  i32.add
  local.get $i
  i32.const 16
  i32.mul
  i32.add
  local.set $b
  local.get $b
  call $interop/dynamic-array-index-read/BodyState#get:x
  return
 )
 (func $interop/dynamic-array-index-read/sumX (param $p i32) (result f64)
  (local $1 i32)
  (local $y i32)
  (local $n i32)
  (local $s f64)
  (local $i i32)
  local.get $p
  local.set $1
  local.get $1
  i32.load
  i32.const 0
  i32.lt_s
  if
   i32.const 32
   i32.const 160
   i32.const 71
   i32.const 13
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  local.set $y
  local.get $y
  i32.load
  local.set $n
  f64.const 0
  local.set $s
  i32.const 0
  local.set $i
  loop $for-loop|0
   local.get $i
   local.get $n
   i32.lt_s
   if
    local.get $s
    local.get $i
    local.get $y
    i32.load
    i32.ge_u
    if
     i32.const 256
     i32.const 160
     i32.const 74
     i32.const 13
     call $~lib/builtins/abort
     unreachable
    end
    local.get $y
    i32.const 8
    i32.add
    local.get $i
    i32.const 16
    i32.mul
    i32.add
    call $interop/dynamic-array-index-read/BodyState#get:x
    f64.add
    local.set $s
    local.get $i
    i32.const 1
    i32.add
    local.set $i
    br $for-loop|0
   end
  end
  local.get $s
  return
 )
 (func $interop/dynamic-array-index-read/run (result i32)
  i32.const 16
  i32.const 16
  i32.eq
  return
 )
 (func $~start
  call $start:interop/dynamic-array-index-read
 )
)
