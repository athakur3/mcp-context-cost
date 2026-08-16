# huggingface — context cost

**4,691 tokens** across 4 tools — *light* (1–5K). Measured 2026-08-16 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | huggingface.co/mcp v0.4.9 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y mcp-remote https://huggingface.co/mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `b269a72bb6340ebfd5cf8170399b2606a9d7ea88b2277cfd6ca3511cec51a980` |
| category | vendor-official |
| source | https://github.com/huggingface/hf-mcp-server |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| hf_whoami | 1,948 | 41.5% | 30 | 26 |
| hf_fs | 1,924 | 41.0% | 966 | 87 |
| hub_repo_details | 453 | 9.7% | 76 | 327 |
| hub_repo_search | 364 | 7.8% | 38 | 278 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/huggingface/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/huggingface/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/huggingface.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
