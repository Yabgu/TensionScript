class SameLine {
  alias: f32 @abi.alias("f");
  bare: i32 @custom;
  args: u8 @abi.alias("b", 1);
  many: f32 @abi.alias("m") @abi.transfer;
}
class NewLine {
  first: f32;
  @belongsToSecond
  second: i32;
}
@unmanaged
class Mixed {
  withAlias: u64 @abi.alias("aligned");
  @decoratedOnItsOwnLine
  plain: u32;
}
