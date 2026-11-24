import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError, toErrorBody } from "../errors/AppError";
import { logger } from "../config/logger";

/** Rota inexistente → 404 no formato padrão. */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError("NOT_FOUND", "Rota não encontrada."));
};

/** Tratamento padronizado: { error: { code, message, details? } }. */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.httpStatus).json({ error: toErrorBody(error) });
    return;
  }
  // JSON malformado ou grande demais no corpo da requisição
  if (error?.type === "entity.parse.failed" || error?.type === "entity.too.large") {
    const message = error.type === "entity.parse.failed" ? "JSON inválido." : "Corpo da requisição muito grande.";
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message } });
    return;
  }
  logger.error("Erro inesperado na rota HTTP", { path: req.path, error: String(error?.stack ?? error) });
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor." } });
};
