# accessibility-scanner — context cost

**8,959 tokens** across 33 tools — *moderate* (5–15K). Measured 2026-09-05 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | Playwright v3.3.2 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y mcp-accessibility-scanner` |
| isolation | docker · public.ecr.aws/docker/library/node:24-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `09ec3a887ad0244e50e5f3ae1ae117d1dc3979ba5e96be187961d55b5022c8fa` |
| category | community |
| source | https://github.com/JustasMonkev/mcp-accessibility-scanner |

## Where the tokens are

| tool | tokens | share | description | input schema |
|---|---:|---:|---:|---:|
| audit_site | 1,100 | 12.3% | 12 | 1,046 |
| scan_page_matrix | 989 | 11.0% | 14 | 932 |
| scan_page | 854 | 9.5% | 9 | 798 |
| audit_keyboard | 643 | 7.2% | 17 | 582 |
| browser_take_screenshot | 410 | 4.6% | 23 | 343 |
| audit_screen_reader | 296 | 3.3% | 16 | 235 |
| browser_drop | 273 | 3.0% | 16 | 214 |
| browser_fill_form | 266 | 3.0% | 4 | 220 |
| browser_find | 239 | 2.7% | 39 | 156 |
| browser_type | 234 | 2.6% | 5 | 188 |
| browser_drag | 217 | 2.4% | 7 | 169 |
| browser_evaluate | 214 | 2.4% | 8 | 162 |
| browser_click | 204 | 2.3% | 6 | 159 |
| browser_select_option | 197 | 2.2% | 6 | 149 |
| browser_session_open | 187 | 2.1% | 106 | 31 |
| browser_snapshot | 174 | 1.9% | 13 | 120 |
| browser_default_timeout | 174 | 1.9% | 30 | 103 |
| browser_tabs | 172 | 1.9% | 12 | 120 |
| browser_network_request | 171 | 1.9% | 18 | 107 |
| browser_wait_for | 168 | 1.9% | 13 | 113 |
| browser_navigation_timeout | 167 | 1.9% | 24 | 102 |
| browser_hover | 158 | 1.8% | 5 | 112 |
| browser_handle_dialog | 153 | 1.7% | 3 | 106 |
| browser_press_key | 151 | 1.7% | 6 | 101 |
| browser_file_upload | 150 | 1.7% | 5 | 103 |
| browser_resize | 148 | 1.7% | 4 | 101 |
| browser_install | 136 | 1.5% | 22 | 64 |
| browser_navigate | 134 | 1.5% | 4 | 84 |
| browser_session_close | 129 | 1.4% | 25 | 61 |
| browser_network_requests | 116 | 1.3% | 8 | 64 |

*3 smaller tools omitted (333 tokens combined) — all of them are in the [raw capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/accessibility-scanner/measurement.json).*

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 8,959 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 7,904 | 11.8% of the capture is MCP-only metadata |
| **Claude, same fields** | **14,301** | 1.60× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/accessibility-scanner/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/accessibility-scanner/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/accessibility-scanner.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
