# ssh-manager — context cost

**8,446 tokens** across 37 tools — *moderate* (5–15K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | mcp-ssh-manager v3.8.5 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y mcp-ssh-manager` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `22ce75f27b9a8bf50f1cb77824b5769d6041d1f3c25032916b5201b1be31f5d7` |
| category | community |
| source | https://github.com/bvisible/mcp-ssh-manager |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| ssh_sync | 477 | 5.6% | 174 | 285 |
| ssh_backup_create | 387 | 4.6% | 84 | 284 |
| ssh_deploy | 333 | 3.9% | 106 | 208 |
| ssh_db_dump | 316 | 3.7% | 91 | 206 |
| ssh_process_manager | 309 | 3.7% | 99 | 191 |
| ssh_group_manage | 297 | 3.5% | 125 | 153 |
| ssh_db_import | 292 | 3.5% | 90 | 183 |
| ssh_execute_group | 291 | 3.4% | 135 | 137 |
| ssh_backup_restore | 286 | 3.4% | 90 | 177 |
| ssh_backup_schedule | 279 | 3.3% | 85 | 174 |
| ssh_alert_setup | 275 | 3.3% | 97 | 159 |
| ssh_db_query | 270 | 3.2% | 77 | 174 |
| ssh_tunnel_create | 253 | 3.0% | 90 | 143 |
| ssh_execute_sudo | 242 | 2.9% | 111 | 111 |
| ssh_db_list | 239 | 2.8% | 73 | 147 |
| ssh_execute | 233 | 2.8% | 112 | 103 |
| ssh_tail | 230 | 2.7% | 95 | 117 |
| ssh_monitor | 221 | 2.6% | 97 | 106 |
| ssh_history | 200 | 2.4% | 97 | 85 |
| ssh_key_manage | 196 | 2.3% | 86 | 91 |
| ssh_session_send | 193 | 2.3% | 92 | 82 |
| ssh_command_alias | 192 | 2.3% | 81 | 92 |
| ssh_backup_list | 187 | 2.2% | 78 | 90 |
| ssh_upload | 185 | 2.2% | 94 | 73 |
| ssh_alias | 182 | 2.2% | 82 | 82 |
| ssh_download | 176 | 2.1% | 85 | 73 |
| ssh_service_status | 176 | 2.1% | 85 | 72 |
| ssh_hooks | 170 | 2.0% | 83 | 69 |
| ssh_connection_status | 166 | 2.0% | 77 | 70 |
| ssh_session_start | 163 | 1.9% | 88 | 56 |

*7 smaller tools omitted (1,028 tokens combined) — all of them are in the [raw capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/ssh-manager/measurement.json).*

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-09-03 | 8,446 | 37 | not recorded | docker | — |
| 2026-09-04 | 8,446 | 37 | 3.8.5 | docker | no change |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/ssh-manager/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/ssh-manager/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/ssh-manager.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
