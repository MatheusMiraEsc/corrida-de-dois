/**
 * Registra no banco as partidas encerradas. É o ÚNICO caminho pelo qual
 * pontos entram no ranking: o servidor calcula o resultado a partir da
 * própria partida (game/scoring.ts), nunca a partir de dados do cliente.
 */
import { randomUUID } from "node:crypto";
import type { GameMatch } from "../game/GameMatch";
import { durationInSeconds, summarizeMatch } from "../game/scoring";
import type { MatchRecorder } from "../rooms/RoomManager";
import type { GameRepository } from "../repositories/types";

export class GameRecordService implements MatchRecorder {
  constructor(private readonly games: GameRepository) {}

  async recordMatch(roomCode: string, match: GameMatch): Promise<void> {
    if (match.status === "IN_PROGRESS" || !match.finishedAt) {
      throw new Error("Só partidas encerradas podem ser registradas.");
    }
    await this.games.save({
      id: randomUUID(),
      roomCode,
      status: match.status,
      startedAt: match.startedAt,
      finishedAt: match.finishedAt,
      durationSeconds: durationInSeconds(match),
      totalMoves: match.moveCount,
      winnerId: match.winnerId,
      participants: summarizeMatch(match).map((participant) => ({ id: randomUUID(), ...participant })),
    });
  }
}
