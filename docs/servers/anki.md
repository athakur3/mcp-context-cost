# anki — context cost

**21,608 tokens** across 53 tools — *heavy* (15–30K). Measured 2026-09-30 under [methodology v1.0](../METHODOLOGY.html).

An Anthropic request carries 10,032 of those tokens as tool definitions. What Claude makes of them is not published for this server: its Claude count is missing, or was taken against a capture this measurement has since replaced.

| | |
|---|---|
| server (self-reported) | anki-mcp-server v0.26.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @ankimcp/anki-mcp-server --stdio` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `bad42d792f7e97407147274574bb0b785c45af7476d62025f653530073c7f97d` |
| category | community |
| source | https://github.com/ankimcp/anki-mcp-server |

## Where the tokens are

| tool | tokens | share | description | input schema | output schema |
|---|---:|---:|---:|---:|---:|
| collection_stats | 1,853 | 8.6% | 267 | 221 | 1,311 |
| deckStats | 1,306 | 6.0% | 210 | 150 | 893 |
| listDecks | 750 | 3.5% | 95 | 42 | 558 |
| review_stats | 712 | 3.3% | 103 | 181 | 375 |
| setDueDate | 616 | 2.9% | 109 | 197 | 254 |
| addNotes | 590 | 2.7% | 76 | 283 | 177 |
| suspend | 572 | 2.6% | 127 | 101 | 291 |
| createModel | 570 | 2.6% | 58 | 321 | 137 |
| addNote | 570 | 2.6% | 87 | 282 | 148 |
| updateNoteFields | 560 | 2.6% | 65 | 311 | 129 |
| unsuspend | 551 | 2.5% | 102 | 101 | 294 |
| get_cards | 540 | 2.5% | 98 | 213 | 176 |
| forgetCards | 526 | 2.4% | 134 | 105 | 232 |
| get_due_cards | 519 | 2.4% | 95 | 193 | 176 |
| updateModelTemplates | 442 | 2.0% | 112 | 193 | 81 |
| notesInfo | 430 | 2.0% | 37 | 81 | 258 |
| guiCurrentCard | 413 | 1.9% | 97 | 26 | 233 |
| areSuspended | 407 | 1.9% | 69 | 101 | 181 |
| updateModelStyling | 407 | 1.9% | 54 | 109 | 187 |
| present_card | 404 | 1.9% | 77 | 73 | 196 |
| guiAddCards | 384 | 1.8% | 64 | 170 | 94 |
| guiBrowse | 371 | 1.7% | 62 | 159 | 96 |
| rate_card | 368 | 1.7% | 72 | 104 | 139 |
| deleteNotes | 347 | 1.6% | 47 | 119 | 128 |
| renameModelField | 345 | 1.6% | 61 | 133 | 94 |
| repositionModelField | 341 | 1.6% | 64 | 135 | 83 |
| addModelField | 338 | 1.6% | 56 | 142 | 83 |
| findNotes | 332 | 1.5% | 80 | 106 | 92 |
| storeMediaFile | 316 | 1.5% | 39 | 138 | 78 |
| modelStyling | 307 | 1.4% | 23 | 58 | 170 |

*23 smaller tools omitted (5,419 tokens combined) — all of them are in the [raw capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/anki/measurement.json).*

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-09-05 | 20,037 | 50 | 0.25.0 | docker | — |
| 2026-09-09 | 20,037 | 50 | 0.25.0 | docker | no change |
| 2026-09-30 | 21,608 | 53 | 0.26.0 | docker | +1,571 |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/anki/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/anki/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/anki.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
