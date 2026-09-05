# elasticsearch — context cost

**374 tokens** across 4 tools — *lean* (< 1K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | elasticsearch-mcp v0.3.1 |
| status | measured |
| package | [superseded by v0.4.0 or later, shipped differently — see the upstream README](https://www.npmjs.com/package/@elastic/mcp-server-elasticsearch) — 0.3.1, read 2026-09-05 |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @elastic/mcp-server-elasticsearch` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | ES_URL, ES_API_KEY |
| canonical SHA-256 | `76a005f840c738f5788e7b5801fdc12194713fce1ed435ad500f891a2b2dd13c` |
| category | vendor-official |
| source | https://github.com/elastic/mcp-server-elasticsearch |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| search | 159 | 42.5% | 15 | 135 |
| get_mappings | 76 | 20.3% | 8 | 56 |
| list_indices | 72 | 19.3% | 5 | 56 |
| get_shards | 65 | 17.4% | 8 | 45 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-18 | 374 | 4 | not recorded | — |
| 2026-08-19 | 374 | 4 | docker | no change |
| 2026-09-04 | 374 | 4 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/elasticsearch/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/elasticsearch/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/elasticsearch.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
