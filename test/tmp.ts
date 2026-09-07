// Removing a temporary directory a subprocess was writing in.
//
// `rmSync(dir, { recursive: true, force: true })` walks the tree and unlinks as
// it goes. `force` only suppresses "it was not there"; it does nothing about a
// directory that gains an entry *between* the walk reading it and the unlink,
// which fails with ENOTEMPTY. Every teardown that uses this helper tears down a
// root that a spawned process wrote into, and a child of that process can still
// be flushing when the synchronous spawn returns.
//
// It is a real race and it is rare: it turned the suite red once on macOS, in
// pr-check's afterEach, on a commit CI had already passed — a cleanup failing
// for a reason that has nothing to do with what the test asserts, which is the
// worst kind of red because the failure names an assertion that was fine.
//
// Node's own answer is the retry options, documented for exactly this error set
// (EBUSY, EMFILE, ENFILE, ENOTEMPTY, EPERM), with a linear backoff. The numbers
// below are measured rather than picked. Against a writer held open for a fixed
// interval while the removal ran, 8 trials per cell:
//
//   writer alive   bare   maxRetries 10    maxRetries 40
//                         retryDelay 50    retryDelay 25
//        0ms       0/8         0/8              0/8
//       25ms       8/8         0/8              0/8
//      100ms       8/8         1/8              0/8
//      150ms       8/8         6/8              0/8
//      200ms       8/8         8/8              0/8
//     1000ms       8/8           —              0/8
//     2000ms       8/8           —              8/8
//
// So a bare removal loses to a writer that outlives it by as little as 25ms,
// the obvious first guess (10 × 50ms) is already degrading at 150ms, and more
// tries at a shorter step beats fewer at a longer one because the backoff is
// linear. 40 × 25ms holds to a full second. **It is not unbounded** — a writer
// still going after ~2s defeats it, and that is the honest limit: this helper
// tolerates a late writer, it does not wait for a live one. A teardown that
// needs the latter has a process it failed to stop, which is a different bug.
//
// It costs nothing when nothing races: 96ms against a bare 90ms over 10 clean
// removals of the same tree, which is noise.
//
// Stated here rather than at each call site so there is one place to read why,
// in the manner of `tsx.ts` next door.
import { rmSync } from 'node:fs';

/** Remove a temp root that a subprocess wrote into, tolerating a late writer. */
export function removeTempRoot(path: string): void {
  rmSync(path, { recursive: true, force: true, maxRetries: 40, retryDelay: 25 });
}
