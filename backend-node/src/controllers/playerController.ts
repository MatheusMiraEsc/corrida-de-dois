import type { Request, RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../errors/AppError";
import { validate } from "../middlewares/validate";
import { playerNameSchema, uuidSchema } from "../schemas/common";
import type { PlayerService } from "../services/playerService";

const playerNameBody = z.object({ name: playerNameSchema });

function readPlayerId(req: Request): string {
  const id = String(req.params.id);
  // Um id mal formado nunca existirá: responde 404 como um id desconhecido.
  if (!uuidSchema.safeParse(id).success) {
    throw new AppError("PLAYER_NOT_FOUND", "Jogador não encontrado.");
  }
  return id.toLowerCase();
}

function readBearerToken(req: Request): string {
  const header = req.header("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) throw new AppError("UNAUTHORIZED", "Envie o token do jogador no cabeçalho Authorization.");
  return match[1];
}

export function playerController(players: PlayerService) {
  const create: RequestHandler = async (req, res) => {
    const body = validate(playerNameBody, req.body ?? {});
    res.status(201).json(await players.register(body.name));
  };

  const getById: RequestHandler = async (req, res) => {
    res.json(await players.getProfile(readPlayerId(req)));
  };

  const rename: RequestHandler = async (req, res) => {
    const id = readPlayerId(req);
    const token = readBearerToken(req);
    const body = validate(playerNameBody, req.body ?? {});
    res.json(await players.rename(id, token, body.name));
  };

  return { create, getById, rename };
}
