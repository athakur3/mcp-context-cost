# airtable — context cost

**4,207 tokens** across 16 tools — *light* (1–5K). Measured 2026-08-19 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | airtable-mcp-server v1.14.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y airtable-mcp-server` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | AIRTABLE_API_KEY |
| canonical SHA-256 | `6ae170e7625e0fa953f2981d005a89ee2b7c80d94830c81a9e5e03d3e5de59e6` |
| category | community |
| source | https://github.com/domdomegg/airtable-mcp-server |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| list_records | 395 | 9.4% | 5 | 269 |
| describe_table | 354 | 8.4% | 7 | 260 |
| upload_attachment | 347 | 8.2% | 48 | 198 |
| list_tables | 340 | 8.1% | 7 | 239 |
| list_comments | 339 | 8.1% | 5 | 122 |
| create_comment | 317 | 7.5% | 6 | 118 |
| search_records | 277 | 6.6% | 6 | 150 |
| update_records | 265 | 6.3% | 9 | 129 |
| update_field | 214 | 5.1% | 7 | 114 |
| create_table | 212 | 5.0% | 7 | 112 |
| create_field | 206 | 4.9% | 7 | 106 |
| create_record | 205 | 4.9% | 7 | 96 |
| delete_records | 202 | 4.8% | 5 | 92 |
| update_table | 195 | 4.6% | 7 | 95 |
| get_record | 186 | 4.4% | 6 | 84 |
| list_bases | 151 | 3.6% | 6 | 24 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | change |
|---|---:|---:|---:|
| 2026-08-16 | 4,207 | 16 | — |
| 2026-08-19 | 4,207 | 16 | no change |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/airtable/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/airtable/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/airtable.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
