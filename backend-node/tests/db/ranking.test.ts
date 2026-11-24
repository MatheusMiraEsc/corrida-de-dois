/**
 * Ranking com PostgreSQL REAL (banco de teste separado: TEST_DATABASE_URL).
 * Rodar com:  npm run test:db   (o PostgreSQL do docker compose precisa estar no ar)
 *
 * Cobre: registro de partida, pontuação, vitórias/derrotas, ordenação com
 * desempates e persistência após "reiniciar o servidor" (novo cliente Prisma).
 */
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GameMatch } from "../../src/game/GameMatch";
import { createPrismaClient, isDatabaseUp } from "../../src/repositories/prismaClient";
import { PrismaGameRepository } from "../../src/repositories/prismaGameRepository";
import { PrismaPlayerRepository } from "../../src/repositories/prismaPlayerRepository";
import { PrismaRankingRepository } from "../../src/repositories/prismaRankingRepository";
import { GameRecordService } from "../../src/services/gameRecordService";
import { PlayerService } from "../../src/services/playerService";
import { RankingService } from "../../src/services/rankingService";
import { startServer } from "../../src/server";
import { interleavedWinningSequence } from "../support/scenarios";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? loadFromDotEnv();

function loadFromDotEnv(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const content: string = require("node:fs").readFileSync(".env", "utf8");
    return /^TEST_DATABASE_URL=(.+)$/m.exec(content)?.[1]?.trim();
  } catch {
    return undefined;
  }
}

if (!TEST_DATABASE_URL) {
  throw new Error("Defina TEST_DATABASE_URL (veja backend-node/.env.example) para rodar os testes de banco.");
}

describe("Ranking global (PostgreSQL)", () => {
  let prisma: PrismaClient;
  let players: PlayerService;
  let recorder: GameRecordService;
  let ranking: RankingService;

  beforeAll(async () => {
    prisma = createPrismaClient(TEST_DATABASE_URL!);
    if (!(await isDatabaseUp(prisma))) {
      throw new Error(`PostgreSQL de teste inacessível em ${TEST_DATABASE_URL}`);
    }
    const rankingRepository = new PrismaRankingRepository(prisma);
    players = new PlayerService(new PrismaPlayerRepository(prisma), rankingRepository);
    recorder = new GameRecordService(new PrismaGameRepository(prisma));
    ranking = new RankingService(rankingRepository);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "game_players", "games", "players" CASCADE');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** Joga uma partida completa em que "winner" vence "loser" e a registra. */
  async function playAndRecord(winnerId: string, loserId: string) {
    const match = new GameMatch([winnerId, loserId], new Date(Date.now() - 90_000));
    interleavedWinningSequence().forEach((dice) => match.playTurn(match.currentPlayerId!, dice, new Date()));
    await recorder.recordMatch("TESTE1", match);
    return match;
  }

  async function abandonAndRecord(aId: string, bId: string) {
    const match = new GameMatch([aId, bId], new Date());
    match.playTurn(aId, 2, new Date());
    match.abandon(new Date());
    await recorder.recordMatch("TESTE2", match);
  }

  it("registra a partida concluída com participantes, duração e vencedor", async () => {
    const ana = await players.register("Ana");
    const bia = await players.register("Bia");
    await playAndRecord(ana.id, bia.id);

    const games = await prisma.game.findMany({ include: { participants: true } });
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({ status: "FINISHED", winnerId: ana.id, roomCode: "TESTE1", totalMoves: 15 });
    expect(games[0].durationSeconds).toBeGreaterThanOrEqual(89);
    expect(games[0].participants.map((p) => [p.playerId, p.result, p.points, p.finalPosition]).sort()).toEqual(
      [
        [ana.id, "WIN", 100, 100],
        [bia.id, "LOSS", 20, expect.any(Number)],
      ].sort(),
    );
  });

  it("soma pontos, vitórias, derrotas e taxa de vitória", async () => {
    const ana = await players.register("Ana");
    const bia = await players.register("Bia");
    await playAndRecord(ana.id, bia.id);
    await playAndRecord(ana.id, bia.id);
    await playAndRecord(bia.id, ana.id);

    const { entries } = await ranking.getRanking();
    expect(entries).toEqual([
      { rank: 1, playerId: ana.id, name: "Ana", gamesPlayed: 3, wins: 2, losses: 1, points: 220, winRate: 66.7 },
      { rank: 2, playerId: bia.id, name: "Bia", gamesPlayed: 3, wins: 1, losses: 2, points: 140, winRate: 33.3 },
    ]);
    const profile = await players.getProfile(bia.id);
    expect(profile.stats).toMatchObject({ rank: 2, points: 140, wins: 1 });
  });

  it("partidas abandonadas não entram no ranking", async () => {
    const ana = await players.register("Ana");
    const bia = await players.register("Bia");
    await abandonAndRecord(ana.id, bia.id);
    expect((await ranking.getRanking()).entries).toEqual([]);
    expect(await prisma.game.count({ where: { status: "ABANDONED" } })).toBe(1);
  });

  it("ordena por pontos e desempata por vitórias, depois por taxa de vitória", async () => {
    // Caio: 1 vitória em 1 partida = 100 pts (100%)
    // Duda: 5 derrotas = 100 pts (0 vitórias) → abaixo de Caio no desempate por vitórias
    // Eva: 1 vitória + 0 derrotas também = 100 pts, mas cadastrada depois de Caio
    const caio = await players.register("Caio");
    const duda = await players.register("Duda");
    const eva = await players.register("Eva");
    const sparring = await players.register("Sparring");

    await playAndRecord(caio.id, sparring.id);
    for (let i = 0; i < 5; i += 1) await playAndRecord(sparring.id, duda.id);
    await playAndRecord(eva.id, sparring.id);

    const { entries } = await ranking.getRanking();
    const order = entries.map((e) => e.name);
    expect(order[0]).toBe("Sparring"); // 5 vitórias + 2 derrotas = 540
    expect(order.slice(1)).toEqual(["Caio", "Eva", "Duda"]); // empate em 100 pts
    expect(entries.map((e) => e.rank)).toEqual([1, 2, 3, 4]);
  });

  it("jogadores com o mesmo nome são contabilizados separadamente", async () => {
    const ana1 = await players.register("Ana");
    const ana2 = await players.register("Ana");
    await playAndRecord(ana1.id, ana2.id);
    const { entries } = await ranking.getRanking();
    expect(entries.map((e) => [e.playerId, e.points])).toEqual([
      [ana1.id, 100],
      [ana2.id, 20],
    ]);
  });

  it("o banco recusa pontuação inconsistente (proteção extra além do backend)", async () => {
    const ana = await players.register("Ana");
    const bia = await players.register("Bia");
    await expect(
      prisma.game.create({
        data: {
          id: randomUUID(),
          roomCode: "HACK00",
          status: "FINISHED",
          startedAt: new Date(),
          finishedAt: new Date(),
          durationSeconds: 1,
          totalMoves: 1,
          winnerId: ana.id,
          participants: {
            create: [
              { id: randomUUID(), playerId: ana.id, turnOrder: 1, finalPosition: 100, result: "WIN", points: 9999 },
              { id: randomUUID(), playerId: bia.id, turnOrder: 2, finalPosition: 1, result: "LOSS", points: 20 },
            ],
          },
        },
      }),
    ).rejects.toThrow();
  });

  it("o ranking continua existindo depois de reiniciar o servidor", async () => {
    const env = {
      PORT: 0,
      CORS_ORIGINS: ["*"],
      RECONNECT_GRACE_SECONDS: 60,
      ENABLE_TEST_ENDPOINTS: false,
    };
    const ana = await players.register("Ana");
    const bia = await players.register("Bia");
    await playAndRecord(ana.id, bia.id);

    async function rankingFromFreshServer() {
      const client = createPrismaClient(TEST_DATABASE_URL!); // conexão nova, como num processo novo
      const running = await startServer(env, {
        players: new PrismaPlayerRepository(client),
        games: new PrismaGameRepository(client),
        ranking: new PrismaRankingRepository(client),
        checkDatabase: () => isDatabaseUp(client),
      });
      const { port } = running.server.address() as AddressInfo;
      const body = (await (await fetch(`http://127.0.0.1:${port}/api/ranking`)).json()) as { entries: any[] };
      await running.stop();
      await client.$disconnect();
      return body.entries.map((e: any) => [e.name, e.points]);
    }

    const before = await rankingFromFreshServer();
    const after = await rankingFromFreshServer();
    expect(before).toEqual([
      ["Ana", 100],
      ["Bia", 20],
    ]);
    expect(after).toEqual(before);
  });
});
