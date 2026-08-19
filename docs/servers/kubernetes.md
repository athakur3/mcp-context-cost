# kubernetes — context cost

**5,268 tokens** across 23 tools — *moderate* (5–15K). Measured 2026-08-19 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | kubernetes v4.1.4 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y mcp-server-kubernetes` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `20126671be70fdb77743a595f195002612b03c889b348447ed9ff4d7057f8c1c` |
| category | community |
| source | https://github.com/Flux159/mcp-server-kubernetes |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| kubectl_create | 945 | 17.9% | 14 | 919 |
| node_management | 341 | 6.5% | 14 | 308 |
| kubectl_delete | 322 | 6.1% | 16 | 286 |
| kubectl_logs | 308 | 5.8% | 12 | 276 |
| kubectl_rollout | 292 | 5.5% | 19 | 252 |
| install_helm_chart | 291 | 5.5% | 13 | 257 |
| kubectl_patch | 287 | 5.4% | 19 | 248 |
| kubectl_get | 286 | 5.4% | 14 | 252 |
| kubectl_generic | 272 | 5.2% | 11 | 241 |
| exec_in_pod | 256 | 4.9% | 43 | 193 |
| upgrade_helm_chart | 226 | 4.3% | 6 | 199 |
| kubectl_apply | 224 | 4.3% | 10 | 194 |
| kubectl_context | 178 | 3.4% | 13 | 145 |
| explain_resource | 177 | 3.4% | 8 | 149 |
| kubectl_describe | 161 | 3.1% | 12 | 128 |
| list_api_resources | 159 | 3.0% | 8 | 131 |
| kubectl_scale | 148 | 2.8% | 4 | 124 |
| uninstall_helm_chart | 106 | 2.0% | 6 | 78 |
| port_forward | 91 | 1.7% | 11 | 61 |
| kubectl_reconnect | 76 | 1.4% | 44 | 12 |
| stop_port_forward | 45 | 0.9% | 5 | 19 |
| ping | 43 | 0.8% | 13 | 12 |
| cleanup | 32 | 0.6% | 4 | 9 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-08-19 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 5,268 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 5,089 | 3.4% of the capture is MCP-only metadata |
| **Claude, same fields** | **9,165** | 1.74× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | change |
|---|---:|---:|---:|
| 2026-08-16 | 5,268 | 23 | — |
| 2026-08-19 | 5,268 | 23 | no change |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/kubernetes/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/kubernetes/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/kubernetes.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
