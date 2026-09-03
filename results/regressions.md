# How the cost of the measured set has moved

Every server here is measured again on a rotating schedule, and most launch unpinned (`npx -y <pkg>`) — so a change between two measurements is a real upstream release landing in real context windows. This page reports each server's **most recent movement**: the change that produced the cost it carries today, dated to when it happened rather than to the last time anyone looked (method `cost-regression/v1`, newest data 2026-09-03). A server that moved once and has held that cost since keeps its real window, and the table says how long the new cost has held.

Comparable means the two runs used the same isolation — two numbers taken under different isolation are not comparable, and the trend line already refuses to span that boundary (see [history](history.csv) and the sparklines on each [server page](../docs/servers/)). A failed measurement contributes no row at all, so a server that stopped starting reads as a gap in its series, never as a drop to zero.

**9 servers moved upward and 1 moved down**, a net +4,357 tokens across the measured set. 6 movements clear both thresholds for being called out (at least 5% *and* at least 25 tokens — relative alone would headline a fifth of a cheap server, absolute alone would headline drift on an expensive one). Everything comparable is listed either way.

| server | window | tokens | change | tools | what moved |
|---|---|---:|---:|---:|---|
| [obsidian](../docs/servers/obsidian.md) **·** | 2026-08-19 → 2026-08-26, held to 2026-09-03 | 1,132 → 2,062 | +930 (+82.2%) | +3 | shipped more tools |
| [blender](../docs/servers/blender.md) **·** | 2026-08-19 → 2026-09-03 | 5,462 → 6,928 | +1,466 (+26.8%) | +3 | shipped more tools |
| [arxiv](../docs/servers/arxiv.md) **·** | 2026-08-19 → 2026-09-03 | 3,228 → 3,960 | +732 (+22.7%) | +5 | shipped more tools |
| [shopify-dev](../docs/servers/shopify-dev.md) **·** | 2026-08-19 → 2026-09-03 | 5,624 → 6,841 | +1,217 (+21.6%) | +1 | shipped more tools |
| [clickhouse](../docs/servers/clickhouse.md) **·** | 2026-08-18 → 2026-09-02 | 581 → 694 | +113 (+19.4%) | — | same tools, rewritten |
| [sentry](../docs/servers/sentry.md) **·** | 2026-08-18 → 2026-09-03 | 6,455 → 6,086 | −369 (−5.7%) | — | same tools, rewritten |
| [searxng](../docs/servers/searxng.md) | 2026-08-19 → 2026-09-02 | 1,481 → 1,537 | +56 (+3.8%) | — | same tools, rewritten |
| [sequential-thinking](../docs/servers/sequential-thinking.md) | 2026-08-18 → 2026-09-03 | 992 → 1,003 | +11 (+1.1%) | — | same tools, rewritten |
| [github](../docs/servers/github.md) | 2026-08-18 → 2026-09-03 | 54,422 → 54,622 | +200 (+0.4%) | — | same tools, rewritten |
| [desktop-commander](../docs/servers/desktop-commander.md) | 2026-08-18 → 2026-08-19 | 11,835 → 11,836 | +1 (+0.0%) | — | same tools, rewritten |

Rows marked **·** clear both thresholds.

## Where the tokens went

**obsidian** +930 (+82.2%), 2026-08-19 → 2026-08-26:
  - per-tool breakdown unavailable: only one of the two captures is on record. Attribution accrues from the first sweep after a server's tool vectors were first stored.

**blender** +1,466 (+26.8%), 2026-08-19 → 2026-09-03:
  - per-tool breakdown unavailable: only one of the two captures is on record. Attribution accrues from the first sweep after a server's tool vectors were first stored.

**arxiv** +732 (+22.7%), 2026-08-19 → 2026-09-03:
  - per-tool breakdown unavailable: only one of the two captures is on record. Attribution accrues from the first sweep after a server's tool vectors were first stored.

**shopify-dev** +1,217 (+21.6%), 2026-08-19 → 2026-09-03:
  - per-tool breakdown unavailable: only one of the two captures is on record. Attribution accrues from the first sweep after a server's tool vectors were first stored.

**clickhouse** +113 (+19.4%), 2026-08-18 → 2026-09-02:
  - per-tool breakdown unavailable: only one of the two captures is on record. Attribution accrues from the first sweep after a server's tool vectors were first stored.

**sentry** −369 (−5.7%), 2026-08-18 → 2026-09-03:
  - per-tool breakdown unavailable: only one of the two captures is on record. Attribution accrues from the first sweep after a server's tool vectors were first stored.

## Not compared (and why)

71 server(s) carry a measurement but no second comparable one — first measurement, or every earlier run taken under different isolation. They appear on the [leaderboard](leaderboard.md) with today's number and no delta, which is the honest reading: a cost with nothing yet to compare it to.

