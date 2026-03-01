import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Only run tests from src/ — never from compiled dist/
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
})
