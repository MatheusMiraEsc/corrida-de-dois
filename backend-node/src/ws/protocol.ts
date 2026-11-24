/**
 * CONTRATO WEBSOCKET — formato das mensagens e validação dos payloads.
 * Documentação completa em docs/eventos-websocket.md.
 *
 * Toda mensagem (nos dois sentidos) é um JSON:
 *   { "type": "<evento>", "requestId": "<opcional>", "payload": { ... } }
 */
import { z } from "zod";
import {
  Messages,
  booleanSchema,
  nonNegativeIntegerSchema,
  optionalVehicleSchema,
  roomCodeSchema,
  tokenSchema,
  uuidSchema,
  vehicleSchema,
} from "../schemas/common";

export const envelopeSchema = z.object({
  type: z.string().min(1).max(64),
  requestId: z.string().min(1).max(64).optional(),
  payload: z.unknown().optional(),
});

export type Envelope = z.infer<typeof envelopeSchema>;

/** Eventos que o CLIENTE pode enviar e o formato de cada payload. */
export const clientEventSchemas = {
  "session:identify": z.object({ playerId: uuidSchema, token: tokenSchema }),
  "room:create": z.object({ vehicle: optionalVehicleSchema }),
  "room:join": z.object({ code: roomCodeSchema, vehicle: optionalVehicleSchema }),
  "room:leave": z.object({}),
  "room:ready": z.object({ ready: booleanSchema(Messages.READY_INVALID) }),
  "room:set-vehicle": z.object({ vehicle: vehicleSchema }),
  "game:start": z.object({}),
  "game:roll-dice": z.object({ expectedMoveCount: nonNegativeIntegerSchema(Messages.MOVE_COUNT_INVALID) }),
  "game:restart": z.object({}),
} as const;

export type ClientEventType = keyof typeof clientEventSchemas;

export function isClientEventType(type: string): type is ClientEventType {
  return Object.prototype.hasOwnProperty.call(clientEventSchemas, type);
}

/** Eventos que o SERVIDOR envia. */
export const ServerEvents = {
  SESSION_IDENTIFIED: "session:identified",
  ACK: "ack",
  ERROR: "error",
  ROOM_STATE: "room:state",
  ROOM_LEFT: "room:left",
  ROOM_PLAYER_JOINED: "room:player-joined",
  ROOM_PLAYER_LEFT: "room:player-left",
  ROOM_PLAYER_DISCONNECTED: "room:player-disconnected",
  ROOM_PLAYER_RECONNECTED: "room:player-reconnected",
  GAME_STARTED: "game:started",
  GAME_DICE_ROLLED: "game:dice-rolled",
  GAME_LADDER_CLIMBED: "game:ladder-climbed",
  GAME_SNAKE_BITTEN: "game:snake-bitten",
  GAME_TURN_CHANGED: "game:turn-changed",
  GAME_FINISHED: "game:finished",
  GAME_ABANDONED: "game:abandoned",
  GAME_RESTARTED: "game:restarted",
} as const;
