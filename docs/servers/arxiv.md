# arxiv — context cost

**3,228 tokens** across 14 tools — *light* (1–5K). Measured 2026-08-19 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | arxiv-mcp-server v0.6.3 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx arxiv-mcp-server` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `969f351ffcbb3a5e5b5e0d4c3cf79eae4e232df55e04828edb57befbd84e343d` |
| category | community |
| source | https://github.com/blazickjp/arxiv-mcp-server |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| search_papers | 1,154 | 35.7% | 770 | 315 |
| watch_topic | 298 | 9.2% | 114 | 152 |
| semantic_search | 204 | 6.3% | 102 | 76 |
| export_citations | 193 | 6.0% | 86 | 82 |
| read_paper | 177 | 5.5% | 67 | 91 |
| download_paper | 175 | 5.4% | 48 | 102 |
| get_paper_latex_section | 170 | 5.3% | 14 | 128 |
| check_alerts | 157 | 4.9% | 82 | 50 |
| get_abstract | 156 | 4.8% | 77 | 54 |
| get_paper_latex | 147 | 4.6% | 23 | 97 |
| list_paper_latex_sections | 135 | 4.2% | 13 | 94 |
| list_papers | 96 | 3.0% | 60 | 17 |
| citation_graph | 88 | 2.7% | 20 | 44 |
| reindex | 76 | 2.4% | 10 | 36 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | change |
|---|---:|---:|---:|
| 2026-08-16 | 3,228 | 14 | — |
| 2026-08-19 | 3,228 | 14 | no change |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/arxiv/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/arxiv/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/arxiv.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
