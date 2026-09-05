# clinicaltrialsgov — context cost

**5,134 tokens** across 7 tools — *moderate* (5–15K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | @cyanheads/mcp-ts-core v0.8.18 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y clinicaltrialsgov-mcp-server` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `acdc9b99e581c7493a98e8c0fac919bbe384ac3205227c15891b94d6ddcf4825` |
| category | community |
| source | https://github.com/cyanheads/clinicaltrialsgov-mcp-server |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| clinicaltrials_search_studies | 1,257 | 24.5% | 51 | 884 |
| clinicaltrials_get_study_results | 928 | 18.1% | 52 | 318 |
| clinicaltrials_get_field_definitions | 737 | 14.4% | 153 | 224 |
| clinicaltrials_find_eligible | 727 | 14.2% | 35 | 281 |
| clinicaltrials_get_study_count | 677 | 13.2% | 59 | 450 |
| clinicaltrials_get_field_values | 527 | 10.3% | 46 | 118 |
| clinicaltrials_get_study_record | 279 | 5.4% | 38 | 65 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 5,134 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 2,879 | 43.9% of the capture is MCP-only metadata |
| **Claude, same fields** | **5,540** | 1.08× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-09-03 | 5,134 | 7 | not recorded | docker | — |
| 2026-09-04 | 5,134 | 7 | 0.8.18 | docker | no change |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/clinicaltrialsgov/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/clinicaltrialsgov/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/clinicaltrialsgov.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
