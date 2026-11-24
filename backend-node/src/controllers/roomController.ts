import type { RequestHandler } from "express";
import { z } from "zod";
import { validate } from "../middlewares/validate";
import { Messages, roomCodeSchema } from "../schemas/common";
import type { RoomManager } from "../rooms/RoomManager";
import { DICE_FACES } from "../game/board";

/**
 * Consulta pública de uma sala (antes de entrar). Não expõe ids dos
 * jogadores — só o necessário para a tela "entrar na sala".
 */
export function roomController(rooms: RoomManager): RequestHandler {
  return (req, res) => {
    const code = validate(roomCodeSchema, req.params.code);
    const room = rooms.requireRoom(code);
    res.json({
      code: room.code,
      status: room.status,
      isFull: room.isFull,
      players: room.seats.map((seat) => ({
        name: seat.name,
        seat: seat.seat,
        vehicle: seat.vehicle,
        connected: seat.connected,
      })),
    });
  };
}

const forcedDiceBody = z.object({
  values: z.unknown().optional().transform((value, ctx) => {
    const valid =
      Array.isArray(value) &&
      value.length >= 1 &&
      value.length <= 500 &&
      value.every((dice) => Number.isInteger(dice) && dice >= 1 && dice <= DICE_FACES);
    if (!valid) {
      ctx.addIssue({ code: "custom", message: Messages.DICE_VALUES_INVALID });
      return z.NEVER;
    }
    return value as number[];
  }),
});

/** SOMENTE TESTES: enfileira valores do dado para uma sala. */
export function forceDiceController(rooms: RoomManager): RequestHandler {
  return (req, res) => {
    const code = validate(roomCodeSchema, req.params.code);
    const body = validate(forcedDiceBody, req.body ?? {});
    rooms.forceDice(code, body.values);
    res.status(204).end();
  };
}
