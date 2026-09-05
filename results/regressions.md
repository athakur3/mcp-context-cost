# How the cost of the measured set has moved

Every server here is measured again on a rotating schedule, and most launch unpinned (`npx -y <pkg>`) — so a change between two measurements is a real upstream release landing in real context windows. This page reports each server's **most recent movement**: the change that produced the cost it carries today, dated to when it happened rather than to the last time anyone looked (method `cost-regression/v1`, newest data 2026-09-05). A server that moved once and has held that cost since keeps its real window, and the table says how long the new cost has held.

Comparable means the two runs used the same isolation — two numbers taken under different isolation are not comparable, and the trend line already refuses to span that boundary (see [history](history.csv) and the sparklines on each [server page](../docs/servers/)). A failed measurement contributes no row at all, so a server that stopped starting reads as a gap in its series, never as a drop to zero.

Every server with a measurement on record is in exactly one of the three sections below: **17 moved**, **64 held the same cost across every comparable measurement**, and **5 have no second comparable measurement yet** — 17 + 64 + 5 = 86.

**11 servers moved upward and 6 moved down**, a net +4,446 tokens across the measured set. 6 movements clear both thresholds for being called out (at least 5% *and* at least 25 tokens — relative alone would headline a fifth of a cheap server, absolute alone would headline drift on an expensive one). Everything comparable is listed either way.

| server | window | release | tokens | change | tools | what moved |
|---|---|---|---:|---:|---:|---|
| [obsidian](../docs/servers/obsidian.md) **·** | 2026-08-19 → 2026-08-26, held to 2026-09-04 | — | 1,132 → 2,062 | +930 (+82.2%) | +3 | shipped more tools |
| [blender](../docs/servers/blender.md) **·** | 2026-08-19 → 2026-09-03, held to 2026-09-04 | — | 5,462 → 6,928 | +1,466 (+26.8%) | +3 | shipped more tools |
| [arxiv](../docs/servers/arxiv.md) **·** | 2026-08-19 → 2026-09-03, held to 2026-09-04 | — | 3,228 → 3,960 | +732 (+22.7%) | +5 | shipped more tools |
| [shopify-dev](../docs/servers/shopify-dev.md) **·** | 2026-08-19 → 2026-09-03, held to 2026-09-04 | — | 5,624 → 6,841 | +1,217 (+21.6%) | +1 | shipped more tools |
| [clickhouse](../docs/servers/clickhouse.md) **·** | 2026-09-02 → 2026-09-04 | — | 694 → 632 | −62 (−8.9%) | — | same tools, rewritten |
| [sentry](../docs/servers/sentry.md) **·** | 2026-08-18 → 2026-09-03, held to 2026-09-04 | — | 6,455 → 6,086 | −369 (−5.7%) | — | same tools, rewritten |
| [searxng](../docs/servers/searxng.md) | 2026-08-19 → 2026-09-02, held to 2026-09-04 | — | 1,481 → 1,537 | +56 (+3.8%) | — | same tools, rewritten |
| [githits](../docs/servers/githits.md) | 2026-09-03 → 2026-09-04 | — | 12,600 → 12,833 | +233 (+1.8%) | — | same tools, rewritten |
| [sequential-thinking](../docs/servers/sequential-thinking.md) | 2026-08-18 → 2026-09-03, held to 2026-09-04 | — | 992 → 1,003 | +11 (+1.1%) | — | same tools, rewritten |
| [huggingface](../docs/servers/huggingface.md) | 2026-08-19 → 2026-09-04 | — | 4,691 → 4,724 | +33 (+0.7%) | — | same tools, rewritten |
| [aws-documentation](../docs/servers/aws-documentation.md) | 2026-08-19 → 2026-09-04 | — | 5,074 → 5,045 | −29 (−0.6%) | — | same tools, rewritten |
| [airtable](../docs/servers/airtable.md) | 2026-08-19 → 2026-09-04 | — | 4,207 → 4,186 | −21 (−0.5%) | — | same tools, rewritten |
| [github](../docs/servers/github.md) | 2026-08-18 → 2026-09-03, held to 2026-09-04 | — | 54,422 → 54,622 | +200 (+0.4%) | — | same tools, rewritten |
| [apify](../docs/servers/apify.md) | 2026-08-19 → 2026-09-04 | — | 10,426 → 10,452 | +26 (+0.2%) | — | same tools, rewritten |
| [brave-search](../docs/servers/brave-search.md) | 2026-08-19 → 2026-09-04 | — | 25,456 → 25,487 | +31 (+0.1%) | — | same tools, rewritten |
| [supabase](../docs/servers/supabase.md) | 2026-08-18 → 2026-09-04 | — | 5,013 → 5,007 | −6 (−0.1%) | — | same tools, rewritten |
| [desktop-commander](../docs/servers/desktop-commander.md) | 2026-08-19 → 2026-09-04 | — | 11,836 → 11,834 | −2 (−0.0%) | — | same tools, rewritten |

Rows marked **·** clear both thresholds.

The **release** column is what the two servers reported at `initialize`, on the two days either side of the movement. `—` means at least one of those rows does not record a version: either the server reports none, or the row was written before `history.csv` carried the column, and neither is something to fill in with a guess. 0 of 17 movements can name both sides today; the rest fill in as the rotation re-measures them.

## Where the tokens went

**obsidian** +930 (+82.2%), 2026-08-19 → 2026-08-26:
  - per-tool breakdown unavailable: only one of the two captures is on record. Attribution accrues from the first sweep after a server's tool vectors were first stored.

**blender** +1,466 (+26.8%), 2026-08-19 → 2026-09-03:
  - per-tool breakdown unavailable: only one of the two captures is on record. Attribution accrues from the first sweep after a server's tool vectors were first stored.

**arxiv** +732 (+22.7%), 2026-08-19 → 2026-09-03:
  - per-tool breakdown unavailable: only one of the two captures is on record. Attribution accrues from the first sweep after a server's tool vectors were first stored.

**shopify-dev** +1,217 (+21.6%), 2026-08-19 → 2026-09-03:
  - per-tool breakdown unavailable: only one of the two captures is on record. Attribution accrues from the first sweep after a server's tool vectors were first stored.

**clickhouse** −62 (−8.9%), 2026-09-02 → 2026-09-04:
  - shrank: `list_tables` 413 → 353 (−60), `run_query` 203 → 201 (−2), `list_databases` 79 → 78 (−1)
  - +1 unattributed: the headline counts the canonical JSON of the whole array, whose framing bytes and token boundaries belong to no single tool.

**sentry** −369 (−5.7%), 2026-08-18 → 2026-09-03:
  - per-tool breakdown unavailable: only one of the two captures is on record. Attribution accrues from the first sweep after a server's tool vectors were first stored.

## Unchanged

**64 servers have been measured at least twice under the same isolation and have not moved** — same tokens, same tool count, every time. That is a measured fact about the server, not a missing one: the definitions in a context window today are the definitions that were there on the date in the window column, confirmed on every sweep since. `since` is when the cost was first recorded at this number, never when it was last looked at.

| server | window | tokens | tools | sweeps |
|---|---|---:|---:|---:|
| [notion](../docs/servers/notion.md) | 2026-08-16 → 2026-09-04 | 17,500 | 24 | 4 |
| [mcp-atlassian](../docs/servers/mcp-atlassian.md) | 2026-08-16 → 2026-09-04 | 17,311 | 63 | 5 |
| [circleci](../docs/servers/circleci.md) | 2026-08-16 → 2026-09-04 | 11,912 | 13 | 3 |
| [firecrawl](../docs/servers/firecrawl.md) | 2026-08-16 → 2026-09-04 | 9,561 | 27 | 5 |
| [basic-memory](../docs/servers/basic-memory.md) | 2026-08-16 → 2026-09-04 | 9,188 | 23 | 4 |
| [hubspot](../docs/servers/hubspot.md) | 2026-08-16 → 2026-09-04 | 9,158 | 21 | 3 |
| [mongodb](../docs/servers/mongodb.md) | 2026-08-16 → 2026-09-04 | 7,926 | 27 | 5 |
| [pinecone](../docs/servers/pinecone.md) | 2026-08-16 → 2026-09-04 | 5,903 | 9 | 3 |
| [kubernetes](../docs/servers/kubernetes.md) | 2026-08-16 → 2026-09-04 | 5,268 | 23 | 5 |
| [excel](../docs/servers/excel.md) | 2026-08-16 → 2026-09-04 | 4,266 | 25 | 3 |
| [playwright](../docs/servers/playwright.md) | 2026-08-16 → 2026-09-04 | 4,024 | 24 | 3 |
| [github-legacy](../docs/servers/github-legacy.md) | 2026-08-16 → 2026-09-04 | 3,548 | 26 | 4 |
| [playwright-community](../docs/servers/playwright-community.md) | 2026-08-16 → 2026-09-04 | 2,920 | 33 | 3 |
| [chroma](../docs/servers/chroma.md) | 2026-08-16 → 2026-09-04 | 2,837 | 13 | 3 |
| [netlify](../docs/servers/netlify.md) | 2026-08-16 → 2026-09-04 | 2,831 | 9 | 5 |
| [filesystem](../docs/servers/filesystem.md) | 2026-08-16 → 2026-09-04 | 2,823 | 14 | 3 |
| [pulumi](../docs/servers/pulumi.md) | 2026-08-16 → 2026-09-04 | 2,768 | 12 | 5 |
| [n8n-mcp](../docs/servers/n8n-mcp.md) | 2026-08-16 → 2026-09-04 | 2,636 | 7 | 3 |
| [memory](../docs/servers/memory.md) | 2026-08-16 → 2026-09-04 | 2,378 | 9 | 8 |
| [terraform](../docs/servers/terraform.md) | 2026-08-16 → 2026-09-04 | 2,061 | 9 | 5 |
| [everything](../docs/servers/everything.md) | 2026-08-16 → 2026-09-04 | 1,708 | 13 | 4 |
| [tavily](../docs/servers/tavily.md) | 2026-08-16 → 2026-09-04 | 1,653 | 5 | 4 |
| [pandoc](../docs/servers/pandoc.md) | 2026-08-16 → 2026-09-04 | 1,425 | 1 | 3 |
| [context7](../docs/servers/context7.md) | 2026-08-16 → 2026-09-04 | 1,052 | 2 | 3 |
| [bright-data](../docs/servers/bright-data.md) | 2026-08-16 → 2026-09-04 | 978 | 5 | 4 |
| [microsoft-learn](../docs/servers/microsoft-learn.md) | 2026-08-16 → 2026-09-04 | 972 | 3 | 3 |
| [figma-context](../docs/servers/figma-context.md) | 2026-08-16 → 2026-09-04 | 946 | 2 | 5 |
| [duckduckgo](../docs/servers/duckduckgo.md) | 2026-08-16 → 2026-09-04 | 724 | 2 | 4 |
| [slack-legacy](../docs/servers/slack-legacy.md) | 2026-08-16 → 2026-09-04 | 681 | 8 | 4 |
| [google-maps](../docs/servers/google-maps.md) | 2026-08-16 → 2026-09-04 | 549 | 7 | 4 |
| [puppeteer](../docs/servers/puppeteer.md) | 2026-08-16 → 2026-09-04 | 540 | 7 | 4 |
| [exa](../docs/servers/exa.md) | 2026-08-16 → 2026-09-04 | 486 | 2 | 4 |
| [airbnb](../docs/servers/airbnb.md) | 2026-08-16 → 2026-09-04 | 486 | 2 | 3 |
| [cloudflare-docs](../docs/servers/cloudflare-docs.md) | 2026-08-16 → 2026-09-04 | 422 | 2 | 3 |
| [mysql](../docs/servers/mysql.md) | 2026-08-16 → 2026-09-04 | 393 | 3 | 3 |
| [browserbase](../docs/servers/browserbase.md) | 2026-08-16 → 2026-09-04 | 364 | 6 | 3 |
| [deepwiki](../docs/servers/deepwiki.md) | 2026-08-16 → 2026-09-04 | 359 | 3 | 4 |
| [gitlab](../docs/servers/gitlab.md) | 2026-08-16 → 2026-09-04 | 336 | 9 | 5 |
| [brave-search-legacy](../docs/servers/brave-search-legacy.md) | 2026-08-16 → 2026-09-04 | 319 | 2 | 3 |
| [qdrant](../docs/servers/qdrant.md) | 2026-08-16 → 2026-09-04 | 188 | 2 | 5 |
| [perplexity](../docs/servers/perplexity.md) | 2026-08-16 → 2026-09-04 | 133 | 1 | 3 |
| [markitdown](../docs/servers/markitdown.md) | 2026-08-16 → 2026-09-04 | 64 | 1 | 4 |
| [postgres](../docs/servers/postgres.md) | 2026-08-16 → 2026-09-04 | 32 | 1 | 5 |
| [redis](../docs/servers/redis.md) | 2026-08-17 → 2026-09-04 | 9,246 | 53 | 4 |
| [serena](../docs/servers/serena.md) | 2026-08-17 → 2026-09-04 | 8,204 | 29 | 3 |
| [xcodebuildmcp](../docs/servers/xcodebuildmcp.md) | 2026-08-18 → 2026-09-04 | 26,594 | 24 | 3 |
| [postgres-mcp](../docs/servers/postgres-mcp.md) | 2026-08-18 → 2026-09-04 | 8,632 | 9 | 4 |
| [git](../docs/servers/git.md) | 2026-08-18 → 2026-09-04 | 1,455 | 12 | 2 |
| [neo4j-cypher](../docs/servers/neo4j-cypher.md) | 2026-08-18 → 2026-09-04 | 523 | 3 | 3 |
| [elasticsearch](../docs/servers/elasticsearch.md) | 2026-08-18 → 2026-09-04 | 374 | 4 | 3 |
| [time](../docs/servers/time.md) | 2026-08-18 → 2026-09-04 | 293 | 2 | 2 |
| [sqlite](../docs/servers/sqlite.md) | 2026-08-18 → 2026-09-04 | 268 | 6 | 2 |
| [fetch](../docs/servers/fetch.md) | 2026-08-18 → 2026-09-04 | 238 | 1 | 3 |
| [comfyui-mcp](../docs/servers/comfyui-mcp.md) | 2026-09-03 → 2026-09-04 | 50,640 | 41 | 2 |
| [octocode](../docs/servers/octocode.md) | 2026-09-03 → 2026-09-04 | 13,552 | 14 | 2 |
| [appium-mcp](../docs/servers/appium-mcp.md) | 2026-09-03 → 2026-09-04 | 10,267 | 31 | 2 |
| [obsidian-rest](../docs/servers/obsidian-rest.md) | 2026-09-03 → 2026-09-04 | 10,173 | 12 | 2 |
| [ssh-manager](../docs/servers/ssh-manager.md) | 2026-09-03 → 2026-09-04 | 8,446 | 37 | 2 |
| [bitbucket-mcp](../docs/servers/bitbucket-mcp.md) | 2026-09-03 → 2026-09-04 | 6,156 | 47 | 2 |
| [agentphone](../docs/servers/agentphone.md) | 2026-09-03 → 2026-09-04 | 6,134 | 28 | 2 |
| [chrome-devtools](../docs/servers/chrome-devtools.md) | 2026-09-03 → 2026-09-04 | 5,717 | 29 | 2 |
| [codebase-memory-mcp](../docs/servers/codebase-memory-mcp.md) | 2026-09-03 → 2026-09-04 | 5,258 | 15 | 2 |
| [clinicaltrialsgov](../docs/servers/clinicaltrialsgov.md) | 2026-09-03 → 2026-09-04 | 5,134 | 7 | 2 |
| [emailmd](../docs/servers/emailmd.md) | 2026-09-03 → 2026-09-04 | 585 | 3 | 2 |

## Not compared (and why)

5 server(s) carry a measurement but no second comparable one — a first measurement, or every earlier run taken under different isolation. They appear on the [leaderboard](leaderboard.md) with today's number and no delta, which is the honest reading: a cost with nothing yet to compare it to. A cost that *has* been compared and did not move is above, under [Unchanged](#unchanged) — the two are different facts and this page counted them as one until 2026-09-05.

