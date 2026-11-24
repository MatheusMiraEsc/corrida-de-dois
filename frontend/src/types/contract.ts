/**
 * Tipos do CONTRATO com o backend (HTTP + WebSocket).
 * Espelham docs/contrato-api.md e docs/eventos-websocket.md — valem para
 * qualquer um dos backends (Node ou Java).
 */

export type Vehicle = "car" | "pickup" | "motorcycle" | "bike";
export type RoomStatus = "WAITING" | "IN_PROGRESS" | "FINISHED";
export type MoveEffect = "MOVE" | "LADDER" | "SNAKE" | "OVERSHOOT";
export type GameResult = "WIN" | "LOSS" | "ABANDONED";

export interface Jump {
  id: number;
  from: number;
  to: number;
}

export interface BoardDescription {
  size: number;
  startPosition: number;
  ladders: Jump[];
  snakes: Jump[];
}

export interface CreatedPlayer {
  id: string;
  name: string;
  token: string;
  createdAt: string;
}

export interface PlayerStats {
  rank: number | null;
  gamesPlayed: number;
  wins: number;
  losses: number;
  points: number;
  winRate: number;
}

export interface PlayerProfile {
  id: string;
  name: string;
  createdAt: string;
  stats: PlayerStats;
}

export interface RankingEntry {
  rank: number;
  playerId: string;
  name: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  points: number;
  winRate: number;
}

export interface RankingResponse {
  entries: RankingEntry[];
  generatedAt: string;
}

export interface RoomInfo {
  code: string;
  status: RoomStatus;
  isFull: boolean;
  players: Array<{ name: string; seat: number; vehicle: Vehicle; connected: boolean }>;
}

export interface MoveRecord {
  moveNumber: number;
  playerId: string;
  dice: number;
  from: number;
  path: number[];
  landedOn: number;
  finalPosition: number;
  effect: MoveEffect;
  jump: Jump | null;
  won: boolean;
  extraTurn: boolean;
  nextPlayerId: string | null;
  at: string;
}

export interface RoomPlayer {
  playerId: string;
  name: string;
  seat: number;
  vehicle: Vehicle;
  ready: boolean;
  connected: boolean;
  reconnectDeadline: string | null;
  isHost: boolean;
  turnOrder: number | null;
  position: number;
  rolls: number;
  laddersClimbed: number;
  snakesHit: number;
}

/** Snapshot completo da sala (evento room:state). É a fonte da verdade da tela. */
export interface RoomSnapshot {
  code: string;
  status: RoomStatus;
  version: number;
  hostId: string;
  matchNumber: number;
  paused: boolean;
  players: RoomPlayer[];
  turnOrder: string[];
  currentPlayerId: string | null;
  winnerId: string | null;
  moveCount: number;
  lastMove: MoveRecord | null;
  history: MoveRecord[];
  startedAt: string | null;
  finishedAt: string | null;
}

export interface GameFinishedPayload {
  matchNumber: number;
  winnerId: string;
  totalMoves: number;
  durationSeconds: number;
  recorded: boolean;
  results: Array<{
    playerId: string;
    name: string;
    turnOrder: number;
    finalPosition: number;
    result: GameResult;
    points: number;
  }>;
}

export interface GameAbandonedPayload {
  playerId: string;
  reason: "LEFT" | "DISCONNECT_TIMEOUT";
  recorded: boolean;
}

export interface ErrorBody {
  code: string;
  message: string;
  details?: Array<{ field: string | null; message: string }>;
}

/** Envelope de toda mensagem WebSocket. */
export interface ServerMessage<T = unknown> {
  type: string;
  requestId?: string;
  payload: T;
}
