import type { RequestHandler } from "express";
import { describeBoard } from "../game/board";

export function healthController(checkDatabase: () => Promise<boolean>): RequestHandler {
  return async (_req, res) => {
    const databaseUp = await checkDatabase();
    res.status(databaseUp ? 200 : 503).json({
      status: databaseUp ? "ok" : "degraded",
      backend: "node",
      database: databaseUp ? "up" : "down",
    });
  };
}

export const boardController: RequestHandler = (_req, res) => {
  res.json(describeBoard());
};
