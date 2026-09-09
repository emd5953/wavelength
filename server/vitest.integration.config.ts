import { defineConfig } from 'vitest/config';

/**
 * Integration tests — require a real Postgres+PostGIS instance.
 * Start one with `docker compose up -d postgres` from the repo root.
 * Kept separate from the default config so `npm test` stays dependency-free.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.itest.ts'],
    // Fixtures share tables; run files serially to keep assertions deterministic.
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
