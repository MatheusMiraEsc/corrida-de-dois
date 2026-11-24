/**
 * Pontuação do ranking global. Calculada SEMPRE pelo servidor
 * ao registrar uma partida concluída — nunca recebida do cliente.
 */
import type { GameMatch } from "./GameMatch";

export const POINTS_FOR_WIN = 100;
export const POINTS_FOR_LOSS = 20;

export type GameResult = "WIN" | "LOSS" | "ABANDONED";

export function pointsFor(result: GameResult): number {
  switch (result) {
    case "WIN":
      return POINTS_FOR_WIN;
    case "LOSS":
      return POINTS_FOR_LOSS;
    case "ABANDONED":
      return 0; // partidas abandonadas não pontuam
  }
}

export interface ParticipantResult {
  playerId: string;
  turnOrder: number;
  finalPosition: number;
  result: GameResult;
  points: number;
}

/** Resultado de cada participante de uma partida encerrada (FINISHED ou ABANDONED). */
export function summarizeMatch(match: GameMatch): ParticipantResult[] {
  return match.players.map((player, index) => {
    const result: GameResult =
      match.status === "ABANDONED" ? "ABANDONED" : player.playerId === match.winnerId ? "WIN" : "LOSS";
    return {
      playerId: player.playerId,
      turnOrder: index + 1,
      finalPosition: player.position,
      result,
      points: pointsFor(result),
    };
  });
}

export function durationInSeconds(match: GameMatch): number {
  const end = match.finishedAt ?? match.startedAt;
  return Math.max(0, Math.floor((end.getTime() - match.startedAt.getTime()) / 1000));
}
