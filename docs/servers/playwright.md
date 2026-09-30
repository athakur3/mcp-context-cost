# playwright — context cost

**4,413 tokens** across 25 tools — *light* (1–5K). Measured 2026-09-30 under [methodology v1.0](../METHODOLOGY.html).

An Anthropic request carries 3,764 of those tokens as tool definitions. What Claude makes of them is not published for this server: its Claude count is missing, or was taken against a capture this measurement has since replaced.

| | |
|---|---|
| server (self-reported) | Playwright v1.64.0-alpha-1790635538000 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @playwright/mcp@latest` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `af2dba5441a3ab02c472d49212573e953d5e60084942ee079c8f6bd8e6a1c5de` |
| category | vendor-official |
| source | https://github.com/microsoft/playwright-mcp |

## Where the tokens are

| tool | tokens | share | description | input schema |
|---|---:|---:|---:|---:|
| browser_take_screenshot | 336 | 7.6% | 23 | 275 |
| browser_emulate_media | 281 | 6.4% | 32 | 210 |
| browser_fill_form | 255 | 5.8% | 4 | 214 |
| browser_find | 253 | 5.7% | 63 | 153 |
| browser_drop | 243 | 5.5% | 34 | 169 |
| browser_network_request | 218 | 4.9% | 33 | 147 |
| browser_run_code_unsafe | 212 | 4.8% | 26 | 143 |
| browser_click | 205 | 4.6% | 6 | 164 |
| browser_type | 198 | 4.5% | 5 | 157 |
| browser_evaluate | 195 | 4.4% | 8 | 149 |
| browser_network_requests | 195 | 4.4% | 24 | 134 |
| browser_snapshot | 194 | 4.4% | 13 | 145 |
| browser_console_messages | 192 | 4.4% | 4 | 150 |
| browser_drag | 183 | 4.1% | 7 | 140 |
| browser_select_option | 162 | 3.7% | 6 | 119 |
| browser_tabs | 154 | 3.5% | 12 | 107 |
| browser_wait_for | 133 | 3.0% | 13 | 83 |
| browser_hover | 122 | 2.8% | 5 | 81 |
| browser_handle_dialog | 112 | 2.5% | 3 | 71 |
| browser_file_upload | 111 | 2.5% | 5 | 69 |
| browser_press_key | 110 | 2.5% | 6 | 66 |
| browser_resize | 107 | 2.4% | 4 | 66 |
| browser_navigate | 92 | 2.1% | 4 | 49 |
| browser_navigate_back | 78 | 1.8% | 9 | 31 |
| browser_close | 70 | 1.6% | 3 | 31 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 4,024 | 24 | not recorded | not recorded | — |
| 2026-08-18 | 4,024 | 24 | not recorded | docker | no change |
| 2026-09-04 | 4,024 | 24 | 1.63.0-alpha-2026-08-31 | docker | no change |
| 2026-09-05 | 4,024 | 24 | 1.63.0-alpha-2026-08-31 | docker | no change |
| 2026-09-09 | 4,024 | 24 | 1.63.0-alpha-2026-08-31 | docker | no change |
| 2026-09-30 | 4,413 | 25 | 1.64.0-alpha-1790635538000 | docker | +389 |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/playwright/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/playwright/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/playwright.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
