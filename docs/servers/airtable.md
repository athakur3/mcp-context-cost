# airtable — context cost

**4,186 tokens** across 16 tools — *light* (1–5K). Measured 2026-09-05 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | airtable-mcp-server v1.14.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y airtable-mcp-server` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | AIRTABLE_API_KEY |
| canonical SHA-256 | `5f90d662e26a77e01125999b97db0bf9204bb92bd0fc7297a28495986d80ec30` |
| category | community |
| source | https://github.com/domdomegg/airtable-mcp-server |

## Where the tokens are

| tool | tokens | share | description | input schema | output schema |
|---|---:|---:|---:|---:|---:|
| list_records | 395 | 9.4% | 5 | 269 | 86 |
| describe_table | 354 | 8.5% | 7 | 260 | 52 |
| upload_attachment | 347 | 8.3% | 48 | 198 | 61 |
| list_tables | 340 | 8.1% | 7 | 239 | 59 |
| list_comments | 325 | 7.8% | 5 | 122 | 163 |
| create_comment | 310 | 7.4% | 6 | 118 | 145 |
| search_records | 277 | 6.6% | 6 | 150 | 86 |
| update_records | 265 | 6.3% | 9 | 129 | 86 |
| update_field | 214 | 5.1% | 7 | 114 | 52 |
| create_table | 212 | 5.1% | 7 | 112 | 52 |
| create_field | 206 | 4.9% | 7 | 106 | 52 |
| create_record | 205 | 4.9% | 7 | 96 | 61 |
| delete_records | 202 | 4.8% | 5 | 92 | 64 |
| update_table | 195 | 4.7% | 7 | 95 | 52 |
| get_record | 186 | 4.4% | 6 | 84 | 61 |
| list_bases | 151 | 3.6% | 6 | 24 | 84 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 4,186 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 2,531 | 39.5% of the capture is MCP-only metadata |
| **Claude, same fields** | **4,555** | 1.09× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 4,207 | 16 | not recorded | not recorded | — |
| 2026-08-19 | 4,207 | 16 | not recorded | docker | no change |
| 2026-09-04 | 4,186 | 16 | 1.14.0 | docker | -21 |
| 2026-09-05 | 4,186 | 16 | 1.14.0 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/airtable/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/airtable/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/airtable.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
