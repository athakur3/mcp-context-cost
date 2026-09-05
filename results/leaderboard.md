# MCP server context-cost leaderboard

Tokens = o200k_base count of the canonical `tools/list` bytes ([methodology v1.0](../docs/METHODOLOGY.md)). Measured 87/106 candidates; every candidate is listed — failures are findings, not omissions. Server names link to their per-tool breakdown.

The **claude** column is the same tools measured through Anthropic's `count_tokens` on `claude-opus-5` (2026-09-05, method `tools-delta/v1`): the tokens the server's tools add to a request, measured for the top 16. It is not a rescaling of the o200k column — two effects pull in opposite directions, and the [per-server pages](../docs/servers/) break both out. See [Claude divergence](../docs/METHODOLOGY.md#claude-divergence).

The **mcp-tokens** column is the other CLI's count of the same server — `sd2k/mcp-tokens` `v0.2.5` (2026-09-05, method `cli-cross-check/v1`), invoked with `--model gpt-4o` so both columns count o200k tokens. Its structs model the three request fields (name/description/input\_schema), so its number sits below the tokens column wherever a server ships metadata those fields do not carry — that gap is each server's field-selection share, published on its page, not a disagreement of counters. The parenthesized percentage is the disagreement of counters: the CLI's count against ours of the same three-field projection, −0.8% to +1.4% across the 84 rows where both tools saw the same tool set. A row prints only while the comparison is between like and like: the same tool names on both sides, and our capture unchanged since the run. See [CLI cross-check](../docs/METHODOLOGY.md#cli-cross-check).

**Of the servers whose cost has moved at all, 11 moved upward and 6 moved down** — a net +4,446 tokens across the set. Most entries here launch unpinned, so a movement is a real upstream release landing in real context windows, and only measurements taken under the same isolation are compared. Every movement, which half of the server moved, and where the tokens went: [regressions.md](regressions.md).

The **session start** column is what a client puts in context when it *defers* tool definitions until they are used: the server's tool names plus the `instructions` string it returns from `initialize` (method `deferred-load/v1`). The tokens column is what a client that loads every definition up front pays; this one is what the same server costs a client that does not. See [session-start load](../docs/METHODOLOGY.md#session-start-load).

**Deferring costs more than it saves on 1 of 87 rows.** `deepwiki` pays 580 at session start against 359 of definitions. The names half is always a fraction of the headline, but `instructions` are bytes the tokens column never counted and their length is independent of the tool set — so a server that re-lists its tools in its instructions makes a deferring client pay for a prose copy of the schemas it just skipped. A client that defers definitions is better off on every other measured row and worse off on this one.

| # | server | tokens | session start | claude | mcp-tokens | tools | largest tool | status | category |
|---:|---|---:|---:|---:|---:|---:|---|---|---|
| 1 | [github](../docs/servers/github.md) | 54,622 | 556 | — | 10,803 (+0.6%) | 44 | issue_write (2,050) | measured | vendor-official |
| 2 | [agent-device](../docs/servers/agent-device.md) | 53,669 | 463 | — | 40,124 (+0.0%) | 57 | fill (4,461) | measured | community |
| 3 | [comfyui-mcp](../docs/servers/comfyui-mcp.md) | 50,640 | 428 | — | 50,375 (+0.3%) | 41 | download_model (3,986) | measured | community |
| 4 | [xcodebuildmcp](../docs/servers/xcodebuildmcp.md) | 26,594 | 559 | 5,335 | 2,704 (+1.0%) | 24 | snapshot_ui (2,139) | measured | community |
| 5 | [brave-search](../docs/servers/brave-search.md) | 25,487 | 61 | — | 8,300 (+0.3%) | 8 | brave_place_search (17,295) | measured | vendor-official |
| 6 | [anki](../docs/servers/anki.md) | 20,037 | 179 | 16,189 | 9,371 (+0.1%) | 50 | collection_stats (1,853) | measured | community |
| 7 | [notion](../docs/servers/notion.md) | 17,500 | 135 | 33,560 | 17,408 (+1.4%) | 24 | API-update-page-markdown (1,282) | measured | vendor-official |
| 8 | [mcp-atlassian](../docs/servers/mcp-atlassian.md) | 17,311 | 347 | — | — | 63 | jira_update_proforma_form_answers (800) | dynamic | community |
| 9 | [grafana](../docs/servers/grafana.md) | 16,774 | 731 | 26,641 | 15,465 (+0.0%) | 65 | alerting_manage_rules (1,368) | measured | vendor-official |
| 10 | [azure](../docs/servers/azure.md) | 15,239 | 697 | 26,202 | 14,297 (−0.0%) | 68 | get_azure_bestpractices (454) | measured | vendor-official |
| 11 | [octocode](../docs/servers/octocode.md) | 13,552 | 791 | — | 13,122 (+1.2%) | 14 | ghSearchPullRequests (1,799) | measured | community |
| 12 | [githits](../docs/servers/githits.md) | 12,833 | 53 | — | 12,416 (+0.3%) | 16 | search (2,270) | measured | community |
| 13 | [circleci](../docs/servers/circleci.md) | 11,912 | 61 | 19,164 | 11,750 (−0.0%) | 13 | run_rollback_pipeline (1,391) | measured | vendor-official |
| 14 | [desktop-commander](../docs/servers/desktop-commander.md) | 11,834 | 99 | — | — | 26 | start_search (1,351) | dynamic | community |
| 15 | [google-surf](../docs/servers/google-surf.md) | 10,948 | 21 | — | 6,472 (+0.9%) | 7 | project_memory (3,279) | measured | community |
| 16 | [apify](../docs/servers/apify.md) | 10,452 | 1,144 | — | 4,803 (+0.2%) | 10 | search-actors (2,226) | measured | vendor-official |
| 17 | [appium-mcp](../docs/servers/appium-mcp.md) | 10,267 | 328 | — | 9,843 (+0.5%) | 31 | appium_gesture (1,308) | measured | vendor-official |
| 18 | [obsidian-rest](../docs/servers/obsidian-rest.md) | 10,173 | 65 | — | 5,855 (−0.4%) | 12 | obsidian_get_note (1,523) | measured | community |
| 19 | [firecrawl](../docs/servers/firecrawl.md) | 9,561 | 342 | 16,428 | 8,993 (+1.4%) | 27 | firecrawl_search (1,391) | measured | vendor-official |
| 20 | [redis](../docs/servers/redis.md) | 9,246 | 169 | 13,221 | 7,489 (+0.0%) | 53 | hybrid_search (510) | measured | vendor-official |
| 21 | [basic-memory](../docs/servers/basic-memory.md) | 9,188 | 71 | 12,426 | 7,113 (−0.1%) | 23 | search_notes (970) | measured | community |
| 22 | [hubspot](../docs/servers/hubspot.md) | 9,158 | 133 | 14,398 | 8,446 (+0.2%) | 21 | hubspot-search-objects (964) | measured | vendor-official |
| 23 | [accessibility-scanner](../docs/servers/accessibility-scanner.md) | 8,959 | 353 | 14,301 | 7,918 (+0.2%) | 33 | audit_site (1,100) | measured | community |
| 24 | [postgres-mcp](../docs/servers/postgres-mcp.md) | 8,632 | 39 | 2,381 | 1,178 (+0.0%) | 9 | explain_query (1,147) | measured | community |
| 25 | [ssh-manager](../docs/servers/ssh-manager.md) | 8,446 | 143 | — | 8,162 (+0.2%) | 37 | ssh_sync (477) | measured | community |
| 26 | [serena](../docs/servers/serena.md) | 8,204 | 138 | 11,494 | 6,528 (−0.3%) | 29 | find_symbol (883) | measured | community |
| 27 | [mongodb](../docs/servers/mongodb.md) | 7,926 | 103 | 8,765 | 4,519 (+0.4%) | 27 | explain (813) | measured | vendor-official |
| 28 | [blender](../docs/servers/blender.md) | 6,928 | 169 | — | 6,162 (+0.0%) | 28 | download_polypizza_model (490) | measured | community |
| 29 | [shopify-dev](../docs/servers/shopify-dev.md) | 6,841 | 26 | — | 6,804 (+0.2%) | 6 | learn_shopify_api (2,847) | measured | vendor-official |
| 30 | [bitbucket-mcp](../docs/servers/bitbucket-mcp.md) | 6,156 | 230 | — | 6,156 (+0.0%) | 47 | listPipelineRuns (258) | measured | community |
| 31 | [agentphone](../docs/servers/agentphone.md) | 6,134 | 100 | — | 5,613 (+0.6%) | 28 | create_agent (763) | measured | community |
| 32 | [sentry](../docs/servers/sentry.md) | 6,086 | 40 | — | 5,432 (−0.2%) | 9 | update_issue (1,248) | measured | vendor-official |
| 33 | [pinecone](../docs/servers/pinecone.md) | 5,903 | 294 | 9,184 | 5,680 (+0.0%) | 9 | search-records (1,179) | measured | vendor-official |
| 34 | [chrome-devtools](../docs/servers/chrome-devtools.md) | 5,717 | 98 | — | 5,080 (−0.4%) | 29 | emulate (418) | measured | vendor-official |
| 35 | [kubernetes](../docs/servers/kubernetes.md) | 5,268 | 95 | 9,165 | 5,089 (+0.0%) | 23 | kubectl_create (945) | measured | community |
| 36 | [codebase-memory-mcp](../docs/servers/codebase-memory-mcp.md) | 5,258 | 205 | — | 4,776 (+0.0%) | 15 | search_graph (905) | measured | community |
| 37 | [clinicaltrialsgov](../docs/servers/clinicaltrialsgov.md) | 5,134 | 54 | — | 2,874 (−0.2%) | 7 | clinicaltrials_search_studies (1,257) | measured | community |
| 38 | [aws-documentation](../docs/servers/aws-documentation.md) | 5,045 | 425 | — | 3,380 (+0.0%) | 5 | search_documentation (1,956) | measured | vendor-official |
| 39 | [supabase](../docs/servers/supabase.md) | 5,007 | 342 | — | 4,061 (−0.0%) | 29 | query_logs (794) | measured | vendor-official |
| 40 | [huggingface](../docs/servers/huggingface.md) | 4,724 | 378 | — | 1,611 (+0.4%) | 4 | hf_fs (1,957) | measured | vendor-official |
| 41 | [excel](../docs/servers/excel.md) | 4,266 | 106 | — | 3,080 (+0.0%) | 25 | format_range (472) | measured | community |
| 42 | [airtable](../docs/servers/airtable.md) | 4,186 | 50 | — | 2,533 (+0.1%) | 16 | list_records (395) | measured | community |
| 43 | [playwright](../docs/servers/playwright.md) | 4,024 | 91 | — | 3,409 (+0.2%) | 24 | browser_take_screenshot (329) | measured | vendor-official |
| 44 | [arxiv](../docs/servers/arxiv.md) | 3,960 | 84 | — | 3,696 (−0.1%) | 19 | search_papers (516) | measured | community |
| 45 | [github-legacy](../docs/servers/github-legacy.md) | 3,548 | 103 | — | 3,564 (+0.5%) | 26 | create_pull_request_review (360) | measured | official-reference |
| 46 | [playwright-community](../docs/servers/playwright-community.md) | 2,920 | 158 | — | 2,925 (+0.2%) | 33 | playwright_get_visible_html (228) | measured | community |
| 47 | [chroma](../docs/servers/chroma.md) | 2,837 | 71 | — | 2,837 (+0.0%) | 13 | chroma_get_documents (610) | measured | vendor-official |
| 48 | [netlify](../docs/servers/netlify.md) | 2,831 | 61 | — | 2,707 (+1.1%) | 9 | netlify-project-services-updater (896) | measured | vendor-official |
| 49 | [filesystem](../docs/servers/filesystem.md) | 2,823 | 51 | — | 1,667 (+0.1%) | 14 | read_media_file (290) | measured | official-reference |
| 50 | [pulumi](../docs/servers/pulumi.md) | 2,768 | 73 | — | 2,650 (−0.4%) | 12 | pulumi-resource-search (1,011) | measured | vendor-official |
| 51 | [n8n-mcp](../docs/servers/n8n-mcp.md) | 2,636 | 24 | — | 2,031 (+0.4%) | 7 | search_templates (628) | measured | community |
| 52 | [memory](../docs/servers/memory.md) | 2,378 | 34 | — | 906 (+0.6%) | 9 | search_nodes (323) | measured | official-reference |
| 53 | [obsidian](../docs/servers/obsidian.md) | 2,062 | 92 | — | 2,064 (+0.1%) | 15 | obsidian_complex_search (492) | measured | community |
| 54 | [terraform](../docs/servers/terraform.md) | 2,061 | 963 | — | 1,718 (+0.0%) | 9 | search_providers (484) | measured | vendor-official |
| 55 | [everything](../docs/servers/everything.md) | 1,708 | 374 | — | 1,083 (+0.1%) | 13 | gzip-file-as-resource (247) | measured | official-reference |
| 56 | [tavily](../docs/servers/tavily.md) | 1,653 | 28 | — | 1,665 (+0.7%) | 5 | tavily_search (615) | measured | vendor-official |
| 57 | [searxng](../docs/servers/searxng.md) | 1,537 | 27 | — | 1,490 (+0.7%) | 4 | searxng_web_search (825) | measured | community |
| 58 | [git](../docs/servers/git.md) | 1,455 | 43 | — | 1,119 (+0.0%) | 12 | git_log (289) | measured | official-reference |
| 59 | [pandoc](../docs/servers/pandoc.md) | 1,425 | 5 | — | 1,426 (+0.1%) | 1 | convert-contents (1,423) | measured | community |
| 60 | [context7](../docs/servers/context7.md) | 1,052 | 135 | — | 983 (−0.2%) | 2 | resolve-library-id (643) | measured | vendor-official |
| 61 | [sequential-thinking](../docs/servers/sequential-thinking.md) | 1,003 | 5 | — | 866 (+0.1%) | 1 | sequentialthinking (1,001) | measured | official-reference |
| 62 | [bright-data](../docs/servers/bright-data.md) | 978 | 20 | — | 880 (+0.1%) | 5 | discover (347) | measured | vendor-official |
| 63 | [microsoft-learn](../docs/servers/microsoft-learn.md) | 972 | 307 | — | 726 (+0.0%) | 3 | microsoft_code_sample_search (396) | measured | vendor-official |
| 64 | [figma-context](../docs/servers/figma-context.md) | 946 | 11 | — | 898 (+0.0%) | 2 | download_figma_images (646) | measured | community |
| 65 | [duckduckgo](../docs/servers/duckduckgo.md) | 724 | 6 | — | 661 (+0.0%) | 2 | fetch_content (387) | measured | community |
| 66 | [slack-legacy](../docs/servers/slack-legacy.md) | 681 | 47 | — | 681 (+0.0%) | 8 | slack_reply_to_thread (124) | measured | official-reference |
| 67 | [clickhouse](../docs/servers/clickhouse.md) | 632 | 72 | — | 494 (−0.2%) | 3 | list_tables (353) | measured | vendor-official |
| 68 | [emailmd](../docs/servers/emailmd.md) | 585 | 377 | — | 546 (+0.7%) | 3 | render (227) | measured | community |
| 69 | [google-maps](../docs/servers/google-maps.md) | 549 | 30 | — | 550 (+0.2%) | 7 | maps_distance_matrix (124) | measured | official-reference |
| 70 | [puppeteer](../docs/servers/puppeteer.md) | 540 | 39 | — | 538 (−0.4%) | 7 | puppeteer_screenshot (142) | measured | official-reference |
| 71 | [neo4j-cypher](../docs/servers/neo4j-cypher.md) | 523 | 26 | — | 354 (+0.0%) | 3 | get_neo4j_schema (238) | measured | vendor-official |
| 72 | [exa](../docs/servers/exa.md) | 486 | 11 | — | 414 (+0.0%) | 2 | web_search_exa (289) | measured | vendor-official |
| 73 | [airbnb](../docs/servers/airbnb.md) | 486 | 10 | — | 486 (+0.0%) | 2 | airbnb_search (319) | measured | community |
| 74 | [cloudflare-docs](../docs/servers/cloudflare-docs.md) | 422 | 15 | — | 252 (+0.0%) | 2 | search_cloudflare_documentation (351) | measured | vendor-official |
| 75 | [mysql](../docs/servers/mysql.md) | 393 | 12 | — | 332 (−0.6%) | 3 | get_table_sample (139) | measured | community |
| 76 | [elasticsearch](../docs/servers/elasticsearch.md) | 374 | 14 | — | — | 4 | search (159) | measured | vendor-official |
| 77 | [browserbase](../docs/servers/browserbase.md) | 364 | 13 | — | 310 (+0.0%) | 6 | act (69) | measured | vendor-official |
| 78 | [deepwiki](../docs/servers/deepwiki.md) | 359 | 580 | — | 234 (+0.4%) | 3 | ask_question (148) | measured | vendor-official |
| 79 | [gitlab](../docs/servers/gitlab.md) | 336 | 33 | — | 336 (+0.0%) | 9 | get_file_contents (41) | measured | official-reference |
| 80 | [brave-search-legacy](../docs/servers/brave-search-legacy.md) | 319 | 11 | — | 320 (+0.3%) | 2 | brave_web_search (161) | measured | official-reference |
| 81 | [time](../docs/servers/time.md) | 293 | 8 | — | 237 (−0.8%) | 2 | convert_time (186) | measured | official-reference |
| 82 | [sqlite](../docs/servers/sqlite.md) | 268 | 20 | — | 268 (+0.0%) | 6 | write_query (50) | measured | official-reference |
| 83 | [fetch](../docs/servers/fetch.md) | 238 | 3 | — | 238 (+0.0%) | 1 | fetch (236) | measured | official-reference |
| 84 | [qdrant](../docs/servers/qdrant.md) | 188 | 11 | — | 188 (+0.0%) | 2 | qdrant-store (101) | measured | vendor-official |
| 85 | [perplexity](../docs/servers/perplexity.md) | 133 | 7 | — | 134 (+0.8%) | 1 | perplexity_ask (131) | measured | vendor-official |
| 86 | [markitdown](../docs/servers/markitdown.md) | 64 | 6 | — | 64 (+0.0%) | 1 | convert_to_markdown (62) | measured | vendor-official |
| 87 | [postgres](../docs/servers/postgres.md) | 32 | 3 | — | 32 (+0.0%) | 1 | query (30) | measured | official-reference |

## Deprecated upstream

3 entries are no longer maintained by the publisher that ships them. They are measured on the same rotation as everything else — a package people have already installed and upstream has stopped updating is precisely the one whose context cost nobody is watching — so a row here can carry a real number, a real failure, or both over time. What it should not carry is silence about the deprecation itself.

| server | status | deprecation |
|---|---|---|
| gdrive | auth-required | [deprecated by its publisher](https://www.npmjs.com/package/@modelcontextprotocol/server-gdrive) — 2025.1.14, read 2026-09-05 |
| neon | startup-failure | [superseded by the remote MCP server at mcp.neon.tech](https://www.npmjs.com/package/@neondatabase/mcp-server-neon) — 0.6.5, read 2026-09-05 |
| elasticsearch | measured | [superseded by v0.4.0 or later, shipped differently — see the upstream README](https://www.npmjs.com/package/@elastic/mcp-server-elasticsearch) — 0.3.1, read 2026-09-05 |

## Not measured (and why)

| server | status | note |
|---|---|---|
| gdrive | auth-required | **[deprecated by its publisher](https://www.npmjs.com/package/@modelcontextprotocol/server-gdrive) — 2025.1.14, read 2026-09-05.** server exited (code 1); stderr tail: Credentials not found. Please run with 'auth' argument first. |
| redis-legacy | not-applicable | needs a Redis at 127.0.0.1:6379; the isolation deliberately provides no backing services — server exited (code 1); stderr tail: \[Redis Retry\] Attempt 1/5 fail |
| magic | auth-required | server error -32001: Not authenticated - your API key is missing or was reset. Get a fresh key at https://21st.dev/mcp and update your MCP config (x-api-key / B |
| stripe | auth-required | server exited (code 1); stderr tail: 🚨  Error initializing Stripe MCP server:     Invalid API key format. Expected sk_* (secret key) or rk_* (restricted key).  |
| heroku | startup-failure | reproduced with the shared package cache bypassed; server exited (code 1); stderr tail: Fatal error in main(): Cannot find module '/tmp/.npm-cache/_npx/909ffbc9 |
| neon | startup-failure | **[superseded by the remote MCP server at mcp.neon.tech](https://www.npmjs.com/package/@neondatabase/mcp-server-neon) — 0.6.5, read 2026-09-05.** reproduced with the shared package cache bypassed; server exited (code 1); stderr tail: npm warn deprecated @neondatabase/mcp-server-neon@0.6.5: This package is |
| linear | remote-auth-wall |  |
| zapier | remote-auth-wall |  |
| vercel | remote-auth-wall |  |
| gmail | auth-required | server exited (code 1); stderr tail: Error: OAuth keys file not found. Please place gcp-oauth.keys.json in current directory or /tmp/.gmail-mcp |
| slack | startup-failure | reproduced with the shared package cache bypassed; server exited (code 1); stderr tail: {"level":"error","timestamp":"2026-09-05T05:53:48Z","message":"Request f |
| kubernetes-containers | not-applicable | needs a kubeconfig with a cluster context; the isolation deliberately has neither — server exited (code 1); stderr tail: Error: unable to create kubernetes targ |
| hana-cli | startup-failure | reproduced with the shared package cache bypassed; server exited (code 1); stderr tail: purchased (at exorbitant rates) by contacting i@izs.me node:internal/mod |
| keboola | auth-required | server error 0: Client error '401 Unauthorized' for url 'https://connection.keboola.com/v2/storage/tokens/verify' For more information check: https://developer. |
| hevy | auth-required | server exited (code 1); stderr tail: Hevy API key is required. Provide it via the HEVY_API_KEY environment variable. |
| local-mcp | not-applicable | the vendor ships no Linux runtime yet — its own Go server is in preview for Windows and Linux — server exited (code 1); stderr tail: LMCP v3.0.405 (linux-amd64) |
| windows-mcp | not-applicable | Windows only — it depends on pywin32, which publishes no Linux wheels — server exited (code 1); stderr tail:  when resolving tool dependencies:   ╰─▶ Because on |
| yandex-tracker | auth-required | server exited (code 1); stderr tail: Downloading grpcio-tools (2.6MiB) Downloading yandexcloud (6.3MiB)  Downloaded grpcio-tools  Downloaded yandexcloud Install |
| safari-mcp | not-applicable | macOS only — the package declares os darwin and npm refuses to install it on Linux — server exited (code 1); stderr tail: npm error code EBADPLATFORM npm error  |

