# serena — context cost

**8,204 tokens** across 29 tools — *moderate* (5–15K). Measured 2026-08-17 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | Serena v1.28.1 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx --from git+https://github.com/oraios/serena serena start-mcp-server` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials, git installed |
| env vars supplied | none |
| canonical SHA-256 | `7d876a84707e0689df306366dc7c3225ae49762ca045d7604c7c9a2b20dfbc3c` |
| category | community |
| source | https://github.com/oraios/serena |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| find_symbol | 883 | 10.8% | 273 | 530 |
| replace_in_files | 801 | 9.8% | 225 | 497 |
| search_for_pattern | 524 | 6.4% | 48 | 405 |
| replace_content | 479 | 5.8% | 128 | 282 |
| find_declaration | 355 | 4.3% | 8 | 280 |
| find_implementations | 346 | 4.2% | 27 | 249 |
| get_diagnostics_for_file | 338 | 4.1% | 52 | 211 |
| execute_shell_command | 330 | 4.0% | 79 | 179 |
| edit_memory | 325 | 4.0% | 10 | 249 |
| find_referencing_symbols | 310 | 3.8% | 48 | 190 |
| get_symbols_overview | 301 | 3.7% | 59 | 171 |
| read_file | 291 | 3.5% | 23 | 202 |
| list_dir | 277 | 3.4% | 30 | 181 |
| replace_symbol_body | 246 | 3.0% | 36 | 138 |
| write_memory | 232 | 2.8% | 74 | 85 |
| insert_before_symbol | 231 | 2.8% | 56 | 105 |
| rename_symbol | 223 | 2.7% | 59 | 97 |
| insert_after_symbol | 205 | 2.5% | 24 | 110 |
| find_file | 180 | 2.2% | 25 | 89 |
| safe_delete_symbol | 175 | 2.1% | 31 | 75 |
| rename_memory | 174 | 2.1% | 56 | 47 |
| create_text_file | 162 | 2.0% | 22 | 71 |
| initial_instructions | 135 | 1.6% | 52 | 14 |
| activate_project | 124 | 1.5% | 11 | 47 |
| read_memory | 123 | 1.5% | 26 | 31 |
| delete_memory | 114 | 1.4% | 17 | 31 |
| onboarding | 112 | 1.4% | 31 | 14 |
| get_current_config | 105 | 1.3% | 22 | 14 |
| list_memories | 101 | 1.2% | 9 | 25 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/serena/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/serena/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/serena.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
