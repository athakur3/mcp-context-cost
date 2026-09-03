# sd2k/mcp-tokens verification notes (2026-08-16)

Findings from reading the CLI source (`src/counter/tiktoken.rs`, `src/main.rs`) — the Day-1
verification item from the plan.

## Finding 1 — encoding is model-dependent with a cl100k_base fallback

```rust
let bpe = tiktoken_rs::get_bpe_from_model(&model).unwrap_or_else(|_| {
    tiktoken_rs::cl100k_base().expect("Failed to load cl100k_base encoding")
});
```

- No `--encoding` flag exists; no default model is set (`model: Option<String>`, env fallback).
- To obtain `o200k_base` counts, the CLI must be invoked with a model tiktoken-rs maps to
  o200k (e.g. `--provider tiktoken --model gpt-4o`); otherwise counts fall back to
  **cl100k_base**, which systematically differs from our canonical numbers.

## Finding 2 — CLI counts a re-serialization, not wire bytes

```rust
let tools_json = serde_json::to_string(tools)?;
let tokens = self.bpe.encode_with_special_tokens(&tools_json);
```

`tools` are **deserialized rmcp structs** (fetched via `Client::fetch_server_data`), so
`serde_json::to_string`:
- re-orders keys into struct declaration order (wire order lost), and
- may drop fields the struct doesn't model (e.g. server-specific extensions),
so its bytes can differ from what the wire carried. Small numeric divergence from our
raw-wire canonical is expected; direction and size to be quantified in the sweep
(cross-check column).

## Consequences for our methodology (v1.0)

1. **Canonical number = ours** (raw wire `tools/list` JSON, as-received order, o200k_base).
   The CLI is a **cross-check column**, not the canonical source. Rationale: the wire bytes
   are the only implementation-independent ground truth; a canonical number defined by one
   Rust binary's struct layout can silently change with a struct refactor.
2. When the cross-check column is built, the sweep records `cliTokens` alongside
   `totalTokens`, always invoking the CLI as `--provider tiktoken --model gpt-4o`, so the
   divergence is published, not discovered by critics.

## Addendum (2026-09-03) — finding 2, quantified

The cross-check column shipped, and the first rows answered the open question above.
The CLI's count lands within a fraction of a percent of **`mappedTokens`** — our o200k
count of the name/description/input_schema projection — not of the full capture:
`memory` 906 vs mapped 901 (full 2,378), `filesystem` 1,667 vs 1,665 (full 2,823),
`postgres` 32 vs 32 vs 32. So "fields the struct doesn't model" is the dominant term and
it is, in practice, everything outside the three request fields; the serialization
difference itself is noise-sized. The published comparison is therefore against
`mappedTokens` of the same fresh capture (`cli-cross-check/v1`), with the field-selection
gap already published per server as its field-selection share.
