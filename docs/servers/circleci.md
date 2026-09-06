# circleci — context cost

**11,912 tokens** across 13 tools — *moderate* (5–15K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | mcp-server-circleci v1.0.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @circleci/mcp-server-circleci` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · architecture not on record · network enabled for package fetch; clean FS, no host credent |
| env vars supplied | CIRCLECI_TOKEN |
| canonical SHA-256 | `f4d995111363bc9a5c220871fb9e4c2d81372ef647572f5f4f19cb5d4bd08bbe` |
| category | vendor-official |
| source | https://github.com/CircleCI-Public/mcp-server-circleci |

## Where the tokens are

| tool | tokens | share | description | input schema |
|---|---:|---:|---:|---:|
| run_rollback_pipeline | 1,391 | 11.7% | 1,077 | 222 |
| get_job_test_results | 1,283 | 10.8% | 772 | 442 |
| list_component_versions | 1,242 | 10.4% | 969 | 204 |
| get_build_failure_logs | 1,193 | 10.0% | 644 | 487 |
| run_pipeline | 1,103 | 9.3% | 579 | 466 |
| get_latest_pipeline_status | 1,048 | 8.8% | 582 | 413 |
| download_usage_api_data | 995 | 8.4% | 637 | 283 |
| find_flaky_tests | 910 | 7.6% | 521 | 326 |
| list_artifacts | 870 | 7.3% | 478 | 343 |
| rerun_workflow | 585 | 4.9% | 297 | 242 |
| find_underused_resource_classes | 488 | 4.1% | 282 | 168 |
| list_followed_projects | 433 | 3.6% | 345 | 43 |
| config_helper | 369 | 3.1% | 230 | 94 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 11,912 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 11,755 | 1.3% of the capture is MCP-only metadata |
| **Claude, same fields** | **19,164** | 1.61× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 11,912 | 13 | not recorded | not recorded | — |
| 2026-08-18 | 11,912 | 13 | not recorded | docker | no change |
| 2026-09-04 | 11,912 | 13 | 1.0.0 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/circleci/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/circleci/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/circleci.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
