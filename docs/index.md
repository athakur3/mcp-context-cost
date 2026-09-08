# mcp-context-cost

**How much of your agent's context window does an MCP server eat before it does anything?**

We measure 107 popular MCP servers; 87 have a number today, and every failure is listed
with its reason. Ranked on the wire, the spread is 1,700×: from `postgres` at 32 tokens to
`github` at **54,622 tokens**, before the agent takes a single action. Of that, an Anthropic
request carries 10,735 tokens as tool definitions, and Claude counts those at 18,728.
Second-heaviest is `agent-device` at 53,669 on the wire, 40,105 carried, 75,686 on Claude.

- **[What moved](https://github.com/athakur3/mcp-context-cost/blob/main/results/regressions.md)**
  — each server's most recent cost movement, dated, and which half of the server moved
- **[The dashboard](dashboard.html)** — the ranked chart; open any row for its breakdown
- **[Server pages](servers/)** — per-server: where the tokens are, tool by tool
- **[The leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md)**
  — every candidate listed, failures included with reasons
- **[Methodology v1.0](METHODOLOGY.md)** — what the number is, how to reproduce it in five
  lines, what it is not
- **[Get the badge](https://github.com/athakur3/mcp-context-cost#measure-your-own-server)** —
  one line in your README, backed by a published measurement

## The badge

A shields.io endpoint badge whose number links to a versioned methodology and to the raw
`tools/list` capture it was counted from. Anyone can re-derive it from that capture in five
lines, and disagree with it in one — [METHODOLOGY §reproduce it](METHODOLOGY.md#reproduce-it)
has them.

That is the point. Numbers you can't audit are marketing; numbers you can refute are
measurements.
