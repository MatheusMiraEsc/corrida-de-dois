/**
 * REQUISIÇÕES HTTP ao backend. Todas as rotas ficam aqui.
 */
import { config } from "../config";
import type {
  BoardDescription,
  CreatedPlayer,
  ErrorBody,
  PlayerProfile,
  RankingResponse,
  RoomInfo,
} from "../types/contract";

/** Erro devolvido pelo backend (com o código padronizado do contrato). */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: ErrorBody["details"];

  constructor(status: number, body: ErrorBody) {
    super(body.message);
    this.code = body.code;
    this.status = status;
    this.details = body.details;
  }

  /** Mensagem mais útil para o usuário: o detalhe do campo, se existir. */
  get friendlyMessage(): string {
    return this.details?.[0]?.message ?? this.message;
  }
}

async function request<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, { code: "NETWORK_ERROR", message: "Não foi possível falar com o servidor." });
  }
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new ApiError(response.status, data?.error ?? { code: "INTERNAL_ERROR", message: "Erro inesperado." });
  }
  return data as T;
}

export const api = {
  getBoard: () => request<BoardDescription>("GET", "/api/board"),
  createPlayer: (name: string) => request<CreatedPlayer>("POST", "/api/players", { name }),
  getPlayer: (id: string) => request<PlayerProfile>("GET", `/api/players/${id}`),
  renamePlayer: (id: string, token: string, name: string) =>
    request<{ id: string; name: string; createdAt: string }>("PATCH", `/api/players/${id}`, { name }, token),
  getRanking: (limit = 50) => request<RankingResponse>("GET", `/api/ranking?limit=${limit}`),
  getRoom: (code: string) => request<RoomInfo>("GET", `/api/rooms/${encodeURIComponent(code)}`),
};
