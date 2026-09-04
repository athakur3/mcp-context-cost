# pulumi — context cost

**2,768 tokens** across 12 tools — *light* (1–5K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | @pulumi/mcp-server v0.2.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @pulumi/mcp-server@latest stdio` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `9eb845dee6bb274d3b93ba0ea67276b2829cb98cbe7ed01079eba7fb8263fa26` |
| category | vendor-official |
| source | https://www.pulumi.com/docs/iac/using-pulumi/mcp-server/ (GitHub repo not public) |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| pulumi-resource-search | 1,011 | 36.5% | 735 | 219 |
| neo-task-launcher | 226 | 8.2% | 25 | 180 |
| pulumi-registry-get-type | 220 | 7.9% | 11 | 185 |
| pulumi-registry-get-function | 217 | 7.8% | 8 | 185 |
| pulumi-registry-get-resource | 214 | 7.7% | 8 | 182 |
| pulumi-registry-list-resources | 174 | 6.3% | 10 | 139 |
| pulumi-registry-list-functions | 173 | 6.3% | 10 | 139 |
| pulumi-cli-stack-output | 123 | 4.4% | 10 | 90 |
| pulumi-cli-preview | 104 | 3.8% | 10 | 72 |
| pulumi-cli-up | 104 | 3.8% | 10 | 72 |
| pulumi-cli-refresh | 104 | 3.8% | 10 | 72 |
| deploy-to-aws | 96 | 3.5% | 51 | 24 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-16 | 2,768 | 12 | not recorded | — |
| 2026-08-19 | 2,768 | 12 | docker | no change |
| 2026-08-26 | 2,768 | 12 | docker | no change |
| 2026-09-03 | 2,768 | 12 | docker | no change |
| 2026-09-04 | 2,768 | 12 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/pulumi/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/pulumi/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/pulumi.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
