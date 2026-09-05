# elasticsearch — context cost

**374 tokens** across 4 tools — *lean* (< 1K). Measured 2026-09-05 under [methodology v1.0](../METHODOLOGY.html).

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

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 374 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 374 | 0.0% of the capture is MCP-only metadata |
| **Claude, same fields** | **987** | 2.64× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-18 | 374 | 4 | not recorded | not recorded | — |
| 2026-08-19 | 374 | 4 | not recorded | docker | no change |
| 2026-09-04 | 374 | 4 | 0.3.1 | docker | no change |
| 2026-09-05 | 374 | 4 | 0.3.1 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/elasticsearch/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/elasticsearch/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/elasticsearch.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
