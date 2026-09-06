# chroma — context cost

**2,837 tokens** across 13 tools — *light* (1–5K). Measured 2026-09-05 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | chroma v1.6.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx chroma-mcp` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `eb0b416a1586989ce3f646259f9f96d0ae6d7b62342aa30393b10ecb7c03c707` |
| category | vendor-official |
| source | https://github.com/chroma-core/chroma-mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| chroma_get_documents | 610 | 21.5% | 337 | 200 |
| chroma_query_documents | 546 | 19.2% | 310 | 167 |
| chroma_update_documents | 382 | 13.5% | 184 | 165 |
| chroma_add_documents | 194 | 6.8% | 62 | 114 |
| chroma_create_collection | 185 | 6.5% | 85 | 82 |
| chroma_modify_collection | 156 | 5.5% | 48 | 91 |
| chroma_delete_documents | 155 | 5.5% | 79 | 54 |
| chroma_list_collections | 151 | 5.3% | 64 | 64 |
| chroma_fork_collection | 120 | 4.2% | 48 | 54 |
| chroma_peek_collection | 104 | 3.7% | 36 | 50 |
| chroma_get_collection_count | 80 | 2.8% | 27 | 35 |
| chroma_get_collection_info | 79 | 2.8% | 26 | 35 |
| chroma_delete_collection | 73 | 2.6% | 22 | 34 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 2,837 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 2,837 | 0.0% of the capture is MCP-only metadata |
| **Claude, same fields** | **5,222** | 1.84× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 2,837 | 13 | not recorded | not recorded | — |
| 2026-08-18 | 2,837 | 13 | not recorded | docker | no change |
| 2026-09-04 | 2,837 | 13 | 1.6.0 | docker | no change |
| 2026-09-05 | 2,837 | 13 | 1.6.0 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/chroma/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/chroma/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/chroma.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
