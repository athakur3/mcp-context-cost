# MCP server context-cost leaderboard

Tokens = o200k_base count of the canonical `tools/list` bytes ([methodology v1.0](../docs/METHODOLOGY.md)). Measured 69/82 candidates; every candidate is listed — failures are findings, not omissions. Server names link to their per-tool breakdown.

The **claude** column is the same tools measured through Anthropic's `count_tokens` on `claude-opus-5` (2026-09-03, method `tools-delta/v1`): the tokens the server's tools add to a request, measured for the top 20. It is not a rescaling of the o200k column — two effects pull in opposite directions, and the [per-server pages](../docs/servers/) break both out. See [Claude divergence](../docs/METHODOLOGY.md#claude-divergence).

The **session start** column is what a client puts in context when it *defers* tool definitions until they are used: the server's tool names plus the `instructions` string it returns from `initialize` (method `deferred-load/v1`). The tokens column is what a client that loads every definition up front pays; this one is what the same server costs a client that does not. See [session-start load](../docs/METHODOLOGY.md#session-start-load).

**`≥` marks a floor, on 3 of 69 rows.** Tool names are counted exactly from the published capture, but `instructions` is not part of `tools/list` and has not been captured for these servers — so the figure is the names half alone and the true number is that or higher. A row stops being a floor the first time the server is measured with its instructions.

**Deferring costs more than it saves on 1 of 69 rows.** `deepwiki` pays 521 at session start against 359 of definitions. The names half is always a fraction of the headline, but `instructions` are bytes the tokens column never counted and their length is independent of the tool set — so a server that re-lists its tools in its instructions makes a deferring client pay for a prose copy of the schemas it just skipped. A client that defers definitions is better off on every other measured row and worse off on this one.

| # | server | tokens | session start | claude | tools | largest tool | status | category |
|---:|---|---:|---:|---:|---:|---|---|---|
| 1 | [github](../docs/servers/github.md) | 54,422 | 556 | 18,406 | 44 | issue_write (1,890) | measured | vendor-official |
| 2 | [xcodebuildmcp](../docs/servers/xcodebuildmcp.md) | 26,594 | 559 | 5,335 | 24 | snapshot_ui (2,139) | measured | community |
| 3 | [brave-search](../docs/servers/brave-search.md) | 25,456 | 61 | 13,746 | 8 | brave_place_search (17,282) | measured | vendor-official |
| 4 | [notion](../docs/servers/notion.md) | 17,500 | 135 | 33,560 | 24 | API-update-page-markdown (1,282) | measured | vendor-official |
| 5 | [mcp-atlassian](../docs/servers/mcp-atlassian.md) | 17,311 | 347 | 22,234 | 63 | jira_update_proforma_form_answers (800) | dynamic | community |
| 6 | [circleci](../docs/servers/circleci.md) | 11,912 | 61 | 19,164 | 13 | run_rollback_pipeline (1,391) | measured | vendor-official |
| 7 | [desktop-commander](../docs/servers/desktop-commander.md) | 11,836 | ≥99 | 19,305 | 26 | start_search (1,351) | dynamic | community |
| 8 | [apify](../docs/servers/apify.md) | 10,426 | ≥51 | 8,313 | 10 | search-actors (2,200) | measured | vendor-official |
| 9 | [firecrawl](../docs/servers/firecrawl.md) | 9,561 | 342 | 16,428 | 27 | firecrawl_search (1,391) | measured | vendor-official |
| 10 | [redis](../docs/servers/redis.md) | 9,246 | 169 | 13,221 | 53 | hybrid_search (510) | measured | vendor-official |
| 11 | [basic-memory](../docs/servers/basic-memory.md) | 9,188 | 71 | 12,426 | 23 | search_notes (970) | measured | community |
| 12 | [hubspot](../docs/servers/hubspot.md) | 9,158 | 133 | 14,398 | 21 | hubspot-search-objects (964) | measured | vendor-official |
| 13 | [postgres-mcp](../docs/servers/postgres-mcp.md) | 8,632 | 39 | 2,381 | 9 | explain_query (1,147) | measured | community |
| 14 | [serena](../docs/servers/serena.md) | 8,204 | 138 | 11,494 | 29 | find_symbol (883) | measured | community |
| 15 | [mongodb](../docs/servers/mongodb.md) | 7,926 | 103 | 8,765 | 27 | explain (813) | measured | vendor-official |
| 16 | [sentry](../docs/servers/sentry.md) | 6,455 | 40 | 10,463 | 9 | update_issue (1,306) | measured | vendor-official |
| 17 | [pinecone](../docs/servers/pinecone.md) | 5,903 | 294 | 9,184 | 9 | search-records (1,179) | measured | vendor-official |
| 18 | [shopify-dev](../docs/servers/shopify-dev.md) | 5,624 | ≥24 | 9,805 | 5 | learn_shopify_api (2,518) | measured | vendor-official |
| 19 | [blender](../docs/servers/blender.md) | 5,462 | 151 | 8,409 | 25 | generate_hyper3d_model_via_images (454) | measured | community |
| 20 | [kubernetes](../docs/servers/kubernetes.md) | 5,268 | 95 | 9,165 | 23 | kubectl_create (945) | measured | community |
| 21 | [aws-documentation](../docs/servers/aws-documentation.md) | 5,074 | 425 | — | 5 | search_documentation (1,956) | measured | vendor-official |
| 22 | [supabase](../docs/servers/supabase.md) | 5,013 | 342 | — | 29 | query_logs (800) | measured | vendor-official |
| 23 | [huggingface](../docs/servers/huggingface.md) | 4,691 | 200 | — | 4 | hf_whoami (1,948) | measured | vendor-official |
| 24 | [excel](../docs/servers/excel.md) | 4,266 | 106 | — | 25 | format_range (472) | measured | community |
| 25 | [airtable](../docs/servers/airtable.md) | 4,207 | 50 | — | 16 | list_records (395) | measured | community |
| 26 | [playwright](../docs/servers/playwright.md) | 4,024 | 91 | — | 24 | browser_take_screenshot (329) | measured | vendor-official |
| 27 | [github-legacy](../docs/servers/github-legacy.md) | 3,548 | 103 | — | 26 | create_pull_request_review (360) | measured | official-reference |
| 28 | [arxiv](../docs/servers/arxiv.md) | 3,228 | 61 | — | 14 | search_papers (1,154) | measured | community |
| 29 | [playwright-community](../docs/servers/playwright-community.md) | 2,920 | 158 | — | 33 | playwright_get_visible_html (228) | measured | community |
| 30 | [chroma](../docs/servers/chroma.md) | 2,837 | 71 | — | 13 | chroma_get_documents (610) | measured | vendor-official |
| 31 | [netlify](../docs/servers/netlify.md) | 2,831 | 61 | — | 9 | netlify-project-services-updater (896) | measured | vendor-official |
| 32 | [filesystem](../docs/servers/filesystem.md) | 2,823 | 51 | — | 14 | read_media_file (290) | measured | official-reference |
| 33 | [pulumi](../docs/servers/pulumi.md) | 2,768 | 73 | — | 12 | pulumi-resource-search (1,011) | measured | vendor-official |
| 34 | [n8n-mcp](../docs/servers/n8n-mcp.md) | 2,636 | 24 | — | 7 | search_templates (628) | measured | community |
| 35 | [memory](../docs/servers/memory.md) | 2,378 | 34 | — | 9 | search_nodes (323) | measured | official-reference |
| 36 | [obsidian](../docs/servers/obsidian.md) | 2,062 | 92 | — | 15 | obsidian_complex_search (492) | measured | community |
| 37 | [terraform](../docs/servers/terraform.md) | 2,061 | 963 | — | 9 | search_providers (484) | measured | vendor-official |
| 38 | [everything](../docs/servers/everything.md) | 1,708 | 374 | — | 13 | gzip-file-as-resource (247) | measured | official-reference |
| 39 | [tavily](../docs/servers/tavily.md) | 1,653 | 28 | — | 5 | tavily_search (615) | measured | vendor-official |
| 40 | [searxng](../docs/servers/searxng.md) | 1,537 | 27 | — | 4 | searxng_web_search (825) | measured | community |
| 41 | [git](../docs/servers/git.md) | 1,455 | 43 | — | 12 | git_log (289) | measured | official-reference |
| 42 | [pandoc](../docs/servers/pandoc.md) | 1,425 | 5 | — | 1 | convert-contents (1,423) | measured | community |
| 43 | [context7](../docs/servers/context7.md) | 1,052 | 135 | — | 2 | resolve-library-id (643) | measured | vendor-official |
| 44 | [sequential-thinking](../docs/servers/sequential-thinking.md) | 1,003 | 5 | — | 1 | sequentialthinking (1,001) | measured | official-reference |
| 45 | [bright-data](../docs/servers/bright-data.md) | 978 | 20 | — | 5 | discover (347) | measured | vendor-official |
| 46 | [microsoft-learn](../docs/servers/microsoft-learn.md) | 972 | 307 | — | 3 | microsoft_code_sample_search (396) | measured | vendor-official |
| 47 | [figma-context](../docs/servers/figma-context.md) | 946 | 11 | — | 2 | download_figma_images (646) | measured | community |
| 48 | [duckduckgo](../docs/servers/duckduckgo.md) | 724 | 6 | — | 2 | fetch_content (387) | measured | community |
| 49 | [clickhouse](../docs/servers/clickhouse.md) | 694 | 72 | — | 3 | list_tables (413) | measured | vendor-official |
| 50 | [slack-legacy](../docs/servers/slack-legacy.md) | 681 | 47 | — | 8 | slack_reply_to_thread (124) | measured | official-reference |
| 51 | [google-maps](../docs/servers/google-maps.md) | 549 | 30 | — | 7 | maps_distance_matrix (124) | measured | official-reference |
| 52 | [puppeteer](../docs/servers/puppeteer.md) | 540 | 39 | — | 7 | puppeteer_screenshot (142) | measured | official-reference |
| 53 | [neo4j-cypher](../docs/servers/neo4j-cypher.md) | 523 | 26 | — | 3 | get_neo4j_schema (238) | measured | vendor-official |
| 54 | [exa](../docs/servers/exa.md) | 486 | 11 | — | 2 | web_search_exa (289) | measured | vendor-official |
| 55 | [airbnb](../docs/servers/airbnb.md) | 486 | 10 | — | 2 | airbnb_search (319) | measured | community |
| 56 | [cloudflare-docs](../docs/servers/cloudflare-docs.md) | 422 | 15 | — | 2 | search_cloudflare_documentation (351) | measured | vendor-official |
| 57 | [mysql](../docs/servers/mysql.md) | 393 | 12 | — | 3 | get_table_sample (139) | measured | community |
| 58 | [elasticsearch](../docs/servers/elasticsearch.md) | 374 | 14 | — | 4 | search (159) | measured | vendor-official |
| 59 | [browserbase](../docs/servers/browserbase.md) | 364 | 13 | — | 6 | act (69) | measured | vendor-official |
| 60 | [deepwiki](../docs/servers/deepwiki.md) | 359 | 521 | — | 3 | ask_question (148) | measured | vendor-official |
| 61 | [gitlab](../docs/servers/gitlab.md) | 336 | 33 | — | 9 | get_file_contents (41) | measured | official-reference |
| 62 | [brave-search-legacy](../docs/servers/brave-search-legacy.md) | 319 | 11 | — | 2 | brave_web_search (161) | measured | official-reference |
| 63 | [time](../docs/servers/time.md) | 293 | 8 | — | 2 | convert_time (186) | measured | official-reference |
| 64 | [sqlite](../docs/servers/sqlite.md) | 268 | 20 | — | 6 | write_query (50) | measured | official-reference |
| 65 | [fetch](../docs/servers/fetch.md) | 238 | 3 | — | 1 | fetch (236) | measured | official-reference |
| 66 | [qdrant](../docs/servers/qdrant.md) | 188 | 11 | — | 2 | qdrant-store (101) | measured | vendor-official |
| 67 | [perplexity](../docs/servers/perplexity.md) | 133 | 7 | — | 1 | perplexity_ask (131) | measured | vendor-official |
| 68 | [markitdown](../docs/servers/markitdown.md) | 64 | 6 | — | 1 | convert_to_markdown (62) | measured | vendor-official |
| 69 | [postgres](../docs/servers/postgres.md) | 32 | 3 | — | 1 | query (30) | measured | official-reference |

## Not measured (and why)

| server | status | note |
|---|---|---|
| gdrive | auth-required | server exited (code 1); stderr tail: npm warn deprecated @modelcontextprotocol/server-gdrive@2025.1.14: Package no longer supported. Contact Support at https:// |
| redis-legacy | startup-failure | reproduced with the shared package cache bypassed; server exited (code 1); stderr tail: econnect (/tmp/.npm-cache/_npx/5c1b9cdedadb4486/node_modules/@redis/clie |
| azure | auth-required | server exited (code 0); stderr tail: oveNext()    at System.Runtime.CompilerServices.AsyncMethodBuilderCore.Start\[\[Azure.Mcp.Server.Program+\<Main\>d__2, azmc |
| magic | auth-required | server error -32001: Not authenticated - your API key is missing or was reset. Get a fresh key at https://21st.dev/mcp and update your MCP config (x-api-key / B |
| stripe | startup-failure | reproduced with the shared package cache bypassed; server exited (code 1); stderr tail: index.js:20:30)     at Object.\<anonymous\> (/tmp/.npm-cache/_npx/bce731 |
| heroku | startup-failure | reproduced with the shared package cache bypassed; server exited (code 1); stderr tail: Fatal error in main(): Cannot find module '/tmp/.npm-cache/_npx/909ffbc9 |
| grafana | timeout | reproduced on double the timeout budget; timeout after 360000ms waiting for initialize |
| neon | startup-failure | reproduced with the shared package cache bypassed; server exited (code 1) |
| linear | remote-auth-wall |  |
| zapier | remote-auth-wall |  |
| vercel | remote-auth-wall |  |
| gmail | auth-required | server exited (code 1); stderr tail: Error: OAuth keys file not found. Please place gcp-oauth.keys.json in current directory or /tmp/.gmail-mcp  |
| slack | startup-failure | reproduced with the shared package cache bypassed; server exited (code 1); stderr tail: .execFileSync (node:child_process:952:15)     at Object.\<anonymous\> (/ |

