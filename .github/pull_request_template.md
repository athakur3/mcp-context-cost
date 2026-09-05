<!--
Thank you. Two kinds of pull request come here, and the checklist is only for the first.
Delete whichever half does not apply.
-->

## Adding or changing a `servers.yaml` entry

The order below is the order that goes green — a pull request that appends an entry without
the second and third steps is red before anything of ours runs (see CONTRIBUTING.md,
"Add an entry").

- [ ] The entry is **appended**, not inserted — rotation slots are dealt by position.
- [ ] `npx tsx src/sweep/regen.ts` was run and **what it rewrote is committed** (the derived
      pages and leaderboard files; the readiness gate prints the list if any is missing).
- [ ] One bullet under `## Unreleased` in `CHANGELOG.md` names the entry.
- [ ] `npm test` and `npx tsx tools/release-readiness.ts` are green locally.
- [ ] `env` holds variable **names only**. No value of any kind is in this diff.
- [ ] The `command` is what the package documents as the way to start its stdio server — the
      subcommand or transport flag is present if the package needs one.
- [ ] `timeoutSeconds`, if set, has a basis: the seconds on the pull-request check's line, or a
      measured cold install named in a comment. Not a neighbour's value.
- [ ] `metricSource` resolves today, and `metric` is what it said on the day this was written.
- [ ] Nothing under `results/`, `badges/` or `docs/servers/` is in this diff. A number checked
      locally was checked with `npm run sweep -- --no-persist …`; CI is what publishes one.

**Provenance** — the registry name's owner and the repository's owner agree, or say here why
they do not:

<!-- e.g. "io.github.acme/thing → github.com/acme/thing" -->

## Anything else

What changed, and the record it rests on (a file, a commit, a measurement).
