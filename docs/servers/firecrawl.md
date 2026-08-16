# firecrawl — context cost

**9,561 tokens** across 27 tools — *moderate* (5–15K). Measured 2026-08-16 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | firecrawl-fastmcp v3.24.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y firecrawl-mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | FIRECRAWL_API_KEY |
| canonical SHA-256 | `3b7694bcedabac9706eba0c497c1fb4591121db0fd25e4e87e4802a001e34cd6` |
| category | vendor-official |
| source | https://github.com/firecrawl/firecrawl-mcp-server |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| firecrawl_search | 1,391 | 14.5% | 261 | 1,082 |
| firecrawl_crawl | 911 | 9.5% | 98 | 769 |
| firecrawl_scrape | 874 | 9.1% | 226 | 600 |
| firecrawl_interact | 819 | 8.6% | 99 | 675 |
| firecrawl_parse | 630 | 6.6% | 170 | 413 |
| firecrawl_feedback | 565 | 5.9% | 55 | 464 |
| firecrawl_search_feedback | 501 | 5.2% | 140 | 315 |
| firecrawl_monitor_create | 380 | 4.0% | 134 | 204 |
| firecrawl_research_search_papers | 346 | 3.6% | 90 | 208 |
| firecrawl_developer_search | 259 | 2.7% | 93 | 122 |
| firecrawl_agent | 253 | 2.6% | 124 | 86 |
| firecrawl_research_related_papers | 247 | 2.6% | 78 | 120 |
| firecrawl_monitor_check | 242 | 2.5% | 89 | 110 |
| firecrawl_map | 240 | 2.5% | 106 | 91 |
| firecrawl_research_read_paper | 236 | 2.5% | 46 | 144 |
| firecrawl_research_inspect_paper | 191 | 2.0% | 42 | 104 |
| firecrawl_extract | 189 | 2.0% | 47 | 98 |
| firecrawl_agent_status | 186 | 1.9% | 103 | 39 |
| firecrawl_monitor_checks | 172 | 1.8% | 29 | 102 |
| firecrawl_monitor_update | 150 | 1.6% | 47 | 61 |
| firecrawl_research_search_github | 135 | 1.4% | 32 | 58 |
| firecrawl_monitor_list | 129 | 1.3% | 22 | 67 |
| firecrawl_check_crawl_status | 115 | 1.2% | 33 | 39 |
| firecrawl_interact_stop | 109 | 1.1% | 24 | 43 |
| firecrawl_monitor_run | 109 | 1.1% | 29 | 39 |
| firecrawl_monitor_delete | 104 | 1.1% | 25 | 39 |
| firecrawl_monitor_get | 102 | 1.1% | 23 | 39 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/firecrawl/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/firecrawl/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/firecrawl.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
