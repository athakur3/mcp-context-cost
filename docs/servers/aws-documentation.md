# aws-documentation — context cost

**5,008 tokens** across 5 tools — *moderate* (5–15K). Measured 2026-09-30 under [methodology v1.0](../METHODOLOGY.html).

An Anthropic request carries 3,367 of those tokens as tool definitions. What Claude makes of them is not published for this server: its Claude count is missing, or was taken against a capture this measurement has since replaced.

| | |
|---|---|
| server (self-reported) | awslabs.aws-documentation-mcp-server |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx awslabs.aws-documentation-mcp-server@latest` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `3a368215b275dbc5c029f9f89998588903db35a1e2aaba325922c2c2d4f18b0f` |
| category | vendor-official |
| source | https://github.com/awslabs/mcp |

## Where the tokens are

| tool | tokens | share | description | input schema | output schema |
|---|---:|---:|---:|---:|---:|
| search_documentation | 1,956 | 39.1% | 657 | 239 | 1,007 |
| search_table | 1,324 | 26.4% | 645 | 172 | 440 |
| read_sections | 634 | 12.7% | 467 | 75 | 29 |
| read_documentation | 571 | 11.4% | 377 | 125 | 30 |
| recommend | 521 | 10.4% | 325 | 41 | 120 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 5,074 | 5 | not recorded | not recorded | — |
| 2026-08-18 | 5,074 | 5 | not recorded | docker | no change |
| 2026-08-19 | 5,074 | 5 | not recorded | docker | no change |
| 2026-09-04 | 5,045 | 5 | not recorded | docker | −29 |
| 2026-09-05 | 5,045 | 5 | not recorded | docker | no change |
| 2026-09-09 | 5,045 | 5 | not recorded | docker | no change |
| 2026-09-30 | 5,008 | 5 | not recorded | docker | −37 |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/aws-documentation/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/aws-documentation/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/aws-documentation.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
