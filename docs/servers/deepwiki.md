# deepwiki — context cost

**359 tokens** across 3 tools — *lean* (< 1K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | DeepWiki v2.14.3 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y mcp-remote https://mcp.deepwiki.com/mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `3735162916165ab23696fc91fbf626bd99a36ddcd1e15746e91e16c7e336b379` |
| category | vendor-official |
| source | https://docs.devin.ai/work-with-devin/deepwiki-mcp |

## Where the tokens are

| tool | tokens | share | description | input schema | output schema |
|---|---:|---:|---:|---:|---:|
| ask_question | 148 | 41.2% | 19 | 76 | 28 |
| read_wiki_structure | 108 | 30.1% | 12 | 41 | 28 |
| read_wiki_contents | 104 | 29.0% | 8 | 41 | 28 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 359 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 233 | 35.1% of the capture is MCP-only metadata |
| **Claude, same fields** | **707** | 1.97× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 359 | 3 | not recorded | not recorded | — |
| 2026-08-19 | 359 | 3 | not recorded | docker | no change |
| 2026-09-03 | 359 | 3 | not recorded | docker | no change |
| 2026-09-04 | 359 | 3 | 2.14.3 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/deepwiki/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/deepwiki/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/deepwiki.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
