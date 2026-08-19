# puppeteer — context cost

**540 tokens** across 7 tools — *lean* (< 1K). Measured 2026-08-19 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | example-servers/puppeteer v0.1.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @modelcontextprotocol/server-puppeteer` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `d9e46f0316917c1d140ffeebceefd4d31c16188780ac278baf347ff536015dd0` |
| category | official-reference |
| source | https://github.com/modelcontextprotocol/servers-archived |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| puppeteer_screenshot | 142 | 26.3% | 11 | 117 |
| puppeteer_navigate | 129 | 23.9% | 4 | 111 |
| puppeteer_select | 65 | 12.0% | 9 | 43 |
| puppeteer_fill | 60 | 11.1% | 5 | 42 |
| puppeteer_evaluate | 48 | 8.9% | 7 | 27 |
| puppeteer_click | 47 | 8.7% | 6 | 28 |
| puppeteer_hover | 47 | 8.7% | 6 | 28 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | change |
|---|---:|---:|---:|
| 2026-08-16 | 540 | 7 | — |
| 2026-08-19 | 540 | 7 | no change |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/puppeteer/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/puppeteer/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/puppeteer.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
