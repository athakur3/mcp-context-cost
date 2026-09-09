import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { measureServer, emptyToolsNote } from '../src/sweep/run.js';
import { hasNumber } from '../src/sweep/harness-guard.js';
import { removeTempRoot } from './tmp.js';
import { writeEmptyToolsStub } from './empty-tools-stub.js';

/**
 * A server that lists no tools, over a real stdio process. No published record
 * has zero tools (checked 2026-09-09), so nothing here is a transcription; the
 * three cases are the three things `initialize` can say about an empty list.
 */
describe('a server that answers tools/list with an empty array', () => {
  let dir: string;
  let stub: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'mcp-ctx-empty-'));
    stub = writeEmptyToolsStub(dir);
  });

  afterAll(() => {
    removeTempRoot(dir);
  });

  const run = (env: Record<string, string>) =>
    measureServer('stub-empty', 'node stub-empty.mjs', {
      argv: [process.execPath, stub],
      env,
      timeoutMs: 5_000,
      persist: false as const,
    });

  it('is measured — zero tools is the answer, not a failure', async () => {
    const m = await run({ STUB_DECLARE_TOOLS: '0' });
    expect(m.status).toBe('measured');
    expect(m.toolCount).toBe(0);
    expect(m.tools).toEqual([]);
    expect(m.rawToolsCapture).toEqual([]);
    expect(m.notes).toBe(emptyToolsNote(false));
    expect(m.notes).toContain('declared no tools capability');
  });

  it('says so when the server declared a tools capability and listed none', async () => {
    const m = await run({ STUB_DECLARE_TOOLS: '1' });
    expect(m.status).toBe('measured');
    expect(m.notes).toBe(emptyToolsNote(true));
    expect(m.notes).toContain('although the server declared a tools capability');
  });

  it('says when there was no capabilities object to read the zero against', async () => {
    const m = await run({});
    expect(m.status).toBe('measured');
    expect(m.notes).toBe(emptyToolsNote(null));
    expect(m.notes).toContain('no capabilities object');
  });

  it('claims nothing about why, in every variant', () => {
    for (const v of [true, false, null] as const) {
      const note = emptyToolsNote(v);
      expect(note).toContain('zero tools, zero tokens of definitions');
      expect(note).not.toMatch(/broken|failed|bug/);
    }
  });

  it('is not evidence that the harness works', async () => {
    const m = await run({ STUB_DECLARE_TOOLS: '0' });
    expect(hasNumber({ status: m.status, toolCount: m.toolCount })).toBe(false);
  });
});
