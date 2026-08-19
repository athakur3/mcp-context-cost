# github — context cost

**54,422 tokens** across 44 tools — *very heavy* (≥ 30K). Measured 2026-08-18 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | github-mcp-server v1.9.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN=dummy ghcr.io/github/github-mcp-server` |
| isolation | docker · command is itself a docker run (host-spawned container) |
| env vars supplied | GITHUB_PERSONAL_ACCESS_TOKEN |
| canonical SHA-256 | `086879383bcdc68ea1b960a141ab1b41cb2a203321c4440553c033b5e9a5344d` |
| category | vendor-official |
| source | https://github.com/github/github-mcp-server |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| issue_write | 1,890 | 3.5% | 14 | 619 |
| list_issues | 1,783 | 3.3% | 33 | 497 |
| pull_request_read | 1,737 | 3.2% | 12 | 515 |
| pull_request_review_write | 1,681 | 3.1% | 242 | 213 |
| search_issues | 1,678 | 3.1% | 34 | 390 |
| sub_issue_write | 1,617 | 3.0% | 15 | 347 |
| search_pull_requests | 1,595 | 2.9% | 18 | 370 |
| issue_read | 1,575 | 2.9% | 12 | 310 |
| list_pull_requests | 1,569 | 2.9% | 31 | 332 |
| search_users | 1,566 | 2.9% | 26 | 158 |
| assign_copilot_to_issue | 1,549 | 2.8% | 62 | 150 |
| add_comment_to_pending_review | 1,534 | 2.8% | 32 | 284 |
| add_issue_comment | 1,513 | 2.8% | 65 | 190 |
| add_reply_to_pull_request_comment | 1,454 | 2.7% | 51 | 191 |
| request_copilot_review | 1,426 | 2.6% | 29 | 69 |
| update_pull_request | 1,419 | 2.6% | 11 | 202 |
| list_issue_fields | 1,394 | 2.6% | 49 | 91 |
| create_pull_request | 1,391 | 2.6% | 11 | 173 |
| list_issue_types | 1,359 | 2.5% | 24 | 80 |
| get_label | 1,337 | 2.5% | 8 | 72 |
| update_pull_request_branch | 1,315 | 2.4% | 16 | 91 |
| merge_pull_request | 1,259 | 2.3% | 10 | 124 |
| fork_repository | 1,242 | 2.3% | 11 | 66 |
| get_team_members | 1,117 | 2.1% | 18 | 47 |
| get_teams | 1,102 | 2.0% | 19 | 32 |
| get_me | 1,096 | 2.0% | 35 | 9 |
| list_commits | 1,092 | 2.0% | 41 | 345 |
| search_code | 1,075 | 2.0% | 33 | 338 |
| search_commits | 1,069 | 2.0% | 37 | 327 |
| create_or_update_file | 987 | 1.8% | 94 | 177 |

*14 smaller tools omitted (11,999 tokens combined) — all of them are in the [raw capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/github/measurement.json).*

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-08-19 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 54,422 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 10,535 | 80.6% of the capture is MCP-only metadata |
| **Claude, same fields** | **18,406** | 0.34× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | change |
|---|---:|---:|---:|
| 2026-08-16 | 54,422 | 44 | — |
| 2026-08-18 | 54,422 | 44 | no change |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/github/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/github/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/github.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
