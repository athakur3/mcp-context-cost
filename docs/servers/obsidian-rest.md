# obsidian-rest — context cost

**10,173 tokens** across 12 tools — *moderate* (5–15K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | @cyanheads/mcp-ts-core v0.8.18 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y obsidian-mcp-server` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | OBSIDIAN_API_KEY |
| canonical SHA-256 | `85d23a7fa63923641625701d0c5fff39249eb8b379c3c1a7a444fef6437d6bc4` |
| category | community |
| source | https://github.com/cyanheads/obsidian-mcp-server |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| obsidian_get_note | 1,523 | 15.0% | 41 | 578 |
| obsidian_search_notes | 1,369 | 13.5% | 83 | 368 |
| obsidian_manage_tags | 1,052 | 10.3% | 96 | 404 |
| obsidian_patch_note | 1,028 | 10.1% | 58 | 729 |
| obsidian_write_note | 933 | 9.2% | 129 | 643 |
| obsidian_manage_frontmatter | 878 | 8.6% | 41 | 409 |
| obsidian_append_to_note | 817 | 8.0% | 124 | 570 |
| obsidian_replace_in_note | 812 | 8.0% | 54 | 555 |
| obsidian_list_notes | 774 | 7.6% | 75 | 197 |
| obsidian_delete_note | 438 | 4.3% | 41 | 289 |
| obsidian_open_in_ui | 298 | 2.9% | 35 | 121 |
| obsidian_list_tags | 249 | 2.4% | 59 | 24 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 10,173 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 5,878 | 42.2% of the capture is MCP-only metadata |
| **Claude, same fields** | **10,172** | 1.00× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-09-03 | 10,173 | 12 | not recorded | docker | — |
| 2026-09-04 | 10,173 | 12 | 0.8.18 | docker | no change |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/obsidian-rest/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/obsidian-rest/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/obsidian-rest.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
