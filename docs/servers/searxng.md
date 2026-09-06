# searxng — context cost

**1,537 tokens** across 4 tools — *light* (1–5K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | ihor-sokoliuk/mcp-searxng v2.1.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y mcp-searxng` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · architecture not on record · network enabled for package fetch; clean FS, no host credent |
| env vars supplied | SEARXNG_URL |
| canonical SHA-256 | `277906d8ed722cfce33b345e34effdc0a2c37c8effc4fc85c9f5d13888d6ea7f` |
| category | community |
| source | https://github.com/ihor-sokoliuk/mcp-searxng |

## Where the tokens are

| tool | tokens | share | description | input schema |
|---|---:|---:|---:|---:|
| searxng_web_search | 825 | 53.7% | 153 | 643 |
| web_url_read | 429 | 27.9% | 259 | 145 |
| searxng_instance_info | 163 | 10.6% | 34 | 100 |
| searxng_search_suggestions | 118 | 7.7% | 23 | 66 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 1,537 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 1,480 | 3.7% of the capture is MCP-only metadata |
| **Claude, same fields** | **2,726** | 1.77× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 1,481 | 4 | not recorded | not recorded | — |
| 2026-08-19 | 1,481 | 4 | not recorded | docker | no change |
| 2026-09-02 | 1,537 | 4 | not recorded | docker | +56 |
| 2026-09-04 | 1,537 | 4 | 2.1.0 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/searxng/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/searxng/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/searxng.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
