#!/usr/bin/env bash
# Dependency-free tests for badge.sh (needs only bash, jq, sed, rev — all on
# ubuntu-latest and macOS). Golden fixtures are shared with the TS reference:
# badge.sh output must be BYTE-identical to JSON.stringify(toBadge(...)).
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
badge_sh="$here/../badge.sh"
fixtures="$here/../../spec/fixtures"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fails=0
assert_eq() { # name expected actual
  if [[ "$2" == "$3" ]]; then
    echo "ok   $1"
  else
    echo "FAIL $1"
    echo "  expected: $2"
    echo "  actual:   $3"
    fails=$((fails + 1))
  fi
}

# 1. Golden: CLI report fixture -> byte-identical to the TS-frozen badge JSON.
BADGE_REPORT="$fixtures/cli-report-basic.json" BADGE_PATH="$tmp/b1.json" "$badge_sh" 2> /dev/null
assert_eq "golden byte-identity" "$(jq -c '.badge' "$fixtures/expected-basic.json")" "$(cat "$tmp/b1.json")"

# 2. BADGE_TOKENS wins over BADGE_REPORT.
BADGE_TOKENS=12430 BADGE_REPORT="$fixtures/cli-report-basic.json" BADGE_PATH="$tmp/b2.json" "$badge_sh" 2> /dev/null
assert_eq "tokens-override message" '"12,430 tokens"' "$(jq '.message' "$tmp/b2.json")"
assert_eq "tokens-override color" '"yellow"' "$(jq '.color' "$tmp/b2.json")"

# 3. Band edges — must match src/core/bands.ts exactly.
declare -a cases=(
  "0 brightgreen" "999 brightgreen" "1000 green" "4999 green"
  "5000 yellow" "14999 yellow" "15000 orange" "29999 orange"
  "30000 red" "42000 red"
)
for c in "${cases[@]}"; do
  read -r n expected_color <<< "$c"
  BADGE_TOKENS="$n" BADGE_PATH="$tmp/band.json" "$badge_sh" 2> /dev/null
  assert_eq "band $n -> $expected_color" "\"$expected_color\"" "$(jq '.color' "$tmp/band.json")"
done

# 4. Thousands separators, locale-independent.
for c in "196:196 tokens" "1234:1,234 tokens" "123456:123,456 tokens" "1234567:1,234,567 tokens"; do
  n="${c%%:*}"; want="${c#*:}"
  BADGE_TOKENS="$n" BADGE_PATH="$tmp/sep.json" "$badge_sh" 2> /dev/null
  assert_eq "commafy $n" "\"$want\"" "$(jq '.message' "$tmp/sep.json")"
done

# 5. GITHUB_OUTPUT gets a heredoc-delimited badge output.
out="$tmp/gh_output"; : > "$out"
BADGE_TOKENS=196 BADGE_PATH="$tmp/b5.json" GITHUB_OUTPUT="$out" "$badge_sh" 2> /dev/null
assert_eq "GITHUB_OUTPUT delimiters" "badge<<MCP_BADGE_EOF|MCP_BADGE_EOF" \
  "$(sed -n '1p' "$out")|$(sed -n '$p' "$out")"
assert_eq "GITHUB_OUTPUT payload" "$(cat "$tmp/b5.json")" "$(sed -n '2p' "$out")"

# 6. Failure modes: missing input, non-numeric tokens.
if BADGE_PATH="$tmp/x.json" "$badge_sh" 2> /dev/null; then
  assert_eq "missing input fails" "exit-nonzero" "exit-zero"
else
  assert_eq "missing input fails" "exit-nonzero" "exit-nonzero"
fi
if BADGE_TOKENS="abc" BADGE_PATH="$tmp/x.json" "$badge_sh" 2> /dev/null; then
  assert_eq "non-numeric fails" "exit-nonzero" "exit-zero"
else
  assert_eq "non-numeric fails" "exit-nonzero" "exit-nonzero"
fi

echo
if (( fails > 0 )); then
  echo "$fails test(s) FAILED"
  exit 1
fi
echo "all badge.sh tests passed"
