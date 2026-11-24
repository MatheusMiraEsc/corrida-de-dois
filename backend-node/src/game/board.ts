/**
 * Configuração do tabuleiro: tamanho, casa inicial, escadas e serpentes.
 * Estes valores são idênticos no backend Java (game/Board.java).
 */

export const BOARD_SIZE = 100;
export const START_POSITION = 1;
export const DICE_FACES = 6;
/** Tirar este valor dá direito a jogar novamente. */
export const EXTRA_TURN_FACE = 6;

/** Uma escada (from < to) ou uma serpente (from > to). */
export interface Jump {
  id: number;
  from: number;
  to: number;
}

export const LADDERS: readonly Jump[] = [
  { id: 1, from: 4, to: 14 },
  { id: 2, from: 21, to: 42 },
  { id: 3, from: 51, to: 67 },
  { id: 4, from: 71, to: 91 },
];

/** Serpentes: "from" é a cabeça, "to" é a cauda. */
export const SNAKES: readonly Jump[] = [
  { id: 1, from: 17, to: 7 },
  { id: 2, from: 54, to: 34 },
  { id: 3, from: 87, to: 24 },
  { id: 4, from: 98, to: 79 },
];

export function findLadderAt(square: number): Jump | null {
  return LADDERS.find((ladder) => ladder.from === square) ?? null;
}

export function findSnakeAt(square: number): Jump | null {
  return SNAKES.find((snake) => snake.from === square) ?? null;
}

/** Formato público do tabuleiro, devolvido por GET /api/board. */
export function describeBoard() {
  return {
    size: BOARD_SIZE,
    startPosition: START_POSITION,
    ladders: LADDERS.map(({ id, from, to }) => ({ id, from, to })),
    snakes: SNAKES.map(({ id, from, to }) => ({ id, from, to })),
  };
}
