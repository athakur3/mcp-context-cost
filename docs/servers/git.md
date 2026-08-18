# git — context cost

**1,455 tokens** across 12 tools — *light* (1–5K). Measured 2026-08-18 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | mcp-git v1.29.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx --with "mcp\<2" mcp-server-git` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials, git installed |
| env vars supplied | none |
| canonical SHA-256 | `9710fb8f79f50348c138ee513e344f7fc9ac0e912a728d8aeda847cd04ed64f1` |
| category | official-reference |
| source | https://github.com/modelcontextprotocol/servers |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| git_log | 289 | 19.9% | 4 | 246 |
| git_branch | 219 | 15.1% | 3 | 177 |
| git_create_branch | 123 | 8.5% | 9 | 74 |
| git_diff | 106 | 7.3% | 6 | 61 |
| git_diff_unstaged | 104 | 7.1% | 11 | 51 |
| git_diff_staged | 98 | 6.7% | 7 | 50 |
| git_add | 97 | 6.7% | 7 | 51 |
| git_checkout | 89 | 6.1% | 3 | 47 |
| git_show | 89 | 6.1% | 6 | 44 |
| git_commit | 88 | 6.0% | 5 | 44 |
| git_reset | 76 | 5.2% | 6 | 31 |
| git_status | 75 | 5.2% | 5 | 31 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/git/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/git/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/git.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
