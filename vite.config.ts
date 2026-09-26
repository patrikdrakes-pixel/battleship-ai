import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
      reporter: ['text', 'lcov'],
    },
  },
});
