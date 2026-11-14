import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'worker/test/**/*.test.ts', 'scripts/test/**/*.test.ts', 'web/components/**/*.test.ts', 'web/lib/**/*.test.ts'],
    environment: 'node',
  },
});
