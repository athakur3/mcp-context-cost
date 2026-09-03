# clinicaltrialsgov — context cost

**5,134 tokens** across 7 tools — *moderate* (5–15K). Measured 2026-09-03 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | @cyanheads/mcp-ts-core v0.8.18 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y clinicaltrialsgov-mcp-server` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `acdc9b99e581c7493a98e8c0fac919bbe384ac3205227c15891b94d6ddcf4825` |
| category | community |
| source | https://github.com/cyanheads/clinicaltrialsgov-mcp-server |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| clinicaltrials_search_studies | 1,257 | 24.5% | 51 | 884 |
| clinicaltrials_get_study_results | 928 | 18.1% | 52 | 318 |
| clinicaltrials_get_field_definitions | 737 | 14.4% | 153 | 224 |
| clinicaltrials_find_eligible | 727 | 14.2% | 35 | 281 |
| clinicaltrials_get_study_count | 677 | 13.2% | 59 | 450 |
| clinicaltrials_get_field_values | 527 | 10.3% | 46 | 118 |
| clinicaltrials_get_study_record | 279 | 5.4% | 38 | 65 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/clinicaltrialsgov/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/clinicaltrialsgov/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/clinicaltrialsgov.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
