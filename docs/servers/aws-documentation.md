# aws-documentation — context cost

**5,045 tokens** across 5 tools — *moderate* (5–15K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | awslabs.aws-documentation-mcp-server |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx awslabs.aws-documentation-mcp-server@latest` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `096790f5b6a85d5faf9b4a09edbeddc34de23ed3c26c195bee05c42fb7f8b6a7` |
| category | vendor-official |
| source | https://github.com/awslabs/mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| search_documentation | 1,956 | 38.8% | 657 | 239 |
| search_table | 1,361 | 27.0% | 658 | 172 |
| read_sections | 634 | 12.6% | 467 | 75 |
| read_documentation | 571 | 11.3% | 377 | 125 |
| recommend | 521 | 10.3% | 325 | 41 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 5,045 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 3,380 | 33.0% of the capture is MCP-only metadata |
| **Claude, same fields** | **5,749** | 1.14× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 5,074 | 5 | not recorded | not recorded | — |
| 2026-08-18 | 5,074 | 5 | not recorded | docker | no change |
| 2026-08-19 | 5,074 | 5 | not recorded | docker | no change |
| 2026-09-04 | 5,045 | 5 | not recorded | docker | -29 |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/aws-documentation/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/aws-documentation/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/aws-documentation.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
