#!/usr/bin/env bash
# badge.sh — turn an mcp-tokens measurement into a shields.io endpoint badge JSON.
#
# Proposed addition to sd2k/mcp-tokens-action (composite step; see action-patch.md).
# Spec: byte-identical output to mcp-context-cost's TS reference (spec/fixtures).
#
# Inputs (env):
#   BADGE_TOKENS   token count to render (wins over BADGE_REPORT)
#   BADGE_REPORT   path to the mcp-tokens JSON report; uses .tools.total
#   BADGE_PATH     output path for the badge JSON (default: badge.json)
#   BADGE_LABEL    badge label (default: "context cost")
#   BADGE_GIST_ID  optional: gist id to publish the badge JSON to
#   GIST_TOKEN     optional: token with gist scope (required with BADGE_GIST_ID)
#   GITHUB_OUTPUT  standard composite-action output file (optional)
set -euo pipefail

BADGE_PATH="${BADGE_PATH:-badge.json}"
BADGE_LABEL="${BADGE_LABEL:-context cost}"

if [[ -n "${BADGE_TOKENS:-}" ]]; then
  tokens="$BADGE_TOKENS"
elif [[ -n "${BADGE_REPORT:-}" ]]; then
  if [[ ! -f "$BADGE_REPORT" ]]; then
    echo "badge.sh: BADGE_REPORT file not found: $BADGE_REPORT" >&2
    exit 1
  fi
  tokens="$(jq -r '.tools.total' "$BADGE_REPORT")"
  if [[ "$tokens" == "null" ]]; then
    echo "badge.sh: report has no .tools.total: $BADGE_REPORT" >&2
    exit 1
  fi
else
  echo "badge.sh: need BADGE_TOKENS or BADGE_REPORT" >&2
  exit 1
fi

if ! [[ "$tokens" =~ ^[0-9]+$ ]]; then
  echo "badge.sh: token count is not a non-negative integer: '$tokens'" >&2
  exit 1
fi
tokens=$((10#$tokens)) # leading zeros are decimal, never octal

# Color bands — must match the reference implementation (src/core/bands.ts).
if   (( tokens < 1000 ));  then color="brightgreen"
elif (( tokens < 5000 ));  then color="green"
elif (( tokens < 15000 )); then color="yellow"
elif (( tokens < 30000 )); then color="orange"
else                            color="red"
fi

# Thousands separator, locale-independent.
commafy() {
  echo "$1" | rev | sed 's/[0-9]\{3\}/&,/g' | rev | sed 's/^,//'
}
message="$(commafy "$tokens") tokens"

# Key order and compact form match JSON.stringify of the TS reference.
jq -cn \
  --arg label "$BADGE_LABEL" \
  --arg message "$message" \
  --arg color "$color" \
  '{schemaVersion: 1, label: $label, message: $message, color: $color, cacheSeconds: 3600}' \
  > "$BADGE_PATH"

echo "badge.sh: wrote $BADGE_PATH ($message, $color)" >&2

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  # jq -c output ends with exactly one newline, so no extra echo: the value must
  # not carry a trailing blank line into the action output.
  {
    echo "badge<<MCP_BADGE_EOF"
    cat "$BADGE_PATH"
    echo "MCP_BADGE_EOF"
  } >> "$GITHUB_OUTPUT"
fi

if [[ -n "${BADGE_GIST_ID:-}" ]]; then
  if [[ -z "${GIST_TOKEN:-}" ]]; then
    echo "badge.sh: BADGE_GIST_ID set but GIST_TOKEN missing" >&2
    exit 1
  fi
  filename="$(basename "$BADGE_PATH")"
  payload="$(jq -cn --arg name "$filename" --rawfile content "$BADGE_PATH" \
    '{files: {($name): {content: $content}}}')"
  # Token via --config on stdin keeps it off the process argument list; -f is
  # dropped so API errors are visible instead of a silent set -e death.
  http_code="$(curl -sS -o /tmp/gist-response.json -w '%{http_code}' -X PATCH \
    --config <(printf 'header = "Authorization: Bearer %s"\n' "$GIST_TOKEN") \
    -H "Accept: application/vnd.github+json" \
    -d "$payload" \
    "https://api.github.com/gists/$BADGE_GIST_ID")" || {
    echo "badge.sh: gist publish failed (curl transport error)" >&2
    exit 1
  }
  if [[ "$http_code" != "200" ]]; then
    echo "badge.sh: gist publish failed (HTTP $http_code): $(head -c 300 /tmp/gist-response.json)" >&2
    exit 1
  fi
  echo "badge.sh: published to gist $BADGE_GIST_ID" >&2
fi
