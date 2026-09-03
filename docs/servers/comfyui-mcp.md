# comfyui-mcp — context cost

**50,640 tokens** across 41 tools — *very heavy* (≥ 30K). Measured 2026-09-03 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | comfyui-mcp v0.52.183 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y comfyui-mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `af7eaa380b99a67fc49ab075c762cd2686f108acc4ba21d001ce922554f7510a` |
| category | community |
| source | https://github.com/artokun/comfyui-mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| download_model | 3,986 | 7.9% | 2,111 | 1,823 |
| generate_image | 3,899 | 7.7% | 1,278 | 2,586 |
| node_pack | 2,961 | 5.8% | 1,401 | 1,521 |
| get_image | 2,642 | 5.2% | 1,151 | 1,462 |
| install_comfyui | 2,501 | 4.9% | 1,412 | 1,035 |
| get_workflow | 2,385 | 4.7% | 1,055 | 1,298 |
| list_packs | 2,314 | 4.6% | 1,681 | 595 |
| comfy_cli | 2,032 | 4.0% | 793 | 1,204 |
| train_start | 1,736 | 3.4% | 683 | 1,023 |
| list_local_models | 1,731 | 3.4% | 978 | 726 |
| install_custom_node | 1,614 | 3.2% | 837 | 747 |
| runpod | 1,570 | 3.1% | 960 | 562 |
| enqueue_workflow | 1,536 | 3.0% | 835 | 670 |
| train_prepare_dataset | 1,516 | 3.0% | 781 | 704 |
| create_workflow | 1,478 | 2.9% | 380 | 1,075 |
| upload_image | 1,431 | 2.8% | 613 | 792 |
| queue | 1,351 | 2.7% | 851 | 471 |
| get_defaults | 1,102 | 2.2% | 643 | 433 |
| get_history | 1,040 | 2.1% | 596 | 417 |
| model_metadata | 1,022 | 2.0% | 742 | 258 |
| apps | 898 | 1.8% | 360 | 513 |
| save_workflow | 808 | 1.6% | 511 | 274 |
| visualize_workflow | 804 | 1.6% | 258 | 519 |
| report_issue | 750 | 1.5% | 419 | 313 |
| batch | 742 | 1.5% | 350 | 365 |
| calculate | 656 | 1.3% | 405 | 215 |
| get_system_stats | 625 | 1.2% | 336 | 267 |
| apply_manifest | 625 | 1.2% | 237 | 370 |
| kitchen | 623 | 1.2% | 379 | 223 |
| train_doctor | 560 | 1.1% | 330 | 207 |

*11 smaller tools omitted (3,700 tokens combined) — all of them are in the [raw capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/comfyui-mcp/measurement.json).*

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/comfyui-mcp/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/comfyui-mcp/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/comfyui-mcp.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
