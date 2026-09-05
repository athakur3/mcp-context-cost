# chrome-devtools — context cost

**5,717 tokens** across 29 tools — *moderate* (5–15K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | chrome_devtools v1.8.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y chrome-devtools-mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `151a59215c20049ea5934809670996c1d73977d468a65fa6b5624c2e24ca3ef4` |
| category | vendor-official |
| source | https://github.com/ChromeDevTools/chrome-devtools-mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| emulate | 418 | 7.3% | 9 | 377 |
| list_console_messages | 333 | 5.8% | 13 | 287 |
| evaluate_script | 320 | 5.6% | 27 | 261 |
| take_screenshot | 278 | 4.9% | 9 | 236 |
| list_network_requests | 277 | 4.8% | 14 | 231 |
| navigate_page | 266 | 4.7% | 21 | 214 |
| fill_form | 265 | 4.6% | 68 | 166 |
| performance_start_trace | 249 | 4.4% | 35 | 182 |
| get_network_request | 215 | 3.8% | 24 | 159 |
| take_snapshot | 211 | 3.7% | 62 | 116 |
| new_page | 205 | 3.6% | 17 | 157 |
| lighthouse_audit | 197 | 3.4% | 30 | 132 |
| upload_file | 197 | 3.4% | 8 | 158 |
| press_key | 190 | 3.3% | 34 | 124 |
| performance_analyze_insight | 188 | 3.3% | 24 | 130 |
| fill | 186 | 3.3% | 19 | 137 |
| wait_for | 161 | 2.8% | 12 | 118 |
| click | 156 | 2.7% | 5 | 120 |
| drag | 154 | 2.7% | 6 | 117 |
| performance_stop_trace | 143 | 2.5% | 11 | 100 |
| handle_dialog | 141 | 2.5% | 13 | 96 |
| take_heapsnapshot | 137 | 2.4% | 24 | 80 |
| type_text | 137 | 2.4% | 9 | 96 |
| hover | 135 | 2.4% | 5 | 99 |
| get_console_message | 131 | 2.3% | 19 | 79 |
| select_page | 125 | 2.2% | 11 | 83 |
| resize_page | 124 | 2.2% | 13 | 78 |
| close_page | 106 | 1.9% | 16 | 59 |
| list_pages | 70 | 1.2% | 10 | 29 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-09-03 | 5,717 | 29 | not recorded | docker | — |
| 2026-09-04 | 5,717 | 29 | 1.8.0 | docker | no change |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/chrome-devtools/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/chrome-devtools/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/chrome-devtools.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
