import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // The demo describe-block is one ordered scenario against one shared chain.
    sequence: { concurrent: false },
    fileParallelism: false,
  },
});
