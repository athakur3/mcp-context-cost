# context7 — context cost

**1,052 tokens** across 2 tools — *light* (1–5K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | Context7 v4.0.4 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @upstash/context7-mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · architecture not on record · network enabled for package fetch; clean FS, no host credent |
| env vars supplied | none |
| canonical SHA-256 | `699d8b33d6d2d90ce7deb777994bb408e1e07bb08fa997042b7cce19e6c1ecec` |
| category | vendor-official |
| source | https://github.com/upstash/context7 |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| resolve-library-id | 643 | 61.1% | 398 | 176 |
| query-docs | 407 | 38.7% | 87 | 273 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 1,052 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 985 | 6.4% of the capture is MCP-only metadata |
| **Claude, same fields** | **1,883** | 1.79× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 1,052 | 2 | not recorded | not recorded | — |
| 2026-08-18 | 1,052 | 2 | not recorded | docker | no change |
| 2026-09-04 | 1,052 | 2 | 4.0.4 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/context7/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/context7/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/context7.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
