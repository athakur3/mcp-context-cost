# The State of MCP Context Cost — withdrawn

**This report was published on 2026-09-04 and withdrawn on 2026-09-08.** It is not here any
more. This notice stands at its address because the link that brought you here is printed inside
several published releases and cannot be recalled, and a reader who follows one is better served
by an account of what happened than by a missing page.

## Why it was withdrawn

It stated something that was never true, and nothing in this project could tell.

Its headline finding attributed most of one server's captured tokens to a metadata field that
server does not ship at all; the field actually responsible was a different one. A table in the
same report published a badge figure that contradicted the report's own headline, because the row
had been computed against bytes that had since been re-measured.

Neither error was reachable by any check. The report was hand-written prose sitting outside the
list of pages this project regenerates, so the guard that proves every published figure is
current copied the file unchanged into its own scratch tree and compared it against itself —
green, unconditionally, forever. Several further numbers in it had drifted the same way,
unnoticed.

It was withdrawn rather than corrected. Bringing it under the existing guard would have meant
freezing a page of prose nobody maintains, and what was left was history with a reading date
attached. History that states a thing which was never true is not worth keeping for the date's
sake.

## Where the numbers are

Everything that report quoted is published live, derived rather than typed, and checkable:

- **[The leaderboard](index.md)** — every measured server, ranked by what it costs before it
  does anything.
- **[Server detail pages](servers/)** — the per-tool breakdown behind any single row, and the
  capture it was computed from.
- **[Methodology](METHODOLOGY.md)** — what the number is, and how to reproduce it yourself.

There is no plan to republish this report in the form it took. If a state-of report returns, it
will state its numbers through the same claims the leaderboard is generated from, so that a
figure going stale fails a check rather than sitting on a page nobody rereads.
