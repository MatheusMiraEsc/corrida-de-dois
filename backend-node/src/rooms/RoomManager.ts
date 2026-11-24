/**
 * CONTROLE DOS JOGADORES E DAS SALAS.
 *
 * Mantém as salas ativas em memória, sabe em qual sala cada jogador está,
 * trata desconexão/reconexão (com prazo) e, quando uma partida termina,
 * pede o registro no banco. Cada mudança gera eventos que o gateway
 * WebSocket repassa aos jogadores da sala (ver ws/gateway.ts).
 */
import { randomInt } from "node:crypto";
import { AppError } from "../errors/AppError";
import { DiceRoller } from "../game/dice";
import { GameMatch, MoveRecord } from "../game/GameMatch";
import { durationInSeconds, summarizeMatch } from "../game/scoring";
import { logger } from "../config/logger";
import { PlayerIdentity, Room, Vehicle } from "./Room";

export interface RoomEvent {
  type: string;
  payload: unknown;
}

/** Recebe a sala alterada e os eventos gerados, para enviá-los aos clientes. */
export type RoomPublisher = (room: Room, events: RoomEvent[]) => void;

/** Quem grava as partidas encerradas (implementado por GameRecordService). */
export interface MatchRecorder {
  recordMatch(roomCode: string, match: GameMatch): Promise<void>;
}

export interface RoomManagerOptions {
  recorder: MatchRecorder;
  diceRoller: DiceRoller;
  /** Aleatoriedade do sorteio da ordem de turno. */
  random?: () => number;
  now?: () => Date;
  reconnectGraceMs: number;
}

const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sem 0/O, 1/I/L
const ROOM_CODE_LENGTH = 6;

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly roomByPlayer = new Map<string, string>();
  private readonly reconnectTimers = new Map<string, NodeJS.Timeout>();
  private publisher: RoomPublisher = () => {};
  private readonly random: () => number;
  private readonly now: () => Date;

  constructor(private readonly options: RoomManagerOptions) {
    this.random = options.random ?? (() => randomInt(0, 1_000_000) / 1_000_000);
    this.now = options.now ?? (() => new Date());
  }

  setPublisher(publisher: RoomPublisher): void {
    this.publisher = publisher;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  requireRoom(code: string): Room {
    const room = this.getRoom(code);
    if (!room) throw new AppError("ROOM_NOT_FOUND", "Sala não encontrada. Confira o código.");
    return room;
  }

  findRoomOfPlayer(playerId: string): Room | undefined {
    const code = this.roomByPlayer.get(playerId);
    return code ? this.rooms.get(code) : undefined;
  }

  private requireRoomOfPlayer(playerId: string): Room {
    const room = this.findRoomOfPlayer(playerId);
    if (!room) throw new AppError("NOT_IN_ROOM", "Você não está em nenhuma sala.");
    return room;
  }

  get activeRoomCount(): number {
    return this.rooms.size;
  }

  // ---------------------------------------------------------------- salas

  createRoom(player: PlayerIdentity, vehicle: Vehicle): Room {
    this.ensureNotInAnotherRoom(player.id);
    const room = new Room(this.generateUniqueCode(), player, vehicle, this.now());
    this.rooms.set(room.code, room);
    this.roomByPlayer.set(player.id, room.code);
    logger.info("Sala criada", { room: room.code, player: player.id });
    this.publish(room, []);
    return room;
  }

  joinRoom(code: string, player: PlayerIdentity, vehicle: Vehicle): Room {
    const room = this.requireRoom(code);
    if (room.findSeat(player.id)) return room; // já está nela: operação idempotente
    this.ensureNotInAnotherRoom(player.id);

    const seat = room.addPlayer(player, vehicle);
    this.roomByPlayer.set(player.id, room.code);
    logger.info("Jogador entrou na sala", { room: room.code, player: player.id });
    this.publish(room, [{ type: "room:player-joined", payload: { player: this.seatView(room, seat.playerId) } }]);
    return room;
  }

  async leaveRoom(playerId: string, reason: "LEFT" | "DISCONNECT_TIMEOUT" = "LEFT"): Promise<void> {
    const room = this.requireRoomOfPlayer(playerId);
    this.clearReconnectTimer(playerId);

    const abandonedMatch = room.removePlayer(playerId, this.now());
    this.roomByPlayer.delete(playerId);
    logger.info("Jogador saiu da sala", { room: room.code, player: playerId, reason });

    if (room.isEmpty) {
      this.rooms.delete(room.code);
      logger.info("Sala encerrada (vazia)", { room: room.code });
    }

    const events: RoomEvent[] = [];
    if (abandonedMatch) {
      const recorded = await this.tryRecord(room.code, abandonedMatch);
      events.push({ type: "game:abandoned", payload: { playerId, reason, recorded } });
    }
    events.push({ type: "room:player-left", payload: { playerId, reason, hostId: room.hostId } });
    if (!room.isEmpty) this.publish(room, events);
  }

  setReady(playerId: string, ready: boolean): Room {
    const room = this.requireRoomOfPlayer(playerId);
    room.setReady(playerId, ready);
    this.publish(room, []);
    return room;
  }

  setVehicle(playerId: string, vehicle: Vehicle): Room {
    const room = this.requireRoomOfPlayer(playerId);
    room.setVehicle(playerId, vehicle);
    this.publish(room, []);
    return room;
  }

  // -------------------------------------------------------------- partida

  startGame(playerId: string): Room {
    const room = this.requireRoomOfPlayer(playerId);
    const match = room.start(playerId, this.random, this.now());
    logger.info("Partida iniciada", { room: room.code, match: room.matchNumber });
    this.publish(room, [this.gameStartedEvent(room, match)]);
    return room;
  }

  restartGame(playerId: string): Room {
    const room = this.requireRoomOfPlayer(playerId);
    const match = room.restart(playerId, this.random, this.now());
    logger.info("Partida reiniciada", { room: room.code, match: room.matchNumber });
    this.publish(room, [
      { type: "game:restarted", payload: { matchNumber: room.matchNumber, requestedBy: playerId } },
      this.gameStartedEvent(room, match),
    ]);
    return room;
  }

  /**
   * Sorteia o dado e aplica a jogada. O estado muda de forma síncrona (antes de
   * qualquer await), então uma segunda jogada simultânea já encontra o novo estado.
   */
  async rollDice(playerId: string, expectedMoveCount: number): Promise<MoveRecord> {
    const room = this.requireRoomOfPlayer(playerId);
    const move = room.roll(playerId, expectedMoveCount, this.options.diceRoller, this.now());
    const match = room.match!;

    const events: RoomEvent[] = [{ type: "game:dice-rolled", payload: move }];
    if (move.effect === "LADDER") {
      events.push({
        type: "game:ladder-climbed",
        payload: { playerId, moveNumber: move.moveNumber, ladder: move.jump },
      });
    }
    if (move.effect === "SNAKE") {
      events.push({
        type: "game:snake-bitten",
        payload: { playerId, moveNumber: move.moveNumber, snake: move.jump },
      });
    }

    if (move.won) {
      const recorded = await this.tryRecord(room.code, match);
      events.push(this.gameFinishedEvent(room, match, recorded));
      logger.info("Partida encerrada", { room: room.code, winner: playerId });
    } else {
      events.push({
        type: "game:turn-changed",
        payload: { currentPlayerId: move.nextPlayerId, previousPlayerId: playerId, extraTurn: move.extraTurn },
      });
    }

    this.publish(room, events);
    return move;
  }

  // ------------------------------------------------- conexão e reconexão

  /** A conexão caiu: marca o jogador como ausente e inicia o prazo de retorno. */
  handleDisconnect(playerId: string): void {
    const room = this.findRoomOfPlayer(playerId);
    if (!room) return;

    const deadline = new Date(this.now().getTime() + this.options.reconnectGraceMs);
    room.setConnected(playerId, false, deadline);
    this.clearReconnectTimer(playerId);
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(playerId);
      this.leaveRoom(playerId, "DISCONNECT_TIMEOUT").catch((error) =>
        logger.error("Falha ao remover jogador após o prazo de reconexão", { error: String(error) }),
      );
    }, this.options.reconnectGraceMs);
    timer.unref?.();
    this.reconnectTimers.set(playerId, timer);

    logger.info("Jogador desconectado", { room: room.code, player: playerId });
    this.publish(room, [
      { type: "room:player-disconnected", payload: { playerId, reconnectDeadline: deadline.toISOString() } },
    ]);
  }

  /** O jogador voltou (nova conexão identificada): devolve a sala dele, se houver. */
  handleReconnect(playerId: string): Room | null {
    const room = this.findRoomOfPlayer(playerId);
    if (!room) return null;
    const seat = room.findSeat(playerId);
    if (seat && !seat.connected) {
      this.clearReconnectTimer(playerId);
      room.setConnected(playerId, true, null);
      logger.info("Jogador reconectado", { room: room.code, player: playerId });
      this.publish(room, [{ type: "room:player-reconnected", payload: { playerId } }]);
    }
    return room;
  }

  /** Apenas para testes automatizados. */
  forceDice(code: string, values: number[]): void {
    this.requireRoom(code).enqueueForcedDice(values);
  }

  shutdown(): void {
    this.reconnectTimers.forEach((timer) => clearTimeout(timer));
    this.reconnectTimers.clear();
  }

  // ------------------------------------------------------------ internos

  private ensureNotInAnotherRoom(playerId: string): void {
    if (this.roomByPlayer.has(playerId)) {
      throw new AppError("ALREADY_IN_ROOM", "Você já está em outra sala. Saia dela antes de entrar em uma nova.");
    }
  }

  private generateUniqueCode(): string {
    for (;;) {
      let code = "";
      for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
        code += ROOM_CODE_ALPHABET[randomInt(0, ROOM_CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
  }

  private clearReconnectTimer(playerId: string): void {
    const timer = this.reconnectTimers.get(playerId);
    if (timer) clearTimeout(timer);
    this.reconnectTimers.delete(playerId);
  }

  private async tryRecord(roomCode: string, match: GameMatch): Promise<boolean> {
    try {
      await this.options.recorder.recordMatch(roomCode, match);
      return true;
    } catch (error) {
      logger.error("Falha ao registrar a partida no banco", { room: roomCode, error: String(error) });
      return false;
    }
  }

  private publish(room: Room, events: RoomEvent[]): void {
    this.publisher(room, events);
  }

  private seatView(room: Room, playerId: string) {
    return room.snapshot().players.find((player) => player.playerId === playerId);
  }

  private gameStartedEvent(room: Room, match: GameMatch): RoomEvent {
    return {
      type: "game:started",
      payload: {
        matchNumber: room.matchNumber,
        turnOrder: match.turnOrder,
        firstPlayerId: match.turnOrder[0],
      },
    };
  }

  private gameFinishedEvent(room: Room, match: GameMatch, recorded: boolean): RoomEvent {
    const names = new Map(room.seats.map((seat) => [seat.playerId, seat.name]));
    return {
      type: "game:finished",
      payload: {
        matchNumber: room.matchNumber,
        winnerId: match.winnerId,
        totalMoves: match.moveCount,
        durationSeconds: durationInSeconds(match),
        results: summarizeMatch(match).map((result) => ({ ...result, name: names.get(result.playerId) ?? "" })),
        recorded,
      },
    };
  }
}
