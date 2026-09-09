# accessibility-scanner — context cost

**9,247 tokens** across 34 tools — *moderate* (5–15K). Measured 2026-09-09 under [methodology v1.0](../METHODOLOGY.html).

An Anthropic request carries 8,151 of those tokens as tool definitions, and Claude counts those at **14,771**.

| | |
|---|---|
| server (self-reported) | Playwright v3.4.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y mcp-accessibility-scanner` |
| isolation | docker · public.ecr.aws/docker/library/node:24-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `42d3cde136eda54a68cea42f820dbadf27e15394b10daa8ed26c90fd8fb59fcc` |
| category | community |
| source | https://github.com/JustasMonkev/mcp-accessibility-scanner |

## Where the tokens are

| tool | tokens | share | description | input schema |
|---|---:|---:|---:|---:|
| audit_site | 1,100 | 11.9% | 12 | 1,046 |
| scan_page_matrix | 989 | 10.7% | 14 | 932 |
| scan_page | 854 | 9.2% | 9 | 798 |
| audit_keyboard | 643 | 7.0% | 17 | 582 |
| browser_take_screenshot | 403 | 4.4% | 23 | 336 |
| audit_screen_reader | 296 | 3.2% | 16 | 235 |
| browser_drop | 273 | 3.0% | 16 | 214 |
| browser_fill_form | 266 | 2.9% | 4 | 220 |
| browser_emulate_media | 249 | 2.7% | 17 | 179 |
| browser_find | 239 | 2.6% | 39 | 156 |
| browser_type | 234 | 2.5% | 5 | 188 |
| browser_snapshot | 220 | 2.4% | 13 | 166 |
| browser_drag | 217 | 2.3% | 7 | 169 |
| browser_evaluate | 214 | 2.3% | 8 | 162 |
| browser_click | 204 | 2.2% | 6 | 159 |
| browser_select_option | 197 | 2.1% | 6 | 149 |
| browser_session_open | 187 | 2.0% | 106 | 31 |
| browser_default_timeout | 174 | 1.9% | 30 | 103 |
| browser_tabs | 172 | 1.9% | 12 | 120 |
| browser_network_request | 171 | 1.8% | 18 | 107 |
| browser_wait_for | 168 | 1.8% | 13 | 113 |
| browser_navigation_timeout | 167 | 1.8% | 24 | 102 |
| browser_hover | 158 | 1.7% | 5 | 112 |
| browser_handle_dialog | 153 | 1.7% | 3 | 106 |
| browser_press_key | 151 | 1.6% | 6 | 101 |
| browser_file_upload | 150 | 1.6% | 5 | 103 |
| browser_resize | 148 | 1.6% | 4 | 101 |
| browser_install | 136 | 1.5% | 22 | 64 |
| browser_navigate | 134 | 1.4% | 4 | 84 |
| browser_session_close | 129 | 1.4% | 25 | 61 |

*4 smaller tools omitted (449 tokens combined) — all of them are in the [raw capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/accessibility-scanner/measurement.json).*

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-09 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 9,247 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 8,151 | 11.9% of the capture is MCP-only metadata |
| **Claude, same fields** | **14,771** | 1.60× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-09-05 | 8,959 | 33 | 3.3.2 | docker | — |
| 2026-09-09 | 9,247 | 34 | 3.4.0 | docker | +288 |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/accessibility-scanner/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/accessibility-scanner/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/accessibility-scanner.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
