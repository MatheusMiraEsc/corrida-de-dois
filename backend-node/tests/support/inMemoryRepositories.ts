/**
 * Repositórios em memória, usados SOMENTE nos testes que não precisam de
 * banco (regras, salas, WebSocket). Os testes de ranking usam PostgreSQL real.
 */
import type {
  GameRecordInput,
  GameRepository,
  PlayerRecord,
  PlayerRepository,
  RankingRepository,
  RankingRow,
} from "../../src/repositories/types";

export class InMemoryPlayerRepository implements PlayerRepository {
  readonly players = new Map<string, PlayerRecord>();

  async create(player: PlayerRecord) {
    this.players.set(player.id, { ...player });
    return { ...player };
  }

  async findById(id: string) {
    const player = this.players.get(id);
    return player ? { ...player } : null;
  }

  async updateName(id: string, name: string) {
    const player = this.players.get(id)!;
    player.name = name;
    return { ...player };
  }
}

export class InMemoryGameRepository implements GameRepository {
  readonly games: GameRecordInput[] = [];
  failNext = false;

  async save(game: GameRecordInput) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("falha simulada no banco");
    }
    this.games.push(game);
  }
}

/** Versão simplificada da view player_ranking (pontos, vitórias). */
export class InMemoryRankingRepository implements RankingRepository {
  constructor(
    private readonly players: InMemoryPlayerRepository,
    private readonly games: InMemoryGameRepository,
  ) {}

  private rows(): RankingRow[] {
    const stats = new Map<string, RankingRow>();
    for (const game of this.games.games.filter((g) => g.status === "FINISHED")) {
      for (const participant of game.participants) {
        const row = stats.get(participant.playerId) ?? {
          rank: 0,
          playerId: participant.playerId,
          name: this.players.players.get(participant.playerId)?.name ?? "",
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          points: 0,
          winRate: 0,
        };
        row.gamesPlayed += 1;
        row.wins += participant.result === "WIN" ? 1 : 0;
        row.losses += participant.result === "LOSS" ? 1 : 0;
        row.points += participant.points;
        row.winRate = Math.round((row.wins * 1000) / row.gamesPlayed) / 10;
        stats.set(participant.playerId, row);
      }
    }
    return [...stats.values()]
      .sort((a, b) => b.points - a.points || b.wins - a.wins)
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }

  async top(limit: number) {
    return this.rows().slice(0, limit);
  }

  async findByPlayer(playerId: string) {
    return this.rows().find((row) => row.playerId === playerId) ?? null;
  }
}

export function createInMemoryRepositories() {
  const players = new InMemoryPlayerRepository();
  const games = new InMemoryGameRepository();
  const ranking = new InMemoryRankingRepository(players, games);
  return { players, games, ranking, checkDatabase: async () => true };
}
