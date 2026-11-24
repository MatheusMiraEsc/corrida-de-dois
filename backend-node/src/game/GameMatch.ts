/**
 * Uma partida em andamento: posições, turno, histórico e vencedor.
 *
 * É aqui que vivem as regras de TURNO (quem joga, jogada extra, troca de vez)
 * e o bloqueio de jogadas depois do fim. O cálculo do movimento em si fica em
 * rules.ts. Esta classe não sabe nada de salas, rede ou banco.
 */
import { AppError } from "../errors/AppError";
import { START_POSITION } from "./board";
import { MoveEffect, calculateMove } from "./rules";

export type MatchStatus = "IN_PROGRESS" | "FINISHED" | "ABANDONED";

export interface MatchPlayer {
  playerId: string;
  position: number;
  rolls: number;
  laddersClimbed: number;
  snakesHit: number;
}

/** Uma jogada já aplicada — vai para o histórico e para o evento game:dice-rolled. */
export interface MoveRecord {
  moveNumber: number;
  playerId: string;
  dice: number;
  from: number;
  path: number[];
  landedOn: number;
  finalPosition: number;
  effect: MoveEffect;
  jump: { id: number; from: number; to: number } | null;
  won: boolean;
  extraTurn: boolean;
  /** Quem joga depois desta jogada (null se a partida acabou). */
  nextPlayerId: string | null;
  at: string;
}

export class GameMatch {
  /** Jogadores na ordem de turno sorteada (índice 0 começa). */
  readonly players: MatchPlayer[];
  readonly history: MoveRecord[] = [];
  readonly startedAt: Date;
  status: MatchStatus = "IN_PROGRESS";
  finishedAt: Date | null = null;
  winnerId: string | null = null;
  private currentIndex = 0;

  constructor(playerIdsInTurnOrder: string[], now: Date) {
    if (playerIdsInTurnOrder.length !== 2) {
      throw new Error("Uma partida precisa de exatamente dois jogadores.");
    }
    this.players = playerIdsInTurnOrder.map((playerId) => ({
      playerId,
      position: START_POSITION,
      rolls: 0,
      laddersClimbed: 0,
      snakesHit: 0,
    }));
    this.startedAt = now;
  }

  get currentPlayerId(): string | null {
    return this.status === "IN_PROGRESS" ? this.players[this.currentIndex].playerId : null;
  }

  get moveCount(): number {
    return this.history.length;
  }

  get turnOrder(): string[] {
    return this.players.map((player) => player.playerId);
  }

  findPlayer(playerId: string): MatchPlayer | undefined {
    return this.players.find((player) => player.playerId === playerId);
  }

  /**
   * Aplica uma jogada do jogador da vez com o valor de dado já sorteado
   * pelo servidor. Lança AppError se a jogada não for permitida.
   */
  playTurn(playerId: string, dice: number, now: Date): MoveRecord {
    if (this.status !== "IN_PROGRESS") {
      throw new AppError("GAME_NOT_IN_PROGRESS", "A partida não está em andamento.");
    }
    const player = this.players[this.currentIndex];
    if (player.playerId !== playerId) {
      throw new AppError("NOT_YOUR_TURN", "Não é a sua vez de jogar.");
    }

    const move = calculateMove(player.position, dice);
    player.position = move.finalPosition;
    player.rolls += 1;
    if (move.effect === "LADDER") player.laddersClimbed += 1;
    if (move.effect === "SNAKE") player.snakesHit += 1;

    if (move.won) {
      this.status = "FINISHED";
      this.winnerId = player.playerId;
      this.finishedAt = now;
    } else if (!move.extraTurn) {
      this.currentIndex = (this.currentIndex + 1) % this.players.length;
    }

    const record: MoveRecord = {
      moveNumber: this.history.length + 1,
      playerId: player.playerId,
      dice: move.dice,
      from: move.from,
      path: move.path,
      landedOn: move.landedOn,
      finalPosition: move.finalPosition,
      effect: move.effect,
      jump: move.jump ? { ...move.jump } : null,
      won: move.won,
      extraTurn: move.extraTurn,
      nextPlayerId: this.currentPlayerId,
      at: now.toISOString(),
    };
    this.history.push(record);
    return record;
  }

  /** Encerra a partida sem vencedor (um jogador saiu ou não voltou a tempo). */
  abandon(now: Date): void {
    if (this.status !== "IN_PROGRESS") return;
    this.status = "ABANDONED";
    this.finishedAt = now;
  }
}

/** Sorteia a ordem de turno (Fisher–Yates com a função aleatória informada). */
export function drawTurnOrder(playerIds: string[], random: () => number): string[] {
  const order = [...playerIds];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
