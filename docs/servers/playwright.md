# playwright — context cost

**4,024 tokens** across 24 tools — *light* (1–5K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | Playwright v1.63.0-alpha-2026-08-31 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @playwright/mcp@latest` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `5d5d92a7c727ef75bd9a70f076039dbdbfd331c56f022915c2e89b76f7fc88f0` |
| category | vendor-official |
| source | https://github.com/microsoft/playwright-mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| browser_take_screenshot | 329 | 8.2% | 23 | 268 |
| browser_fill_form | 255 | 6.3% | 4 | 214 |
| browser_drop | 243 | 6.0% | 34 | 169 |
| browser_find | 221 | 5.5% | 63 | 121 |
| browser_network_request | 207 | 5.1% | 33 | 136 |
| browser_click | 205 | 5.1% | 6 | 164 |
| browser_run_code_unsafe | 202 | 5.0% | 26 | 133 |
| browser_type | 198 | 4.9% | 5 | 157 |
| browser_evaluate | 184 | 4.6% | 8 | 138 |
| browser_network_requests | 184 | 4.6% | 24 | 123 |
| browser_snapshot | 184 | 4.6% | 13 | 135 |
| browser_drag | 183 | 4.5% | 7 | 140 |
| browser_console_messages | 181 | 4.5% | 4 | 139 |
| browser_select_option | 162 | 4.0% | 6 | 119 |
| browser_tabs | 154 | 3.8% | 12 | 107 |
| browser_wait_for | 128 | 3.2% | 13 | 78 |
| browser_hover | 122 | 3.0% | 5 | 81 |
| browser_handle_dialog | 112 | 2.8% | 3 | 71 |
| browser_file_upload | 111 | 2.8% | 5 | 69 |
| browser_press_key | 110 | 2.7% | 6 | 66 |
| browser_resize | 107 | 2.7% | 4 | 66 |
| browser_navigate | 92 | 2.3% | 4 | 49 |
| browser_navigate_back | 78 | 1.9% | 9 | 31 |
| browser_close | 70 | 1.7% | 3 | 31 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 4,024 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 3,402 | 15.5% of the capture is MCP-only metadata |
| **Claude, same fields** | **6,172** | 1.53× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 4,024 | 24 | not recorded | not recorded | — |
| 2026-08-18 | 4,024 | 24 | not recorded | docker | no change |
| 2026-09-04 | 4,024 | 24 | 1.63.0-alpha-2026-08-31 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/playwright/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/playwright/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/playwright.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
