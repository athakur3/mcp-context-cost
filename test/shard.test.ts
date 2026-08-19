import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { weekIndex, shardIndexForDate, selectShard } from '../src/sweep/shard.js';
import type { Measurement } from '../src/core/types.js';

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('weekIndex', () => {
  it('holds steady across a week and advances by exactly one at the boundary', () => {
    const start = weekIndex(day('2026-08-19'));
    // Whatever day of the week 08-19 lands in, six more days can advance the
    // counter at most once, and seven days must advance it exactly once.
    expect(weekIndex(day('2026-08-25')) - start).toBeLessThanOrEqual(1);
    expect(weekIndex(day('2026-08-26')) - weekIndex(day('2026-08-19'))).toBe(1);
    expect(weekIndex(day('2026-10-14')) - weekIndex(day('2026-08-19'))).toBe(8);
  });

  it('ignores the time of day — the slice is a property of the date', () => {
    expect(weekIndex(new Date('2026-08-19T00:00:00Z'))).toBe(
      weekIndex(new Date('2026-08-19T23:59:59Z')),
    );
  });

  it('does not reset at a year boundary', () => {
    // A calendar week *number* restarts each January; this counter must not,
    // or one shard would be measured twice running and another skipped.
    expect(weekIndex(day('2027-01-07')) - weekIndex(day('2026-12-31'))).toBe(1);
  });
});

describe('shardIndexForDate', () => {
  it('stays inside the shard range', () => {
    for (let d = 1; d <= 28; d++) {
      const date = day(`2026-09-${String(d).padStart(2, '0')}`);
      const i = shardIndexForDate(date, 6);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(6);
    }
  });

  it('visits every shard once over one cycle of consecutive weeks', () => {
    const seen = new Set<number>();
    for (let w = 0; w < 6; w++) {
      const date = new Date(Date.UTC(2026, 7, 19) + w * 7 * 86_400_000);
      seen.add(shardIndexForDate(date, 6));
    }
    expect(seen.size).toBe(6);
  });

  it('is a pure function of the date, so a missed week needs no repair', () => {
    // Nothing is stored between runs. A job that fails to fire simply leaves
    // that week's servers to come round again next cycle — there is no cursor
    // to be left pointing at the wrong place.
    expect(shardIndexForDate(day('2026-11-04'), 6)).toBe(shardIndexForDate(day('2026-11-04'), 6));
    expect(shardIndexForDate(day('2026-12-16'), 6)).toBe(shardIndexForDate(day('2026-11-04'), 6));
  });

  it('rejects a shard count that could not partition anything', () => {
    expect(() => shardIndexForDate(day('2026-08-19'), 0)).toThrow();
    expect(() => shardIndexForDate(day('2026-08-19'), 2.5)).toThrow();
  });
});

describe('selectShard', () => {
  const items = Array.from({ length: 82 }, (_, i) => `s${i}`);

  it('partitions the set — every server in exactly one shard', () => {
    const all: string[] = [];
    for (let i = 0; i < 6; i++) all.push(...selectShard(items, 6, i));
    expect(all.sort()).toEqual([...items].sort());
    expect(new Set(all).size).toBe(items.length);
  });

  it('keeps shard sizes within one of each other', () => {
    // This is the property that makes a week's budget predictable: no shard can
    // quietly become twice the work of its neighbours.
    const sizes = Array.from({ length: 6 }, (_, i) => selectShard(items, 6, i).length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it('interleaves rather than slicing contiguously', () => {
    // servers.yaml is written in rough cost order within its groups. A
    // contiguous slice would hand one week every heavyweight entry; round-robin
    // spreads them, which is the whole reason a week fits in a runner.
    expect(selectShard(items, 6, 0).slice(0, 3)).toEqual(['s0', 's6', 's12']);
    expect(selectShard(items, 6, 1).slice(0, 3)).toEqual(['s1', 's7', 's13']);
  });

  it('covers every server exactly once per cycle of scheduled weeks', () => {
    const measured = new Map<string, number>();
    for (let w = 0; w < 6; w++) {
      const date = new Date(Date.UTC(2026, 7, 19) + w * 7 * 86_400_000);
      for (const s of selectShard(items, 6, shardIndexForDate(date, 6))) {
        measured.set(s, (measured.get(s) ?? 0) + 1);
      }
    }
    expect(measured.size).toBe(items.length);
    expect([...new Set(measured.values())]).toEqual([1]);
  });

  it('with one shard, sweeps everything', () => {
    expect(selectShard(items, 1, 0)).toEqual(items);
  });

  it('rejects an out-of-range index instead of returning an empty week', () => {
    // An empty shard sweep exits 0 having measured nothing — a silent no-op is
    // exactly what a scheduled job must not be able to do.
    expect(() => selectShard(items, 6, 6)).toThrow();
    expect(() => selectShard(items, 6, -1)).toThrow();
    expect(() => selectShard(items, 0, 0)).toThrow();
  });
});

describe('sweep-all sharding (subprocess)', () => {
  const repoRoot = process.cwd();
  const sweepAll = join(repoRoot, 'src', 'sweep', 'sweep-all.ts');
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'sweep-shard-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function measurement(name: string, tokens: number): Measurement {
    return {
      methodologyVersion: '1.0',
      provider: 'tiktoken',
      encoding: 'o200k_base',
      status: 'measured',
      totalTokens: tokens,
      toolCount: 9,
      tools: [],
      canonicalSha256: 'deadbeef',
      rawToolsCapture: [],
      measuredAt: '2026-08-19T12:03:51.569Z',
      serverName: name,
    };
  }

  /** `n` servers whose launch command exits immediately; no prior measurements. */
  function scaffold(n: number): string[] {
    const names = Array.from({ length: n }, (_, i) => `stub${i}`);
    writeFileSync(
      join(root, 'servers.yaml'),
      'servers:\n' +
        names
          .map((nm) => `  - name: ${nm}\n    command: node -e "process.exit(1)"\n    timeoutSeconds: 10\n`)
          .join(''),
    );
    return names;
  }

  function runSweep(args: string[]): { code: number; out: string } {
    try {
      const out = execFileSync('npx', ['tsx', sweepAll, ...args], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { code: 0, out };
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      return { code: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
  }

  /** Which servers the sweep actually measured, read off its per-server log lines. */
  function swept(out: string): string[] {
    return out
      .split('\n')
      .map((l) => /^ {2}(stub\d+):/.exec(l)?.[1])
      .filter((n): n is string => Boolean(n))
      .sort(); // workers finish out of order; membership is the claim, not sequence
  }

  it('measures only its own slice, and the slices tile the whole set', () => {
    const names = scaffold(9);
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { code, out } = runSweep(['--shards', '3', '--shard-index', String(i)]);
      expect(code).toBe(0);
      const week = swept(out);
      expect(week.length).toBe(3);
      seen.push(...week);
    }
    expect(seen.sort()).toEqual([...names].sort());
  }, 180_000);

  it('names the slice in its log before measuring it', () => {
    scaffold(9);
    const { out } = runSweep(['--shards', '3', '--shard-index', '1']);
    expect(out).toContain('shard 2/3 of 9 sweepable: stub1, stub4, stub7');
  }, 120_000);

  it('leaves servers outside this week`s slice exactly as they were published', () => {
    // The point of the rotation is that untouched servers keep their number.
    // A shard sweep that blanked them would empty the leaderboard six weeks
    // running, one slice at a time.
    scaffold(9);
    const outside = ['stub2', 'stub5'];
    const before: Record<string, string> = {};
    for (const [i, name] of outside.entries()) {
      mkdirSync(join(root, 'results', name), { recursive: true });
      const json = JSON.stringify(measurement(name, 4000 + i), null, 2) + '\n';
      writeFileSync(join(root, 'results', name, 'measurement.json'), json);
      before[name] = json;
    }

    const { code, out } = runSweep(['--shards', '3', '--shard-index', '0']);
    expect(code).toBe(0);
    expect(swept(out)).toEqual(['stub0', 'stub3', 'stub6']);
    for (const name of outside) {
      expect(readFileSync(join(root, 'results', name, 'measurement.json'), 'utf8')).toBe(before[name]);
    }
    // ...and they are still on the published leaderboard and in history.
    const leaderboard = readFileSync(join(root, 'results', 'leaderboard.md'), 'utf8');
    for (const name of outside) expect(leaderboard).toContain(name);
    const history = readFileSync(join(root, 'results', 'history.csv'), 'utf8');
    expect(history).toContain('2026-08-19,stub2,4000,9,measured');
  }, 120_000);

  it('derives the slice from today when no index is pinned', () => {
    scaffold(9);
    const { code, out } = runSweep(['--shards', '3']);
    expect(code).toBe(0);
    const expected = shardIndexForDate(new Date(), 3);
    expect(out).toContain(`shard ${expected + 1}/3 of 9 sweepable:`);
    expect(swept(out)).toEqual(selectShard(['stub0', 'stub1', 'stub2', 'stub3', 'stub4', 'stub5', 'stub6', 'stub7', 'stub8'], 3, expected));
  }, 120_000);

  it('refuses --shards together with --only rather than intersecting them', () => {
    scaffold(9);
    const { code, out } = runSweep(['--shards', '3', '--only', 'stub1']);
    expect(code).toBe(2);
    expect(out).toContain('pass one or the other');
    expect(existsSync(join(root, 'results', 'leaderboard.md'))).toBe(false);
  }, 60_000);

  it('refuses --shard-index without --shards', () => {
    scaffold(9);
    const { code, out } = runSweep(['--shard-index', '0']);
    expect(code).toBe(2);
    expect(out).toContain('--shard-index needs --shards');
  }, 60_000);
});
