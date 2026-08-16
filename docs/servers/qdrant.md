# qdrant — context cost

**188 tokens** across 2 tools — *lean* (< 1K). Measured 2026-08-16 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | mcp-server-qdrant v1.29.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx mcp-server-qdrant` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | QDRANT_URL, COLLECTION_NAME |
| canonical SHA-256 | `2bd5a36e7293bab6b8e62c28b7d210c5261f4b80331b176c1df6dc100a7e6fc4` |
| category | vendor-official |
| source | https://github.com/qdrant/mcp-server-qdrant |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| qdrant-store | 101 | 53.7% | 15 | 74 |
| qdrant-find | 85 | 45.2% | 39 | 30 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/qdrant/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/qdrant/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/qdrant.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
