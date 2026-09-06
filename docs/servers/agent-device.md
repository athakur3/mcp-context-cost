# agent-device — context cost

**53,669 tokens** across 57 tools — *very heavy* (≥ 30K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | agent-device v0.20.10 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y agent-device mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `61a100d3f94ba6e81eedcbd151cfff7ce5e6acd36906571c7035e0b09a681dca` |
| category | community |
| source | https://github.com/callstack/agent-device |

## Where the tokens are

| tool | tokens | share | description | input schema | output schema |
|---|---:|---:|---:|---:|---:|
| fill | 4,461 | 8.3% | 43 | 968 | 3,439 |
| click | 2,718 | 5.1% | 51 | 1,016 | 1,640 |
| press | 2,670 | 5.0% | 30 | 989 | 1,640 |
| longpress | 2,485 | 4.6% | 34 | 880 | 1,559 |
| hover | 2,478 | 4.6% | 56 | 861 | 1,550 |
| find | 1,566 | 2.9% | 12 | 725 | 817 |
| back | 1,213 | 2.3% | 28 | 681 | 493 |
| open | 1,102 | 2.1% | 77 | 1,016 | 0 |
| record | 998 | 1.9% | 39 | 637 | 311 |
| gesture | 980 | 1.8% | 35 | 936 | 0 |
| replay | 892 | 1.7% | 26 | 747 | 107 |
| test | 881 | 1.6% | 11 | 722 | 136 |
| doctor | 880 | 1.6% | 71 | 596 | 202 |
| batch | 868 | 1.6% | 7 | 851 | 0 |
| get | 817 | 1.5% | 30 | 778 | 0 |
| snapshot | 813 | 1.5% | 30 | 774 | 0 |
| metro | 812 | 1.5% | 64 | 739 | 0 |
| keyboard | 806 | 1.5% | 58 | 584 | 153 |
| diff | 800 | 1.5% | 24 | 619 | 146 |
| wait | 788 | 1.5% | 41 | 659 | 77 |
| scroll | 776 | 1.4% | 17 | 750 | 0 |
| trace | 776 | 1.4% | 34 | 592 | 139 |
| tv-remote | 773 | 1.4% | 48 | 643 | 69 |
| perf | 772 | 1.4% | 63 | 700 | 0 |
| is | 754 | 1.4% | 32 | 713 | 0 |
| appstate | 750 | 1.4% | 4 | 551 | 182 |
| shutdown | 749 | 1.4% | 7 | 551 | 180 |
| push | 735 | 1.4% | 10 | 602 | 112 |
| swipe | 733 | 1.4% | 8 | 715 | 0 |
| boot | 732 | 1.4% | 31 | 569 | 121 |

*27 smaller tools omitted (17,089 tokens combined) — all of them are in the [raw capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/agent-device/measurement.json).*

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 53,669 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 40,105 | 25.3% of the capture is MCP-only metadata |
| **Claude, same fields** | **75,686** | 1.41× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/agent-device/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/agent-device/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/agent-device.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
