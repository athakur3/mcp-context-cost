# google-surf — context cost

**10,948 tokens** across 7 tools — *moderate* (5–15K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | google-surf-mcp v1.0.9 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y google-surf-mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `64ca81a34311e1318d731b8fbf14e5f1759567e4a7bdaabf43f3553ee732ee41` |
| category | community |
| source | https://github.com/HarimxChoi/google-surf-mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| project_memory | 3,279 | 30.0% | 285 | 2,030 |
| search_parallel | 1,860 | 17.0% | 482 | 631 |
| search | 1,737 | 15.9% | 478 | 612 |
| project_memory_search | 1,436 | 13.1% | 208 | 261 |
| extract | 1,249 | 11.4% | 330 | 511 |
| scholar_search | 981 | 9.0% | 134 | 302 |
| health | 404 | 3.7% | 50 | 24 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 10,948 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 6,412 | 41.4% of the capture is MCP-only metadata |
| **Claude, same fields** | **11,232** | 1.03× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/google-surf/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/google-surf/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/google-surf.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
