# Proposed patch to sd2k/mcp-tokens-action (DRAFT — held for user review)

Adds opt-in badge output to the existing composite action. No measurement-logic changes,
no new required inputs, no default-behavior changes.

## New inputs

```yaml
  badge:
    description: 'Generate a shields.io endpoint badge JSON from the measurement'
    required: false
    default: 'false'
  badge-path:
    description: 'Where to write the badge JSON'
    required: false
    default: 'badge.json'
  badge-label:
    description: 'Badge label text'
    required: false
    default: 'context cost'
  badge-gist-id:
    description: 'Gist id to publish the badge JSON to (requires gist-token)'
    required: false
  gist-token:
    description: 'Token with gist scope for publishing the badge JSON'
    required: false
```

## New output

```yaml
  badge:
    description: 'The shields.io endpoint badge JSON'
    value: ${{ steps.badge.outputs.badge }}
```

## New step (after "Check result", so a failed threshold check never publishes)

```yaml
  - name: Generate badge
    id: badge
    if: inputs.badge == 'true' && success()
    shell: bash
    env:
      BADGE_TOKENS: ${{ steps.analyze.outputs.tool-tokens }}
      BADGE_PATH: ${{ inputs.badge-path }}
      BADGE_LABEL: ${{ inputs.badge-label }}
      BADGE_GIST_ID: ${{ inputs.badge-gist-id }}
      GIST_TOKEN: ${{ inputs.gist-token }}
    run: ${{ github.action_path }}/badge.sh
```

The badge number is `tool-tokens` (tool-schema cost), not `total-tokens` — resources and
prompts are separate concerns and most clients only preload tool schemas.

## README addition (snippet for server maintainers)

```markdown
### Publish a context-cost badge

    - uses: sd2k/mcp-tokens-action@v1
      with:
        command: 'npx -y your-mcp-server'
        badge: 'true'
        badge-gist-id: '<your-gist-id>'
        gist-token: ${{ secrets.GIST_TOKEN }}

Then in your README:

    [![context cost](https://img.shields.io/endpoint?url=<raw-gist-url>/badge.json)](https://<methodology-url>)

Zero-token alternative: set `badge-path`, commit the JSON to a `badges` branch, and point
shields at the raw.githubusercontent URL.
```

## Notes for the PR body

- Publish-on-success only: the step runs after the threshold check with `success()`, so a
  failed analysis or a failed check never overwrites a badge — badges degrade to
  last-known-good.
- Tested: `upstream/tests/badge-test.sh` runs badge.sh against golden fixtures shared with
  the TypeScript reference implementation (byte-identical output required).
- Follow-up (separate issue, also drafted): `--encoding` flag on the CLI so tiktoken counts
  can pin `o200k_base` explicitly instead of the cl100k_base model-fallback.
