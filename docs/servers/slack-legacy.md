# slack-legacy — context cost

**681 tokens** across 8 tools — *lean* (< 1K). Measured 2026-08-19 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | Slack MCP Server v1.0.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @modelcontextprotocol/server-slack` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials, shared package cache by |
| env vars supplied | SLACK_BOT_TOKEN, SLACK_TEAM_ID |
| canonical SHA-256 | `5939f969618ff709e86ff0599b80cc8f418db8904b4304a6eeb82a25f30ccd81` |
| category | official-reference |
| source | https://github.com/modelcontextprotocol/servers-archived |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| slack_reply_to_thread | 124 | 18.2% | 8 | 102 |
| slack_get_thread_replies | 110 | 16.2% | 7 | 88 |
| slack_add_reaction | 95 | 14.0% | 7 | 74 |
| slack_get_users | 80 | 11.7% | 14 | 53 |
| slack_list_channels | 76 | 11.2% | 11 | 52 |
| slack_get_channel_history | 73 | 10.7% | 6 | 53 |
| slack_post_message | 70 | 10.3% | 8 | 49 |
| slack_get_user_profile | 51 | 7.5% | 8 | 29 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-16 | 681 | 8 | not recorded | — |
| 2026-08-18 | 681 | 8 | docker | no change |
| 2026-08-19 | 681 | 8 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/slack-legacy/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/slack-legacy/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/slack-legacy.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
