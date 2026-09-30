# markitdown — context cost

**98 tokens** across 1 tools — *lean* (< 1K). Measured 2026-09-30 under [methodology v1.0](../METHODOLOGY.html).

An Anthropic request carries 64 of those tokens as tool definitions. What Claude makes of them is not published for this server: its Claude count is missing, or was taken against a capture this measurement has since replaced.

| | |
|---|---|
| server (self-reported) | markitdown |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx markitdown-mcp` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `eef53f600eee8a14332be832c38139fe2092e219c3429c033befa8c41adf054e` |
| category | vendor-official |
| source | https://github.com/microsoft/markitdown |

## Where the tokens are

| tool | tokens | share | description | input schema | output schema |
|---|---:|---:|---:|---:|---:|
| convert_to_markdown | 96 | 98.0% | 18 | 31 | 31 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 64 | 1 | not recorded | not recorded | — |
| 2026-08-18 | 64 | 1 | not recorded | docker | no change |
| 2026-08-19 | 64 | 1 | not recorded | docker | no change |
| 2026-09-04 | 64 | 1 | 1.8.1 | docker | no change |
| 2026-09-05 | 64 | 1 | 1.8.1 | docker | no change |
| 2026-09-09 | 64 | 1 | 1.8.1 | docker | no change |
| 2026-09-30 | 98 | 1 | not recorded | docker | +34 |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/markitdown/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/markitdown/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/markitdown.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
