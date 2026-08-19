# sentry — context cost

**6,455 tokens** across 9 tools — *moderate* (5–15K). Measured 2026-08-18 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | Sentry MCP v0.37.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @sentry/mcp-server@latest` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | SENTRY_ACCESS_TOKEN |
| canonical SHA-256 | `b56928d7394324ec80ddda1377e382b535fd3abc7b488cda6b4a52e4a01b410b` |
| category | vendor-official |
| source | https://github.com/getsentry/sentry-mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| update_issue | 1,306 | 20.2% | 455 | 767 |
| search_events | 1,243 | 19.3% | 459 | 718 |
| search_issues | 932 | 14.4% | 377 | 496 |
| get_sentry_resource | 752 | 11.6% | 397 | 287 |
| analyze_issue_with_seer | 726 | 11.2% | 331 | 324 |
| search_sentry_tools | 584 | 9.0% | 247 | 107 |
| find_projects | 421 | 6.5% | 66 | 318 |
| execute_sentry_tool | 285 | 4.4% | 138 | 90 |
| find_organizations | 204 | 3.2% | 70 | 96 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-08-19 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 6,455 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 6,051 | 6.3% of the capture is MCP-only metadata |
| **Claude, same fields** | **10,463** | 1.62× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-16 | 6,455 | 9 | not recorded | — |
| 2026-08-18 | 6,455 | 9 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/sentry/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/sentry/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/sentry.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
