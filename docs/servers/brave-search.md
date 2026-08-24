# brave-search — context cost

**25,456 tokens** across 8 tools — *heavy* (15–30K). Measured 2026-08-19 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | brave-search-mcp-server v2.1.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @brave/brave-search-mcp-server` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | BRAVE_API_KEY |
| canonical SHA-256 | `e5a8f43437056e6e89bb8f5167f5b8d471ba42de915ede953ce5968a84471582` |
| category | vendor-official |
| source | https://github.com/brave/brave-search-mcp-server |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| brave_place_search | 17,282 | 67.9% | 351 | 1,143 |
| brave_llm_context | 2,550 | 10.0% | 177 | 1,535 |
| brave_local_search | 1,415 | 5.6% | 157 | 1,211 |
| brave_web_search | 1,396 | 5.5% | 133 | 1,211 |
| brave_news_search | 1,002 | 3.9% | 249 | 694 |
| brave_image_search | 814 | 3.2% | 67 | 268 |
| brave_video_search | 688 | 2.7% | 86 | 554 |
| brave_summarizer | 307 | 1.2% | 154 | 101 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-08-24 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 25,456 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 8,262 | 67.5% of the capture is MCP-only metadata |
| **Claude, same fields** | **13,746** | 0.54× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-16 | 25,456 | 8 | not recorded | — |
| 2026-08-19 | 25,456 | 8 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/brave-search/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/brave-search/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/brave-search.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
