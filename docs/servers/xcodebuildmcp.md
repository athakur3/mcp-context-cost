# xcodebuildmcp — context cost

**26,594 tokens** across 24 tools — *heavy* (15–30K). Measured 2026-08-18 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | xcodebuildmcp v2.7.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y xcodebuildmcp@latest mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `f467743f38a30d15da18709c500aa4e22186a755f0e3d2c97966ccd343978a5d` |
| category | community |
| source | https://github.com/getsentry/XcodeBuildMCP |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| snapshot_ui | 2,139 | 8.0% | 45 | 51 |
| record_sim_video | 2,123 | 8.0% | 4 | 74 |
| screenshot | 2,099 | 7.9% | 3 | 54 |
| session_set_defaults | 1,616 | 6.1% | 18 | 555 |
| test_sim | 1,391 | 5.2% | 6 | 167 |
| session_clear_defaults | 1,197 | 4.5% | 12 | 142 |
| get_file_coverage | 1,176 | 4.4% | 13 | 92 |
| get_coverage_report | 1,173 | 4.4% | 11 | 91 |
| build_run_sim | 1,115 | 4.2% | 43 | 79 |
| session_show_defaults | 1,092 | 4.1% | 24 | 24 |
| build_sim | 1,081 | 4.1% | 12 | 88 |
| boot_sim | 1,019 | 3.8% | 22 | 24 |
| open_sim | 1,019 | 3.8% | 22 | 24 |
| clean | 1,004 | 3.8% | 4 | 77 |
| discover_projs | 870 | 3.3% | 37 | 65 |
| get_sim_app_path | 842 | 3.2% | 6 | 53 |
| launch_app_sim | 839 | 3.2% | 21 | 91 |
| install_app_sim | 739 | 2.8% | 5 | 47 |
| stop_app_sim | 737 | 2.8% | 4 | 24 |
| list_schemes | 736 | 2.8% | 5 | 59 |
| show_build_settings | 717 | 2.7% | 4 | 24 |
| get_app_bundle_id | 685 | 2.6% | 7 | 45 |
| session_use_defaults_profile | 598 | 2.2% | 7 | 89 |
| list_sims | 585 | 2.2% | 6 | 29 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/xcodebuildmcp/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/xcodebuildmcp/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/xcodebuildmcp.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
