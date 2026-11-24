/**
 * Estado da conexão e da sala, atualizado SOMENTE por mensagens do servidor.
 * A interface é sempre uma consequência deste estado.
 */
import type { ConnectionStatus } from "../services/gameSocket";
import type { GameAbandonedPayload, GameFinishedPayload, RoomSnapshot, ServerMessage } from "../types/contract";

export type NoticeKind = "info" | "success" | "warning" | "danger" | "ladder" | "snake";

export interface Notice {
  id: number;
  kind: NoticeKind;
  text: string;
}

export interface GameState {
  connection: ConnectionStatus;
  identified: boolean;
  /** Id do jogador desta janela (informado pelo servidor em session:identified). */
  selfId: string | null;
  room: RoomSnapshot | null;
  /** Resultado da última partida encerrada (evento game:finished). */
  finished: GameFinishedPayload | null;
  /** Aviso fixo na sala de espera (ex.: partida abandonada). */
  lobbyNotice: string | null;
  notices: Notice[];
}

export type GameAction =
  | { type: "connection"; status: ConnectionStatus }
  | { type: "server"; message: ServerMessage<any> }
  | { type: "notify"; kind: NoticeKind; text: string }
  | { type: "dismiss"; id: number }
  | { type: "clear-lobby-notice" };

export const initialGameState: GameState = {
  connection: "closed",
  identified: false,
  selfId: null,
  room: null,
  finished: null,
  lobbyNotice: null,
  notices: [],
};

let nextNoticeId = 1;
const MAX_NOTICES = 4;

function withNotice(state: GameState, kind: NoticeKind, text: string): GameState {
  const notice = { id: nextNoticeId++, kind, text };
  return { ...state, notices: [...state.notices, notice].slice(-MAX_NOTICES) };
}

function nameOf(state: GameState, playerId: string): string {
  return state.room?.players.find((p) => p.playerId === playerId)?.name ?? "O outro jogador";
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "connection":
      return {
        ...state,
        connection: action.status,
        identified: action.status === "open" ? state.identified : false,
      };
    case "notify":
      return withNotice(state, action.kind, action.text);
    case "dismiss":
      return { ...state, notices: state.notices.filter((n) => n.id !== action.id) };
    case "clear-lobby-notice":
      return { ...state, lobbyNotice: null };
    case "server":
      return applyServerMessage(state, action.message);
  }
}

const ABOUT_A_PLAYER = new Set([
  "room:player-joined",
  "room:player-left",
  "room:player-disconnected",
  "room:player-reconnected",
]);

function applyServerMessage(state: GameState, message: ServerMessage<any>): GameState {
  const payload = message.payload;
  // Avisos de entrada/saída/queda só interessam quando são sobre o OUTRO jogador.
  const aboutPlayerId = message.type === "room:player-joined" ? payload.player?.playerId : payload?.playerId;
  if (ABOUT_A_PLAYER.has(message.type) && aboutPlayerId === state.selfId) return state;

  switch (message.type) {
    case "session:identified":
      return {
        ...state,
        identified: true,
        selfId: payload.player?.id ?? null,
        room: payload.roomCode ? state.room : null,
      };

    case "room:state": {
      const snapshot = payload as RoomSnapshot;
      const current = state.room;
      // Descarta snapshots atrasados da mesma sala.
      if (current && current.code === snapshot.code && snapshot.version < current.version) return state;
      const newMatch = !current || current.matchNumber !== snapshot.matchNumber || current.code !== snapshot.code;
      return {
        ...state,
        room: snapshot,
        finished: newMatch && snapshot.status !== "FINISHED" ? null : state.finished,
        lobbyNotice: snapshot.status === "WAITING" ? state.lobbyNotice : null,
      };
    }

    case "room:left":
      return { ...state, room: null, finished: null, lobbyNotice: null };

    case "game:finished":
      return { ...state, finished: payload as GameFinishedPayload };

    case "room:player-joined":
      return withNotice(state, "success", `${payload.player.name} entrou na sala.`);

    case "room:player-left": {
      if (payload.reason === "DISCONNECT_TIMEOUT") return state; // já avisado por game:abandoned ou abaixo
      return withNotice(state, "info", `${nameOf(state, payload.playerId)} saiu da sala.`);
    }

    case "room:player-disconnected":
      return withNotice(state, "warning", `${nameOf(state, payload.playerId)} perdeu a conexão.`);

    case "room:player-reconnected":
      return withNotice(state, "success", `${nameOf(state, payload.playerId)} voltou!`);

    case "game:abandoned": {
      const abandoned = payload as GameAbandonedPayload;
      const who = nameOf(state, abandoned.playerId);
      const text =
        abandoned.reason === "LEFT"
          ? `A partida foi encerrada porque ${who} saiu. Ninguém pontuou.`
          : `A partida foi encerrada porque ${who} não voltou a tempo. Ninguém pontuou.`;
      return { ...withNotice(state, "danger", text), lobbyNotice: text };
    }

    case "error":
      if (payload.code === "SESSION_REPLACED") return withNotice(state, "warning", payload.message);
      return state;

    default:
      return state;
  }
}
