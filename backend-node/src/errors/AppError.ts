/**
 * Erros de negócio padronizados. O mesmo código é usado no HTTP
 * ({ error: { code, message } }) e no WebSocket (evento "error").
 * A tabela é idêntica no backend Java (error/ErrorCode.java).
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 400,
  INVALID_MESSAGE: 400,
  UNKNOWN_EVENT: 400,
  UNAUTHORIZED: 401,
  NOT_AUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_HOST: 403,
  NOT_FOUND: 404,
  PLAYER_NOT_FOUND: 404,
  ROOM_NOT_FOUND: 404,
  ROOM_FULL: 409,
  ALREADY_IN_ROOM: 409,
  NOT_IN_ROOM: 409,
  PLAYERS_NOT_READY: 409,
  GAME_ALREADY_STARTED: 409,
  GAME_NOT_IN_PROGRESS: 409,
  GAME_NOT_FINISHED: 409,
  GAME_PAUSED: 409,
  NOT_YOUR_TURN: 409,
  STALE_ACTION: 409,
  SESSION_REPLACED: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = ErrorCodes[code];
    this.details = details;
  }
}

/** Corpo padrão de erro, igual no HTTP e no WebSocket. */
export function toErrorBody(error: AppError) {
  return {
    code: error.code,
    message: error.message,
    ...(error.details !== undefined ? { details: error.details } : {}),
  };
}
