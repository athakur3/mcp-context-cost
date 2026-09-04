# browserbase — context cost

**364 tokens** across 6 tools — *lean* (< 1K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | Browserbase MCP Server v3.0.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @browserbasehq/mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID |
| canonical SHA-256 | `1dc53461369d7cb64ea8151f33283db371951cf44289471f6156e35cd1ae28bb` |
| category | vendor-official |
| source | https://github.com/browserbase/mcp-server-browserbase |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| act | 69 | 19.0% | 6 | 44 |
| observe | 69 | 19.0% | 6 | 44 |
| navigate | 67 | 18.4% | 4 | 44 |
| extract | 58 | 15.9% | 5 | 34 |
| start | 50 | 13.7% | 7 | 24 |
| end | 49 | 13.5% | 6 | 24 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-16 | 364 | 6 | not recorded | — |
| 2026-08-19 | 364 | 6 | docker | no change |
| 2026-09-04 | 364 | 6 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/browserbase/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/browserbase/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/browserbase.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
