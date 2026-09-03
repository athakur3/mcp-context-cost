# deepwiki — context cost

**359 tokens** across 3 tools — *lean* (< 1K). Measured 2026-09-03 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | DeepWiki v2.14.3 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y mcp-remote https://mcp.deepwiki.com/mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `3735162916165ab23696fc91fbf626bd99a36ddcd1e15746e91e16c7e336b379` |
| category | vendor-official |
| source | https://docs.devin.ai/work-with-devin/deepwiki-mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| ask_question | 148 | 41.2% | 19 | 76 |
| read_wiki_structure | 108 | 30.1% | 12 | 41 |
| read_wiki_contents | 104 | 29.0% | 8 | 41 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-16 | 359 | 3 | not recorded | — |
| 2026-08-19 | 359 | 3 | docker | no change |
| 2026-09-03 | 359 | 3 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/deepwiki/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/deepwiki/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/deepwiki.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
