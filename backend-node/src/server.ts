/**
 * PONTO DE ENTRADA do backend Node.
 * Lê a configuração, cria as dependências, sobe HTTP + WebSocket na mesma
 * porta e trata o desligamento gracioso.
 */
import { createServer, type Server } from "node:http";
import type { PrismaClient } from "@prisma/client";
import { createApp } from "./app";
import { loadEnv, type Env } from "./config/env";
import { logger, setLogLevel } from "./config/logger";
import { secureDiceRoller } from "./game/dice";
import { createPrismaClient, isDatabaseUp } from "./repositories/prismaClient";
import { PrismaGameRepository } from "./repositories/prismaGameRepository";
import { PrismaPlayerRepository } from "./repositories/prismaPlayerRepository";
import { PrismaRankingRepository } from "./repositories/prismaRankingRepository";
import type { GameRepository, PlayerRepository, RankingRepository } from "./repositories/types";
import { RoomManager } from "./rooms/RoomManager";
import { GameRecordService } from "./services/gameRecordService";
import { PlayerService } from "./services/playerService";
import { RankingService } from "./services/rankingService";
import { GameGateway } from "./ws/gateway";
import type { DiceRoller } from "./game/dice";

export interface ServerDependencies {
  players: PlayerRepository;
  games: GameRepository;
  ranking: RankingRepository;
  checkDatabase: () => Promise<boolean>;
  diceRoller?: DiceRoller;
}

export interface RunningServer {
  server: Server;
  roomManager: RoomManager;
  stop(): Promise<void>;
}

/** Monta e inicia o servidor. Usado pelo main() abaixo e pelos testes de integração. */
export async function startServer(
  env: Pick<Env, "PORT" | "CORS_ORIGINS" | "RECONNECT_GRACE_SECONDS" | "ENABLE_TEST_ENDPOINTS">,
  deps: ServerDependencies,
): Promise<RunningServer> {
  const playerService = new PlayerService(deps.players, deps.ranking);
  const rankingService = new RankingService(deps.ranking);
  const roomManager = new RoomManager({
    recorder: new GameRecordService(deps.games),
    diceRoller: deps.diceRoller ?? secureDiceRoller,
    reconnectGraceMs: env.RECONNECT_GRACE_SECONDS * 1000,
  });

  const app = createApp({
    playerService,
    rankingService,
    roomManager,
    checkDatabase: deps.checkDatabase,
    enableTestEndpoints: env.ENABLE_TEST_ENDPOINTS,
    corsOrigins: env.CORS_ORIGINS,
  });
  const server = createServer(app);
  const gateway = new GameGateway(server, { roomManager, playerService, corsOrigins: env.CORS_ORIGINS });

  await new Promise<void>((resolve) => server.listen(env.PORT, resolve));

  return {
    server,
    roomManager,
    async stop() {
      roomManager.shutdown();
      await gateway.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function main(): Promise<void> {
  const env = loadEnv();
  setLogLevel(env.LOG_LEVEL);
  const prisma: PrismaClient = createPrismaClient(env.DATABASE_URL);

  const running = await startServer(env, {
    players: new PrismaPlayerRepository(prisma),
    games: new PrismaGameRepository(prisma),
    ranking: new PrismaRankingRepository(prisma),
    checkDatabase: () => isDatabaseUp(prisma),
  });
  logger.info("Backend Node iniciado", {
    port: env.PORT,
    websocket: "/ws",
    testEndpoints: env.ENABLE_TEST_ENDPOINTS,
  });
  if (env.ENABLE_TEST_ENDPOINTS) logger.warn("Endpoints de TESTE habilitados — não use em produção.");

  const shutdown = async (signal: string) => {
    logger.info("Desligando o servidor", { signal });
    await running.stop();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

if (require.main === module) {
  main().catch((error) => {
    logger.error("Falha ao iniciar o servidor", { error: String(error?.stack ?? error) });
    process.exit(1);
  });
}
