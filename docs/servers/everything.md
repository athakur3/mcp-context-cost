# everything — context cost

**1,708 tokens** across 13 tools — *light* (1–5K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | mcp-servers/everything v2.0.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @modelcontextprotocol/server-everything` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `e61b2e1761ff2f931d030faf1dc192ca70247e52ff31d8633431b69ba6e00b7e` |
| category | official-reference |
| source | https://github.com/modelcontextprotocol/servers |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| gzip-file-as-resource | 247 | 14.5% | 45 | 146 |
| get-structured-content | 195 | 11.4% | 12 | 50 |
| simulate-research-query | 174 | 10.2% | 49 | 72 |
| get-annotated-message | 147 | 8.6% | 14 | 77 |
| trigger-long-running-operation | 128 | 7.5% | 11 | 62 |
| get-resource-reference | 127 | 7.4% | 11 | 62 |
| get-resource-links | 121 | 7.1% | 12 | 55 |
| get-sum | 112 | 6.6% | 6 | 53 |
| echo | 96 | 5.6% | 6 | 40 |
| toggle-simulated-logging | 95 | 5.6% | 14 | 24 |
| toggle-subscriber-updates | 90 | 5.3% | 11 | 24 |
| get-env | 88 | 5.2% | 11 | 24 |
| get-tiny-image | 86 | 5.0% | 7 | 24 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-16 | 1,708 | 13 | not recorded | — |
| 2026-08-18 | 1,708 | 13 | docker | no change |
| 2026-08-19 | 1,708 | 13 | docker | no change |
| 2026-09-04 | 1,708 | 13 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/everything/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/everything/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/everything.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
