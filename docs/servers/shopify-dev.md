# shopify-dev — context cost

**5,624 tokens** across 5 tools — *moderate* (5–15K). Measured 2026-08-19 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | shopify-dev-mcp v1.14.4 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @shopify/dev-mcp@latest` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials, shared package cache by |
| env vars supplied | none |
| canonical SHA-256 | `6c863ee06d8d4d8fb2ade2e07673c087b75cc1482b3e521e9c9375151860c659` |
| category | vendor-official |
| source | https://shopify.dev/docs/apps/build/devmcp (GitHub repo not public) |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| learn_shopify_api | 2,518 | 44.8% | 2,102 | 344 |
| validate_graphql_codeblocks | 1,179 | 21.0% | 202 | 949 |
| validate_component_codeblocks | 1,173 | 20.9% | 547 | 550 |
| validate_theme | 451 | 8.0% | 194 | 236 |
| search_docs_chunks | 301 | 5.4% | 29 | 253 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-08-24 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 5,624 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 5,584 | 0.7% of the capture is MCP-only metadata |
| **Claude, same fields** | **9,805** | 1.74× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-16 | 5,624 | 5 | not recorded | — |
| 2026-08-19 | 5,624 | 5 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/shopify-dev/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/shopify-dev/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/shopify-dev.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
