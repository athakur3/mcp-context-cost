# desktop-commander — context cost

**11,836 tokens** across 26 tools — *moderate* (5–15K). Measured 2026-08-19 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | desktop-commander v0.2.47 |
| status | dynamic |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @wonderwhy-er/desktop-commander` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `8623f9de377963b97d6e8294e16ac107c445e29b3ad97fbe78f18c1971dde6f5` |
| category | community |
| source | https://github.com/wonderwhy-er/DesktopCommanderMCP |

> This server's `tools/list` differed between two consecutive captures, so the number is the first capture and moves between sweeps. Treat it as a range, not a constant.

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| start_search | 1,351 | 11.4% | 1,078 | 158 |
| start_process | 1,180 | 10.0% | 983 | 81 |
| read_file | 1,024 | 8.7% | 778 | 112 |
| edit_block | 917 | 7.7% | 670 | 107 |
| write_pdf | 882 | 7.5% | 567 | 203 |
| interact_with_process | 825 | 7.0% | 651 | 74 |
| write_file | 726 | 6.1% | 516 | 81 |
| list_directory | 536 | 4.5% | 366 | 64 |
| read_process_output | 511 | 4.3% | 380 | 70 |
| get_prompts | 445 | 3.8% | 326 | 55 |
| give_feedback_to_desktop_commander | 389 | 3.3% | 296 | 29 |
| get_more_search_results | 353 | 3.0% | 242 | 62 |
| set_config_value | 306 | 2.6% | 154 | 91 |
| get_config | 298 | 2.5% | 166 | 42 |
| get_file_info | 262 | 2.2% | 183 | 39 |
| read_multiple_files | 241 | 2.0% | 154 | 45 |
| get_recent_tool_calls | 223 | 1.9% | 114 | 67 |
| move_file | 213 | 1.8% | 116 | 48 |
| create_directory | 191 | 1.6% | 111 | 39 |
| list_sessions | 186 | 1.6% | 118 | 29 |
| stop_search | 176 | 1.5% | 93 | 41 |
| list_searches | 129 | 1.1% | 64 | 29 |
| kill_process | 128 | 1.1% | 46 | 39 |
| force_terminate | 116 | 1.0% | 32 | 39 |
| get_usage_stats | 114 | 1.0% | 50 | 29 |
| list_processes | 112 | 0.9% | 48 | 29 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-08-19 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 11,836 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 11,056 | 6.6% of the capture is MCP-only metadata |
| **Claude, same fields** | **19,305** | 1.63× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | change |
|---|---:|---:|---:|
| 2026-08-18 | 11,835 | 26 | — |
| 2026-08-19 | 11,836 | 26 | +1 |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/desktop-commander/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/desktop-commander/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/desktop-commander.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
