# bitbucket-mcp — context cost

**6,156 tokens** across 47 tools — *moderate* (5–15K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | bitbucket-mcp-server v1.0.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y bitbucket-mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | BITBUCKET_TOKEN |
| canonical SHA-256 | `e131b1d46e30c0d05f07995aa167fa323ec1003719d861dbe27c82c94ad803cf` |
| category | community |
| source | https://github.com/MatanYemini/bitbucket-mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| listPipelineRuns | 258 | 4.2% | 6 | 240 |
| runPipeline | 256 | 4.2% | 5 | 240 |
| updateRepositoryBranchingModelSettings | 235 | 3.8% | 8 | 212 |
| updateProjectBranchingModelSettings | 235 | 3.8% | 8 | 212 |
| getPipelineStepLogs | 226 | 3.7% | 7 | 206 |
| addPullRequestComment | 220 | 3.6% | 12 | 195 |
| getPullRequests | 211 | 3.4% | 6 | 193 |
| addPendingPullRequestComment | 202 | 3.3% | 16 | 172 |
| createPullRequest | 190 | 3.1% | 5 | 173 |
| getPullRequestActivity | 179 | 2.9% | 7 | 159 |
| getPullRequestCommits | 179 | 2.9% | 6 | 159 |
| getPullRequest | 178 | 2.9% | 7 | 159 |
| unapprovePullRequest | 178 | 2.9% | 6 | 159 |
| getPullRequestComments | 178 | 2.9% | 6 | 159 |
| listRepositories | 177 | 2.9% | 4 | 162 |
| approvePullRequest | 175 | 2.8% | 4 | 159 |
| getPipelineRun | 175 | 2.8% | 7 | 156 |
| createDraftPullRequest | 173 | 2.8% | 6 | 154 |
| createPullRequestTask | 134 | 2.2% | 7 | 114 |
| updatePullRequestTask | 132 | 2.1% | 7 | 112 |
| mergePullRequest | 116 | 1.9% | 4 | 100 |
| getPendingReviewPRs | 114 | 1.9% | 21 | 80 |
| updatePullRequestComment | 112 | 1.8% | 7 | 92 |
| updatePullRequest | 105 | 1.7% | 4 | 89 |
| reopenComment | 99 | 1.6% | 10 | 77 |
| getPullRequestComment | 98 | 1.6% | 8 | 77 |
| getPullRequestTask | 98 | 1.6% | 8 | 77 |
| resolveComment | 96 | 1.6% | 8 | 77 |
| getPipelineStep | 93 | 1.5% | 7 | 74 |
| declinePullRequest | 92 | 1.5% | 5 | 74 |

*17 smaller tools omitted (1,240 tokens combined) — all of them are in the [raw capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/bitbucket-mcp/measurement.json).*

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 6,156 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 6,156 | 0.0% of the capture is MCP-only metadata |
| **Claude, same fields** | **12,210** | 1.98× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-09-03 | 6,156 | 47 | not recorded | docker | — |
| 2026-09-04 | 6,156 | 47 | 1.0.0 | docker | no change |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/bitbucket-mcp/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/bitbucket-mcp/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/bitbucket-mcp.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
