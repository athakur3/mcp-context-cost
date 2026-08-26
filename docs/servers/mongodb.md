# mongodb — context cost

**7,926 tokens** across 27 tools — *moderate* (5–15K). Measured 2026-08-26 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | MongoDB MCP Server v2.1.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y mongodb-mcp-server` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `c771e7295dc27668861b2a251566196a3e30b5b3ac282f7736aab96891bff300` |
| category | vendor-official |
| source | https://github.com/mongodb-js/mongodb-mcp-server |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| explain | 813 | 10.3% | 18 | 628 |
| create-index | 761 | 9.6% | 6 | 607 |
| export | 657 | 8.3% | 13 | 581 |
| aggregate | 524 | 6.6% | 8 | 345 |
| find | 375 | 4.7% | 9 | 209 |
| collection-indexes | 338 | 4.3% | 6 | 59 |
| update-many | 295 | 3.7% | 32 | 101 |
| list-connections | 270 | 3.4% | 21 | 29 |
| insert-many | 260 | 3.3% | 31 | 84 |
| aggregate-db | 256 | 3.2% | 8 | 89 |
| drop-index | 233 | 2.9% | 10 | 86 |
| rename-collection | 233 | 2.9% | 9 | 82 |
| collection-schema | 223 | 2.8% | 6 | 86 |
| mongodb-logs | 217 | 2.7% | 8 | 70 |
| delete-many | 215 | 2.7% | 13 | 75 |
| drop-collection | 209 | 2.6% | 22 | 59 |
| list-databases | 207 | 2.6% | 8 | 41 |
| create-collection | 205 | 2.6% | 20 | 59 |
| count | 202 | 2.5% | 22 | 75 |
| list-collections | 202 | 2.5% | 7 | 50 |
| connect | 195 | 2.5% | 40 | 49 |
| search-knowledge | 189 | 2.4% | 36 | 86 |
| collection-storage-size | 183 | 2.3% | 6 | 59 |
| db-stats | 183 | 2.3% | 11 | 50 |
| drop-database | 181 | 2.3% | 11 | 50 |
| disconnect | 166 | 2.1% | 11 | 41 |
| list-knowledge-sources | 132 | 1.7% | 32 | 29 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-08-24 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 7,926 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 4,501 | 43.2% of the capture is MCP-only metadata |
| **Claude, same fields** | **8,765** | 1.11× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-16 | 7,926 | 27 | not recorded | — |
| 2026-08-18 | 7,926 | 27 | docker | no change |
| 2026-08-26 | 7,926 | 27 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/mongodb/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/mongodb/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/mongodb.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
