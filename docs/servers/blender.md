# blender — context cost

**5,462 tokens** across 25 tools — *moderate* (5–15K). Measured 2026-08-19 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | BlenderMCP v1.29.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx blender-mcp` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `14c1a93ca0b59e6b394bae642a6eba89f01c8c953076c19ed8ae16c6a0db6e09` |
| category | community |
| source | https://github.com/ahujasid/blender-mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| generate_hyper3d_model_via_images | 454 | 8.3% | 270 | 113 |
| download_sketchfab_model | 375 | 6.9% | 244 | 63 |
| generate_hunyuan3d_model | 347 | 6.4% | 213 | 69 |
| generate_hyper3d_model_via_text | 320 | 5.9% | 173 | 79 |
| download_polyhaven_asset | 317 | 5.8% | 162 | 98 |
| poll_rodin_job_status | 307 | 5.6% | 215 | 51 |
| search_sketchfab_models | 275 | 5.0% | 123 | 94 |
| search_polyhaven_assets | 228 | 4.2% | 111 | 62 |
| set_texture | 227 | 4.2% | 111 | 63 |
| record_trajectory_feedback | 213 | 3.9% | 80 | 81 |
| import_generated_asset | 204 | 3.7% | 118 | 65 |
| poll_hunyuan_job_status | 204 | 3.7% | 140 | 34 |
| get_polyhaven_categories | 193 | 3.5% | 92 | 48 |
| get_sketchfab_model_preview | 190 | 3.5% | 116 | 48 |
| execute_blender_code | 185 | 3.4% | 87 | 46 |
| get_object_info | 180 | 3.3% | 82 | 48 |
| get_addon_status | 166 | 3.0% | 82 | 30 |
| get_viewport_screenshot | 165 | 3.0% | 94 | 49 |
| disable_telemetry | 159 | 2.9% | 76 | 30 |
| import_generated_asset_hunyuan | 154 | 2.8% | 80 | 52 |
| get_scene_info | 145 | 2.7% | 64 | 33 |
| get_hunyuan3d_status | 120 | 2.2% | 31 | 33 |
| get_hyper3d_status | 117 | 2.1% | 31 | 32 |
| get_sketchfab_status | 108 | 2.0% | 25 | 31 |
| get_polyhaven_status | 107 | 2.0% | 27 | 30 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | change |
|---|---:|---:|---:|
| 2026-08-16 | 5,258 | 24 | — |
| 2026-08-19 | 5,462 | 25 | +204 |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/blender/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/blender/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/blender.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
