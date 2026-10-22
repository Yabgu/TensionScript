// Post-type attributes: the token after a type decides where `@` attaches.
//
// Same line  -> the attribute belongs to the type it follows.
// New line   -> the type ended; the attribute belongs to the next declaration.
//
// The AST builder prints type attributes inline (`f32 @abi.alias("f")`), so this
// fixture is the attachment position made observable: anything after the type on
// its line is the type's, anything on its own line is the next member's.

class SameLine {
  alias: f32 @abi.alias("f");
  bare: i32 @custom;
  args: u8 @abi.alias("b", 1);
  many: f32 @abi.alias("m") @abi.transfer;
}

class NewLine {
  first: f32
  @belongsToSecond
  second: i32;
}

// The two readings side by side, which is the whole rule:
//   `sameLine.alias` carries one type attribute and no declaration decorator;
//   `newLine.second` carries none, and its declaration carries the decorator.
struct Mixed {
  withAlias: u64 @abi.alias("aligned");
  @decoratedOnItsOwnLine
  plain: u32;
}
