/**
 * Contratos de ACESSO AO BANCO. As implementações reais usam Prisma
 * (arquivos prisma*.ts); os testes sem banco usam versões em memória.
 */
import type { GameResult } from "../game/scoring";

export interface PlayerRecord {
  id: string;
  name: string;
  tokenHash: string;
  createdAt: Date;
}

export interface PlayerRepository {
  create(player: PlayerRecord): Promise<PlayerRecord>;
  findById(id: string): Promise<PlayerRecord | null>;
  updateName(id: string, name: string): Promise<PlayerRecord>;
}

export interface GameRecordInput {
  id: string;
  roomCode: string;
  status: "FINISHED" | "ABANDONED";
  startedAt: Date;
  finishedAt: Date;
  durationSeconds: number;
  totalMoves: number;
  winnerId: string | null;
  participants: Array<{
    id: string;
    playerId: string;
    turnOrder: number;
    finalPosition: number;
    result: GameResult;
    points: number;
  }>;
}

export interface GameRepository {
  save(game: GameRecordInput): Promise<void>;
}

/** Uma linha do ranking, já calculada pela view "player_ranking" do banco. */
export interface RankingRow {
  rank: number;
  playerId: string;
  name: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  points: number;
  winRate: number;
}

export interface RankingRepository {
  top(limit: number): Promise<RankingRow[]>;
  findByPlayer(playerId: string): Promise<RankingRow | null>;
}
