# agent-device — context cost

**53,669 tokens** across 57 tools — *very heavy* (≥ 30K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | agent-device v0.20.10 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y agent-device mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `61a100d3f94ba6e81eedcbd151cfff7ce5e6acd36906571c7035e0b09a681dca` |
| category | community |
| source | https://github.com/callstack/agent-device |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| fill | 4,461 | 8.3% | 43 | 968 |
| click | 2,718 | 5.1% | 51 | 1,016 |
| press | 2,670 | 5.0% | 30 | 989 |
| longpress | 2,485 | 4.6% | 34 | 880 |
| hover | 2,478 | 4.6% | 56 | 861 |
| find | 1,566 | 2.9% | 12 | 725 |
| back | 1,213 | 2.3% | 28 | 681 |
| open | 1,102 | 2.1% | 77 | 1,016 |
| record | 998 | 1.9% | 39 | 637 |
| gesture | 980 | 1.8% | 35 | 936 |
| replay | 892 | 1.7% | 26 | 747 |
| test | 881 | 1.6% | 11 | 722 |
| doctor | 880 | 1.6% | 71 | 596 |
| batch | 868 | 1.6% | 7 | 851 |
| get | 817 | 1.5% | 30 | 778 |
| snapshot | 813 | 1.5% | 30 | 774 |
| metro | 812 | 1.5% | 64 | 739 |
| keyboard | 806 | 1.5% | 58 | 584 |
| diff | 800 | 1.5% | 24 | 619 |
| wait | 788 | 1.5% | 41 | 659 |
| scroll | 776 | 1.4% | 17 | 750 |
| trace | 776 | 1.4% | 34 | 592 |
| tv-remote | 773 | 1.4% | 48 | 643 |
| perf | 772 | 1.4% | 63 | 700 |
| is | 754 | 1.4% | 32 | 713 |
| appstate | 750 | 1.4% | 4 | 551 |
| shutdown | 749 | 1.4% | 7 | 551 |
| push | 735 | 1.4% | 10 | 602 |
| swipe | 733 | 1.4% | 8 | 715 |
| boot | 732 | 1.4% | 31 | 569 |

*27 smaller tools omitted (17,089 tokens combined) — all of them are in the [raw capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/agent-device/measurement.json).*

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/agent-device/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/agent-device/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/agent-device.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
