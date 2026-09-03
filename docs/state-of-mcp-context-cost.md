# The State of MCP Context Cost

*mcp-context-cost · September 2026 · methodology v1.0*

Every MCP server in an agent's config injects its tool schemas into the model's context on
every request — before the agent does anything. We measured 106 popular servers. Here is
what the numbers say.

Model Context Protocol servers are how agents get tools, and tools are not free at rest: a
connected server's `tools/list` — names, descriptions, JSON schemas — rides along in context
on every single request, whether or not any tool is called. No client shows this number. So
[mcp-context-cost](https://github.com/athakur3/mcp-context-cost) measures it: the o200k_base
token count of the canonical `tools/list` bytes, exactly as each server's wire sent them,
captured in credential-free Docker containers, with every published number backed by a raw
capture, its SHA-256, and the exact launch command. Anyone can re-derive any figure with one
command; disputes reduce to a byte-level diff. As of this week the set covers **106
candidate servers, 81 of them measured** — the rest are listed as failures with their
reasons, because a server that won't start is a finding, not an omission.

Six things the data says, each traceable to a
[published measurement](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md).

## 1. The spread is 1,700×

The cheapest measured server, the reference
[postgres](https://athakur3.github.io/mcp-context-cost/servers/postgres.html), costs **32
tokens**. The most expensive, GitHub's official server, costs **54,622** — 27.3% of a
200,000-token context window spent before the agent takes a single action. That is a factor
of 1,700 between two things people install with the same one-line command, for the same
reason.

The distribution is heavy-tailed: the median server costs 2,837 tokens, the 90th percentile
11,912 — and the top ten together cost **242,023 tokens**, which is to say: more than an
entire 200K context window, spent on schemas alone, before a word of conversation. A stack
of four or five popular servers routinely costs more than the system prompt it rides beside.

## 2. The heaviest server depends on who's counting

The headline number counts every byte a server ships. An Anthropic request carries only
three fields per tool — `name`, `description`, `input_schema` — and counts them with a
different tokenizer. Both effects are measured against a pinned model (`claude-opus-5`, via
`count_tokens`), and they do not cancel:

| server | badge (o200k) | on Claude | why they differ |
|---|---:|---:|---|
| github | 54,422 | **18,406** | 81% of the capture is annotations/outputSchema metadata a request never carries |
| notion | 17,500 | **33,560** | almost no metadata to drop, so the denser tokenizer dominates |

**The heaviest server on the badge is not the heaviest server on Claude.**

Across the measured run the ratio of Claude tokens to badge tokens ranges from **0.20× to
1.92×** — there is no constant you can multiply by. Field selection removes anywhere from
0.7% to 89.9% of a server's payload depending on how much metadata it ships. This is why the
leaderboard publishes the Claude number as its own column, pinned to the capture hash it was
computed from: when a server's schema moves, the stale cell prints silence rather than a
number that no longer describes anything.

## 3. Deferring tool definitions is nearly free — but not by construction

Some clients (Claude Code's tool search, by default) do not load definitions up front: they
put a list of tool *names* in context and fetch a definition when the model reaches for it.
What that client pays at session start — names plus the server's `instructions` string — is
measured per server as its own column, and on 80 of 81 rows it is a small fraction of the
headline.

On one row it is not.
[deepwiki](https://athakur3.github.io/mcp-context-cost/servers/deepwiki.html) pays **580
tokens at session start against 359 of definitions** — its `instructions` re-describe its
tools in prose, so a deferring client pays for a prose copy of the schemas it just skipped.
Instructions are bytes the headline never counted, and their length has nothing to do with
the size of the tool set. Deferral is an excellent default; it is not a law of nature, and
this measurement is how you catch the exception.

## 4. Two independent counters agree to within about one percent

There is another CLI that measures this — [sd2k/mcp-tokens](https://github.com/sd2k/mcp-tokens),
a Rust implementation with its own MCP client and its own serialization. Since this week the
leaderboard runs it beside every measurement, same encoding, and publishes the disagreement.
Counting the same three request fields on the same tool sets, the two implementations land
within **−0.8% to +1.4%** of each other across all 71 rows where both saw the same tools.

That residual is serialization order and whitespace; the rest of the visible gap between the
two tools' headline numbers is field modeling — their structs carry the three request
fields, ours carry the wire — which the cross-check separates out rather than folding in. A
comparison only prints while it compares like with like: same tool names on both sides,
capture unchanged since the run, dynamic listings excluded. Two codebases that share nothing
agreeing to a fraction of a percent is about the strongest external check a number like this
can get.

## 5. Popularity tells you nothing about cost

This week the set grew by 24 servers from the official MCP registry's long tail, and the two
most instructive arrivals point in opposite directions:

| server | installs/week | context cost | tools |
|---|---:|---:|---:|
| chrome-devtools (official) | 3,288,165 | **5,717** | 29 |
| comfyui-mcp | 141,905 | **50,640** | 41 |

The most-installed MCP server we have ever measured is also one of the leaner ones for its
size — 29 tools, carefully written. A server with 4% of its install base costs nine times as
much and walked straight in at #2 on the leaderboard. Cost is an engineering choice, not a
side effect of scope — and nothing in an install command tells you which choice was made.
(25 of the 106 candidates are currently unmeasurable, each listed with its reason: 14 won't
start — several of them broken as published — 6 demand real credentials before naming their
tools, 3 are OAuth-walled remotes, 2 time out even on a doubled budget.)

## 6. You can check any of these numbers, and your own

Every published figure resolves to a `measurement.json` holding the raw capture, its
canonical SHA-256, the tokenizer, and the launch command:

```bash
npx -y mcp-context-cost verify --remote \
  https://raw.githubusercontent.com/athakur3/mcp-context-cost/main/results/github/measurement.json
# OK github-mcp-server: 54622 tokens (o200k_base, methodology 1.0)
#    — capture, hash, and count all agree
```

And the same measurement runs against your own config — Claude Desktop, Claude Code, Cursor,
VS Code, Windsurf — including what your client's deferral settings actually do on your
machine:

```bash
npx -y mcp-context-cost audit
# per-server totals, share of your context window, per-tool breakdown

npx -y mcp-context-cost audit --config .mcp.json --baseline baseline.json --max-increase 2000
# CI gate: fail the PR that quietly adds 25,000 tokens to every request
```

If you publish a server, the number is available as a badge — `[context cost | 2,061
tokens]` — linked to the measurement behind it, so your users can see the cost before they
install instead of after. A badge nobody can audit is decoration; these resolve to bytes.

---

**Method, in one paragraph.** Each server is launched by a ~200-line raw-wire stdio client
(no SDK — schema-parsing layers reorder keys, which would corrupt canonical bytes), in a
credential-free container with recorded isolation. `tools/list` is captured twice; servers
whose listings differ between runs are marked dynamic. Tokens = o200k_base over the
canonical JSON of the capture. The Claude column is `count_tokens` deltas on a pinned model;
the session-start column is tool names plus `instructions`; the cross-check column is
sd2k/mcp-tokens v0.2.5 run in the same containers minutes after each measurement. Full
definition, failure taxonomy, and known divergences:
[METHODOLOGY.md](https://github.com/athakur3/mcp-context-cost/blob/main/docs/METHODOLOGY.md).

**Data.** The
[leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md)
(every candidate, failures included),
[dashboard](https://athakur3.github.io/mcp-context-cost/dashboard.html), and
[per-server pages](https://athakur3.github.io/mcp-context-cost/servers/) showing which tools
the tokens are in. Rows carry the date of their own most recent measurement; two weekly jobs
re-measure the set on a six-week rotation, and every number in this article was read from
the data of 2026-09-04.
