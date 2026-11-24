import type { PrismaClient } from "@prisma/client";
import type { RankingRepository, RankingRow } from "./types";

/**
 * O cálculo do ranking (somas, critérios de desempate e posição) está na
 * view SQL "player_ranking" (prisma/migrations), compartilhada com o Java.
 * Aqui apenas a consultamos.
 */
export class PrismaRankingRepository implements RankingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  top(limit: number): Promise<RankingRow[]> {
    return this.prisma.$queryRaw<RankingRow[]>`
      SELECT rank, player_id::text AS "playerId", name, games_played AS "gamesPlayed",
             wins, losses, points, win_rate AS "winRate"
      FROM player_ranking
      ORDER BY rank
      LIMIT ${limit}`;
  }

  async findByPlayer(playerId: string): Promise<RankingRow | null> {
    const rows = await this.prisma.$queryRaw<RankingRow[]>`
      SELECT rank, player_id::text AS "playerId", name, games_played AS "gamesPlayed",
             wins, losses, points, win_rate AS "winRate"
      FROM player_ranking
      WHERE player_id = ${playerId}::uuid`;
    return rows[0] ?? null;
  }
}
