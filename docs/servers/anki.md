# anki — context cost

**20,037 tokens** across 50 tools — *heavy* (15–30K). Measured 2026-09-05 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | anki-mcp-server v0.25.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @ankimcp/anki-mcp-server --stdio` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `ff5c37e3ceea7d5f2514dc0b15b4443a9c6b10ce53fd9328f28be21759c69276` |
| category | community |
| source | https://github.com/ankimcp/anki-mcp-server |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| collection_stats | 1,853 | 9.2% | 267 | 221 |
| deckStats | 1,306 | 6.5% | 210 | 150 |
| listDecks | 750 | 3.7% | 95 | 42 |
| review_stats | 669 | 3.3% | 60 | 181 |
| setDueDate | 616 | 3.1% | 109 | 197 |
| addNotes | 590 | 2.9% | 76 | 283 |
| createModel | 570 | 2.8% | 58 | 321 |
| addNote | 570 | 2.8% | 87 | 282 |
| updateNoteFields | 560 | 2.8% | 65 | 311 |
| get_cards | 540 | 2.7% | 98 | 213 |
| forgetCards | 526 | 2.6% | 134 | 105 |
| get_due_cards | 519 | 2.6% | 95 | 193 |
| updateModelTemplates | 442 | 2.2% | 112 | 193 |
| notesInfo | 432 | 2.2% | 37 | 81 |
| guiCurrentCard | 413 | 2.1% | 97 | 26 |
| updateModelStyling | 407 | 2.0% | 54 | 109 |
| present_card | 404 | 2.0% | 77 | 73 |
| guiAddCards | 384 | 1.9% | 64 | 170 |
| guiBrowse | 371 | 1.9% | 62 | 159 |
| rate_card | 368 | 1.8% | 72 | 104 |
| deleteNotes | 347 | 1.7% | 47 | 119 |
| renameModelField | 345 | 1.7% | 61 | 133 |
| repositionModelField | 341 | 1.7% | 64 | 135 |
| addModelField | 338 | 1.7% | 56 | 142 |
| findNotes | 332 | 1.7% | 80 | 106 |
| storeMediaFile | 316 | 1.6% | 39 | 138 |
| modelStyling | 307 | 1.5% | 23 | 58 |
| removeModelField | 303 | 1.5% | 44 | 130 |
| replaceTags | 281 | 1.4% | 33 | 107 |
| modelTemplates | 278 | 1.4% | 43 | 58 |

*20 smaller tools omitted (4,557 tokens combined) — all of them are in the [raw capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/anki/measurement.json).*

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 20,037 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 9,357 | 53.3% of the capture is MCP-only metadata |
| **Claude, same fields** | **16,189** | 0.81× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Re-derive it

```bash
npx -y mcp-context-cost verify results/anki/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/anki/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/anki.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
