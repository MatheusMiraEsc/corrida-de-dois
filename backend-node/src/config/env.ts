/**
 * CONFIGURAÇÃO DO SERVIDOR — lida das variáveis de ambiente e validada na
 * inicialização. Se algo obrigatório faltar, o servidor nem sobe.
 */
import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false", "1", "0"])
  .default("false")
  .transform((value) => value === "true" || value === "1");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  RECONNECT_GRACE_SECONDS: z.coerce.number().int().min(5).max(600).default(60),
  ENABLE_TEST_ENDPOINTS: booleanFromString,
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Configuração inválida: ${problems}`);
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.ENABLE_TEST_ENDPOINTS) {
    throw new Error("ENABLE_TEST_ENDPOINTS não pode ser usado em produção.");
  }
  return parsed.data;
}
