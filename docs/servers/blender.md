# blender — context cost

**5,258 tokens** across 24 tools — *moderate* (5–15K). Measured 2026-08-16 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | BlenderMCP v1.29.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx blender-mcp` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `d2eaa893817022900e08e72922d111d17cc1acb50532e337704a89305ee57639` |
| category | community |
| source | https://github.com/ahujasid/blender-mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| generate_hyper3d_model_via_images | 454 | 8.6% | 270 | 113 |
| download_sketchfab_model | 375 | 7.1% | 244 | 63 |
| generate_hunyuan3d_model | 347 | 6.6% | 213 | 69 |
| generate_hyper3d_model_via_text | 320 | 6.1% | 173 | 79 |
| download_polyhaven_asset | 317 | 6.0% | 162 | 98 |
| poll_rodin_job_status | 307 | 5.8% | 215 | 51 |
| search_sketchfab_models | 275 | 5.2% | 123 | 94 |
| search_polyhaven_assets | 228 | 4.3% | 111 | 62 |
| set_texture | 227 | 4.3% | 111 | 63 |
| poll_hunyuan_job_status | 214 | 4.1% | 151 | 34 |
| record_trajectory_feedback | 213 | 4.1% | 80 | 81 |
| import_generated_asset | 204 | 3.9% | 118 | 65 |
| get_polyhaven_categories | 193 | 3.7% | 92 | 48 |
| get_sketchfab_model_preview | 190 | 3.6% | 116 | 48 |
| execute_blender_code | 185 | 3.5% | 87 | 46 |
| get_object_info | 180 | 3.4% | 82 | 48 |
| get_viewport_screenshot | 165 | 3.1% | 94 | 49 |
| get_scene_info | 145 | 2.8% | 64 | 33 |
| import_generated_asset_hunyuan | 136 | 2.6% | 62 | 52 |
| get_addon_status | 129 | 2.5% | 47 | 30 |
| get_hunyuan3d_status | 120 | 2.3% | 31 | 33 |
| get_hyper3d_status | 117 | 2.2% | 31 | 32 |
| get_sketchfab_status | 108 | 2.1% | 25 | 31 |
| get_polyhaven_status | 107 | 2.0% | 27 | 30 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-08-16 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 5,258 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 4,629 | 12.0% of the capture is MCP-only metadata |
| **Claude, same fields** | **8,106** | 1.54× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/blender/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/blender/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/blender.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
