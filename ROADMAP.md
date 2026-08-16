# Roadmap

Ordered by value-per-effort for users. Contributions welcome on any of these.

## Next

- [ ] **Claude divergence column**: measure the top servers via Anthropic's count_tokens
      (tools-delta method, model-pinned, dated) and publish alongside o200k in the
      leaderboard — closes the methodology's "planned" promise.
- [ ] **Cost-over-time sparklines**: `results/history.csv` already accumulates a
      per-(date, server) series with every sweep; surface it on the dashboard once
      multiple sweep dates exist.
- [ ] **`measure --remote <url>`**: first-class remote-server measurement (wrapping the
      mcp-remote bridge internally).
- [ ] **CLI cross-check column**: publish ours-vs-mcp-tokens divergence across the measured
      set — closes the second "planned" promise.
- [ ] **Expand the sweep**: more servers from the registry long-tail; re-attempt current
      startup-failures as upstream fixes land.
- [ ] **npm 0.2.0**: `verify --remote` (fetch a measurement URL), JSON output mode,
      documented exit codes.

## Later

- [ ] Schema-size suggestions (opt-in): turn per-tool breakdowns into concrete
      trim-this-description advice.
- [ ] Periodic "state of MCP context cost" data summary, when the deltas tell a story.

## Done

- [x] v0.1.0: measurement pipeline, 57-server leaderboard, methodology v1.0, shields
      badges, verify CLI, npm publish (2026-08-16)
- [x] `results/history.csv`: per-(date, server) token series, upserted by every sweep
      (2026-08-16)
- [x] Server detail pages: `docs/servers/<name>.md` per measured server — per-tool
      breakdown, launch command, isolation, hash, `verify` command, and (once a second
      sweep date exists) the over-time table; linked from the dashboard and leaderboard
      (2026-08-16)
