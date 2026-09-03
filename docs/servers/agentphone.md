# agentphone — context cost

**6,134 tokens** across 28 tools — *moderate* (5–15K). Measured 2026-09-03 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | agentphone v0.7.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y agentphone-mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | AGENTPHONE_API_KEY |
| canonical SHA-256 | `eec89a7ec71ac3e9e65fb8477bf594b4ce9af01b572bcc5d7e9fbbcc85f4e813` |
| category | community |
| source | https://github.com/AgentPhone-AI/agentphone-mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| create_agent | 763 | 12.4% | 64 | 678 |
| update_agent | 721 | 11.8% | 44 | 649 |
| send_message | 594 | 9.7% | 117 | 448 |
| make_conversation_call | 400 | 6.5% | 86 | 282 |
| manage_contact | 311 | 5.1% | 61 | 220 |
| list_calls | 276 | 4.5% | 56 | 184 |
| buy_number | 223 | 3.6% | 48 | 149 |
| make_call | 220 | 3.6% | 45 | 146 |
| set_webhook | 212 | 3.5% | 55 | 126 |
| get_usage | 208 | 3.4% | 36 | 139 |
| get_call | 175 | 2.9% | 29 | 113 |
| list_conversations | 173 | 2.8% | 45 | 92 |
| list_webhook_deliveries | 172 | 2.8% | 37 | 96 |
| update_conversation | 145 | 2.4% | 28 | 89 |
| list_contacts | 145 | 2.4% | 22 | 90 |
| list_numbers | 128 | 2.1% | 21 | 74 |
| get_messages | 128 | 2.1% | 24 | 71 |
| test_webhook | 122 | 2.0% | 39 | 47 |
| get_conversation | 119 | 1.9% | 16 | 69 |
| attach_number | 117 | 1.9% | 28 | 62 |
| detach_number | 114 | 1.9% | 20 | 67 |
| list_agents | 112 | 1.8% | 31 | 48 |
| get_webhook | 105 | 1.7% | 23 | 48 |
| delete_webhook | 105 | 1.7% | 31 | 47 |
| get_agent | 93 | 1.5% | 18 | 42 |
| delete_agent | 91 | 1.5% | 21 | 44 |
| account_overview | 81 | 1.3% | 22 | 24 |
| list_voices | 79 | 1.3% | 20 | 24 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/agentphone/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/agentphone/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/agentphone.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
