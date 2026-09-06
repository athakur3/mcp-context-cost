# grafana — context cost

**16,774 tokens** across 65 tools — *heavy* (15–30K). Measured 2026-09-05 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | mcp-grafana v(devel) |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `docker run --rm -i -e GRAFANA_URL=http://localhost:3000 -e GRAFANA_SERVICE_ACCOUNT_TOKEN=dummy mcp/grafana --transport stdio` |
| isolation | docker · architecture not on record · command is itself a docker run (host-spawned container) |
| env vars supplied | GRAFANA_URL, GRAFANA_SERVICE_ACCOUNT_TOKEN |
| canonical SHA-256 | `f35587d4d6afaf90c68d7b861793a9e980bb6817b389fdb2391d365e7358beab` |
| category | vendor-official |
| source | https://github.com/grafana/mcp-grafana |

## Where the tokens are

| tool | tokens | share | description | input schema |
|---|---:|---:|---:|---:|
| alerting_manage_rules | 1,368 | 8.2% | 96 | 1,238 |
| update_dashboard | 1,006 | 6.0% | 498 | 466 |
| get_panel_image | 602 | 3.6% | 83 | 484 |
| query_loki_logs | 568 | 3.4% | 184 | 348 |
| generate_deeplink | 563 | 3.4% | 115 | 419 |
| query_prometheus | 438 | 2.6% | 79 | 323 |
| create_datasource | 420 | 2.5% | 129 | 259 |
| alerting_manage_routing | 415 | 2.5% | 105 | 265 |
| query_loki_stats | 408 | 2.4% | 196 | 177 |
| list_alert_groups | 407 | 2.4% | 137 | 235 |
| query_pyroscope | 404 | 2.4% | 94 | 271 |
| list_prometheus_label_values | 393 | 2.3% | 53 | 303 |
| query_prometheus_histogram | 391 | 2.3% | 91 | 258 |
| list_prometheus_label_names | 366 | 2.2% | 33 | 296 |
| analyze_loki_labels | 360 | 2.1% | 49 | 275 |
| query_loki_patterns | 334 | 2.0% | 109 | 191 |
| get_dashboard_property | 319 | 1.9% | 175 | 101 |
| list_prometheus_metric_names | 317 | 1.9% | 66 | 214 |
| list_pyroscope_label_values | 307 | 1.8% | 91 | 172 |
| list_pyroscope_label_names | 281 | 1.7% | 104 | 135 |
| list_loki_label_values | 271 | 1.6% | 74 | 161 |
| get_assertions | 269 | 1.6% | 23 | 212 |
| list_pyroscope_profile_types | 267 | 1.6% | 99 | 127 |
| create_incident | 261 | 1.6% | 52 | 189 |
| create_annotation | 259 | 1.5% | 28 | 206 |
| get_annotations | 241 | 1.4% | 16 | 193 |
| grafana_api_request | 236 | 1.4% | 46 | 167 |
| validate_provisioning_file | 232 | 1.4% | 84 | 110 |
| list_loki_label_names | 223 | 1.3% | 62 | 125 |
| get_dashboard_panel_queries | 222 | 1.3% | 106 | 81 |

*35 smaller tools omitted (4,688 tokens combined) — all of them are in the [raw capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/grafana/measurement.json).*

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 16,774 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 15,460 | 7.8% of the capture is MCP-only metadata |
| **Claude, same fields** | **26,641** | 1.59× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/grafana/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/grafana/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/grafana.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
