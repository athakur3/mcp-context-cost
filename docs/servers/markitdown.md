# markitdown — context cost

**64 tokens** across 1 tools — *lean* (< 1K). Measured 2026-08-18 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | markitdown v1.8.1 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx markitdown-mcp` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `d708fc0ae4f3fb818d01cc3d4da0b74c2e5591a7982735d6200b3d56ab74d66b` |
| category | vendor-official |
| source | https://github.com/microsoft/markitdown |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| convert_to_markdown | 62 | 96.9% | 18 | 31 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | change |
|---|---:|---:|---:|
| 2026-08-16 | 64 | 1 | — |
| 2026-08-18 | 64 | 1 | no change |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/markitdown/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/markitdown/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/markitdown.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
