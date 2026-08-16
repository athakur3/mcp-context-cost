# sentry — context cost

**6,455 tokens** across 9 tools — *moderate* (5–15K). Measured 2026-08-16 under [methodology v1.0](../METHODOLOGY.html).

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

## Re-derive it

```bash
npx -y mcp-context-cost verify results/sentry/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/sentry/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/sentry.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
