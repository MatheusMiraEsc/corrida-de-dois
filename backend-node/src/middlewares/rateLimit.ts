import type { RequestHandler } from "express";
import { AppError } from "../errors/AppError";

/**
 * Limitador simples por IP em janela fixa (em memória). Suficiente para
 * evitar criação de jogadores em massa em uma instância única.
 */
export function rateLimit(maxRequests: number, windowMs: number): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req, _res, next) => {
    const now = Date.now();
    const key = req.ip ?? "desconhecido";
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > maxRequests) {
      return next(new AppError("RATE_LIMITED", "Muitas requisições. Tente novamente em instantes."));
    }
    return next();
  };
}
