# arxiv — context cost

**3,960 tokens** across 19 tools — *light* (1–5K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | arxiv-mcp-server v0.7.2 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx arxiv-mcp-server` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `2ee361441efca1de3e296a572bbe2d20fa88d5565c9d4f54a8a1523ee7f54251` |
| category | community |
| source | https://github.com/blazickjp/arxiv-mcp-server |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| search_papers | 516 | 13.0% | 211 | 273 |
| watch_topic | 354 | 8.9% | 150 | 172 |
| download_paper | 353 | 8.9% | 125 | 202 |
| read_paper | 275 | 6.9% | 115 | 141 |
| check_alerts | 246 | 6.2% | 164 | 50 |
| semantic_search | 226 | 5.7% | 125 | 76 |
| get_paper_latex_section | 213 | 5.4% | 22 | 162 |
| export_citations | 193 | 4.9% | 86 | 82 |
| read_paper_section | 184 | 4.6% | 21 | 143 |
| get_paper_latex | 181 | 4.6% | 23 | 131 |
| search_paper_text | 180 | 4.5% | 35 | 125 |
| citation_graph | 171 | 4.3% | 72 | 75 |
| list_papers | 157 | 4.0% | 81 | 57 |
| get_paper_outline | 141 | 3.6% | 27 | 94 |
| get_abstract | 137 | 3.5% | 58 | 54 |
| list_paper_latex_sections | 135 | 3.4% | 13 | 94 |
| unwatch_topic | 120 | 3.0% | 44 | 45 |
| list_watches | 100 | 2.5% | 61 | 14 |
| reindex | 76 | 1.9% | 10 | 36 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 3,228 | 14 | not recorded | not recorded | — |
| 2026-08-19 | 3,228 | 14 | not recorded | docker | no change |
| 2026-09-03 | 3,960 | 19 | not recorded | docker | +732 |
| 2026-09-04 | 3,960 | 19 | 0.7.2 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/arxiv/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/arxiv/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/arxiv.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
