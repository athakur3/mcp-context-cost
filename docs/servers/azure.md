# azure — context cost

**15,239 tokens** across 68 tools — *heavy* (15–30K). Measured 2026-09-05 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | Azure MCP Server v3.0.0-beta.41 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @azure/mcp@latest server start` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials, installed libicu72 libs |
| env vars supplied | none |
| canonical SHA-256 | `0539db0747ec02a1bfb4167d12146549e697758d0977f487126116c1fa2a6a26` |
| category | vendor-official |
| source | https://github.com/microsoft/mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| get_azure_bestpractices | 454 | 3.0% | 318 | 96 |
| compute | 367 | 2.4% | 242 | 96 |
| extension_azqr | 322 | 2.1% | 151 | 91 |
| monitor | 289 | 1.9% | 172 | 96 |
| storage | 285 | 1.9% | 164 | 96 |
| azuremigrate | 280 | 1.8% | 158 | 96 |
| documentation | 258 | 1.7% | 141 | 96 |
| aks | 256 | 1.7% | 138 | 96 |
| foundryextensions | 250 | 1.6% | 127 | 96 |
| servicebus | 246 | 1.6% | 128 | 96 |
| speech | 243 | 1.6% | 125 | 96 |
| azurebackup | 242 | 1.6% | 122 | 96 |
| search | 240 | 1.6% | 123 | 96 |
| azd | 236 | 1.5% | 118 | 96 |
| deploy | 232 | 1.5% | 116 | 96 |
| resilience | 232 | 1.5% | 112 | 96 |
| applens | 231 | 1.5% | 111 | 96 |
| group_resource_list | 231 | 1.5% | 54 | 97 |
| advisor | 230 | 1.5% | 113 | 96 |
| pricing | 229 | 1.5% | 112 | 96 |
| managedlustre | 224 | 1.5% | 104 | 96 |
| foundry | 223 | 1.5% | 104 | 96 |
| wellarchitectedframework | 223 | 1.5% | 100 | 96 |
| bicepschema | 221 | 1.5% | 100 | 96 |
| azureterraform | 220 | 1.4% | 103 | 96 |
| deviceregistry | 220 | 1.4% | 97 | 96 |
| sreagent | 219 | 1.4% | 99 | 96 |
| storagesync | 219 | 1.4% | 98 | 96 |
| subscription_list | 219 | 1.4% | 110 | 34 |
| redis | 218 | 1.4% | 102 | 96 |

*38 smaller tools omitted (7,678 tokens combined) — all of them are in the [raw capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/azure/measurement.json).*

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 15,239 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 14,303 | 6.1% of the capture is MCP-only metadata |
| **Claude, same fields** | **26,202** | 1.72× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/azure/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/azure/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/azure.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
