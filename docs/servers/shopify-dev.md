# shopify-dev — context cost

**6,841 tokens** across 6 tools — *moderate* (5–15K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | shopify-dev-mcp v1.15.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @shopify/dev-mcp@latest` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `6817cd262c23cdfbac2ac9e04b037d307d7d21907f9028707ae6dbac3f0a284d` |
| category | vendor-official |
| source | https://shopify.dev/docs/apps/build/devmcp (GitHub repo not public) |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| learn_shopify_api | 2,847 | 41.6% | 2,425 | 348 |
| validate_graphql_codeblocks | 1,273 | 18.6% | 202 | 1,043 |
| validate_component_codeblocks | 1,173 | 17.1% | 547 | 550 |
| feedback | 794 | 11.6% | 421 | 345 |
| validate_theme | 451 | 6.6% | 194 | 236 |
| search_docs_chunks | 301 | 4.4% | 29 | 253 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-16 | 5,624 | 5 | not recorded | — |
| 2026-08-19 | 5,624 | 5 | docker | no change |
| 2026-09-03 | 6,841 | 6 | docker | +1,217 |
| 2026-09-04 | 6,841 | 6 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/shopify-dev/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/shopify-dev/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/shopify-dev.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
