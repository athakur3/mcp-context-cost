# perplexity — context cost

**133 tokens** across 1 tools — *lean* (< 1K). Measured 2026-09-05 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | example-servers/perplexity-ask v0.1.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y server-perplexity-ask` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | PERPLEXITY_API_KEY |
| canonical SHA-256 | `bf3f548ecca0308f30e544a03d3a36778dbbfba3a5ed12dab6d981dcbcc7a73c` |
| category | vendor-official |
| source | https://github.com/perplexityai/modelcontextprotocol |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| perplexity_ask | 131 | 98.5% | 38 | 80 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 133 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 133 | 0.0% of the capture is MCP-only metadata |
| **Claude, same fields** | **503** | 3.78× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 133 | 1 | not recorded | not recorded | — |
| 2026-08-19 | 133 | 1 | not recorded | docker | no change |
| 2026-09-04 | 133 | 1 | 0.1.0 | docker | no change |
| 2026-09-05 | 133 | 1 | 0.1.0 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/perplexity/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/perplexity/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/perplexity.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
