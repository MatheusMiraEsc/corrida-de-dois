/**
 * Logger simples em uma linha JSON por evento (fácil de ler no terminal e
 * de filtrar em serviços de nuvem). Nunca registre tokens aqui.
 */
type Level = "debug" | "info" | "warn" | "error";
const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

let minimumLevel: Level = (process.env.LOG_LEVEL as Level) ?? "info";
if (process.env.NODE_ENV === "test" || process.env.VITEST) minimumLevel = "error";

export function setLogLevel(level: Level): void {
  minimumLevel = level;
}

function write(level: Level, message: string, context?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minimumLevel]) return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...context });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => write("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => write("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => write("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => write("error", message, context),
};
