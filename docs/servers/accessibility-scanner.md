# accessibility-scanner — context cost

**9,111 tokens** across 33 tools — *moderate* (5–15K). Measured 2026-09-30 under [methodology v1.0](../METHODOLOGY.html).

An Anthropic request carries 8,055 of those tokens as tool definitions. What Claude makes of them is not published for this server: its Claude count is missing, or was taken against a capture this measurement has since replaced.

| | |
|---|---|
| server (self-reported) | Playwright v3.5.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y mcp-accessibility-scanner` |
| isolation | docker · public.ecr.aws/docker/library/node:24-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `7b69b6e616dc3719801b349ba9db1ec673fa20bcab58ef64b749bf4efac03ec1` |
| category | community |
| source | https://github.com/JustasMonkev/mcp-accessibility-scanner |

## Where the tokens are

| tool | tokens | share | description | input schema |
|---|---:|---:|---:|---:|
| audit_site | 1,100 | 12.1% | 12 | 1,046 |
| scan_page_matrix | 989 | 10.9% | 14 | 932 |
| scan_page | 854 | 9.4% | 9 | 798 |
| audit_keyboard | 643 | 7.1% | 17 | 582 |
| browser_take_screenshot | 403 | 4.4% | 23 | 336 |
| audit_screen_reader | 296 | 3.2% | 16 | 235 |
| browser_drop | 273 | 3.0% | 16 | 214 |
| browser_fill_form | 266 | 2.9% | 4 | 220 |
| browser_emulate_media | 249 | 2.7% | 17 | 179 |
| browser_find | 239 | 2.6% | 39 | 156 |
| browser_type | 234 | 2.6% | 5 | 188 |
| browser_snapshot | 220 | 2.4% | 13 | 166 |
| browser_drag | 217 | 2.4% | 7 | 169 |
| browser_evaluate | 214 | 2.3% | 8 | 162 |
| browser_click | 204 | 2.2% | 6 | 159 |
| browser_select_option | 197 | 2.2% | 6 | 149 |
| browser_session_open | 187 | 2.1% | 106 | 31 |
| browser_default_timeout | 174 | 1.9% | 30 | 103 |
| browser_tabs | 172 | 1.9% | 12 | 120 |
| browser_network_request | 171 | 1.9% | 18 | 107 |
| browser_wait_for | 168 | 1.8% | 13 | 113 |
| browser_navigation_timeout | 167 | 1.8% | 24 | 102 |
| browser_hover | 158 | 1.7% | 5 | 112 |
| browser_handle_dialog | 153 | 1.7% | 3 | 106 |
| browser_press_key | 151 | 1.7% | 6 | 101 |
| browser_file_upload | 150 | 1.6% | 5 | 103 |
| browser_resize | 148 | 1.6% | 4 | 101 |
| browser_navigate | 134 | 1.5% | 4 | 84 |
| browser_session_close | 129 | 1.4% | 25 | 61 |
| browser_network_requests | 116 | 1.3% | 8 | 64 |

*3 smaller tools omitted (333 tokens combined) — all of them are in the [raw capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/accessibility-scanner/measurement.json).*

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-09-05 | 8,959 | 33 | 3.3.2 | docker | — |
| 2026-09-09 | 9,247 | 34 | 3.4.0 | docker | +288 |
| 2026-09-30 | 9,111 | 33 | 3.5.0 | docker | −136 |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/accessibility-scanner/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/accessibility-scanner/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/accessibility-scanner.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
