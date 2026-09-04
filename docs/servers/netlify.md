# netlify — context cost

**2,831 tokens** across 9 tools — *light* (1–5K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | netlify-mcp v1.15.1 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @netlify/mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `be8578ef35da6e632f7cee04f664676c4895a1320868eceec1150a55f6c21440` |
| category | vendor-official |
| source | https://github.com/netlify/netlify-mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| netlify-project-services-updater | 896 | 31.6% | 37 | 827 |
| netlify-project-services-reader | 349 | 12.3% | 27 | 291 |
| netlify-extension-services-updater | 302 | 10.7% | 19 | 251 |
| netlify-extension-services-reader | 265 | 9.4% | 23 | 211 |
| netlify-deploy-services-reader | 261 | 9.2% | 24 | 205 |
| netlify-deploy-services-updater | 254 | 9.0% | 13 | 208 |
| netlify-team-services-reader | 231 | 8.2% | 21 | 179 |
| netlify-user-services-reader | 147 | 5.2% | 17 | 99 |
| netlify-coding-rules | 124 | 4.4% | 32 | 61 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-16 | 2,831 | 9 | not recorded | — |
| 2026-08-19 | 2,831 | 9 | docker | no change |
| 2026-08-26 | 2,831 | 9 | docker | no change |
| 2026-09-03 | 2,831 | 9 | docker | no change |
| 2026-09-04 | 2,831 | 9 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/netlify/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/netlify/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/netlify.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
