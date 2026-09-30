# huggingface — context cost

**4,910 tokens** across 4 tools — *light* (1–5K). Measured 2026-09-30 under [methodology v1.0](../METHODOLOGY.html).

An Anthropic request carries 1,796 of those tokens as tool definitions. What Claude makes of them is not published for this server: its Claude count is missing, or was taken against a capture this measurement has since replaced.

| | |
|---|---|
| server (self-reported) | huggingface.co/mcp v0.4.25 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y mcp-remote https://huggingface.co/mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `3bc9987909c0f43691f98cb4e2fd56d7bdd04aa87b35c95d137f74c67bf4022d` |
| category | vendor-official |
| source | https://github.com/huggingface/hf-mcp-server |

## Where the tokens are

| tool | tokens | share | description | input schema | output schema |
|---|---:|---:|---:|---:|---:|
| hf_fs | 2,152 | 43.8% | 734 | 191 | 1,062 |
| hf_whoami | 1,939 | 39.5% | 30 | 26 | 1,823 |
| hub_repo_details | 453 | 9.2% | 76 | 327 | 0 |
| hub_repo_search | 364 | 7.4% | 38 | 278 | 0 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 4,691 | 4 | not recorded | not recorded | — |
| 2026-08-19 | 4,691 | 4 | not recorded | docker | no change |
| 2026-09-04 | 4,724 | 4 | 0.4.15 | docker | +33 |
| 2026-09-05 | 4,724 | 4 | 0.4.15 | docker | no change |
| 2026-09-09 | 4,724 | 4 | 0.4.15 | docker | no change |
| 2026-09-30 | 4,910 | 4 | 0.4.25 | docker | +186 |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/huggingface/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/huggingface/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/huggingface.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
