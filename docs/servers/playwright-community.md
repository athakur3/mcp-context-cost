# playwright-community — context cost

**2,920 tokens** across 33 tools — *light* (1–5K). Measured 2026-08-16 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | playwright-mcp v1.0.11 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @executeautomation/playwright-mcp-server` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `4af7a9d131b4506471d83cc2d014ffc39b784a16ff181cce05ae2d9f26dbe9ff` |
| category | community |
| source | https://github.com/executeautomation/mcp-playwright |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| playwright_get_visible_html | 228 | 7.8% | 31 | 184 |
| playwright_resize | 205 | 7.0% | 39 | 155 |
| playwright_screenshot | 193 | 6.6% | 11 | 169 |
| playwright_navigate | 174 | 6.0% | 4 | 157 |
| playwright_save_as_pdf | 155 | 5.3% | 8 | 133 |
| playwright_console_logs | 138 | 4.7% | 9 | 116 |
| start_codegen_session | 125 | 4.3% | 11 | 102 |
| playwright_post | 100 | 3.4% | 5 | 83 |
| playwright_put | 100 | 3.4% | 5 | 83 |
| playwright_patch | 100 | 3.4% | 5 | 83 |
| playwright_expect_response | 99 | 3.4% | 26 | 61 |
| playwright_assert_response | 99 | 3.4% | 12 | 75 |
| playwright_iframe_fill | 91 | 3.1% | 9 | 68 |
| playwright_get | 82 | 2.8% | 5 | 65 |
| playwright_delete | 82 | 2.8% | 5 | 65 |
| playwright_upload_file | 77 | 2.6% | 14 | 50 |
| playwright_iframe_click | 76 | 2.6% | 9 | 53 |
| playwright_press_key | 74 | 2.5% | 4 | 57 |
| playwright_drag | 70 | 2.4% | 7 | 51 |
| playwright_select | 64 | 2.2% | 9 | 43 |
| playwright_fill | 59 | 2.0% | 5 | 42 |
| playwright_custom_user_agent | 55 | 1.9% | 8 | 33 |
| playwright_click_and_switch_tab | 54 | 1.8% | 10 | 29 |
| end_codegen_session | 52 | 1.8% | 10 | 30 |
| clear_codegen_session | 51 | 1.7% | 9 | 30 |
| get_codegen_session | 49 | 1.7% | 7 | 30 |
| playwright_click | 47 | 1.6% | 6 | 29 |
| playwright_evaluate | 47 | 1.6% | 7 | 27 |
| playwright_hover | 46 | 1.6% | 6 | 28 |
| playwright_get_visible_text | 35 | 1.2% | 9 | 12 |

*3 smaller tools omitted (91 tokens combined) — all of them are in the [raw capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/playwright-community/measurement.json).*

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/playwright-community/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/playwright-community/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/playwright-community.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
