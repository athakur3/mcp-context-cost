# pinecone — context cost

**5,903 tokens** across 9 tools — *moderate* (5–15K). Measured 2026-09-05 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | pinecone-mcp v0.3.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @pinecone-database/mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | PINECONE_API_KEY |
| canonical SHA-256 | `cc8ffaadb37615f11747b0a1eafd8541cfb2f31064adcd4973860f8f03bab377` |
| category | vendor-official |
| source | https://github.com/pinecone-io/pinecone-mcp |

## Where the tokens are

| tool | tokens | share | description | input schema |
|---|---:|---:|---:|---:|
| search-records | 1,179 | 20.0% | 111 | 1,031 |
| cascading-search | 1,154 | 19.5% | 55 | 1,063 |
| create-index-for-model | 856 | 14.5% | 80 | 728 |
| rerank-documents | 793 | 13.4% | 69 | 687 |
| upsert-records | 593 | 10.0% | 84 | 457 |
| describe-index-stats | 424 | 7.2% | 64 | 325 |
| describe-index | 423 | 7.2% | 67 | 325 |
| list-indexes | 371 | 6.3% | 32 | 306 |
| search-docs | 108 | 1.8% | 31 | 43 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 5,903 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 5,679 | 3.8% of the capture is MCP-only metadata |
| **Claude, same fields** | **9,184** | 1.56× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 5,903 | 9 | not recorded | not recorded | — |
| 2026-08-19 | 5,903 | 9 | not recorded | docker | no change |
| 2026-09-04 | 5,903 | 9 | 0.3.0 | docker | no change |
| 2026-09-05 | 5,903 | 9 | 0.3.0 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/pinecone/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/pinecone/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/pinecone.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
