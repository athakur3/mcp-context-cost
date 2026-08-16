# circleci — context cost

**11,912 tokens** across 13 tools — *moderate* (5–15K). Measured 2026-08-16 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | mcp-server-circleci v1.0.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @circleci/mcp-server-circleci` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | CIRCLECI_TOKEN |
| canonical SHA-256 | `f4d995111363bc9a5c220871fb9e4c2d81372ef647572f5f4f19cb5d4bd08bbe` |
| category | vendor-official |
| source | https://github.com/CircleCI-Public/mcp-server-circleci |

## Where the tokens are

| tool | tokens | share | description | schema |
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

## Re-derive it

```bash
npx -y mcp-context-cost verify results/circleci/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/circleci/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/circleci.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
