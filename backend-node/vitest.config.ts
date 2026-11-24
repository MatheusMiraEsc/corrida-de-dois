import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Os testes de banco compartilham o mesmo PostgreSQL: rodam em série.
    fileParallelism: false,
    testTimeout: 15000,
  },
});
