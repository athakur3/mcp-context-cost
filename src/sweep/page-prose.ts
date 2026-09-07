/**
 * What counts as prose on a published page, and which of it regen owns.
 *
 * Two tests scan the published markdown for numbers nobody maintains, and both
 * need the same two answers: which text is a claim rather than an illustration,
 * and which spans of it regen already rewrites. They lived in
 * `test/page-numbers.test.ts` while there was one such test. There are two now,
 * and two definitions of "prose" that drift apart is the same failure this
 * project keeps finding on its own pages — a rule stated twice is a rule that
 * can disagree with itself.
 *
 * Offsets matter and are why `blank` pads rather than deletes: callers match
 * `maintainedSpans` against the *raw* text and `stripNonProse` output against
 * the same coordinates, so every index has to survive the stripping. Splitting
 * these two functions into separate homes would break that silently.
 */
import { CHECK_CLAIMS, PAGE_CLAIMS, compileTemplate, type PageFile } from './published-stats.js';

/** Same length, same line breaks, no content — so every offset still lines up. */
const blank = (m: string) => m.replace(/[^\n]/g, ' ');

/**
 * Numbers in code are not claims about the data: fenced blocks and inline code
 * are transcripts, commands and JSON — illustrations of shape, shown as they
 * were run. Link targets and URLs are addresses.
 */
export function stripNonProse(text: string): string {
  return text
    .replace(/^```[\s\S]*?^```/gm, blank)
    .replace(/`[^`\n]*`/g, blank)
    .replace(/\]\([^)]*\)/g, blank)
    .replace(/https?:\/\/\S+/g, blank);
}

/** Half-open ranges of the page that regen owns, from the claims themselves. */
export function maintainedSpans(file: PageFile, raw: string): [number, number][] {
  const spans: [number, number][] = [];
  const templates = [
    ...PAGE_CLAIMS.filter((c) => c.file === file).map((c) => c.template),
    ...CHECK_CLAIMS.filter((c) => c.file === file).map((c) => c.words),
  ];
  for (const template of templates) {
    for (const m of raw.matchAll(compileTemplate(template))) {
      spans.push([m.index, m.index + m[0].length]);
    }
  }
  return spans;
}
