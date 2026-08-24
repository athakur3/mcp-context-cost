# basic-memory — context cost

**9,188 tokens** across 23 tools — *moderate* (5–15K). Measured 2026-08-19 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | Basic Memory v3.3.1 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx basic-memory mcp` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `0ba9e9185e3d5c167bbaf0dcfeb499f27020c307f1387a3b85374f849f0a38a7` |
| category | community |
| source | https://github.com/basicmachines-co/basic-memory |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| search_notes | 970 | 10.6% | 13 | 869 |
| write_note | 780 | 8.5% | 23 | 662 |
| edit_note | 722 | 7.9% | 28 | 606 |
| schema_validate | 710 | 7.7% | 9 | 229 |
| build_context | 687 | 7.5% | 195 | 386 |
| recent_activity | 636 | 6.9% | 61 | 468 |
| move_note | 531 | 5.8% | 16 | 427 |
| read_note | 501 | 5.5% | 9 | 404 |
| delete_note | 398 | 4.3% | 12 | 293 |
| canvas | 381 | 4.1% | 13 | 287 |
| create_memory_project | 365 | 4.0% | 39 | 234 |
| list_directory | 352 | 3.8% | 9 | 268 |
| schema_infer | 314 | 3.4% | 11 | 214 |
| schema_diff | 264 | 2.9% | 11 | 165 |
| read_content | 257 | 2.8% | 10 | 190 |
| view_note | 242 | 2.6% | 11 | 158 |
| delete_project | 241 | 2.6% | 41 | 124 |
| list_memory_projects | 234 | 2.5% | 86 | 54 |
| list_workspaces | 161 | 1.8% | 16 | 52 |
| fetch | 135 | 1.5% | 9 | 39 |
| search | 133 | 1.4% | 7 | 40 |
| release_notes | 98 | 1.1% | 11 | 14 |
| cloud_info | 97 | 1.1% | 10 | 14 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-08-24 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 9,188 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 7,120 | 22.5% of the capture is MCP-only metadata |
| **Claude, same fields** | **12,426** | 1.35× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-16 | 9,188 | 23 | not recorded | — |
| 2026-08-19 | 9,188 | 23 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/basic-memory/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/basic-memory/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/basic-memory.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
