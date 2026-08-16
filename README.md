# mcp-context-cost

[![npm](https://img.shields.io/npm/v/mcp-context-cost)](https://www.npmjs.com/package/mcp-context-cost)
[![CI](https://github.com/athakur3/mcp-context-cost/actions/workflows/ci.yml/badge.svg)](https://github.com/athakur3/mcp-context-cost/actions/workflows/ci.yml)

**Reproducible context-cost badges for MCP servers.**

Every MCP server you wire into an agent injects its tool schemas into the model's context
before any work happens. That cost is invisible — and it varies by **1,700×** across
popular servers:

| server | context cost | tools |
|---|---:|---:|
| github (official) | **54,422 tokens** | 44 |
| brave-search | 25,456 | 8 |
| notion | 17,500 | 24 |
| playwright *(4.8M installs/week)* | 4,024 | 24 |
| filesystem (reference) | 2,823 | 14 |
| markitdown | 64 | 1 |

*(57 of 82 popular servers measured, 2026-08-16 sweep — full table in
[results/leaderboard.md](results/leaderboard.md); every failure is listed with its reason.)*

This project makes that cost **legible and disputable**:

```
[context cost | 12,430 tokens]   ← shields.io badge, linked to the methodology
```

## Why trust the number?

Every badge is backed by a `measurement.json` containing the raw `tools/list` capture, the
SHA-256 of its canonical bytes, the pinned tokenizer (`o200k_base`), and the exact launch
command. Disputes reduce to a byte-level diff:

```bash
npx -y mcp-context-cost verify results/github/measurement.json
# OK github-mcp-server: 54422 tokens (o200k_base, methodology 1.0) — capture, hash, and count all agree
```

Full definition: [docs/METHODOLOGY.md](docs/METHODOLOGY.md) — what is counted, what the
number is *not*, config policy, failure taxonomy, frozen color bands, known divergences.

## What's in the repo

| path | what |
|---|---|
| `src/core/` | the measurement spec, executable — canonical form, tokenizer, bands, badge JSON |
| `src/sweep/` | raw-wire MCP stdio client + Dockerized batch sweep + leaderboard/dashboard generators |
| `src/cli.ts` | `verify` (re-derive any published number) and `measure` |
| `spec/fixtures/` | golden vectors shared by the TypeScript and bash implementations |
| `upstream/` | staged contribution to [sd2k/mcp-tokens-action](https://github.com/sd2k/mcp-tokens-action): `badge.sh` + action patch + tests |
| `servers.yaml` | 82 curated candidates with live install metrics and provenance |
| `results/` · `badges/` | measurements, leaderboard, shields endpoint JSONs |

## Measure your own server

```bash
npm ci
npm run sweep -- --name my-server --command "npx -y my-mcp-server"
cat badges/my-server.json   # strict shields.io endpoint JSON
```

Then in your README:

```markdown
[![context cost](https://img.shields.io/endpoint?url=<raw URL of badges/my-server.json>)](<methodology URL>)
```

Or self-serve from CI via the (staged) mcp-tokens-action badge inputs — see
[upstream/action-patch.md](upstream/action-patch.md).

## Development

```bash
npm test                        # 24 TS tests incl. golden fixtures + dispute drills
npx tsc --noEmit                # typecheck
./upstream/tests/badge-test.sh  # 21 bash tests — byte-identical to the TS reference
npm run sweep:all -- --docker   # full curated sweep (Docker isolation)
```

Notable engineering choices: the MCP client is a deliberate ~150-line raw-wire
implementation (SDK schema-parsing can reorder keys, which would corrupt canonical bytes);
sweep servers run in credential-free Docker containers with recorded isolation; the badge
color bands are frozen against the observed distribution of the first full sweep.

## Status

Active. The leaderboard refreshes weekly; badge PRs are open across the ecosystem and
[sd2k/mcp-tokens-action#5](https://github.com/sd2k/mcp-tokens-action/pull/5) proposes the
self-serve badge path upstream. See [ROADMAP.md](ROADMAP.md) for what's next —
contributions welcome, especially new `servers.yaml` entries.

MIT © 2026
