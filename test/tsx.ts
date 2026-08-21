// Where the tests find tsx.
//
// `npx tsx …` resolves tsx from the cwd it is given. Several of these tests spawn
// the CLI from a temporary directory outside this repository, where the tsx that
// package.json pins and package-lock.json locks is not on the resolution path — so
// npx downloads tsx from the registry into the shared `~/.npm/_npx` cache at test
// time. On a machine whose cache already holds it that is invisible; on a cold one
// several such spawns race to populate the same cache entry and fail with
// ENOTEMPTY. That is what turned CI red at the commit npm serves.
//
// Resolving the repo's own tsx and running it under this process's node makes the
// suite depend on `npm ci` alone, which is the same on every machine.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const manifest = require.resolve('tsx/package.json');

/** Absolute path to the installed tsx CLI. Run it with `process.execPath`, never `npx`. */
export const TSX_CLI = join(dirname(manifest), (require(manifest) as { bin: string }).bin);
