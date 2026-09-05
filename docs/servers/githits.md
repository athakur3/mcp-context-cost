# githits — context cost

**12,833 tokens** across 16 tools — *moderate* (5–15K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | githits v0.12.1 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y githits mcp start` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `1de4342682e058fb6395fc1a42dbcb9fa87838dc26852ba6810e57cc388ab81e` |
| category | community |
| source | https://github.com/githits-com/githits-cli |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| search | 2,270 | 17.7% | 409 | 1,821 |
| code_grep | 1,681 | 13.1% | 365 | 1,272 |
| code_files | 1,424 | 11.1% | 329 | 1,054 |
| code_read | 1,170 | 9.1% | 350 | 777 |
| pkg_changelog | 967 | 7.5% | 343 | 573 |
| pkg_deps | 805 | 6.3% | 247 | 516 |
| pkg_vulns | 778 | 6.1% | 369 | 363 |
| pkg_upgrade_review | 700 | 5.5% | 171 | 486 |
| pkg_info | 509 | 4.0% | 232 | 233 |
| get_example | 474 | 3.7% | 201 | 228 |
| search_status | 448 | 3.5% | 234 | 174 |
| feedback | 428 | 3.3% | 153 | 232 |
| docs_read | 410 | 3.2% | 126 | 242 |
| docs_list | 404 | 3.1% | 145 | 217 |
| search_language | 241 | 1.9% | 83 | 117 |
| quick_start | 122 | 1.0% | 59 | 24 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-09-03 | 12,600 | 16 | not recorded | docker | — |
| 2026-09-04 | 12,833 | 16 | 0.12.1 | docker | +233 |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/githits/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/githits/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/githits.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
