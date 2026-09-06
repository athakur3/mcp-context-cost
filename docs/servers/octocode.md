# octocode — context cost

**13,552 tokens** across 14 tools — *moderate* (5–15K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | octocode-mcp_18.2.2 v18.2.2 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y octocode-mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `17bae5bf5a76df127b4ddba609724a2a52b86400700daa315562e18f1082304f` |
| category | community |
| source | https://github.com/bgauryy/octocode |
| not to be confused with | Muvon/octocode (https://github.com/Muvon/octocode, read 2026-09-07) — an unrelated project of the same name, not measured here |

## Where the tokens are

| tool | tokens | share | description | input schema |
|---|---:|---:|---:|---:|
| ghSearchPullRequests | 1,799 | 13.3% | 178 | 1,564 |
| localSearchCode | 1,755 | 13.0% | 153 | 1,547 |
| ghSearchIssues | 1,189 | 8.8% | 133 | 1,001 |
| ghGetFileContent | 1,054 | 7.8% | 352 | 642 |
| ghSearchCommits | 1,003 | 7.4% | 211 | 735 |
| localFindFiles | 979 | 7.2% | 100 | 827 |
| ghSearchRepos | 877 | 6.5% | 99 | 724 |
| localGetFileContent | 858 | 6.3% | 292 | 509 |
| lspGetSemantics | 818 | 6.0% | 120 | 643 |
| localViewStructure | 810 | 6.0% | 85 | 670 |
| localFindDeadCode | 746 | 5.5% | 234 | 458 |
| ghSearchCode | 725 | 5.3% | 166 | 504 |
| ghViewRepoStructure | 544 | 4.0% | 60 | 429 |
| npmSearch | 393 | 2.9% | 50 | 293 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 13,552 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 12,967 | 4.3% of the capture is MCP-only metadata |
| **Claude, same fields** | **23,343** | 1.72× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-09-03 | 13,552 | 14 | not recorded | docker | — |
| 2026-09-04 | 13,552 | 14 | 18.2.2 | docker | no change |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/octocode/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/octocode/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/octocode.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
