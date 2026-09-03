# mcp-context-cost

**How much of your agent's context window does an MCP server eat before it does anything?**

We measure 106 popular MCP servers; 81 have a number today, and every failure is listed
with its reason. The spread is 1,700×: from `postgres` at 32 tokens to `github` at
**54,622 tokens** — 27% of a 200K context window, before the agent takes a single action.
Second-heaviest is `comfyui-mcp` at 50,640.

- **[The State of MCP Context Cost](state-of-mcp-context-cost)** — six findings from the
  data, September 2026: the spread, the tokenizer reversal, the deferral exception, and why
  two independent counters agreeing matters
- **[The dashboard](dashboard.html)** — the ranked chart; open any row for its breakdown
- **[Server pages](servers/)** — per-server: where the tokens are, tool by tool
- **[The leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md)**
  — every candidate listed, failures included with reasons
- **[Methodology v1.0](METHODOLOGY.md)** — what the number is, how to reproduce it in five
  lines, what it is not
- **[Get the badge](https://github.com/athakur3/mcp-context-cost#measure-your-own-server)** —
  one line in your README, backed by a published measurement
- **[Who displays the badge](adoption.md)** — how many projects outside this repository
  carry it, the day someone last looked, and every file that was examined to say so

## The badge

```
[context cost | 2,061 tokens]
```

A shields.io endpoint badge whose number links to a versioned methodology and a raw
`tools/list` capture. Anyone can re-derive it:

```js
import { getEncoding } from "js-tiktoken";
const m = JSON.parse(fs.readFileSync("measurement.json", "utf8"));
const n = getEncoding("o200k_base").encode(JSON.stringify(m.rawToolsCapture)).length;
// n === m.totalTokens, or the badge is wrong and you just proved it
```

That last clause is the point. Numbers you can't audit are marketing; numbers you can
refute are measurements.
