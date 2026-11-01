(module
 (type $0 (func (param i32) (result i32)))
 (type $1 (func (result i32)))
 (memory $0 1)
 (data $0 (i32.const 1036) "<")
 (data $0.1 (i32.const 1048) "\02\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00t\00l\00s\00f\00.\00t\00s")
 (data $1 (i32.const 1100) "<")
 (data $1.1 (i32.const 1112) "\02\00\00\00(\00\00\00A\00l\00l\00o\00c\00a\00t\00i\00o\00n\00 \00t\00o\00o\00 \00l\00a\00r\00g\00e")
 (export "take" (func $interop/array-star-abi/take))
 (export "give" (func $interop/array-star-abi/give))
 (export "make" (func $interop/array-star-abi/make))
 (export "run" (func $interop/array-star-abi/run))
 (export "memory" (memory $0))
 (func $interop/array-star-abi/take (param $0 i32) (result i32)
  i32.const 0
 )
 (func $interop/array-star-abi/run (result i32)
  i32.const 1
 )
 (func $interop/array-star-abi/make (result i32)
  i32.const 0
 )
 (func $interop/array-star-abi/give (param $0 i32) (result i32)
  local.get $0
 )
)
