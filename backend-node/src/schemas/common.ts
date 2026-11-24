/**
 * VALIDAÇÕES reutilizadas pelo HTTP e pelo WebSocket.
 *
 * Cada campo produz NO MÁXIMO UMA mensagem de erro, sempre em português.
 * O backend Java (validation/Validators.java) implementa exatamente as mesmas
 * regras e mensagens — os testes de equivalência comparam as duas respostas.
 */
import { z } from "zod";
import { VEHICLES, type Vehicle } from "../rooms/Room";

export const PLAYER_NAME_MAX = 24;
const PLAYER_NAME_PATTERN = /^[\p{L}\p{N} _.'-]+$/u;
const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Messages = {
  NAME_REQUIRED: "O nome é obrigatório.",
  NAME_TOO_LONG: `O nome pode ter no máximo ${PLAYER_NAME_MAX} caracteres.`,
  NAME_INVALID_CHARS: "O nome contém caracteres não permitidos.",
  ROOM_CODE_REQUIRED: "O código da sala é obrigatório.",
  ROOM_CODE_INVALID: "O código da sala tem 6 letras ou números.",
  ID_INVALID: "Identificador inválido.",
  TOKEN_INVALID: "Token inválido.",
  VEHICLE_INVALID: "Veículo inválido.",
  READY_INVALID: "ready deve ser verdadeiro ou falso.",
  MOVE_COUNT_INVALID: "expectedMoveCount deve ser um número inteiro maior ou igual a zero.",
  LIMIT_INVALID: "limit deve ser um inteiro entre 1 e 100.",
  DICE_VALUES_INVALID: "values deve ser uma lista de 1 a 500 valores inteiros entre 1 e 6.",
} as const;

/**
 * Cria um validador que converte o valor (ou devolve undefined se inválido).
 * Em caso de erro, gera um único problema com a mensagem informada.
 */
function rule<T>(parse: (value: unknown) => T | undefined | { error: string }) {
  // .optional() faz o Zod executar a regra também quando a chave está ausente.
  return z.unknown().optional().transform((value, ctx): T => {
    const result = parse(value);
    if (result !== null && typeof result === "object" && "error" in (result as object)) {
      ctx.addIssue({ code: "custom", message: (result as { error: string }).error });
      return z.NEVER;
    }
    return result as T;
  });
}

const fail = (error: string) => ({ error });

/** Nome: espaços extras removidos, 1–24 caracteres, letras/números/espaço e . _ ' - */
export const playerNameSchema = rule<string>((value) => {
  if (typeof value !== "string") return fail(Messages.NAME_REQUIRED);
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length === 0) return fail(Messages.NAME_REQUIRED);
  if (name.length > PLAYER_NAME_MAX) return fail(Messages.NAME_TOO_LONG);
  if (!PLAYER_NAME_PATTERN.test(name)) return fail(Messages.NAME_INVALID_CHARS);
  return name;
});

/** Código da sala: 6 letras/números; aceita minúsculas e espaços nas pontas. */
export const roomCodeSchema = rule<string>((value) => {
  if (typeof value !== "string" || value.trim().length === 0) return fail(Messages.ROOM_CODE_REQUIRED);
  const code = value.trim().toUpperCase();
  return ROOM_CODE_PATTERN.test(code) ? code : fail(Messages.ROOM_CODE_INVALID);
});

export const uuidSchema = rule<string>((value) =>
  typeof value === "string" && UUID_PATTERN.test(value) ? value.toLowerCase() : fail(Messages.ID_INVALID),
);

export const tokenSchema = rule<string>((value) =>
  typeof value === "string" && value.length >= 1 && value.length <= 200 ? value : fail(Messages.TOKEN_INVALID),
);

function isVehicle(value: unknown): value is Vehicle {
  return typeof value === "string" && (VEHICLES as readonly string[]).includes(value);
}

/** Veículo obrigatório (room:set-vehicle). */
export const vehicleSchema = rule<Vehicle>((value) => (isVehicle(value) ? value : fail(Messages.VEHICLE_INVALID)));

/** Veículo opcional: ausente → "car" (room:create e room:join). */
export const optionalVehicleSchema = rule<Vehicle>((value) => {
  if (value === undefined || value === null) return "car";
  return isVehicle(value) ? value : fail(Messages.VEHICLE_INVALID);
});

export const booleanSchema = (message: string) =>
  rule<boolean>((value) => (typeof value === "boolean" ? value : fail(message)));

export const nonNegativeIntegerSchema = (message: string) =>
  rule<number>((value) => (Number.isInteger(value) && (value as number) >= 0 ? (value as number) : fail(message)));

/** Converte um erro do Zod para a lista de detalhes do nosso formato de erro. */
export function describeIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : null,
    message: issue.message,
  }));
}
