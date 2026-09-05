# codebase-memory-mcp — context cost

**5,258 tokens** across 15 tools — *moderate* (5–15K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | codebase-memory-mcp v0.10.8 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y codebase-memory-mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `01a1bd0f450ccf86b0bf36b2b63749c70dc4add7b0a4d9621ce69e29c9db7b27` |
| category | community |
| source | https://github.com/DeusData/codebase-memory-mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| search_graph | 905 | 17.2% | 324 | 537 |
| trace_path | 732 | 13.9% | 170 | 520 |
| query_graph | 577 | 11.0% | 407 | 125 |
| index_repository | 510 | 9.7% | 224 | 243 |
| search_code | 473 | 9.0% | 178 | 253 |
| detect_changes | 411 | 7.8% | 123 | 246 |
| get_architecture | 324 | 6.2% | 121 | 157 |
| index_status | 307 | 5.8% | 200 | 64 |
| check_index_coverage | 291 | 5.5% | 112 | 134 |
| get_code_snippet | 205 | 3.9% | 104 | 56 |
| list_projects | 135 | 2.6% | 6 | 86 |
| manage_adr | 121 | 2.3% | 6 | 71 |
| ingest_traces | 119 | 2.3% | 9 | 64 |
| get_graph_schema | 78 | 1.5% | 14 | 19 |
| delete_project | 68 | 1.3% | 6 | 19 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-09-03 | 5,258 | 15 | not recorded | docker | — |
| 2026-09-04 | 5,258 | 15 | 0.10.8 | docker | no change |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/codebase-memory-mcp/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/codebase-memory-mcp/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/codebase-memory-mcp.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
