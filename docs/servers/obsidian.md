# obsidian — context cost

**1,132 tokens** across 12 tools — *light* (1–5K). Measured 2026-08-18 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | mcp-obsidian v1.29.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx --with "mcp\<2" mcp-obsidian` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | OBSIDIAN_API_KEY |
| canonical SHA-256 | `4f3971a8c6858e81f7a2834791f4b1de1b4b967efa575ddc6d8968fb69cb41c8` |
| category | community |
| source | https://github.com/MarkusPfundstein/mcp-obsidian |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| obsidian_patch_content | 167 | 14.8% | 19 | 136 |
| obsidian_get_recent_periodic_notes | 134 | 11.8% | 11 | 108 |
| obsidian_complex_search | 129 | 11.4% | 61 | 51 |
| obsidian_simple_search | 105 | 9.3% | 30 | 61 |
| obsidian_get_recent_changes | 93 | 8.2% | 8 | 72 |
| obsidian_delete_file | 87 | 7.7% | 9 | 66 |
| obsidian_batch_get_file_contents | 84 | 7.4% | 15 | 55 |
| obsidian_append_content | 78 | 6.9% | 12 | 54 |
| obsidian_list_files_in_dir | 74 | 6.5% | 15 | 45 |
| obsidian_get_periodic_note | 74 | 6.5% | 9 | 51 |
| obsidian_get_file_contents | 62 | 5.5% | 11 | 38 |
| obsidian_list_files_in_vault | 43 | 3.8% | 16 | 12 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/obsidian/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/obsidian/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/obsidian.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
