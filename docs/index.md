# mcp-context-cost

**How much of your agent's context window does an MCP server eat before it does anything?**

We measured 82 popular MCP servers (57 measurable without credentials). The spread is
1,700×: from markitdown's 64 tokens to the official GitHub server's **54,422 tokens** —
more than a quarter of a 200K context window, before the agent takes a single action.

- **[The leaderboard](../results/leaderboard.md)** — every candidate listed, failures
  included with reasons
- **[Methodology v1.0](METHODOLOGY.md)** — what the number is, how to reproduce it in five
  lines, what it is not
- **[Get the badge](../README.md#measure-your-own-server)** — one line in your README,
  backed by a published measurement

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
