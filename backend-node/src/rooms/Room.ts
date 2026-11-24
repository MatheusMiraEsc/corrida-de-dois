/**
 * Uma sala de jogo: os dois assentos, quem está pronto/conectado, o anfitrião
 * e a partida atual. Valida TODAS as ações dos jogadores dentro da sala
 * (autorização, estado, turno) antes de alterar qualquer coisa.
 *
 * Não conhece WebSocket nem banco: quem orquestra é o RoomManager.
 */
import { AppError } from "../errors/AppError";
import { DiceRoller, isValidDiceValue } from "../game/dice";
import { GameMatch, MoveRecord, drawTurnOrder } from "../game/GameMatch";
import { START_POSITION } from "../game/board";

export const VEHICLES = ["car", "pickup", "motorcycle", "bike"] as const;
export type Vehicle = (typeof VEHICLES)[number];

export const MAX_PLAYERS = 2;
/** Quantas jogadas do histórico vão no snapshot (o resto fica no servidor). */
export const HISTORY_LIMIT = 50;

export type RoomStatus = "WAITING" | "IN_PROGRESS" | "FINISHED";

export interface Seat {
  playerId: string;
  name: string;
  seat: number; // 1 ou 2 (define a cor do carrinho)
  vehicle: Vehicle;
  ready: boolean;
  connected: boolean;
  reconnectDeadline: Date | null;
}

export interface PlayerIdentity {
  id: string;
  name: string;
}

export class Room {
  readonly code: string;
  readonly createdAt: Date;
  hostId: string;
  seats: Seat[] = [];
  match: GameMatch | null = null;
  matchNumber = 0;
  /** Aumenta a cada mudança de estado; o cliente usa para descartar snapshots velhos. */
  version = 0;
  /** Fila de valores do dado usada apenas em testes automatizados. */
  forcedDice: number[] = [];

  constructor(code: string, host: PlayerIdentity, vehicle: Vehicle, now: Date) {
    this.code = code;
    this.createdAt = now;
    this.hostId = host.id;
    this.addPlayer(host, vehicle);
  }

  get status(): RoomStatus {
    if (!this.match) return "WAITING";
    return this.match.status === "IN_PROGRESS" ? "IN_PROGRESS" : "FINISHED";
  }

  /** Partida pausada: está em andamento, mas alguém caiu. */
  get paused(): boolean {
    return this.status === "IN_PROGRESS" && this.seats.some((seat) => !seat.connected);
  }

  get isFull(): boolean {
    return this.seats.length >= MAX_PLAYERS;
  }

  get isEmpty(): boolean {
    return this.seats.length === 0;
  }

  findSeat(playerId: string): Seat | undefined {
    return this.seats.find((seat) => seat.playerId === playerId);
  }

  private requireSeat(playerId: string): Seat {
    const seat = this.findSeat(playerId);
    if (!seat) throw new AppError("NOT_IN_ROOM", "Você não está nesta sala.");
    return seat;
  }

  private requireWaiting(): void {
    if (this.status !== "WAITING") {
      throw new AppError("GAME_ALREADY_STARTED", "A partida já começou nesta sala.");
    }
  }

  private touch(): void {
    this.version += 1;
  }

  addPlayer(player: PlayerIdentity, vehicle: Vehicle): Seat {
    if (this.findSeat(player.id)) {
      throw new AppError("ALREADY_IN_ROOM", "Você já está nesta sala.");
    }
    if (this.isFull) throw new AppError("ROOM_FULL", "A sala já tem dois jogadores.");
    this.requireWaiting();

    const takenSeats = new Set(this.seats.map((seat) => seat.seat));
    const seatNumber = takenSeats.has(1) ? 2 : 1;
    const seat: Seat = {
      playerId: player.id,
      name: player.name,
      seat: seatNumber,
      vehicle,
      ready: false,
      connected: true,
      reconnectDeadline: null,
    };
    this.seats.push(seat);
    this.seats.sort((a, b) => a.seat - b.seat);
    this.touch();
    return seat;
  }

  /**
   * Remove o jogador. Se havia partida em andamento, ela é abandonada.
   * Devolve a partida abandonada (para ser registrada) ou null.
   */
  removePlayer(playerId: string, now: Date): GameMatch | null {
    this.requireSeat(playerId);
    let abandonedMatch: GameMatch | null = null;

    if (this.match && this.match.status === "IN_PROGRESS") {
      this.match.abandon(now);
      abandonedMatch = this.match;
    }
    // Ao sair alguém, a sala volta para a espera (sem partida e sem "pronto").
    this.match = null;
    this.seats = this.seats.filter((seat) => seat.playerId !== playerId);
    this.seats.forEach((seat) => (seat.ready = false));
    if (this.hostId === playerId && this.seats.length > 0) {
      this.hostId = this.seats[0].playerId;
    }
    this.touch();
    return abandonedMatch;
  }

  setReady(playerId: string, ready: boolean): void {
    const seat = this.requireSeat(playerId);
    this.requireWaiting();
    seat.ready = ready;
    this.touch();
  }

  setVehicle(playerId: string, vehicle: Vehicle): void {
    const seat = this.requireSeat(playerId);
    this.requireWaiting();
    seat.vehicle = vehicle;
    this.touch();
  }

  setConnected(playerId: string, connected: boolean, reconnectDeadline: Date | null): void {
    const seat = this.requireSeat(playerId);
    seat.connected = connected;
    seat.reconnectDeadline = connected ? null : reconnectDeadline;
    this.touch();
  }

  /** Só o anfitrião inicia, e só com dois jogadores conectados e prontos. */
  start(playerId: string, random: () => number, now: Date): GameMatch {
    this.requireSeat(playerId);
    this.requireWaiting();
    if (playerId !== this.hostId) {
      throw new AppError("NOT_HOST", "Apenas quem criou a sala pode iniciar a partida.");
    }
    if (!this.isFull || this.seats.some((seat) => !seat.ready || !seat.connected)) {
      throw new AppError("PLAYERS_NOT_READY", "Os dois jogadores precisam estar conectados e prontos.");
    }
    return this.beginNewMatch(random, now);
  }

  /** "Jogar novamente": qualquer um dos dois, depois que a partida terminou. */
  restart(playerId: string, random: () => number, now: Date): GameMatch {
    this.requireSeat(playerId);
    if (this.status !== "FINISHED") {
      throw new AppError("GAME_NOT_FINISHED", "Só é possível jogar novamente depois que a partida terminar.");
    }
    if (!this.isFull || this.seats.some((seat) => !seat.connected)) {
      throw new AppError("PLAYERS_NOT_READY", "Os dois jogadores precisam estar conectados.");
    }
    return this.beginNewMatch(random, now);
  }

  private beginNewMatch(random: () => number, now: Date): GameMatch {
    const order = drawTurnOrder(
      this.seats.map((seat) => seat.playerId),
      random,
    );
    this.match = new GameMatch(order, now);
    this.matchNumber += 1;
    this.touch();
    return this.match;
  }

  /**
   * Lança o dado para o jogador. A ordem das verificações define qual erro
   * o cliente recebe e é a mesma no backend Java.
   */
  roll(playerId: string, expectedMoveCount: number, diceRoller: DiceRoller, now: Date): MoveRecord {
    this.requireSeat(playerId);
    const match = this.match;
    if (!match || match.status !== "IN_PROGRESS") {
      throw new AppError("GAME_NOT_IN_PROGRESS", "A partida não está em andamento.");
    }
    if (this.paused) {
      throw new AppError("GAME_PAUSED", "A partida está pausada aguardando a reconexão de um jogador.");
    }
    if (match.currentPlayerId !== playerId) {
      throw new AppError("NOT_YOUR_TURN", "Não é a sua vez de jogar.");
    }
    if (expectedMoveCount !== match.moveCount) {
      throw new AppError("STALE_ACTION", "Esta jogada já foi processada ou o seu estado está desatualizado.");
    }

    const dice = this.forcedDice.shift() ?? diceRoller();
    const move = match.playTurn(playerId, dice, now);
    this.touch();
    return move;
  }

  /** Apenas para testes automatizados (ENABLE_TEST_ENDPOINTS=true). */
  enqueueForcedDice(values: number[]): void {
    if (!values.every(isValidDiceValue)) {
      throw new AppError("VALIDATION_ERROR", "Os valores do dado devem estar entre 1 e 6.");
    }
    this.forcedDice.push(...values);
  }

  /** Estado completo da sala enviado aos clientes no evento room:state. */
  snapshot() {
    const match = this.match;
    const turnOrder = match ? match.turnOrder : [];
    return {
      code: this.code,
      status: this.status,
      version: this.version,
      hostId: this.hostId,
      matchNumber: this.matchNumber,
      paused: this.paused,
      players: this.seats.map((seat) => {
        const state = match?.findPlayer(seat.playerId);
        const orderIndex = turnOrder.indexOf(seat.playerId);
        return {
          playerId: seat.playerId,
          name: seat.name,
          seat: seat.seat,
          vehicle: seat.vehicle,
          ready: seat.ready,
          connected: seat.connected,
          reconnectDeadline: seat.reconnectDeadline ? seat.reconnectDeadline.toISOString() : null,
          isHost: seat.playerId === this.hostId,
          turnOrder: orderIndex >= 0 ? orderIndex + 1 : null,
          position: state?.position ?? START_POSITION,
          rolls: state?.rolls ?? 0,
          laddersClimbed: state?.laddersClimbed ?? 0,
          snakesHit: state?.snakesHit ?? 0,
        };
      }),
      turnOrder,
      currentPlayerId: match?.currentPlayerId ?? null,
      winnerId: match?.winnerId ?? null,
      moveCount: match?.moveCount ?? 0,
      lastMove: match && match.history.length > 0 ? match.history[match.history.length - 1] : null,
      history: match ? match.history.slice(-HISTORY_LIMIT) : [],
      startedAt: match ? match.startedAt.toISOString() : null,
      finishedAt: match?.finishedAt ? match.finishedAt.toISOString() : null,
    };
  }
}

export type RoomSnapshot = ReturnType<Room["snapshot"]>;
