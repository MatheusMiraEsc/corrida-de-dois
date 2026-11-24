/**
 * LÓGICA DO RANKING (leitura). As regras de pontuação estão em
 * game/scoring.ts e o cálculo agregado na view SQL "player_ranking".
 */
import type { RankingRepository } from "../repositories/types";

export const RANKING_DEFAULT_LIMIT = 50;
export const RANKING_MAX_LIMIT = 100;

export class RankingService {
  constructor(private readonly ranking: RankingRepository) {}

  async getRanking(limit = RANKING_DEFAULT_LIMIT) {
    const entries = await this.ranking.top(limit);
    return { entries, generatedAt: new Date().toISOString() };
  }
}
