/**
 * Which servers does *this week's* re-sweep measure?
 *
 * `history.csv` only grows for servers that get measured again, and the only
 * scheduled measurement this project runs is the weekly self-badge job — one
 * server, `memory`. Every other row's trend line therefore stops at whatever
 * date a maintenance run last swept by hand. Re-measuring all 82 on a schedule
 * is not the fix: a cold runner pays a full image pull and package install per
 * server with no cache volume to carry over, so the whole set does not fit in
 * one job's budget comfortably or cheaply.
 *
 * So the set rotates. Each week measures one deterministic slice, and after
 * `shardCount` weeks every server has been re-measured exactly once. The
 * schedule needs no state anywhere — the slice is a function of the date, so a
 * missed week is simply a week's worth of servers measured a cycle later, not a
 * cursor left pointing at the wrong place.
 */

const MS_PER_DAY = 86_400_000;

/**
 * Whole UTC weeks since the Unix epoch. Only differences matter — this is a
 * counter that advances once every 7 days, not a calendar week number, so it
 * has no year boundary to get wrong.
 */
export function weekIndex(date: Date): number {
  const utcDay = Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / MS_PER_DAY,
  );
  return Math.floor(utcDay / 7);
}

/** The shard this date falls in, always in `[0, shardCount)`. */
export function shardIndexForDate(date: Date, shardCount: number): number {
  if (!Number.isInteger(shardCount) || shardCount < 1) {
    throw new Error(`shardCount must be a positive integer, got ${shardCount}`);
  }
  return weekIndex(date) % shardCount;
}

/**
 * Deal `items` into `shardCount` shards round-robin and return shard `index`.
 *
 * Interleaving by position rather than slicing contiguously is deliberate:
 * `servers.yaml` is written in rough cost order within its groups, so a
 * contiguous slice would hand one week every heavyweight server and another
 * week nothing but cheap ones. Round-robin spreads the expensive entries
 * across shards, which is what keeps any single week inside a runner's budget.
 *
 * The cost of positional dealing is that inserting a server shifts the ones
 * after it by one shard. That is harmless — a shifted server is measured one
 * week early or late, once, and every server is still measured exactly once per
 * cycle. It is worth naming, though: shard membership is stable only as long as
 * `servers.yaml`'s order is.
 */
export function selectShard<T>(items: readonly T[], shardCount: number, index: number): T[] {
  if (!Number.isInteger(shardCount) || shardCount < 1) {
    throw new Error(`shardCount must be a positive integer, got ${shardCount}`);
  }
  if (!Number.isInteger(index) || index < 0 || index >= shardCount) {
    throw new Error(`shard index must be in [0, ${shardCount}), got ${index}`);
  }
  return items.filter((_, i) => i % shardCount === index);
}
