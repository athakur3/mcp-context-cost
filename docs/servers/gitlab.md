# gitlab — context cost

**336 tokens** across 9 tools — *lean* (< 1K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | gitlab-mcp-server v0.5.1 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @modelcontextprotocol/server-gitlab` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | GITLAB_PERSONAL_ACCESS_TOKEN |
| canonical SHA-256 | `d51fb022687ee403f9710c9fae31ac91dbc796f5c52a3fcdbe0a91c387aa9365` |
| category | official-reference |
| source | https://github.com/modelcontextprotocol/servers-archived |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| get_file_contents | 41 | 12.2% | 13 | 16 |
| create_or_update_file | 40 | 11.9% | 11 | 16 |
| push_files | 39 | 11.6% | 12 | 16 |
| create_merge_request | 38 | 11.3% | 10 | 16 |
| fork_repository | 38 | 11.3% | 11 | 16 |
| create_issue | 36 | 10.7% | 9 | 16 |
| create_branch | 36 | 10.7% | 9 | 16 |
| search_repositories | 33 | 9.8% | 5 | 16 |
| create_repository | 33 | 9.8% | 6 | 16 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 336 | 9 | not recorded | not recorded | — |
| 2026-08-18 | 336 | 9 | not recorded | docker | no change |
| 2026-08-26 | 336 | 9 | not recorded | docker | no change |
| 2026-09-03 | 336 | 9 | not recorded | docker | no change |
| 2026-09-04 | 336 | 9 | 0.5.1 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/gitlab/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/gitlab/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/gitlab.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
