# desktop-commander — context cost

**11,063 tokens** across 26 tools — *moderate* (5–15K). Measured 2026-09-30 under [methodology v1.0](../METHODOLOGY.html).

An Anthropic request carries 10,283 of those tokens as tool definitions. What Claude makes of them is not published for this server: its Claude count is missing, or was taken against a capture this measurement has since replaced.

| | |
|---|---|
| server (self-reported) | desktop-commander v0.2.52 |
| status | dynamic |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @wonderwhy-er/desktop-commander` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `b71040e15f7b214bf1107857cff176108f473faf17d9e3dee74523a67101843b` |
| category | community |
| source | https://github.com/wonderwhy-er/DesktopCommanderMCP |

> This server's `tools/list` differed between two consecutive captures, so the number is the first capture and moves between sweeps. Treat it as a range, not a constant.

## Where the tokens are

| tool | tokens | share | description | input schema |
|---|---:|---:|---:|---:|
| start_search | 1,351 | 12.2% | 1,078 | 158 |
| read_file | 1,023 | 9.2% | 777 | 112 |
| edit_block | 917 | 8.3% | 670 | 107 |
| write_pdf | 882 | 8.0% | 567 | 203 |
| start_process | 758 | 6.9% | 590 | 81 |
| write_file | 726 | 6.6% | 516 | 81 |
| list_directory | 536 | 4.8% | 366 | 64 |
| read_process_output | 511 | 4.6% | 380 | 70 |
| get_prompts | 445 | 4.0% | 326 | 55 |
| interact_with_process | 440 | 4.0% | 294 | 74 |
| give_feedback_to_desktop_commander | 389 | 3.5% | 296 | 29 |
| get_more_search_results | 353 | 3.2% | 242 | 62 |
| set_config_value | 306 | 2.8% | 154 | 91 |
| get_config | 298 | 2.7% | 166 | 42 |
| get_file_info | 262 | 2.4% | 183 | 39 |
| get_recent_tool_calls | 258 | 2.3% | 149 | 67 |
| read_multiple_files | 241 | 2.2% | 154 | 45 |
| move_file | 213 | 1.9% | 116 | 48 |
| create_directory | 191 | 1.7% | 111 | 39 |
| list_sessions | 186 | 1.7% | 118 | 29 |
| stop_search | 176 | 1.6% | 93 | 41 |
| list_searches | 129 | 1.2% | 64 | 29 |
| kill_process | 128 | 1.2% | 46 | 39 |
| force_terminate | 116 | 1.0% | 32 | 39 |
| get_usage_stats | 114 | 1.0% | 50 | 29 |
| list_processes | 112 | 1.0% | 48 | 29 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-18 | 11,835 | 26 | not recorded | not recorded | — |
| 2026-08-19 | 11,836 | 26 | not recorded | docker | +1 |
| 2026-09-04 | 11,834 | 26 | 0.2.48 | docker | −2 |
| 2026-09-05 | 11,837 | 26 | 0.2.48 | docker | +3 |
| 2026-09-09 | 11,837 | 26 | 0.2.48 | docker | no change |
| 2026-09-30 | 11,063 | 26 | 0.2.52 | docker | −774 |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/desktop-commander/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/desktop-commander/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/desktop-commander.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
