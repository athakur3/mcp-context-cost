# MCP server context-cost leaderboard

Tokens = o200k_base count of the canonical `tools/list` bytes ([methodology v1.0](../docs/METHODOLOGY.md)). Measured 57/82 candidates; every candidate is listed — failures are findings, not omissions.

| # | server | tokens | tools | largest tool | status | category |
|---:|---|---:|---:|---|---|---|
| 1 | github | 54,422 | 44 | issue_write (1,890) | measured | vendor-official |
| 2 | brave-search | 25,456 | 8 | brave_place_search (17,282) | measured | vendor-official |
| 3 | notion | 17,500 | 24 | API-update-page-markdown (1,282) | measured | vendor-official |
| 4 | mcp-atlassian | 17,311 | 63 | jira_update_proforma_form_answers (800) | dynamic | community |
| 5 | circleci | 11,912 | 13 | run_rollback_pipeline (1,391) | measured | vendor-official |
| 6 | apify | 10,426 | 10 | search-actors (2,200) | measured | vendor-official |
| 7 | firecrawl | 9,561 | 27 | firecrawl_search (1,391) | measured | vendor-official |
| 8 | basic-memory | 9,188 | 23 | search_notes (970) | measured | community |
| 9 | hubspot | 9,158 | 21 | hubspot-search-objects (964) | measured | vendor-official |
| 10 | mongodb | 7,926 | 27 | explain (813) | measured | vendor-official |
| 11 | sentry | 6,455 | 9 | update_issue (1,306) | measured | vendor-official |
| 12 | pinecone | 5,903 | 9 | search-records (1,179) | measured | vendor-official |
| 13 | shopify-dev | 5,624 | 5 | learn_shopify_api (2,518) | measured | vendor-official |
| 14 | kubernetes | 5,268 | 23 | kubectl_create (945) | measured | community |
| 15 | blender | 5,258 | 24 | generate_hyper3d_model_via_images (454) | measured | community |
| 16 | aws-documentation | 5,074 | 5 | search_documentation (1,956) | measured | vendor-official |
| 17 | supabase | 5,013 | 29 | query_logs (800) | measured | vendor-official |
| 18 | huggingface | 4,691 | 4 | hf_whoami (1,948) | measured | vendor-official |
| 19 | excel | 4,266 | 25 | format_range (472) | measured | community |
| 20 | airtable | 4,207 | 16 | list_records (395) | measured | community |
| 21 | playwright | 4,024 | 24 | browser_take_screenshot (329) | measured | vendor-official |
| 22 | github-legacy | 3,548 | 26 | create_pull_request_review (360) | measured | official-reference |
| 23 | arxiv | 3,228 | 14 | search_papers (1,154) | measured | community |
| 24 | playwright-community | 2,920 | 33 | playwright_get_visible_html (228) | measured | community |
| 25 | chroma | 2,837 | 13 | chroma_get_documents (610) | measured | vendor-official |
| 26 | netlify | 2,831 | 9 | netlify-project-services-updater (896) | measured | vendor-official |
| 27 | filesystem | 2,823 | 14 | read_media_file (290) | measured | official-reference |
| 28 | pulumi | 2,768 | 12 | pulumi-resource-search (1,011) | measured | vendor-official |
| 29 | n8n-mcp | 2,636 | 7 | search_templates (628) | measured | community |
| 30 | memory | 2,378 | 9 | search_nodes (323) | measured | official-reference |
| 31 | terraform | 2,061 | 9 | search_providers (484) | measured | vendor-official |
| 32 | everything | 1,708 | 13 | gzip-file-as-resource (247) | measured | official-reference |
| 33 | tavily | 1,653 | 5 | tavily_search (615) | measured | vendor-official |
| 34 | searxng | 1,481 | 4 | searxng_web_search (770) | measured | community |
| 35 | pandoc | 1,425 | 1 | convert-contents (1,423) | measured | community |
| 36 | context7 | 1,052 | 2 | resolve-library-id (643) | measured | vendor-official |
| 37 | sequential-thinking | 992 | 1 | sequentialthinking (990) | measured | official-reference |
| 38 | bright-data | 978 | 5 | discover (347) | measured | vendor-official |
| 39 | microsoft-learn | 972 | 3 | microsoft_code_sample_search (396) | measured | vendor-official |
| 40 | figma-context | 946 | 2 | download_figma_images (646) | measured | community |
| 41 | duckduckgo | 724 | 2 | fetch_content (387) | measured | community |
| 42 | slack-legacy | 681 | 8 | slack_reply_to_thread (124) | measured | official-reference |
| 43 | clickhouse | 581 | 3 | list_tables (370) | measured | vendor-official |
| 44 | google-maps | 549 | 7 | maps_distance_matrix (124) | measured | official-reference |
| 45 | puppeteer | 540 | 7 | puppeteer_screenshot (142) | measured | official-reference |
| 46 | exa | 486 | 2 | web_search_exa (289) | measured | vendor-official |
| 47 | airbnb | 486 | 2 | airbnb_search (319) | measured | community |
| 48 | cloudflare-docs | 422 | 2 | search_cloudflare_documentation (351) | measured | vendor-official |
| 49 | mysql | 393 | 3 | get_table_sample (139) | measured | community |
| 50 | browserbase | 364 | 6 | act (69) | measured | vendor-official |
| 51 | deepwiki | 359 | 3 | ask_question (148) | measured | vendor-official |
| 52 | gitlab | 336 | 9 | get_file_contents (41) | measured | official-reference |
| 53 | brave-search-legacy | 319 | 2 | brave_web_search (161) | measured | official-reference |
| 54 | qdrant | 188 | 2 | qdrant-store (101) | measured | vendor-official |
| 55 | perplexity | 133 | 1 | perplexity_ask (131) | measured | vendor-official |
| 56 | markitdown | 64 | 1 | convert_to_markdown (62) | measured | vendor-official |
| 57 | postgres | 32 | 1 | query (30) | measured | official-reference |

## Not measured (and why)

| server | status | note |
|---|---|---|
| fetch | startup-failure | server exited (code 1); stderr tail: in \<module\>     from mcp_server_fetch import main   File "/tmp/.uv-cache/archive-v0/vFrrNX6vyNRVMDZ7hjaS4/lib/python3.12/ |
| git | startup-failure | server exited (code 1); stderr tail: PATH     - be set via $GIT_PYTHON_GIT_EXECUTABLE     - explicitly set via git.refresh(\<full-path-to-git-executable\>)  All |
| time | startup-failure | server exited (code 1); stderr tail: , in \<module\>     from mcp_server_time import main   File "/tmp/.uv-cache/archive-v0/SfGkkZZ67zYjtZfKCUoDr/lib/python3.12 |
| sqlite | startup-failure | server exited (code 1); stderr tail: main)            ^^^^^^^^^^^^^^^^   File "/usr/local/lib/python3.12/asyncio/runners.py", line 118, in run     return self._ |
| gdrive | auth-required | server exited (code 1); stderr tail: Credentials not found. Please run with 'auth' argument first.  |
| redis-legacy | startup-failure | server exited (code 1); stderr tail: econnect (/tmp/.npm-cache/_npx/5c1b9cdedadb4486/node_modules/@redis/client/dist/lib/client/socket.js:140:16)     at RedisSo |
| azure | auth-required | server exited (code 0); stderr tail: oveNext()    at System.Runtime.CompilerServices.AsyncMethodBuilderCore.Start\[\[Azure.Mcp.Server.Program+\<Main\>d__2, azmc |
| magic | auth-required | server error -32001: Not authenticated - your API key is missing or was reset. Get a fresh key at https://21st.dev/mcp and update your MCP config (x-api-key / B |
| stripe | startup-failure | server exited (code 1); stderr tail: index.js:20:30)     at Object.\<anonymous\> (/tmp/.npm-cache/_npx/bce731a0395adf49/node_modules/@stripe/mcp/dist/index.js:8 |
| heroku | startup-failure | server exited (code 1); stderr tail: Fatal error in main(): Cannot find module '/tmp/.npm-cache/_npx/909ffbc9d45b7a62/node_modules/@modelcontextprotocol/sdk/dis |
| neo4j-cypher | startup-failure | server exited (code 1); stderr tail: CK8xthI3sJK/lib/python3.12/site-packages/neo4j/_async/driver.py", line 194, in driver     driver_type, security_type, parse |
| grafana | timeout | timeout after 180000ms waiting for initialize |
| neon | startup-failure | server exited (code 1) |
| elasticsearch | startup-failure | server exited (code 1); stderr tail: Server error: \[   {     "validation": "url",     "code": "invalid_string",     "message": "Invalid Elasticsearch URL forma |
| redis | startup-failure | server exited (code 1); stderr tail:    Updating https://github.com/redis/mcp-redis.git (HEAD)   × Failed to download and build \`redis-mcp-server @   │ git+htt |
| linear | remote-auth-wall |  |
| zapier | remote-auth-wall |  |
| vercel | remote-auth-wall |  |
| postgres-mcp | startup-failure | server exited (code 1); stderr tail: Traceback (most recent call last):   File "/tmp/.uv-cache/archive-v0/X29VIyA7dTXbxyKVSfrhs/bin/postgres-mcp", line 6, in \< |
| xcodebuildmcp | startup-failure | server exited (code 1); stderr tail: "none"\]       --style                   Output style (normal is detailed; minimal is compact MCP-like output)  \[string\]  |
| desktop-commander | startup-failure | server exited (code 1); stderr tail: nt rates) by contacting i@izs.me npm warn deprecated fstream@1.0.12: This package is no longer supported. npm warn deprecat |
| serena | startup-failure | server exited (code 1); stderr tail:    Updating https://github.com/oraios/serena (HEAD)    Building proxy-tools==0.1.0   × Failed to download and build \`seren |
| gmail | auth-required | server exited (code 1); stderr tail: Error: OAuth keys file not found. Please place gcp-oauth.keys.json in current directory or /tmp/.gmail-mcp  |
| obsidian | startup-failure | server exited (code 1); stderr tail: Traceback (most recent call last):   File "/tmp/.uv-cache/archive-v0/q7a7WJc6K7v0b4ItgsxyM/bin/mcp-obsidian", line 6, in \< |
| slack | startup-failure | server exited (code 1); stderr tail: .execFileSync (node:child_process:952:15)     at Object.\<anonymous\> (/tmp/.npm-cache/_npx/2f12aed4e6049c73/node_modules/s |

