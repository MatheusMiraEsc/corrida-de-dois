import type { RequestHandler } from "express";

/** Cabeçalhos básicos de segurança para uma API JSON. */
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
};

/** Origem permitida? "*" libera todas (use só em desenvolvimento). */
export function isOriginAllowed(origin: string | undefined, allowed: string[]): boolean {
  if (!origin) return true; // clientes que não são navegador (testes, curl)
  return allowed.includes("*") || allowed.includes(origin);
}
