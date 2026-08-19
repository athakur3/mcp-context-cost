# n8n-mcp — context cost

**2,636 tokens** across 7 tools — *light* (1–5K). Measured 2026-08-19 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | n8n-documentation-mcp v2.72.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y n8n-mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `efc31b255c09a3f364367c1450285b1e107d999faf01d4c9c37711aa12410948` |
| category | community |
| source | https://github.com/czlonkowski/n8n-mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| search_templates | 628 | 23.8% | 65 | 533 |
| validate_node | 522 | 19.8% | 52 | 182 |
| get_node | 470 | 17.8% | 85 | 354 |
| validate_workflow | 432 | 16.4% | 24 | 160 |
| search_nodes | 297 | 11.3% | 50 | 216 |
| tools_documentation | 151 | 5.7% | 36 | 84 |
| get_template | 134 | 5.1% | 28 | 75 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | change |
|---|---:|---:|---:|
| 2026-08-16 | 2,636 | 7 | — |
| 2026-08-19 | 2,636 | 7 | no change |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/n8n-mcp/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/n8n-mcp/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/n8n-mcp.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
