# obsidian — context cost

**2,062 tokens** across 15 tools — *light* (1–5K). Measured 2026-08-26 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | mcp-obsidian v1.29.1 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx --with "mcp\<2" mcp-obsidian` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | OBSIDIAN_API_KEY |
| canonical SHA-256 | `6064f85a43ae17b2da72d1b87fd9435879e8b42bc320e1347e382f5c8a61b499` |
| category | community |
| source | https://github.com/MarkusPfundstein/mcp-obsidian |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| obsidian_complex_search | 492 | 23.9% | 241 | 198 |
| obsidian_patch_content | 263 | 12.8% | 69 | 182 |
| obsidian_search_by_tag | 167 | 8.1% | 82 | 72 |
| obsidian_put_content | 146 | 7.1% | 69 | 65 |
| obsidian_get_periodic_note | 135 | 6.5% | 9 | 112 |
| obsidian_get_recent_periodic_notes | 134 | 6.5% | 11 | 108 |
| obsidian_simple_search | 105 | 5.1% | 30 | 61 |
| obsidian_get_frontmatter | 97 | 4.7% | 48 | 36 |
| obsidian_get_recent_changes | 93 | 4.5% | 8 | 72 |
| obsidian_delete_file | 87 | 4.2% | 9 | 66 |
| obsidian_batch_get_file_contents | 84 | 4.1% | 15 | 55 |
| obsidian_append_content | 78 | 3.8% | 12 | 54 |
| obsidian_list_files_in_dir | 74 | 3.6% | 15 | 45 |
| obsidian_get_file_contents | 62 | 3.0% | 11 | 38 |
| obsidian_list_files_in_vault | 43 | 2.1% | 16 | 12 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-18 | 1,132 | 12 | not recorded | — |
| 2026-08-19 | 1,132 | 12 | docker | no change |
| 2026-08-26 | 2,062 | 15 | docker | +930 |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/obsidian/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/obsidian/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/obsidian.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
