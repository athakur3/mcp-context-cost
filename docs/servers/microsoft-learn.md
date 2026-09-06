# microsoft-learn — context cost

**972 tokens** across 3 tools — *lean* (< 1K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | Microsoft Learn MCP Server v1.0.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y mcp-remote https://learn.microsoft.com/api/mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · architecture not on record · network enabled for package fetch; clean FS, no host credent |
| env vars supplied | none |
| canonical SHA-256 | `9e3f4a65f0dc136a6ffa5ed00f95785ec561e9a78413888da160e44ceb139346` |
| category | vendor-official |
| source | https://github.com/MicrosoftDocs/mcp |

## Where the tokens are

| tool | tokens | share | description | input schema | output schema |
|---|---:|---:|---:|---:|---:|
| microsoft_code_sample_search | 396 | 40.7% | 163 | 111 | 63 |
| microsoft_docs_search | 297 | 30.6% | 129 | 42 | 76 |
| microsoft_docs_fetch | 277 | 28.5% | 196 | 30 | 0 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 972 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 726 | 25.3% of the capture is MCP-only metadata |
| **Claude, same fields** | **1,612** | 1.66× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 972 | 3 | not recorded | not recorded | — |
| 2026-08-19 | 972 | 3 | not recorded | docker | no change |
| 2026-09-04 | 972 | 3 | 1.0.0 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/microsoft-learn/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/microsoft-learn/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/microsoft-learn.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
