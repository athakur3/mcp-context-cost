# azure — context cost

**14,808 tokens** across 71 tools — *moderate* (5–15K). Measured 2026-09-30 under [methodology v1.0](../METHODOLOGY.html).

An Anthropic request carries 13,844 of those tokens as tool definitions. What Claude makes of them is not published for this server: its Claude count is missing, or was taken against a capture this measurement has since replaced.

| | |
|---|---|
| server (self-reported) | Azure MCP Server v3.0.0-beta.48 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @azure/mcp@latest server start` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials, installed |
| env vars supplied | none |
| canonical SHA-256 | `ee0a96dcba902514e37b0564405f85b34a633f0863f593e2abc20cc76c7ab2c5` |
| category | vendor-official |
| source | https://github.com/microsoft/mcp |

## Where the tokens are

| tool | tokens | share | description | input schema |
|---|---:|---:|---:|---:|
| get_azure_bestpractices | 401 | 2.7% | 277 | 96 |
| compute | 344 | 2.3% | 224 | 96 |
| extension_azqr | 322 | 2.2% | 151 | 91 |
| monitor | 266 | 1.8% | 149 | 96 |
| azuremigrate | 264 | 1.8% | 141 | 96 |
| storage | 264 | 1.8% | 145 | 96 |
| documentation | 258 | 1.7% | 141 | 96 |
| aks | 240 | 1.6% | 121 | 96 |
| azd | 236 | 1.6% | 118 | 96 |
| group_resource_list | 231 | 1.6% | 54 | 97 |
| servicebus | 230 | 1.6% | 111 | 96 |
| foundryextensions | 228 | 1.5% | 107 | 96 |
| iotoperations | 225 | 1.5% | 104 | 96 |
| speech | 225 | 1.5% | 107 | 96 |
| azurebackup | 224 | 1.5% | 105 | 96 |
| foundry | 223 | 1.5% | 104 | 96 |
| search | 219 | 1.5% | 101 | 96 |
| subscription_list | 219 | 1.5% | 110 | 34 |
| extension_cli_generate | 217 | 1.5% | 49 | 91 |
| deploy | 216 | 1.5% | 99 | 96 |
| extension_cli_install | 216 | 1.5% | 65 | 67 |
| applens | 215 | 1.5% | 94 | 96 |
| advisor | 214 | 1.4% | 96 | 96 |
| pricing | 213 | 1.4% | 95 | 96 |
| managedlustre | 208 | 1.4% | 87 | 96 |
| wellarchitectedframework | 206 | 1.4% | 82 | 96 |
| bicepschema | 205 | 1.4% | 83 | 96 |
| azureterraform | 204 | 1.4% | 86 | 96 |
| arm | 203 | 1.4% | 85 | 96 |
| sreagent | 203 | 1.4% | 82 | 96 |

*41 smaller tools omitted (7,667 tokens combined) — all of them are in the [raw capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/azure/measurement.json).*

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-09-05 | 15,239 | 68 | 3.0.0-beta.41 | docker | — |
| 2026-09-09 | 15,657 | 70 | 3.0.0-beta.42 | docker | +418 |
| 2026-09-30 | 14,808 | 71 | 3.0.0-beta.48 | docker | −849 |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/azure/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/azure/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/azure.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
