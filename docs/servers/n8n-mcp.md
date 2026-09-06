# n8n-mcp — context cost

**2,636 tokens** across 7 tools — *light* (1–5K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | n8n-documentation-mcp v2.82.1 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y n8n-mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · architecture not on record · network enabled for package fetch; clean FS, no host credent |
| env vars supplied | none |
| canonical SHA-256 | `efc31b255c09a3f364367c1450285b1e107d999faf01d4c9c37711aa12410948` |
| category | community |
| source | https://github.com/czlonkowski/n8n-mcp |

## Where the tokens are

| tool | tokens | share | description | input schema | output schema |
|---|---:|---:|---:|---:|---:|
| search_templates | 628 | 23.8% | 65 | 533 | 0 |
| validate_node | 522 | 19.8% | 52 | 182 | 218 |
| get_node | 470 | 17.8% | 85 | 354 | 0 |
| validate_workflow | 432 | 16.4% | 24 | 160 | 180 |
| search_nodes | 297 | 11.3% | 50 | 216 | 0 |
| tools_documentation | 151 | 5.7% | 36 | 84 | 0 |
| get_template | 134 | 5.1% | 28 | 75 | 0 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 2,636 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 2,022 | 23.3% of the capture is MCP-only metadata |
| **Claude, same fields** | **3,902** | 1.48× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 2,636 | 7 | not recorded | not recorded | — |
| 2026-08-19 | 2,636 | 7 | not recorded | docker | no change |
| 2026-09-04 | 2,636 | 7 | 2.82.1 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/n8n-mcp/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/n8n-mcp/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/n8n-mcp.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
