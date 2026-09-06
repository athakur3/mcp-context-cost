# pulumi — context cost

**2,768 tokens** across 12 tools — *light* (1–5K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | @pulumi/mcp-server v0.2.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @pulumi/mcp-server@latest stdio` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
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

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 2,768 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 2,660 | 3.9% of the capture is MCP-only metadata |
| **Claude, same fields** | **4,671** | 1.69× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 2,768 | 12 | not recorded | not recorded | — |
| 2026-08-19 | 2,768 | 12 | not recorded | docker | no change |
| 2026-08-26 | 2,768 | 12 | not recorded | docker | no change |
| 2026-09-03 | 2,768 | 12 | not recorded | docker | no change |
| 2026-09-04 | 2,768 | 12 | 0.2.0 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/pulumi/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/pulumi/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/pulumi.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
