# sentry — context cost

**6,086 tokens** across 9 tools — *moderate* (5–15K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | Sentry MCP v0.39.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @sentry/mcp-server@latest` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | SENTRY_ACCESS_TOKEN |
| canonical SHA-256 | `11ef5fbfa5440a29377fedcd23abb764cf640ba03762911c8bfcd5b11a53aebd` |
| category | vendor-official |
| source | https://github.com/getsentry/sentry-mcp |

## Where the tokens are

| tool | tokens | share | description | input schema | output schema |
|---|---:|---:|---:|---:|---:|
| update_issue | 1,248 | 20.5% | 455 | 710 | 0 |
| search_events | 1,127 | 18.5% | 459 | 597 | 0 |
| search_issues | 853 | 14.0% | 377 | 412 | 0 |
| analyze_issue_with_seer | 641 | 10.5% | 331 | 240 | 0 |
| get_sentry_resource | 632 | 10.4% | 346 | 218 | 0 |
| search_sentry_tools | 592 | 9.7% | 247 | 102 | 177 |
| find_projects | 397 | 6.5% | 66 | 211 | 75 |
| find_organizations | 308 | 5.1% | 70 | 68 | 124 |
| execute_sentry_tool | 286 | 4.7% | 138 | 92 | 0 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 6,086 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 5,442 | 10.6% of the capture is MCP-only metadata |
| **Claude, same fields** | **9,481** | 1.56× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 6,455 | 9 | not recorded | not recorded | — |
| 2026-08-18 | 6,455 | 9 | not recorded | docker | no change |
| 2026-09-03 | 6,086 | 9 | not recorded | docker | -369 |
| 2026-09-04 | 6,086 | 9 | 0.39.0 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/sentry/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/sentry/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/sentry.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
