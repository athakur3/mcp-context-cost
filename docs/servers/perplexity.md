# perplexity — context cost

**133 tokens** across 1 tools — *lean* (< 1K). Measured 2026-08-16 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | example-servers/perplexity-ask v0.1.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y server-perplexity-ask` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | PERPLEXITY_API_KEY |
| canonical SHA-256 | `bf3f548ecca0308f30e544a03d3a36778dbbfba3a5ed12dab6d981dcbcc7a73c` |
| category | vendor-official |
| source | https://github.com/perplexityai/modelcontextprotocol |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| perplexity_ask | 131 | 98.5% | 38 | 80 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/perplexity/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/perplexity/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/perplexity.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
