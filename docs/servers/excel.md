# excel — context cost

**10,493 tokens** across 26 tools — *moderate* (5–15K). Measured 2026-09-30 under [methodology v1.0](../METHODOLOGY.html).

An Anthropic request carries 7,798 of those tokens as tool definitions. What Claude makes of them is not published for this server: its Claude count is missing, or was taken against a capture this measurement has since replaced.

| | |
|---|---|
| server (self-reported) | excel-mcp-server v1.1.1 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx excel-mcp-server stdio` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `821aae9d8816d70368d42aea139dc573c8ca9a1a71cdc99e15611ce2cf576c81` |
| category | community |
| source | https://github.com/haris-musa/excel-mcp-server |

## Where the tokens are

| tool | tokens | share | description | input schema | output schema |
|---|---:|---:|---:|---:|---:|
| format_range | 884 | 8.4% | 71 | 732 | 29 |
| set_sheet_layout | 763 | 7.3% | 93 | 588 | 30 |
| add_data_validation | 685 | 6.5% | 79 | 524 | 30 |
| add_conditional_format | 680 | 6.5% | 85 | 511 | 31 |
| describe_sheet | 647 | 6.2% | 29 | 99 | 472 |
| create_chart | 618 | 5.9% | 36 | 505 | 29 |
| create_summary_table | 512 | 4.9% | 65 | 367 | 30 |
| read_range | 502 | 4.8% | 60 | 263 | 131 |
| find_cells | 500 | 4.8% | 12 | 304 | 138 |
| read_vba | 452 | 4.3% | 102 | 153 | 147 |
| write_range | 414 | 3.9% | 115 | 194 | 57 |
| describe_workbook | 375 | 3.6% | 48 | 74 | 203 |
| insert_rows_or_columns | 323 | 3.1% | 41 | 199 | 31 |
| delete_rows_or_columns | 323 | 3.1% | 41 | 199 | 31 |
| create_table | 319 | 3.0% | 16 | 228 | 29 |
| copy_range | 302 | 2.9% | 29 | 196 | 29 |
| merge_cells | 270 | 2.6% | 23 | 167 | 29 |
| clear_range | 257 | 2.4% | 14 | 168 | 29 |
| create_workbook | 236 | 2.2% | 8 | 151 | 30 |
| create_sheet | 229 | 2.2% | 5 | 149 | 29 |
| rename_sheet | 229 | 2.2% | 16 | 138 | 29 |
| copy_sheet | 227 | 2.2% | 14 | 138 | 29 |
| import_workbook | 222 | 2.1% | 17 | 128 | 30 |
| list_workbooks | 218 | 2.1% | 7 | 70 | 93 |
| delete_sheet | 182 | 1.7% | 8 | 99 | 29 |
| export_workbook | 147 | 1.4% | 27 | 74 | 0 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 4,266 | 25 | not recorded | not recorded | — |
| 2026-08-19 | 4,266 | 25 | not recorded | docker | no change |
| 2026-09-04 | 4,266 | 25 | 1.29.1 | docker | no change |
| 2026-09-05 | 4,266 | 25 | 1.29.1 | docker | no change |
| 2026-09-09 | 4,266 | 25 | 1.30.0 | docker | no change |
| 2026-09-30 | 10,493 | 26 | 1.1.1 | docker | +6,227 |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/excel/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/excel/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/excel.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
