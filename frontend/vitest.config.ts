// Testes unitários do frontend (funções puras: geometria do tabuleiro e reducer).
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
