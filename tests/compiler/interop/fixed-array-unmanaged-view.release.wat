(module
 (type $0 (func (param i32 i32) (result i32)))
 (type $1 (func (param i32 i32 i32)))
 (type $2 (func (param i32) (result i32)))
 (type $3 (func (param i32 i32 i64)))
 (type $4 (func (param i32 i32) (result i64)))
 (memory $0 0)
 (export "readU32" (func $interop/fixed-array-unmanaged-view/readViaParam))
 (export "readAt3" (func $interop/fixed-array-unmanaged-view/readAt3))
 (export "readU8" (func $interop/fixed-array-unmanaged-view/readU8))
 (export "readU64" (func $interop/fixed-array-unmanaged-view/readU64))
 (export "readI32" (func $interop/fixed-array-unmanaged-view/readI32))
 (export "readRecordX" (func $interop/fixed-array-unmanaged-view/readRecordX))
 (export "readRecordY" (func $interop/fixed-array-unmanaged-view/readRecordY))
 (export "writeU32" (func $interop/fixed-array-unmanaged-view/writeU32))
 (export "writeU64" (func $interop/fixed-array-unmanaged-view/writeU64))
 (export "writeRecordX" (func $interop/fixed-array-unmanaged-view/writeRecordX))
 (export "readViaParam" (func $interop/fixed-array-unmanaged-view/readViaParam))
 (export "passThrough" (func $interop/fixed-array-unmanaged-view/passThrough))
 (export "globalRead" (func $interop/fixed-array-unmanaged-view/globalRead))
 (export "fieldRead" (func $interop/fixed-array-unmanaged-view/fieldRead))
 (export "fieldWrite" (func $interop/fixed-array-unmanaged-view/fieldWrite))
 (export "memory" (memory $0))
 (func $interop/fixed-array-unmanaged-view/writeU64 (param $0 i32) (param $1 i32) (param $2 i64)
  local.get $0
  local.get $1
  i32.const 3
  i32.shl
  i32.add
  local.get $2
  i64.store
 )
 (func $interop/fixed-array-unmanaged-view/writeU32 (param $0 i32) (param $1 i32) (param $2 i32)
  local.get $0
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  local.get $2
  i32.store
 )
 (func $interop/fixed-array-unmanaged-view/writeRecordX (param $0 i32) (param $1 i32) (param $2 i32)
  local.get $0
  local.get $1
  i32.const 3
  i32.shl
  i32.add
  local.get $2
  i32.store
 )
 (func $interop/fixed-array-unmanaged-view/readViaParam (param $0 i32) (param $1 i32) (result i32)
  local.get $0
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  i32.load
 )
 (func $interop/fixed-array-unmanaged-view/readU8 (param $0 i32) (param $1 i32) (result i32)
  local.get $0
  local.get $1
  i32.add
  i32.load8_u
 )
 (func $interop/fixed-array-unmanaged-view/readU64 (param $0 i32) (param $1 i32) (result i64)
  local.get $0
  local.get $1
  i32.const 3
  i32.shl
  i32.add
  i64.load
 )
 (func $interop/fixed-array-unmanaged-view/readRecordY (param $0 i32) (param $1 i32) (result i32)
  local.get $0
  local.get $1
  i32.const 3
  i32.shl
  i32.add
  i32.load offset=4
 )
 (func $interop/fixed-array-unmanaged-view/readRecordX (param $0 i32) (param $1 i32) (result i32)
  local.get $0
  local.get $1
  i32.const 3
  i32.shl
  i32.add
  i32.load
 )
 (func $interop/fixed-array-unmanaged-view/readI32 (param $0 i32) (param $1 i32) (result i32)
  local.get $0
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  i32.load
 )
 (func $interop/fixed-array-unmanaged-view/readAt3 (param $0 i32) (result i32)
  local.get $0
  i32.load offset=12
 )
 (func $interop/fixed-array-unmanaged-view/passThrough (param $0 i32) (result i32)
  local.get $0
 )
 (func $interop/fixed-array-unmanaged-view/globalRead (param $0 i32) (result i32)
  local.get $0
  i32.const 2
  i32.shl
  i32.const 4096
  i32.add
  i32.load
 )
 (func $interop/fixed-array-unmanaged-view/fieldWrite (param $0 i32) (param $1 i32) (param $2 i32)
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
 (func $interop/fixed-array-unmanaged-view/fieldRead (param $0 i32) (param $1 i32) (result i32)
  local.get $0
  i32.const 4
  i32.add
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  i32.load
 )
)
