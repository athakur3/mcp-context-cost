# codebase-memory-mcp — context cost

**4,065 tokens** across 17 tools — *light* (1–5K). Measured 2026-09-30 under [methodology v1.0](../METHODOLOGY.html).

An Anthropic request carries 3,606 of those tokens as tool definitions. What Claude makes of them is not published for this server: its Claude count is missing, or was taken against a capture this measurement has since replaced.

| | |
|---|---|
| server (self-reported) | codebase-memory-mcp v0.11.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y codebase-memory-mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `db11670b6fc094f5af5ae6a24bf875d4c8440da3a5eb4bc87d99c289ab5bd345` |
| category | community |
| source | https://github.com/DeusData/codebase-memory-mcp |

## Where the tokens are

| tool | tokens | share | description | input schema |
|---|---:|---:|---:|---:|
| trace_path | 403 | 9.9% | 37 | 329 |
| search_code | 380 | 9.3% | 16 | 327 |
| query_graph | 346 | 8.5% | 71 | 238 |
| search_graph | 342 | 8.4% | 44 | 261 |
| detect_changes | 338 | 8.3% | 15 | 286 |
| get_code_snippet | 295 | 7.3% | 33 | 223 |
| manage_adr | 254 | 6.2% | 13 | 202 |
| check_index_coverage | 229 | 5.6% | 28 | 162 |
| index_repository | 224 | 5.5% | 28 | 159 |
| get_architecture | 205 | 5.0% | 36 | 131 |
| list_projects | 197 | 4.8% | 15 | 145 |
| get_file_outline | 190 | 4.7% | 32 | 120 |
| index_status | 171 | 4.2% | 35 | 99 |
| compare_graphs | 167 | 4.1% | 41 | 88 |
| get_graph_schema | 144 | 3.5% | 17 | 89 |
| ingest_traces | 115 | 2.8% | 11 | 64 |
| delete_project | 63 | 1.5% | 6 | 19 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-09-03 | 5,258 | 15 | not recorded | docker | — |
| 2026-09-04 | 5,258 | 15 | 0.10.8 | docker | no change |
| 2026-09-05 | 5,258 | 15 | 0.10.8 | docker | no change |
| 2026-09-09 | 5,258 | 15 | 0.10.8 | docker | no change |
| 2026-09-30 | 4,065 | 17 | 0.11.0 | docker | −1,193 |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/codebase-memory-mcp/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/codebase-memory-mcp/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/codebase-memory-mcp.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
