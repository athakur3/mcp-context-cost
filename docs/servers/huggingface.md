# huggingface — context cost

**4,724 tokens** across 4 tools — *light* (1–5K). Measured 2026-09-05 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | huggingface.co/mcp v0.4.15 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y mcp-remote https://huggingface.co/mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `a2e48e88545d92665679b878c9e66f4f902af2a11bccafc29cc6e627def941ae` |
| category | vendor-official |
| source | https://github.com/huggingface/hf-mcp-server |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| hf_fs | 1,957 | 41.4% | 596 | 142 |
| hf_whoami | 1,948 | 41.2% | 30 | 26 |
| hub_repo_details | 453 | 9.6% | 76 | 327 |
| hub_repo_search | 364 | 7.7% | 38 | 278 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 4,724 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 1,604 | 66.0% of the capture is MCP-only metadata |
| **Claude, same fields** | **3,043** | 0.64× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 4,691 | 4 | not recorded | not recorded | — |
| 2026-08-19 | 4,691 | 4 | not recorded | docker | no change |
| 2026-09-04 | 4,724 | 4 | 0.4.15 | docker | +33 |
| 2026-09-05 | 4,724 | 4 | 0.4.15 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/huggingface/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/huggingface/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/huggingface.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
