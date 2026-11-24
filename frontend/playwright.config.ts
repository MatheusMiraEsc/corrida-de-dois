/**
 * Testes ponta a ponta (E2E) com DOIS navegadores independentes — cada um
 * com seu próprio localStorage e WebSocket, como dois computadores.
 *
 * Sobe automaticamente:
 *  - um backend em http://localhost:3101 usando o banco de TESTE
 *    (TEST_DATABASE_URL de backend-node/.env) e a fila de dados de teste;
 *  - o frontend em http://localhost:5174 apontando para esse backend.
 *
 * Rodar:  npm run test:e2e   (PostgreSQL do docker compose precisa estar no ar)
 */
import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:3101";
const FRONTEND_URL = "http://localhost:5174";
const BACKEND = process.env.E2E_BACKEND ?? "node";

function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  try {
    const env = readFileSync("../backend-node/.env", "utf8");
    const match = /^TEST_DATABASE_URL=(.+)$/m.exec(env);
    if (match) return match[1].trim();
  } catch {
    /* sem .env */
  }
  throw new Error("Defina TEST_DATABASE_URL (veja backend-node/.env.example).");
}

const backendServer = {
  command: "npx tsx src/server.ts",
  cwd: "../backend-node",
  url: `${BACKEND_URL}/api/health`,
  reuseExistingServer: false,
  timeout: 60_000,
  env: {
    PORT: "3101",
    DATABASE_URL: testDatabaseUrl(),
    CORS_ORIGINS: FRONTEND_URL,
    ENABLE_TEST_ENDPOINTS: "true",
    RECONNECT_GRACE_SECONDS: "30",
    LOG_LEVEL: "warn",
  },
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: FRONTEND_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    // Para testar outro backend já rodando, defina E2E_BACKEND=external e E2E_BACKEND_URL.
    ...(BACKEND === "external" ? [] : [backendServer]),
    {
      command: "npx vite --port 5174 --strictPort",
      url: FRONTEND_URL,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        VITE_API_URL: BACKEND_URL,
        VITE_WS_URL: `${BACKEND_URL.replace(/^http/, "ws")}/ws`,
      },
    },
  ],
});
