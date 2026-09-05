/**
 * Rename the Unreleased heading to a dated version, leaving its preamble in
 * place — the mechanical half of cutting a release.
 *
 * A script rather than a line of `sed` in a workflow because it has to be
 * refusable. `0.8.0` shipped once with this step skipped, so npm served bytes
 * the changelog still described as unreleased, and the publish guard that
 * exists today was written in response. This refuses the same way: no entries
 * under Unreleased, or a section that already exists for this version, and it
 * exits non-zero rather than producing a plausible-looking file.
 *
 *   npx tsx tools/cut-changelog.ts 0.14.0 [--date 2026-09-05]
 */
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
const dateFlag = process.argv.indexOf('--date');
const date = dateFlag > 0 ? process.argv[dateFlag + 1]! : new Date().toISOString().slice(0, 10);

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('usage: cut-changelog.ts <x.y.z> [--date YYYY-MM-DD]');
  process.exit(2);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`not a date: ${date}`);
  process.exit(2);
}

const path = 'CHANGELOG.md';
const text = readFileSync(path, 'utf8');
const heading = `## ${version} — ${date}`;

if (text.includes(`## ${version} —`)) {
  console.error(`CHANGELOG already has a section for ${version} — nothing to cut`);
  process.exit(1);
}

const start = text.indexOf('## Unreleased');
if (start < 0) {
  console.error('no `## Unreleased` heading to cut from');
  process.exit(1);
}
const next = text.indexOf('\n## ', start + 1);
const section = text.slice(start, next > 0 ? next : text.length);
if (!section.includes('\n- ')) {
  console.error(
    'the Unreleased section has no entries. A version whose changelog says nothing is a ' +
      'version nobody can read — write it before cutting.',
  );
  process.exit(1);
}

// The preamble — the first paragraph under `## Unreleased` — explains what the
// heading means and stays with it. Everything after it belongs to the release,
// including the opening paragraph that says what the release *is*. The split is
// on the paragraph break rather than on the first `- ` entry because inserting
// before the entries strands that opening under "Unreleased", describing a
// version it is no longer part of.
const sectionEnd = next > 0 ? next : text.length;
const lines = text.slice(start, sectionEnd).split('\n');
let i = 1;
while (i < lines.length && lines[i]!.trim() === '') i++; // blank line(s) under the heading
while (i < lines.length && lines[i]!.trim() !== '') i++; // the preamble itself
if (i >= lines.length) {
  console.error('could not find the end of the Unreleased preamble');
  process.exit(1);
}
const rebuilt = [...lines.slice(0, i + 1), heading, '', ...lines.slice(i + 1)].join('\n');
const out = text.slice(0, start) + rebuilt + text.slice(sectionEnd);
writeFileSync(path, out);
console.log(`cut ${heading}`);
