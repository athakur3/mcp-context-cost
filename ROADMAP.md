# Roadmap

Ordered by value-per-effort for users. Contributions welcome on any of these.

## Next

- [ ] **Trim advice in `audit`**: the per-tool breakdown already names the heaviest tools;
      turn that into "disabling these 3 tools recovers N tokens" for clients that support
      per-tool filtering.
- [ ] **Cost-over-time sparklines**: `results/history.csv` already accumulates a
      per-(date, server) series with every sweep; surface it on the dashboard once
      multiple sweep dates exist.
- [ ] **`measure --remote <url>`**: first-class remote-server measurement (wrapping the
      mcp-remote bridge internally).
- [ ] **CLI cross-check column**: publish ours-vs-mcp-tokens divergence across the measured
      set — closes the second "planned" promise.
- [ ] **Expand the sweep**: more servers from the registry long-tail; re-attempt current
      startup-failures as upstream fixes land.

## Later

- [ ] Schema-size suggestions (opt-in): turn per-tool breakdowns into concrete
      trim-this-description advice.
- [ ] Periodic "state of MCP context cost" data summary, when the deltas tell a story.

## Done

- [x] **`audit --claude`**: annotates each audited server with its Anthropic-request cost
      from the published `tools-delta/v1` divergence run — an exact number when the
      published capture hash matches what's installed locally, silence (`—`) when it
      doesn't. Fetches `results/divergence.json` from the published repo (`--divergence-url`
      to override); a fetch failure degrades to no column plus a recorded problem, never a
      crash (2026-08-17)

- [x] **`audit`**: measure the servers in your own MCP config — Claude Desktop, Claude Code,
      Cursor, VS Code, Windsurf — with per-config totals, context-window share, heaviest
      tools, and a `--budget N` CI gate. The leaderboard answers "what does this server
      cost?"; `audit` answers "what does my stack cost?" (2026-08-17)

- [x] **`verify --remote <url>`**: fetch and verify a published measurement.json directly,
      no clone required; 15s request timeout (2026-08-17)

- [x] **Claude divergence column** (`tools-delta/v1`): top 15 servers measured via Anthropic's
      count_tokens, model-pinned and dated, published in the leaderboard and decomposed per
      server into field selection vs tokenizer/framing (2026-08-16)

- [x] v0.1.0: measurement pipeline, 57-server leaderboard, methodology v1.0, shields
      badges, verify CLI, npm publish (2026-08-16)
- [x] `results/history.csv`: per-(date, server) token series, upserted by every sweep
      (2026-08-16)
- [x] Server detail pages: `docs/servers/<name>.md` per measured server — per-tool
      breakdown, launch command, isolation, hash, `verify` command, and (once a second
      sweep date exists) the over-time table; linked from the dashboard and leaderboard
      (2026-08-16)
