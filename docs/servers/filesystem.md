# filesystem — context cost

**2,823 tokens** across 14 tools — *light* (1–5K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | secure-filesystem-server v0.2.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @modelcontextprotocol/server-filesystem /tmp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `245b04832111268c3fcc72543af89fb2f8c109d8306c1b5b8c49dc45977e41e1` |
| category | official-reference |
| source | https://github.com/modelcontextprotocol/servers |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| read_media_file | 290 | 10.3% | 47 | 34 |
| read_text_file | 256 | 9.1% | 97 | 78 |
| edit_file | 245 | 8.7% | 35 | 118 |
| search_files | 218 | 7.7% | 79 | 60 |
| read_multiple_files | 210 | 7.4% | 58 | 71 |
| directory_tree | 202 | 7.2% | 72 | 51 |
| list_directory_with_sizes | 201 | 7.1% | 56 | 62 |
| move_file | 192 | 6.8% | 57 | 43 |
| read_file | 179 | 6.3% | 19 | 78 |
| create_directory | 177 | 6.3% | 51 | 34 |
| write_file | 174 | 6.2% | 39 | 43 |
| list_directory | 166 | 5.9% | 53 | 34 |
| get_file_info | 162 | 5.7% | 47 | 34 |
| list_allowed_directories | 149 | 5.3% | 41 | 24 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 2,823 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 1,665 | 41.0% of the capture is MCP-only metadata |
| **Claude, same fields** | **3,115** | 1.10× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 2,823 | 14 | not recorded | not recorded | — |
| 2026-08-18 | 2,823 | 14 | not recorded | docker | no change |
| 2026-09-04 | 2,823 | 14 | 0.2.0 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/filesystem/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/filesystem/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/filesystem.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
