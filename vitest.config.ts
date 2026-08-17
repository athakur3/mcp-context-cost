import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // CLI tests spawn `npx tsx ...` subprocesses; the default 5s can be tight
    // under load (cold npx resolution + esbuild transform).
    testTimeout: 15_000,
  },
});
