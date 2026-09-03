# githits — context cost

**12,600 tokens** across 16 tools — *moderate* (5–15K). Measured 2026-09-03 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | githits v0.12.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y githits mcp start` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `1de63e2beef41e0f618a1b41e1ead6a82fbce11d6e0c9652466884a2c74e10f0` |
| category | community |
| source | https://github.com/githits-com/githits-cli |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| search | 2,270 | 18.0% | 409 | 1,821 |
| code_grep | 1,681 | 13.3% | 365 | 1,272 |
| code_files | 1,424 | 11.3% | 329 | 1,054 |
| code_read | 1,170 | 9.3% | 350 | 777 |
| pkg_changelog | 967 | 7.7% | 343 | 573 |
| pkg_vulns | 778 | 6.2% | 369 | 363 |
| pkg_upgrade_review | 700 | 5.6% | 171 | 486 |
| pkg_deps | 677 | 5.4% | 191 | 445 |
| get_example | 474 | 3.8% | 201 | 228 |
| search_status | 448 | 3.6% | 234 | 174 |
| feedback | 428 | 3.4% | 153 | 232 |
| docs_read | 410 | 3.3% | 126 | 242 |
| docs_list | 404 | 3.2% | 145 | 217 |
| pkg_info | 404 | 3.2% | 170 | 191 |
| search_language | 241 | 1.9% | 83 | 117 |
| quick_start | 122 | 1.0% | 59 | 24 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/githits/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/githits/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/githits.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
