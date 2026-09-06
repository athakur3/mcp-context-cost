# appium-mcp — context cost

**10,267 tokens** across 31 tools — *moderate* (5–15K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | MCP Appium v1.92.13 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y appium-mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · architecture not on record · network enabled for package fetch; clean FS, no host credent |
| env vars supplied | none |
| canonical SHA-256 | `d024ca5b97d52d5442da395ed92d1d107b6728db57cf1295bb87c5d3624c0e53` |
| category | vendor-official |
| source | https://github.com/appium/appium-mcp |

## Where the tokens are

| tool | tokens | share | description | input schema |
|---|---:|---:|---:|---:|
| appium_gesture | 1,308 | 12.7% | 94 | 1,188 |
| appium_session_management | 971 | 9.5% | 48 | 891 |
| appium_perform_actions | 623 | 6.1% | 80 | 516 |
| appium_find_element | 533 | 5.2% | 154 | 344 |
| appium_screen_recording | 513 | 5.0% | 21 | 465 |
| appium_mobile_permissions | 479 | 4.7% | 23 | 430 |
| appium_app_lifecycle | 444 | 4.3% | 14 | 403 |
| select_device | 434 | 4.2% | 254 | 146 |
| appium_drag_and_drop | 416 | 4.1% | 70 | 319 |
| appium_geolocation | 384 | 3.7% | 113 | 245 |
| appium_prepare_ios_real_device | 356 | 3.5% | 179 | 147 |
| prepare_ios_simulator | 348 | 3.4% | 157 | 164 |
| appium_screenshot | 277 | 2.7% | 19 | 212 |
| appium_mobile_press_key | 267 | 2.6% | 30 | 210 |
| appium_driver_settings | 261 | 2.5% | 59 | 176 |
| appium_mobile_file | 255 | 2.5% | 27 | 202 |
| appium_mobile_keyboard | 222 | 2.2% | 43 | 153 |
| appium_get_element_attribute | 222 | 2.2% | 45 | 149 |
| appium_mobile_device_control | 221 | 2.2% | 30 | 164 |
| appium_mobile_device_info | 216 | 2.1% | 37 | 152 |
| appium_set_value | 179 | 1.7% | 5 | 147 |
| appium_mobile_clipboard | 172 | 1.7% | 33 | 112 |
| appium_context | 166 | 1.6% | 26 | 115 |
| appium_orientation | 158 | 1.5% | 24 | 108 |
| appium_alert | 154 | 1.5% | 19 | 110 |
| appium_generate_tests | 151 | 1.5% | 71 | 54 |
| generate_locators | 132 | 1.3% | 37 | 50 |
| appium_get_active_element | 115 | 1.1% | 37 | 50 |
| appium_get_page_source | 109 | 1.1% | 11 | 50 |
| appium_get_text | 106 | 1.0% | 5 | 74 |

*1 smaller tools omitted (103 tokens combined) — all of them are in the [raw capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/appium-mcp/measurement.json).*

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 10,267 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 9,798 | 4.6% of the capture is MCP-only metadata |
| **Claude, same fields** | **17,001** | 1.66× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-09-03 | 10,267 | 31 | not recorded | docker | — |
| 2026-09-04 | 10,267 | 31 | 1.92.13 | docker | no change |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/appium-mcp/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/appium-mcp/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/appium-mcp.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
