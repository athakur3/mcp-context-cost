# supabase — context cost

**5,007 tokens** across 29 tools — *moderate* (5–15K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | supabase v0.11.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @supabase/mcp-server-supabase@latest` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | SUPABASE_ACCESS_TOKEN |
| canonical SHA-256 | `8ad33a05f12e8c0f535683508468dd970df8715f01fc82235b2b039718aeebf7` |
| category | vendor-official |
| source | https://github.com/supabase-community/supabase-mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| query_logs | 794 | 15.9% | 102 | 649 |
| search_docs | 483 | 9.6% | 387 | 48 |
| deploy_edge_function | 447 | 8.9% | 104 | 277 |
| create_project | 279 | 5.6% | 39 | 198 |
| create_branch | 193 | 3.9% | 60 | 91 |
| list_tables | 189 | 3.8% | 33 | 114 |
| get_advisors | 180 | 3.6% | 69 | 66 |
| get_publishable_keys | 173 | 3.5% | 86 | 41 |
| confirm_cost | 162 | 3.2% | 46 | 72 |
| get_cost | 149 | 3.0% | 36 | 68 |
| apply_migration | 149 | 3.0% | 28 | 78 |
| execute_sql | 143 | 2.9% | 43 | 58 |
| reset_branch | 122 | 2.4% | 19 | 61 |
| list_branches | 116 | 2.3% | 32 | 41 |
| rebase_branch | 111 | 2.2% | 26 | 41 |
| get_edge_function | 110 | 2.2% | 14 | 52 |
| get_organization | 99 | 2.0% | 10 | 45 |
| list_projects | 98 | 2.0% | 27 | 29 |
| get_project | 96 | 1.9% | 8 | 45 |
| generate_typescript_types | 96 | 1.9% | 9 | 41 |
| merge_branch | 96 | 1.9% | 13 | 41 |
| list_edge_functions | 95 | 1.9% | 10 | 41 |
| get_project_url | 93 | 1.9% | 8 | 41 |
| list_migrations | 91 | 1.8% | 7 | 41 |
| pause_project | 90 | 1.8% | 7 | 41 |
| restore_project | 90 | 1.8% | 7 | 41 |
| list_extensions | 90 | 1.8% | 7 | 41 |
| delete_branch | 88 | 1.8% | 5 | 41 |
| list_organizations | 83 | 1.7% | 11 | 29 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 5,007 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 4,062 | 18.9% of the capture is MCP-only metadata |
| **Claude, same fields** | **7,323** | 1.46× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 5,013 | 29 | not recorded | not recorded | — |
| 2026-08-18 | 5,013 | 29 | not recorded | docker | no change |
| 2026-09-04 | 5,007 | 29 | 0.11.0 | docker | -6 |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/supabase/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/supabase/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/supabase.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
