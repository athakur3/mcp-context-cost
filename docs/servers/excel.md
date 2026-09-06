# excel — context cost

**4,266 tokens** across 25 tools — *light* (1–5K). Measured 2026-09-05 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | excel-mcp v1.29.1 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx excel-mcp-server stdio` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `cf374a8866847f36b743f5b59176d3908466f40c2d5d9b3cb0462ea47af40999` |
| category | community |
| source | https://github.com/haris-musa/excel-mcp-server |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| format_range | 472 | 11.1% | 8 | 408 |
| read_data_from_excel | 293 | 6.9% | 107 | 109 |
| write_data_to_excel | 244 | 5.7% | 82 | 90 |
| create_pivot_table | 219 | 5.1% | 6 | 152 |
| create_chart | 198 | 4.6% | 5 | 137 |
| get_data_validation_info | 191 | 4.5% | 68 | 48 |
| copy_range | 185 | 4.3% | 9 | 120 |
| create_table | 176 | 4.1% | 12 | 108 |
| delete_range | 161 | 3.8% | 10 | 95 |
| validate_excel_range | 158 | 3.7% | 10 | 89 |
| apply_formula | 151 | 3.5% | 19 | 72 |
| delete_sheet_rows | 147 | 3.4% | 11 | 78 |
| delete_sheet_columns | 147 | 3.4% | 11 | 78 |
| unmerge_cells | 145 | 3.4% | 7 | 79 |
| insert_rows | 144 | 3.4% | 11 | 77 |
| insert_columns | 144 | 3.4% | 11 | 77 |
| validate_formula_syntax | 143 | 3.4% | 8 | 74 |
| merge_cells | 140 | 3.3% | 6 | 78 |
| copy_worksheet | 126 | 3.0% | 5 | 63 |
| rename_worksheet | 126 | 3.0% | 5 | 63 |
| get_workbook_metadata | 122 | 2.9% | 11 | 50 |
| get_merged_cells | 117 | 2.7% | 7 | 48 |
| create_worksheet | 111 | 2.6% | 6 | 47 |
| delete_worksheet | 110 | 2.6% | 5 | 47 |
| create_workbook | 94 | 2.2% | 5 | 31 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 4,266 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 3,080 | 27.8% of the capture is MCP-only metadata |
| **Claude, same fields** | **6,338** | 1.49× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 4,266 | 25 | not recorded | not recorded | — |
| 2026-08-19 | 4,266 | 25 | not recorded | docker | no change |
| 2026-09-04 | 4,266 | 25 | 1.29.1 | docker | no change |
| 2026-09-05 | 4,266 | 25 | 1.29.1 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/excel/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/excel/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/excel.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
