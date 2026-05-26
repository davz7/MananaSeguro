import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['netlify/functions/_lib/**/*.test.js'],
  },
})
