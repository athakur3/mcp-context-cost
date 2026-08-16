# mcp-atlassian — context cost

**17,311 tokens** across 63 tools — *heavy* (15–30K). Measured 2026-08-16 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | Atlassian MCP v3.4.7 |
| status | dynamic |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx mcp-atlassian` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN |
| canonical SHA-256 | `c55fb33bea2aebc0be1aa5c7a04e19652f01508e0891e8fdf705684f5de3ce85` |
| category | community |
| source | https://github.com/sooperset/mcp-atlassian |

> This server's `tools/list` differed between two consecutive captures, so the number is the first capture and moves between sweeps. Treat it as a range, not a constant.

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| jira_update_proforma_form_answers | 800 | 4.6% | 507 | 145 |
| jira_update_issue | 602 | 3.5% | 18 | 502 |
| jira_get_issue | 567 | 3.3% | 54 | 428 |
| jira_search | 555 | 3.2% | 12 | 461 |
| jira_create_issue | 550 | 3.2% | 15 | 453 |
| jira_create_customer_request | 464 | 2.7% | 8 | 370 |
| jira_get_issue_sla | 463 | 2.7% | 161 | 201 |
| jira_get_board_issues | 437 | 2.5% | 13 | 338 |
| jira_search_assignable_users | 434 | 2.5% | 160 | 180 |
| jira_get_field_options | 402 | 2.3% | 76 | 234 |
| jira_create_issue_link | 391 | 2.3% | 8 | 299 |
| jira_create_remote_issue_link | 377 | 2.2% | 56 | 231 |
| jira_add_worklog | 363 | 2.1% | 10 | 268 |
| jira_transition_issue | 355 | 2.1% | 9 | 264 |
| jira_add_comment | 340 | 2.0% | 8 | 251 |
| jira_move_issue | 312 | 1.8% | 87 | 133 |
| jira_batch_create_issues | 308 | 1.8% | 8 | 214 |
| jira_update_version | 306 | 1.8% | 48 | 174 |
| jira_batch_create_versions | 290 | 1.7% | 9 | 197 |
| jira_get_issue_development_info | 288 | 1.7% | 51 | 144 |
| jira_get_agile_boards | 280 | 1.6% | 13 | 180 |
| jira_get_issues_development_info | 274 | 1.6% | 27 | 152 |
| jira_batch_get_changelogs | 264 | 1.5% | 12 | 160 |
| jira_get_sprint_issues | 261 | 1.5% | 6 | 168 |
| jira_get_project_epic_hierarchy | 261 | 1.5% | 72 | 92 |
| jira_assign_issue | 256 | 1.5% | 46 | 126 |
| jira_update_sprint | 251 | 1.4% | 4 | 164 |
| jira_get_issue_dates | 248 | 1.4% | 38 | 122 |
| jira_edit_comment | 242 | 1.4% | 9 | 152 |
| jira_get_create_fields | 242 | 1.4% | 59 | 95 |

*33 smaller tools omitted (6,189 tokens combined) — all of them are in the [raw capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/mcp-atlassian/measurement.json).*

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/mcp-atlassian/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/mcp-atlassian/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/mcp-atlassian.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
