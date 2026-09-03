# blender — context cost

**6,928 tokens** across 28 tools — *moderate* (5–15K). Measured 2026-09-03 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | BlenderMCP v1.29.1 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx blender-mcp` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `5d8045af01c1eaf81a5931cfc5aa814fe0928f66cf1e176962bd3a97aff0a62f` |
| category | community |
| source | https://github.com/ahujasid/blender-mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| download_polypizza_model | 490 | 7.1% | 341 | 84 |
| generate_hyper3d_model_via_images | 484 | 7.0% | 300 | 113 |
| search_polypizza_models | 448 | 6.5% | 279 | 105 |
| download_sketchfab_model | 405 | 5.8% | 274 | 63 |
| generate_hunyuan3d_model | 377 | 5.4% | 243 | 69 |
| generate_hyper3d_model_via_text | 350 | 5.1% | 203 | 79 |
| download_polyhaven_asset | 347 | 5.0% | 192 | 98 |
| poll_rodin_job_status | 307 | 4.4% | 215 | 51 |
| search_sketchfab_models | 305 | 4.4% | 153 | 94 |
| search_polyhaven_assets | 258 | 3.7% | 141 | 62 |
| set_texture | 257 | 3.7% | 141 | 63 |
| get_polyhaven_categories | 223 | 3.2% | 122 | 48 |
| get_sketchfab_model_preview | 220 | 3.2% | 146 | 48 |
| execute_blender_code | 215 | 3.1% | 117 | 46 |
| record_trajectory_feedback | 213 | 3.1% | 80 | 81 |
| get_object_info | 210 | 3.0% | 112 | 48 |
| import_generated_asset | 204 | 2.9% | 118 | 65 |
| poll_hunyuan_job_status | 204 | 2.9% | 140 | 34 |
| get_viewport_screenshot | 195 | 2.8% | 124 | 49 |
| get_scene_info | 175 | 2.5% | 94 | 33 |
| get_addon_status | 166 | 2.4% | 82 | 30 |
| disable_telemetry | 159 | 2.3% | 76 | 30 |
| import_generated_asset_hunyuan | 154 | 2.2% | 80 | 52 |
| get_hunyuan3d_status | 120 | 1.7% | 31 | 33 |
| get_hyper3d_status | 117 | 1.7% | 31 | 32 |
| get_sketchfab_status | 108 | 1.6% | 25 | 31 |
| get_polypizza_status | 108 | 1.6% | 25 | 31 |
| get_polyhaven_status | 107 | 1.5% | 27 | 30 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-16 | 5,258 | 24 | not recorded | — |
| 2026-08-19 | 5,462 | 25 | docker | +204 |
| 2026-09-03 | 6,928 | 28 | docker | +1,466 |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/blender/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/blender/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/blender.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
