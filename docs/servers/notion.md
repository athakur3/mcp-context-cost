# notion — context cost

**17,500 tokens** across 24 tools — *heavy* (15–30K). Measured 2026-08-18 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | Notion API v1.0.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @notionhq/notion-mcp-server` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | NOTION_TOKEN |
| canonical SHA-256 | `f9544e7c84986529d5bc4a1c9357bbbb9c2f458133904075319f8fec7d716da9` |
| category | vendor-official |
| source | https://github.com/makenotion/notion-mcp-server |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| API-update-page-markdown | 1,282 | 7.3% | 62 | 1,189 |
| API-post-search | 1,097 | 6.3% | 14 | 1,056 |
| API-patch-page | 889 | 5.1% | 14 | 848 |
| API-post-page | 819 | 4.7% | 14 | 779 |
| API-query-data-source | 770 | 4.4% | 15 | 727 |
| API-update-a-block | 727 | 4.2% | 14 | 685 |
| API-create-a-comment | 725 | 4.1% | 13 | 684 |
| API-update-a-data-source | 721 | 4.1% | 15 | 676 |
| API-patch-block-children | 713 | 4.1% | 14 | 669 |
| API-retrieve-page-markdown | 706 | 4.0% | 49 | 626 |
| API-retrieve-a-page-property | 704 | 4.0% | 16 | 657 |
| API-get-block-children | 693 | 4.0% | 14 | 650 |
| API-create-a-data-source | 688 | 3.9% | 15 | 643 |
| API-retrieve-a-comment | 687 | 3.9% | 13 | 645 |
| API-retrieve-a-page | 680 | 3.9% | 14 | 637 |
| API-get-users | 663 | 3.8% | 14 | 622 |
| API-move-page | 641 | 3.7% | 14 | 600 |
| API-list-data-source-templates | 640 | 3.7% | 17 | 592 |
| API-retrieve-a-data-source | 618 | 3.5% | 15 | 572 |
| API-retrieve-a-database | 613 | 3.5% | 14 | 569 |
| API-retrieve-a-block | 612 | 3.5% | 14 | 569 |
| API-delete-a-block | 611 | 3.5% | 14 | 569 |
| API-get-user | 604 | 3.5% | 14 | 564 |
| API-get-self | 595 | 3.4% | 17 | 551 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-08-19 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 17,500 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 17,163 | 1.9% of the capture is MCP-only metadata |
| **Claude, same fields** | **33,560** | 1.92× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | change |
|---|---:|---:|---:|
| 2026-08-16 | 17,500 | 24 | — |
| 2026-08-18 | 17,500 | 24 | no change |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/notion/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/notion/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/notion.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
