import type { RequestHandler } from "express";
import { AppError } from "../errors/AppError";
import { Messages } from "../schemas/common";
import { RANKING_DEFAULT_LIMIT, RANKING_MAX_LIMIT, type RankingService } from "../services/rankingService";

/** ?limit= ausente → 50; senão precisa ser um inteiro (só dígitos) entre 1 e 100. */
export function parseRankingLimit(raw: unknown): number {
  if (raw === undefined) return RANKING_DEFAULT_LIMIT;
  const text = typeof raw === "string" ? raw : "";
  const value = /^\d{1,3}$/.test(text) ? Number(text) : NaN;
  if (!(value >= 1 && value <= RANKING_MAX_LIMIT)) {
    throw new AppError("VALIDATION_ERROR", "Dados inválidos.", [{ field: "limit", message: Messages.LIMIT_INVALID }]);
  }
  return value;
}

export function rankingController(ranking: RankingService): RequestHandler {
  return async (req, res) => {
    res.json(await ranking.getRanking(parseRankingLimit(req.query.limit)));
  };
}
