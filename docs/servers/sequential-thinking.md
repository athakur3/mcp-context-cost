# sequential-thinking — context cost

**1,003 tokens** across 1 tools — *light* (1–5K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | sequential-thinking-server v2026.8.31 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @modelcontextprotocol/server-sequential-thinking` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `55e4c41338722ccc0672def6b5462f1dee664bf168cfd01172c4e96d344a1c2e` |
| category | official-reference |
| source | https://github.com/modelcontextprotocol/servers |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| sequentialthinking | 1,001 | 99.8% | 565 | 270 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 1,003 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 865 | 13.8% of the capture is MCP-only metadata |
| **Claude, same fields** | **1,804** | 1.80× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 992 | 1 | not recorded | not recorded | — |
| 2026-08-18 | 992 | 1 | not recorded | docker | no change |
| 2026-09-03 | 1,003 | 1 | not recorded | docker | +11 |
| 2026-09-04 | 1,003 | 1 | 2026.8.31 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/sequential-thinking/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/sequential-thinking/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/sequential-thinking.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
