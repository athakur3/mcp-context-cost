# exa — context cost

**486 tokens** across 2 tools — *lean* (< 1K). Measured 2026-08-16 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | exa-search-server v3.4.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y exa-mcp-server` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | EXA_API_KEY |
| canonical SHA-256 | `eea558e4c905976a1bf6e014b1a1a73cffa2b9baa707c11da9ec26db70e38e46` |
| category | vendor-official |
| source | https://github.com/exa-labs/exa-mcp-server |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| web_search_exa | 289 | 59.5% | 113 | 119 |
| web_fetch_exa | 195 | 40.1% | 56 | 87 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/exa/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/exa/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/exa.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
