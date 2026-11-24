/**
 * ROTAS HTTP. Cada rota só repassa para o controller correspondente.
 * Contrato completo em docs/contrato-api.md.
 */
import { Router } from "express";
import { boardController, healthController } from "../controllers/healthController";
import { playerController } from "../controllers/playerController";
import { rankingController } from "../controllers/rankingController";
import { forceDiceController, roomController } from "../controllers/roomController";
import { rateLimit } from "../middlewares/rateLimit";
import type { RoomManager } from "../rooms/RoomManager";
import type { PlayerService } from "../services/playerService";
import type { RankingService } from "../services/rankingService";

export interface RouteDependencies {
  playerService: PlayerService;
  rankingService: RankingService;
  roomManager: RoomManager;
  checkDatabase: () => Promise<boolean>;
  enableTestEndpoints: boolean;
  /** Máximo de cadastros de jogador por IP por minuto. */
  playerCreationLimitPerMinute?: number;
}

export function buildRoutes(deps: RouteDependencies): Router {
  const router = Router();
  const players = playerController(deps.playerService);

  router.get("/health", healthController(deps.checkDatabase));
  router.get("/board", boardController);

  router.post("/players", rateLimit(deps.playerCreationLimitPerMinute ?? 30, 60_000), players.create);
  router.get("/players/:id", players.getById);
  router.patch("/players/:id", players.rename);

  router.get("/ranking", rankingController(deps.rankingService));
  router.get("/rooms/:code", roomController(deps.roomManager));

  if (deps.enableTestEndpoints) {
    router.post("/test/rooms/:code/dice", forceDiceController(deps.roomManager));
  }

  return router;
}
