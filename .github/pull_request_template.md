<!--
Thank you. Two kinds of pull request come here, and the checklist is only for the first.
Delete whichever half does not apply.
-->

## Adding or changing a `servers.yaml` entry

The steps, their order, and the reason for each are in
[CONTRIBUTING.md](../CONTRIBUTING.md) — "Add an entry" for the order that goes green,
"Check it locally" for the command that writes nothing, and a section each for `command`,
`timeoutSeconds` and `env`. They are not repeated here; tick these once you have followed them.

- [ ] Followed "Add an entry" in order — appended the entry, regenerated, and committed
      everything regen rewrote.
- [ ] The changelog's unreleased section names the entry.
- [ ] The suite and the release-readiness gate are green locally.
- [ ] `env` holds variable **names only**. No value of any kind is in this diff.
- [ ] `command`, `timeoutSeconds` and `metricSource` each follow their section of the guide,
      and any `timeoutSeconds` carries the basis it came from.
- [ ] Nothing generated is in this diff — no `results/`, `badges/` or `docs/servers/` files.
      A number checked locally was checked with the flag that writes nothing; CI publishes.

**Provenance** — per the guide's rule, state it here:

<!-- e.g. "io.github.acme/thing → github.com/acme/thing", or why they differ -->

## Anything else

What changed, and the record it rests on (a file, a commit, a measurement).
