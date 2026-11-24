/** Converte qualquer erro (HTTP ou WebSocket) em uma mensagem amigável. */
import { ApiError } from "../services/api";
import { SocketRequestError } from "../services/gameSocket";

const FRIENDLY: Record<string, string> = {
  ROOM_NOT_FOUND: "Sala não encontrada. Confira o código.",
  ROOM_FULL: "Essa sala já tem dois pilotos.",
  ALREADY_IN_ROOM: "Você já está em outra sala. Saia dela primeiro.",
  NOT_YOUR_TURN: "Calma! Ainda não é a sua vez.",
  GAME_PAUSED: "A partida está pausada esperando o outro jogador voltar.",
  STALE_ACTION: "Essa jogada já foi feita. Atualizamos o tabuleiro.",
  RATE_LIMITED: "Muitas ações seguidas. Espere um instante.",
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return FRIENDLY[error.code] ?? error.friendlyMessage;
  if (error instanceof SocketRequestError) return FRIENDLY[error.code] ?? error.message;
  return "Algo deu errado. Tente novamente.";
}
