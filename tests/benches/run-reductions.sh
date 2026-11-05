#!/usr/bin/env bash
# Compile each value-return reduction case on its own and report which the
# compiler still rejects. See value-return-reductions.ts for what the cases are
# and why they exist.
#
# On 0.11.0 the expected result is: A1-A4 REJECTED, A5 OK, overall exit 1.
# A fix makes every case OK and the script exit 0. A partial fix shows a subset.
#
# Usage: bash tests/benches/run-reductions.sh
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"
asc="$root/bin/tensionscript.js"
src="$here/value-return-reductions.ts"
out="$root/build/reductions"
mkdir -p "$out"

[ -f "$asc" ] || { echo "run-reductions: $asc is missing — run npm run build first" >&2; exit 2; }

# One case per file: a compile failure aborts the whole module, so the cases
# cannot be tested from a single build.
cases=(siblingLoops siblingBranches shadowOuter nestedLoops control)
expected=(reject reject reject reject ok)

failed=0
for i in "${!cases[@]}"; do
  name="${cases[$i]}"
  want="${expected[$i]}"
  one="$out/$name.ts"

  # The case plus the struct and its producer, which every case shares.
  {
    printf '%s\n' 'struct Q { x: f32 = 0; y: f32 = 0; z: f32 = 0; w: f32 = 1; }'
    printf '%s\n' 'function mk(a: f32): Q { let q: Q; q.x = a; q.y = a; q.z = a; q.w = a; return q; }'
    awk -v fn="$name" '
      $0 ~ "^export function " fn "\\(" { on = 1 }
      on { print }
      on && /^}/ { exit }
    ' "$src"
  } > "$one"

  if node "$asc" "$one" --target release -o "$out/$name.wasm" >"$out/$name.log" 2>&1; then
    got=ok
  else
    got=reject
  fi

  if [ "$got" = "$want" ]; then
    printf '  %-16s %-7s (expected %s)\n' "$name" "$got" "$want"
  else
    printf '  %-16s %-7s (expected %s)  <-- CHANGED\n' "$name" "$got" "$want"
    failed=$((failed + 1))
    grep -m1 -E 'duplicate local name|ERROR' "$out/$name.log" | sed 's/^/      /'
  fi
done

if [ "$failed" -ne 0 ]; then
  echo "run-reductions: $failed case(s) changed — the defect is fixed or has moved." >&2
  exit 1
fi
echo "run-reductions: all cases as expected (A1-A4 rejected, A5 compiles)"
