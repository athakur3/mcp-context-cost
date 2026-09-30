# How the cost of the measured set has moved

Every server here is measured again on a rotating schedule, and most launch unpinned (`npx -y <pkg>`) — so a change between two measurements is a real upstream release landing in real context windows. This page reports each server's **most recent movement**: the change that produced the cost it carries today, dated to when it happened rather than to the last time anyone looked (method `cost-regression/v1`, newest data 2026-09-30). A server that moved once and has held that cost since keeps its real window, and the table says how long the new cost has held.

Comparable means the two runs used the same isolation — two numbers taken under different isolation are not comparable, and the trend line already refuses to span that boundary (see [history](history.csv) and the sparklines on each [server page](../docs/servers/)). A failed measurement contributes no row at all, so a server that stopped starting reads as a gap in its series, never as a drop to zero.

Every server with a measurement on record is in exactly one of the three sections below: **28 moved**, **58 held the same cost across every comparable measurement**, and **1 has no second comparable measurement yet** — 28 + 58 + 1 = 87.

**17 servers moved upward and 11 moved down**, a net +10,818 tokens across the measured set. 15 movements clear both thresholds for being called out (at least 5% *and* at least 25 tokens — relative alone would headline a fifth of a cheap server, absolute alone would headline drift on an expensive one). Everything comparable is listed either way.

| server | window | release | tokens | change | tools | what moved |
|---|---|---|---:|---:|---:|---|
| [excel](../docs/servers/excel.md) **·** | 2026-09-09 → 2026-09-30 | `1.30.0` → `1.1.1` | 4,266 → 10,493 | +6,227 (+146.0%) | +1 | shipped more tools |
| [obsidian](../docs/servers/obsidian.md) **·** | 2026-08-19 → 2026-08-26, held to 2026-09-16 | — | 1,132 → 2,062 | +930 (+82.2%) | +3 | shipped more tools |
| [google-surf](../docs/servers/google-surf.md) **·** | 2026-09-09 → 2026-09-30 | `1.0.9` → `1.1.3` | 10,948 → 17,185 | +6,237 (+57.0%) | — | same tools, rewritten |
| [markitdown](../docs/servers/markitdown.md) **·** | 2026-09-09 → 2026-09-30 | — | 64 → 98 | +34 (+53.1%) | — | same tools, rewritten |
| [blender](../docs/servers/blender.md) **·** | 2026-08-19 → 2026-09-03, held to 2026-09-04 | — | 5,462 → 6,928 | +1,466 (+26.8%) | +3 | shipped more tools |
| [codebase-memory-mcp](../docs/servers/codebase-memory-mcp.md) **·** | 2026-09-09 → 2026-09-30 | `0.10.8` → `0.11.0` | 5,258 → 4,065 | −1,193 (−22.7%) | +2 | added and rewrote |
| [arxiv](../docs/servers/arxiv.md) **·** | 2026-08-19 → 2026-09-03, held to 2026-09-04 | — | 3,228 → 3,960 | +732 (+22.7%) | +5 | shipped more tools |
| [shopify-dev](../docs/servers/shopify-dev.md) **·** | 2026-08-19 → 2026-09-03, held to 2026-09-04 | — | 5,624 → 6,841 | +1,217 (+21.6%) | +1 | shipped more tools |
| [playwright](../docs/servers/playwright.md) **·** | 2026-09-09 → 2026-09-30 | `1.63.0-alpha-2026-08-31` → `1.64.0-alpha-1790635538000` | 4,024 → 4,413 | +389 (+9.7%) | +1 | shipped more tools |
| [clickhouse](../docs/servers/clickhouse.md) **·** | 2026-09-02 → 2026-09-04 | — | 694 → 632 | −62 (−8.9%) | — | same tools, rewritten |
| [agent-device](../docs/servers/agent-device.md) **·** | 2026-09-04 → 2026-09-16 | `0.20.10` → `0.21.4` | 53,669 → 48,909 | −4,760 (−8.9%) | — | same tools, rewritten |
| [anki](../docs/servers/anki.md) **·** | 2026-09-09 → 2026-09-30 | `0.25.0` → `0.26.0` | 20,037 → 21,608 | +1,571 (+7.8%) | +3 | shipped more tools |
| [desktop-commander](../docs/servers/desktop-commander.md) **·** | 2026-09-09 → 2026-09-30 | `0.2.48` → `0.2.52` | 11,837 → 11,063 | −774 (−6.5%) | — | same tools, rewritten |
| [sentry](../docs/servers/sentry.md) **·** | 2026-08-18 → 2026-09-03, held to 2026-09-04 | — | 6,455 → 6,086 | −369 (−5.7%) | — | same tools, rewritten |
| [azure](../docs/servers/azure.md) **·** | 2026-09-09 → 2026-09-30 | `3.0.0-beta.42` → `3.0.0-beta.48` | 15,657 → 14,808 | −849 (−5.4%) | +1 | added and rewrote |
| [huggingface](../docs/servers/huggingface.md) | 2026-09-09 → 2026-09-30 | `0.4.15` → `0.4.25` | 4,724 → 4,910 | +186 (+3.9%) | — | same tools, rewritten |
| [searxng](../docs/servers/searxng.md) | 2026-08-19 → 2026-09-02, held to 2026-09-04 | — | 1,481 → 1,537 | +56 (+3.8%) | — | same tools, rewritten |
| [githits](../docs/servers/githits.md) | 2026-09-03 → 2026-09-04 | — | 12,600 → 12,833 | +233 (+1.8%) | — | same tools, rewritten |
| [accessibility-scanner](../docs/servers/accessibility-scanner.md) | 2026-09-09 → 2026-09-30 | `3.4.0` → `3.5.0` | 9,247 → 9,111 | −136 (−1.5%) | −1 | dropped tools |
| [sequential-thinking](../docs/servers/sequential-thinking.md) | 2026-08-18 → 2026-09-03, held to 2026-09-16 | — | 992 → 1,003 | +11 (+1.1%) | — | same tools, rewritten |
| [comfyui-mcp](../docs/servers/comfyui-mcp.md) | 2026-09-09 → 2026-09-30 | `0.52.202` → `0.52.203` | 50,776 → 50,268 | −508 (−1.0%) | — | same tools, rewritten |
| [aws-documentation](../docs/servers/aws-documentation.md) | 2026-09-09 → 2026-09-30 | — | 5,045 → 5,008 | −37 (−0.7%) | — | same tools, rewritten |
| [airtable](../docs/servers/airtable.md) | 2026-08-19 → 2026-09-04, held to 2026-09-30 | — | 4,207 → 4,186 | −21 (−0.5%) | — | same tools, rewritten |
| [github](../docs/servers/github.md) | 2026-08-18 → 2026-09-03, held to 2026-09-04 | — | 54,422 → 54,622 | +200 (+0.4%) | — | same tools, rewritten |
| [apify](../docs/servers/apify.md) | 2026-08-19 → 2026-09-04, held to 2026-09-16 | — | 10,426 → 10,452 | +26 (+0.2%) | — | same tools, rewritten |
| [supabase](../docs/servers/supabase.md) | 2026-08-18 → 2026-09-04, held to 2026-09-16 | — | 5,013 → 5,007 | −6 (−0.1%) | — | same tools, rewritten |
| [agentphone](../docs/servers/agentphone.md) | 2026-09-04 → 2026-09-16 | still `0.7.0` | 6,134 → 6,139 | +5 (+0.1%) | — | same tools, rewritten |
| [brave-search](../docs/servers/brave-search.md) | 2026-09-09 → 2026-09-30 | `2.1.3` → `2.1.4` | 25,487 → 25,500 | +13 (+0.1%) | — | same tools, rewritten |

Rows marked **·** clear both thresholds.

The **release** column is what the two servers reported at `initialize`, on the two days either side of the movement. `—` means at least one of those rows does not record a version: either the server reports none, or the row was written before `history.csv` carried the column, and neither is something to fill in with a guess. 13 of 28 movements can name both sides today; the rest fill in as the rotation re-measures them.

**still `x`** means the cost moved while the version did not — 1 movement here. That is not a contradiction: an unpinned dependency can change a server's tool definitions without the server itself cutting a release, and the context window pays for it either way.

## Where the tokens went

**excel** +6,227 (+146.0%), 2026-09-09 → 2026-09-30, `1.30.0` → `1.1.1`:
  - added 20 tools: `set_sheet_layout` (763), `add_data_validation` (685), `add_conditional_format` (680), and 17 more
  - removed 19 tools: `read_data_from_excel` (293), `write_data_to_excel` (244), `create_pivot_table` (219), and 16 more
  - grew: `create_chart` 198 → 618 (+420), `format_range` 472 → 884 (+412), `create_table` 176 → 319 (+143), and 3 more
  - −25 unattributed: the headline counts the canonical JSON of the whole array, whose framing bytes and token boundaries belong to no single tool.

**obsidian** +930 (+82.2%), 2026-08-19 → 2026-08-26:
  - per-tool breakdown unavailable: only one of the two captures is on record. Attribution accrues from the first sweep after a server's tool vectors were first stored.

**google-surf** +6,237 (+57.0%), 2026-09-09 → 2026-09-30, `1.0.9` → `1.1.3`:
  - grew: `project_memory` 3,279 → 7,869 (+4,590), `project_memory_search` 1,436 → 2,742 (+1,306), `search` 1,737 → 1,873 (+136), and 4 more

**markitdown** +34 (+53.1%), 2026-09-09 → 2026-09-30:
  - grew: `convert_to_markdown` 62 → 96 (+34)

**blender** +1,466 (+26.8%), 2026-08-19 → 2026-09-03:
  - per-tool breakdown unavailable: only one of the two captures is on record. Attribution accrues from the first sweep after a server's tool vectors were first stored.

**codebase-memory-mcp** −1,193 (−22.7%), 2026-09-09 → 2026-09-30, `0.10.8` → `0.11.0`:
  - added 2 tools: `get_file_outline` (190), `compare_graphs` (167)
  - grew: `manage_adr` 121 → 254 (+133), `get_code_snippet` 205 → 295 (+90), `get_graph_schema` 78 → 144 (+66), and 1 more
  - shrank: `search_graph` 905 → 342 (−563), `trace_path` 732 → 403 (−329), `index_repository` 510 → 224 (−286), and 8 more

**arxiv** +732 (+22.7%), 2026-08-19 → 2026-09-03:
  - per-tool breakdown unavailable: only one of the two captures is on record. Attribution accrues from the first sweep after a server's tool vectors were first stored.

**shopify-dev** +1,217 (+21.6%), 2026-08-19 → 2026-09-03:
  - per-tool breakdown unavailable: only one of the two captures is on record. Attribution accrues from the first sweep after a server's tool vectors were first stored.

**playwright** +389 (+9.7%), 2026-09-09 → 2026-09-30, `1.63.0-alpha-2026-08-31` → `1.64.0-alpha-1790635538000`:
  - added 1 tool: `browser_emulate_media` (281)
  - grew: `browser_find` 221 → 253 (+32), `browser_console_messages` 181 → 192 (+11), `browser_evaluate` 184 → 195 (+11), and 6 more

**clickhouse** −62 (−8.9%), 2026-09-02 → 2026-09-04:
  - shrank: `list_tables` 413 → 353 (−60), `run_query` 203 → 201 (−2), `list_databases` 79 → 78 (−1)
  - +1 unattributed: the headline counts the canonical JSON of the whole array, whose framing bytes and token boundaries belong to no single tool.

**agent-device** −4,760 (−8.9%), 2026-09-04 → 2026-09-16, `0.20.10` → `0.21.4`:
  - grew: `scroll` 776 → 1,535 (+759), `fill` 4,461 → 4,848 (+387), `hover` 2,478 → 2,605 (+127), and 3 more
  - shrank: `find` 1,566 → 993 (−573), `metro` 812 → 666 (−146), `appstate` 750 → 621 (−129), and 47 more

**anki** +1,571 (+7.8%), 2026-09-09 → 2026-09-30, `0.25.0` → `0.26.0`:
  - added 3 tools: `suspend` (572), `unsuspend` (551), `areSuspended` (407)
  - grew: `review_stats` 669 → 712 (+43)
  - shrank: `notesInfo` 432 → 430 (−2)

**desktop-commander** −774 (−6.5%), 2026-09-09 → 2026-09-30, `0.2.48` → `0.2.52`:
  - grew: `get_recent_tool_calls` 223 → 258 (+35)
  - shrank: `start_process` 1,181 → 758 (−423), `interact_with_process` 825 → 440 (−385), `read_file` 1,024 → 1,023 (−1)

**sentry** −369 (−5.7%), 2026-08-18 → 2026-09-03:
  - per-tool breakdown unavailable: only one of the two captures is on record. Attribution accrues from the first sweep after a server's tool vectors were first stored.

**azure** −849 (−5.4%), 2026-09-09 → 2026-09-30, `3.0.0-beta.42` → `3.0.0-beta.48`:
  - added 2 tools: `iotoperations` (225), `resiliency` (184)
  - removed 1 tool: `resilience` (232)
  - shrank: `get_azure_bestpractices` 454 → 401 (−53), `compute` 367 → 344 (−23), `monitor` 289 → 266 (−23), and 56 more

## Unchanged

**58 servers have been measured at least twice under the same isolation and have not moved** — same tokens, same tool count, every time. That is a measured fact about the server, not a missing one: the definitions in a context window today are the definitions that were there on the date in the window column, confirmed on every sweep since. `since` is when the cost was first recorded at this number, never when it was last looked at.

| server | window | tokens | tools | sweeps |
|---|---|---:|---:|---:|
| [notion](../docs/servers/notion.md) | 2026-08-16 → 2026-09-04 | 17,500 | 24 | 4 |
| [mcp-atlassian](../docs/servers/mcp-atlassian.md) | 2026-08-16 → 2026-09-16 | 17,311 | 63 | 6 |
| [circleci](../docs/servers/circleci.md) | 2026-08-16 → 2026-09-16 | 11,912 | 13 | 4 |
| [firecrawl](../docs/servers/firecrawl.md) | 2026-08-16 → 2026-09-16 | 9,561 | 27 | 6 |
| [basic-memory](../docs/servers/basic-memory.md) | 2026-08-16 → 2026-09-04 | 9,188 | 23 | 4 |
| [hubspot](../docs/servers/hubspot.md) | 2026-08-16 → 2026-09-30 | 9,158 | 21 | 6 |
| [mongodb](../docs/servers/mongodb.md) | 2026-08-16 → 2026-09-16 | 7,926 | 27 | 6 |
| [pinecone](../docs/servers/pinecone.md) | 2026-08-16 → 2026-09-30 | 5,903 | 9 | 6 |
| [kubernetes](../docs/servers/kubernetes.md) | 2026-08-16 → 2026-09-16 | 5,268 | 23 | 6 |
| [github-legacy](../docs/servers/github-legacy.md) | 2026-08-16 → 2026-09-04 | 3,548 | 26 | 4 |
| [playwright-community](../docs/servers/playwright-community.md) | 2026-08-16 → 2026-09-16 | 2,920 | 33 | 4 |
| [chroma](../docs/servers/chroma.md) | 2026-08-16 → 2026-09-30 | 2,837 | 13 | 6 |
| [netlify](../docs/servers/netlify.md) | 2026-08-16 → 2026-09-16 | 2,831 | 9 | 6 |
| [filesystem](../docs/servers/filesystem.md) | 2026-08-16 → 2026-09-16 | 2,823 | 14 | 4 |
| [pulumi](../docs/servers/pulumi.md) | 2026-08-16 → 2026-09-16 | 2,768 | 12 | 6 |
| [n8n-mcp](../docs/servers/n8n-mcp.md) | 2026-08-16 → 2026-09-16 | 2,636 | 7 | 4 |
| [memory](../docs/servers/memory.md) | 2026-08-16 → 2026-09-28 | 2,378 | 9 | 13 |
| [terraform](../docs/servers/terraform.md) | 2026-08-16 → 2026-09-16 | 2,061 | 9 | 6 |
| [everything](../docs/servers/everything.md) | 2026-08-16 → 2026-09-30 | 1,708 | 13 | 7 |
| [tavily](../docs/servers/tavily.md) | 2026-08-16 → 2026-09-04 | 1,653 | 5 | 4 |
| [pandoc](../docs/servers/pandoc.md) | 2026-08-16 → 2026-09-30 | 1,425 | 1 | 6 |
| [context7](../docs/servers/context7.md) | 2026-08-16 → 2026-09-16 | 1,052 | 2 | 4 |
| [bright-data](../docs/servers/bright-data.md) | 2026-08-16 → 2026-09-04 | 978 | 5 | 4 |
| [microsoft-learn](../docs/servers/microsoft-learn.md) | 2026-08-16 → 2026-09-16 | 972 | 3 | 4 |
| [figma-context](../docs/servers/figma-context.md) | 2026-08-16 → 2026-09-16 | 946 | 2 | 6 |
| [duckduckgo](../docs/servers/duckduckgo.md) | 2026-08-16 → 2026-09-04 | 724 | 2 | 4 |
| [slack-legacy](../docs/servers/slack-legacy.md) | 2026-08-16 → 2026-09-30 | 681 | 8 | 7 |
| [google-maps](../docs/servers/google-maps.md) | 2026-08-16 → 2026-09-04 | 549 | 7 | 4 |
| [puppeteer](../docs/servers/puppeteer.md) | 2026-08-16 → 2026-09-04 | 540 | 7 | 4 |
| [exa](../docs/servers/exa.md) | 2026-08-16 → 2026-09-04 | 486 | 2 | 4 |
| [airbnb](../docs/servers/airbnb.md) | 2026-08-16 → 2026-09-16 | 486 | 2 | 4 |
| [cloudflare-docs](../docs/servers/cloudflare-docs.md) | 2026-08-16 → 2026-09-16 | 422 | 2 | 4 |
| [mysql](../docs/servers/mysql.md) | 2026-08-16 → 2026-09-30 | 393 | 3 | 6 |
| [browserbase](../docs/servers/browserbase.md) | 2026-08-16 → 2026-09-30 | 364 | 6 | 6 |
| [deepwiki](../docs/servers/deepwiki.md) | 2026-08-16 → 2026-09-04 | 359 | 3 | 4 |
| [gitlab](../docs/servers/gitlab.md) | 2026-08-16 → 2026-09-16 | 336 | 9 | 6 |
| [brave-search-legacy](../docs/servers/brave-search-legacy.md) | 2026-08-16 → 2026-09-30 | 319 | 2 | 6 |
| [qdrant](../docs/servers/qdrant.md) | 2026-08-16 → 2026-09-16 | 188 | 2 | 6 |
| [perplexity](../docs/servers/perplexity.md) | 2026-08-16 → 2026-09-30 | 133 | 1 | 6 |
| [postgres](../docs/servers/postgres.md) | 2026-08-16 → 2026-09-16 | 32 | 1 | 6 |
| [redis](../docs/servers/redis.md) | 2026-08-17 → 2026-09-04 | 9,246 | 53 | 4 |
| [serena](../docs/servers/serena.md) | 2026-08-17 → 2026-09-16 | 8,204 | 29 | 4 |
| [xcodebuildmcp](../docs/servers/xcodebuildmcp.md) | 2026-08-18 → 2026-09-30 | 26,594 | 24 | 6 |
| [postgres-mcp](../docs/servers/postgres-mcp.md) | 2026-08-18 → 2026-09-04 | 8,632 | 9 | 4 |
| [git](../docs/servers/git.md) | 2026-08-18 → 2026-09-30 | 1,455 | 12 | 5 |
| [neo4j-cypher](../docs/servers/neo4j-cypher.md) | 2026-08-18 → 2026-09-30 | 523 | 3 | 6 |
| [elasticsearch](../docs/servers/elasticsearch.md) | 2026-08-18 → 2026-09-30 | 374 | 4 | 6 |
| [time](../docs/servers/time.md) | 2026-08-18 → 2026-09-16 | 293 | 2 | 3 |
| [sqlite](../docs/servers/sqlite.md) | 2026-08-18 → 2026-09-16 | 268 | 6 | 3 |
| [fetch](../docs/servers/fetch.md) | 2026-08-18 → 2026-09-04 | 238 | 1 | 3 |
| [octocode](../docs/servers/octocode.md) | 2026-09-03 → 2026-09-04 | 13,552 | 14 | 2 |
| [appium-mcp](../docs/servers/appium-mcp.md) | 2026-09-03 → 2026-09-04 | 10,267 | 31 | 2 |
| [obsidian-rest](../docs/servers/obsidian-rest.md) | 2026-09-03 → 2026-09-04 | 10,173 | 12 | 2 |
| [ssh-manager](../docs/servers/ssh-manager.md) | 2026-09-03 → 2026-09-04 | 8,446 | 37 | 2 |
| [bitbucket-mcp](../docs/servers/bitbucket-mcp.md) | 2026-09-03 → 2026-09-30 | 6,156 | 47 | 5 |
| [chrome-devtools](../docs/servers/chrome-devtools.md) | 2026-09-03 → 2026-09-04 | 5,717 | 29 | 2 |
| [clinicaltrialsgov](../docs/servers/clinicaltrialsgov.md) | 2026-09-03 → 2026-09-04 | 5,134 | 7 | 2 |
| [emailmd](../docs/servers/emailmd.md) | 2026-09-03 → 2026-09-16 | 585 | 3 | 3 |

## Not compared (and why)

1 server(s) carry a measurement but no second comparable one — a first measurement, or every earlier run taken under different isolation. They appear on the [leaderboard](leaderboard.md) with today's number and no delta, which is the honest reading: a cost with nothing yet to compare it to. A cost that *has* been compared and did not move is above, under [Unchanged](#unchanged) — the two are different facts and this page counted them as one until 2026-09-05.

