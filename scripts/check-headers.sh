#!/usr/bin/env bash
# Compile-check the published C ABI headers.
#
# The headers under `include/` are a contract with external consumers: a C
# program, a game engine, a WASI host. A contract that only compiles in the
# author's configuration is not a contract, so this checks both languages the
# headers claim to support, plus a strict warning set.
#
# Not part of `npm test`: the JS test suite needs no C toolchain, and adding a
# hard toolchain dependency there would break contributors who are not building
# against C. `npm run check:headers` is the explicit gate, and is what a CI job
# should call once one exists.

set -euo pipefail

cd "$(dirname "$0")/.."

INCLUDE_DIR="include"
SOURCE="tests/headers/compile-check.c"

if [ ! -f "$SOURCE" ]; then
  echo "error: $SOURCE is missing" >&2
  exit 1
fi

# Pick a compiler per language, reporting which one is used so a mismatch
# between a local run and CI is visible.
CC_BIN="${CC:-}"
if [ -z "$CC_BIN" ]; then
  for candidate in gcc clang cc; do
    if command -v "$candidate" >/dev/null 2>&1; then CC_BIN="$candidate"; break; fi
  done
fi
CXX_BIN="${CXX:-}"
if [ -z "$CXX_BIN" ]; then
  for candidate in c++ g++ clang++; do
    if command -v "$candidate" >/dev/null 2>&1; then CXX_BIN="$candidate"; break; fi
  done
fi

if [ -z "$CC_BIN" ]; then
  echo "error: no C compiler found (looked for: gcc, clang, cc)" >&2
  exit 1
fi
if [ -z "$CXX_BIN" ]; then
  echo "error: no C++ compiler found (looked for: c++, g++, clang++)" >&2
  exit 1
fi

echo "C   : $CC_BIN ($("$CC_BIN" --version 2>/dev/null | head -1))"
echo "C++ : $CXX_BIN ($("$CXX_BIN" --version 2>/dev/null | head -1))"
echo

fail=0
run() {
  local label="$1"; shift
  printf '  %-34s ' "$label"
  if output=$("$@" 2>&1); then
    echo "ok"
  else
    echo "FAILED"
    echo "$output" | sed 's/^/      /'
    fail=1
  fi
}

# The two gates the landing names.
run "C11 (-fsyntax-only)" \
  "$CC_BIN" -std=c11 -I "$INCLUDE_DIR" -fsyntax-only "$SOURCE"
run "C++17 (-fsyntax-only)" \
  "$CXX_BIN" -std=c++17 -I "$INCLUDE_DIR" -fsyntax-only "$SOURCE"

# And the same two under a strict warning set, because a header that warns is a
# header consumers will wrap in pragmas.
#
# `-Werror` is load-bearing, not decoration: without it `-fsyntax-only` exits 0
# with warnings on stdout, so this script reported "ok" while `-Wpedantic` was
# rejecting a flexible array member in C++. A gate that only reads exit codes
# cannot see a warning, and a warning in a published header is a defect for
# every consumer who builds with `-Werror` themselves.
run "C11 (-Wall -Wextra -pedantic -Werror)" \
  "$CC_BIN" -std=c11 -Wall -Wextra -pedantic -Werror -I "$INCLUDE_DIR" -fsyntax-only "$SOURCE"
run "C++17 (-Wall -Wextra -pedantic -Werror)" \
  "$CXX_BIN" -std=c++17 -Wall -Wextra -pedantic -Werror -I "$INCLUDE_DIR" -fsyntax-only "$SOURCE"

echo
if [ "$fail" -ne 0 ]; then
  echo "header check FAILED" >&2
  exit 1
fi
echo "header check passed"
