# browserbase — context cost

**364 tokens** across 6 tools — *lean* (< 1K). Measured 2026-09-05 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | Browserbase MCP Server v3.0.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @browserbasehq/mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID |
| canonical SHA-256 | `1dc53461369d7cb64ea8151f33283db371951cf44289471f6156e35cd1ae28bb` |
| category | vendor-official |
| source | https://github.com/browserbase/mcp-server-browserbase |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| act | 69 | 19.0% | 6 | 44 |
| observe | 69 | 19.0% | 6 | 44 |
| navigate | 67 | 18.4% | 4 | 44 |
| extract | 58 | 15.9% | 5 | 34 |
| start | 50 | 13.7% | 7 | 24 |
| end | 49 | 13.5% | 6 | 24 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 364 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 310 | 14.8% of the capture is MCP-only metadata |
| **Claude, same fields** | **869** | 2.39× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 364 | 6 | not recorded | not recorded | — |
| 2026-08-19 | 364 | 6 | not recorded | docker | no change |
| 2026-09-04 | 364 | 6 | 3.0.0 | docker | no change |
| 2026-09-05 | 364 | 6 | 3.0.0 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/browserbase/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/browserbase/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/browserbase.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
