# github-legacy — context cost

**3,548 tokens** across 26 tools — *light* (1–5K). Measured 2026-08-16 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | github-mcp-server v0.6.2 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @modelcontextprotocol/server-github` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | GITHUB_PERSONAL_ACCESS_TOKEN |
| canonical SHA-256 | `e0194003d2ddaf668a23e0570cdbcf8c142c3314d3dd811a50ae99e5afd79ae3` |
| category | official-reference |
| source | https://github.com/modelcontextprotocol/servers-archived |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| create_pull_request_review | 360 | 10.1% | 7 | 340 |
| list_pull_requests | 226 | 6.4% | 6 | 208 |
| create_pull_request | 200 | 5.6% | 10 | 178 |
| create_or_update_file | 178 | 5.0% | 11 | 154 |
| push_files | 178 | 5.0% | 12 | 155 |
| merge_pull_request | 159 | 4.5% | 4 | 143 |
| search_issues | 151 | 4.3% | 10 | 129 |
| list_issues | 149 | 4.2% | 10 | 127 |
| update_issue | 143 | 4.0% | 9 | 123 |
| update_pull_request_branch | 128 | 3.6% | 13 | 102 |
| create_branch | 127 | 3.6% | 9 | 107 |
| get_file_contents | 121 | 3.4% | 13 | 96 |
| create_issue | 120 | 3.4% | 9 | 100 |
| search_repositories | 115 | 3.2% | 5 | 98 |
| search_users | 110 | 3.1% | 6 | 93 |
| fork_repository | 108 | 3.0% | 11 | 86 |
| create_repository | 107 | 3.0% | 9 | 87 |
| get_pull_request_status | 105 | 3.0% | 12 | 80 |
| get_pull_request_files | 103 | 2.9% | 10 | 80 |
| get_pull_request_comments | 101 | 2.8% | 8 | 80 |
| get_pull_request_reviews | 100 | 2.8% | 7 | 80 |
| get_pull_request | 99 | 2.8% | 7 | 80 |
| search_code | 96 | 2.7% | 7 | 78 |
| list_commits | 94 | 2.6% | 12 | 70 |
| add_issue_comment | 87 | 2.5% | 7 | 68 |
| get_issue | 81 | 2.3% | 12 | 59 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/github-legacy/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/github-legacy/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/github-legacy.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
