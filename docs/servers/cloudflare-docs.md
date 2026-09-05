# cloudflare-docs — context cost

**422 tokens** across 2 tools — *lean* (< 1K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | docs-ai-search v0.4.13 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y mcp-remote https://docs.mcp.cloudflare.com/sse` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `a65649ac29928ffde9e8bf8796482b5aaeb17e79d02ea2f3b8b96f11ac32b604` |
| category | vendor-official |
| source | https://github.com/cloudflare/mcp-server-cloudflare |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| search_cloudflare_documentation | 351 | 83.2% | 140 | 36 |
| migrate_pages_to_workers_guide | 69 | 16.4% | 12 | 26 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 422 | 2 | not recorded | not recorded | — |
| 2026-08-19 | 422 | 2 | not recorded | docker | no change |
| 2026-09-04 | 422 | 2 | 0.4.13 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/cloudflare-docs/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/cloudflare-docs/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/cloudflare-docs.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
