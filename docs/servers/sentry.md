# sentry — context cost

**6,086 tokens** across 9 tools — *moderate* (5–15K). Measured 2026-09-03 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | Sentry MCP v0.39.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @sentry/mcp-server@latest` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | SENTRY_ACCESS_TOKEN |
| canonical SHA-256 | `11ef5fbfa5440a29377fedcd23abb764cf640ba03762911c8bfcd5b11a53aebd` |
| category | vendor-official |
| source | https://github.com/getsentry/sentry-mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| update_issue | 1,248 | 20.5% | 455 | 710 |
| search_events | 1,127 | 18.5% | 459 | 597 |
| search_issues | 853 | 14.0% | 377 | 412 |
| analyze_issue_with_seer | 641 | 10.5% | 331 | 240 |
| get_sentry_resource | 632 | 10.4% | 346 | 218 |
| search_sentry_tools | 592 | 9.7% | 247 | 102 |
| find_projects | 397 | 6.5% | 66 | 211 |
| find_organizations | 308 | 5.1% | 70 | 68 |
| execute_sentry_tool | 286 | 4.7% | 138 | 92 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-16 | 6,455 | 9 | not recorded | — |
| 2026-08-18 | 6,455 | 9 | docker | no change |
| 2026-09-03 | 6,086 | 9 | docker | -369 |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/sentry/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/sentry/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/sentry.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
