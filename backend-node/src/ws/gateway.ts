/**
 * COMUNICAÇÃO WEBSOCKET.
 *
 * Responsabilidades (e só estas):
 *  - aceitar conexões em /ws (checando a origem);
 *  - validar cada mensagem recebida;
 *  - exigir identificação (session:identify) antes de qualquer ação;
 *  - repassar a ação ao RoomManager e responder ack/erro;
 *  - enviar os eventos da sala aos jogadores conectados nela.
 *
 * Nenhuma regra de jogo é decidida aqui.
 */
import type { IncomingMessage, Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { AppError, toErrorBody } from "../errors/AppError";
import { logger } from "../config/logger";
import { isOriginAllowed } from "../middlewares/security";
import { validate } from "../middlewares/validate";
import type { Room } from "../rooms/Room";
import type { RoomEvent, RoomManager } from "../rooms/RoomManager";
import type { PlayerService } from "../services/playerService";
import { ClientEventType, ServerEvents, clientEventSchemas, envelopeSchema, isClientEventType } from "./protocol";

export const WS_PATH = "/ws";
const MAX_MESSAGE_BYTES = 16 * 1024;
const HEARTBEAT_INTERVAL_MS = 30_000;
const RATE_LIMIT_MESSAGES = 20;
const RATE_LIMIT_WINDOW_MS = 1_000;
/** Código de fechamento usado quando o mesmo jogador abre outra conexão. */
export const CLOSE_SESSION_REPLACED = 4001;

interface Connection {
  socket: WebSocket;
  playerId: string | null;
  playerName: string;
  alive: boolean;
  replaced: boolean;
  windowStart: number;
  messagesInWindow: number;
}

interface GatewayOptions {
  roomManager: RoomManager;
  playerService: PlayerService;
  corsOrigins: string[];
}

type Handler = (connection: Connection, payload: any) => Promise<void> | void;

export class GameGateway {
  private readonly wss: WebSocketServer;
  private readonly connections = new Map<WebSocket, Connection>();
  private readonly connectionsByPlayer = new Map<string, Connection>();
  private readonly heartbeat: NodeJS.Timeout;
  private readonly handlers: Record<ClientEventType, Handler>;

  constructor(server: Server, private readonly options: GatewayOptions) {
    this.wss = new WebSocketServer({
      server,
      path: WS_PATH,
      maxPayload: MAX_MESSAGE_BYTES,
      verifyClient: (info: { origin: string; req: IncomingMessage }) =>
        isOriginAllowed(info.origin || undefined, options.corsOrigins),
    });
    this.wss.on("connection", (socket) => this.onConnection(socket));

    this.heartbeat = setInterval(() => this.checkHeartbeats(), HEARTBEAT_INTERVAL_MS);
    this.heartbeat.unref();

    options.roomManager.setPublisher((room, events) => this.publish(room, events));

    const rooms = options.roomManager;
    this.handlers = {
      "session:identify": (connection, payload) => this.identify(connection, payload),
      "room:create": (connection, payload) => {
        rooms.createRoom(this.identityOf(connection), payload.vehicle);
      },
      "room:join": (connection, payload) => {
        rooms.joinRoom(payload.code, this.identityOf(connection), payload.vehicle);
      },
      "room:leave": async (connection) => {
        const playerId = this.requirePlayer(connection);
        const code = rooms.findRoomOfPlayer(playerId)?.code ?? null;
        await rooms.leaveRoom(playerId);
        this.send(connection.socket, ServerEvents.ROOM_LEFT, { code });
      },
      "room:ready": (connection, payload) => {
        rooms.setReady(this.requirePlayer(connection), payload.ready);
      },
      "room:set-vehicle": (connection, payload) => {
        rooms.setVehicle(this.requirePlayer(connection), payload.vehicle);
      },
      "game:start": (connection) => {
        rooms.startGame(this.requirePlayer(connection));
      },
      "game:roll-dice": async (connection, payload) => {
        await rooms.rollDice(this.requirePlayer(connection), payload.expectedMoveCount);
      },
      "game:restart": (connection) => {
        rooms.restartGame(this.requirePlayer(connection));
      },
    };
  }

  close(): Promise<void> {
    clearInterval(this.heartbeat);
    this.wss.clients.forEach((client) => client.terminate());
    return new Promise((resolve) => this.wss.close(() => resolve()));
  }

  // ------------------------------------------------------------ conexão

  private onConnection(socket: WebSocket): void {
    const connection: Connection = {
      socket,
      playerId: null,
      playerName: "",
      alive: true,
      replaced: false,
      windowStart: Date.now(),
      messagesInWindow: 0,
    };
    this.connections.set(socket, connection);
    socket.on("pong", () => (connection.alive = true));
    socket.on("message", (data, isBinary) => {
      void this.onMessage(connection, isBinary ? null : data.toString());
    });
    socket.on("close", () => this.onClose(connection));
    socket.on("error", (error) => logger.warn("Erro no WebSocket", { error: String(error) }));
  }

  private onClose(connection: Connection): void {
    this.connections.delete(connection.socket);
    const playerId = connection.playerId;
    if (!playerId || connection.replaced) return;
    if (this.connectionsByPlayer.get(playerId) !== connection) return;
    this.connectionsByPlayer.delete(playerId);
    this.options.roomManager.handleDisconnect(playerId);
  }

  /** Conexões que não respondem ao ping são encerradas (dispara o fluxo de desconexão). */
  private checkHeartbeats(): void {
    this.connections.forEach((connection, socket) => {
      if (!connection.alive) {
        socket.terminate();
        return;
      }
      connection.alive = false;
      socket.ping();
    });
  }

  // ----------------------------------------------------------- mensagens

  private async onMessage(connection: Connection, raw: string | null): Promise<void> {
    let requestId: string | undefined;
    try {
      if (this.isRateLimited(connection)) {
        throw new AppError("RATE_LIMITED", "Muitas mensagens em pouco tempo.");
      }
      const envelope = this.parseEnvelope(raw);
      requestId = envelope.requestId;

      if (!isClientEventType(envelope.type)) {
        throw new AppError("UNKNOWN_EVENT", `Evento desconhecido: ${envelope.type}`);
      }
      if (envelope.type !== "session:identify" && !connection.playerId) {
        throw new AppError("NOT_AUTHENTICATED", "Identifique-se com session:identify antes de jogar.");
      }

      const payload = validate(clientEventSchemas[envelope.type], envelope.payload ?? {});
      await this.handlers[envelope.type](connection, payload);
      if (requestId) this.send(connection.socket, ServerEvents.ACK, { type: envelope.type }, requestId);
    } catch (error) {
      this.sendError(connection.socket, error, requestId);
    }
  }

  private parseEnvelope(raw: string | null) {
    if (raw === null) throw new AppError("INVALID_MESSAGE", "Mensagens devem ser texto JSON.");
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new AppError("INVALID_MESSAGE", "Mensagem não é um JSON válido.");
    }
    const envelope = envelopeSchema.safeParse(json);
    if (!envelope.success) {
      throw new AppError("INVALID_MESSAGE", "Formato esperado: { type, requestId?, payload? }.");
    }
    return envelope.data;
  }

  private isRateLimited(connection: Connection): boolean {
    const now = Date.now();
    if (now - connection.windowStart > RATE_LIMIT_WINDOW_MS) {
      connection.windowStart = now;
      connection.messagesInWindow = 0;
    }
    connection.messagesInWindow += 1;
    return connection.messagesInWindow > RATE_LIMIT_MESSAGES;
  }

  // -------------------------------------------------------- identificação

  private async identify(connection: Connection, payload: { playerId: string; token: string }): Promise<void> {
    const playerId = payload.playerId.toLowerCase();
    if (connection.playerId && connection.playerId !== playerId) {
      throw new AppError("FORBIDDEN", "Esta conexão já está identificada com outro jogador.");
    }
    const player = await this.options.playerService.authenticate(playerId, payload.token);

    // Mesmo jogador em outra aba/dispositivo: a conexão antiga é substituída.
    const previous = this.connectionsByPlayer.get(player.id);
    if (previous && previous !== connection) {
      previous.replaced = true;
      this.sendError(
        previous.socket,
        new AppError("SESSION_REPLACED", "Você abriu o jogo em outra janela. Esta conexão foi encerrada."),
      );
      previous.socket.close(CLOSE_SESSION_REPLACED, "SESSION_REPLACED");
    }
    connection.playerId = player.id;
    connection.playerName = player.name;
    this.connectionsByPlayer.set(player.id, connection);

    const room = this.options.roomManager.findRoomOfPlayer(player.id);
    this.send(connection.socket, ServerEvents.SESSION_IDENTIFIED, {
      player: { id: player.id, name: player.name },
      roomCode: room?.code ?? null,
    });

    if (room) {
      const seat = room.findSeat(player.id);
      if (seat && !seat.connected) {
        this.options.roomManager.handleReconnect(player.id); // avisa todos + snapshot
      } else {
        this.send(connection.socket, ServerEvents.ROOM_STATE, room.snapshot());
      }
    }
  }

  private requirePlayer(connection: Connection): string {
    if (!connection.playerId) {
      throw new AppError("NOT_AUTHENTICATED", "Identifique-se com session:identify antes de jogar.");
    }
    return connection.playerId;
  }

  private identityOf(connection: Connection) {
    // O nome vem do banco (lido no identify), nunca do cliente.
    return { id: this.requirePlayer(connection), name: connection.playerName };
  }

  // --------------------------------------------------------------- envio

  /** Envia os eventos e, por último, o snapshot da sala a cada jogador conectado nela. */
  private publish(room: Room, events: RoomEvent[]): void {
    const snapshot = room.snapshot();
    for (const seat of room.seats) {
      const connection = this.connectionsByPlayer.get(seat.playerId);
      if (!connection) continue;
      for (const event of events) this.send(connection.socket, event.type, event.payload);
      this.send(connection.socket, ServerEvents.ROOM_STATE, snapshot);
    }
  }

  private send(socket: WebSocket, type: string, payload: unknown, requestId?: string): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(requestId ? { type, requestId, payload } : { type, payload }));
  }

  private sendError(socket: WebSocket, error: unknown, requestId?: string): void {
    const appError =
      error instanceof AppError ? error : new AppError("INTERNAL_ERROR", "Erro interno do servidor.");
    if (!(error instanceof AppError)) {
      logger.error("Erro inesperado no WebSocket", { error: String((error as Error)?.stack ?? error) });
    }
    this.send(socket, ServerEvents.ERROR, toErrorBody(appError), requestId);
  }
}
