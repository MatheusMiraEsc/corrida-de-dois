/**
 * Identificação dos jogadores (sem login): cada jogador tem um UUID público
 * e um token secreto. Nomes iguais NÃO significam o mesmo jogador.
 */
import { randomUUID } from "node:crypto";
import { AppError } from "../errors/AppError";
import type { PlayerIdentity } from "../rooms/Room";
import type { PlayerRepository, RankingRepository } from "../repositories/types";
import { generatePlayerToken, hashToken, tokenMatches } from "./tokens";

export class PlayerService {
  constructor(
    private readonly players: PlayerRepository,
    private readonly ranking: RankingRepository,
  ) {}

  /** Cria o jogador e devolve o token em texto puro (única vez em que ele aparece). */
  async register(name: string) {
    const token = generatePlayerToken();
    const player = await this.players.create({
      id: randomUUID(),
      name,
      tokenHash: hashToken(token),
      createdAt: new Date(),
    });
    return { id: player.id, name: player.name, token, createdAt: player.createdAt.toISOString() };
  }

  /** Confere o par (id, token). Usado pelo WebSocket e pelas rotas protegidas. */
  async authenticate(playerId: string, token: string): Promise<PlayerIdentity> {
    const player = await this.players.findById(playerId);
    if (!player || !tokenMatches(token, player.tokenHash)) {
      throw new AppError("UNAUTHORIZED", "Identificação do jogador inválida.");
    }
    return { id: player.id, name: player.name };
  }

  async getProfile(playerId: string) {
    const player = await this.players.findById(playerId);
    if (!player) throw new AppError("PLAYER_NOT_FOUND", "Jogador não encontrado.");
    const row = await this.ranking.findByPlayer(playerId);
    return {
      id: player.id,
      name: player.name,
      createdAt: player.createdAt.toISOString(),
      stats: {
        rank: row?.rank ?? null,
        gamesPlayed: row?.gamesPlayed ?? 0,
        wins: row?.wins ?? 0,
        losses: row?.losses ?? 0,
        points: row?.points ?? 0,
        winRate: row?.winRate ?? 0,
      },
    };
  }

  async rename(playerId: string, token: string, name: string) {
    const player = await this.players.findById(playerId);
    if (!player) throw new AppError("PLAYER_NOT_FOUND", "Jogador não encontrado.");
    if (!tokenMatches(token, player.tokenHash)) {
      throw new AppError("FORBIDDEN", "Você só pode alterar o seu próprio nome.");
    }
    const updated = await this.players.updateName(playerId, name);
    return { id: updated.id, name: updated.name, createdAt: updated.createdAt.toISOString() };
  }
}
