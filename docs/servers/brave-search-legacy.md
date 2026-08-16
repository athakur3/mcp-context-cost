# brave-search-legacy — context cost

**319 tokens** across 2 tools — *lean* (< 1K). Measured 2026-08-16 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | example-servers/brave-search v0.1.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @modelcontextprotocol/server-brave-search` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | BRAVE_API_KEY |
| canonical SHA-256 | `727577fbcd5fe4e811453a32d9c9852ea877c90b8acf56e0cdf5eda15e97d803` |
| category | official-reference |
| source | https://github.com/modelcontextprotocol/servers-archived |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| brave_web_search | 161 | 50.5% | 65 | 84 |
| brave_local_search | 156 | 48.9% | 82 | 61 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/brave-search-legacy/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/brave-search-legacy/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/brave-search-legacy.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
