/**
 * REGRAS DE MOVIMENTO — funções puras (sem banco, sem rede, sem relógio).
 *
 * Dada a posição atual e o valor do dado, calcula para onde o carrinho vai,
 * quais casas ele percorre (para a animação), se caiu em escada ou serpente,
 * se venceu e se ganhou jogada extra.
 */
import { BOARD_SIZE, EXTRA_TURN_FACE, Jump, findLadderAt, findSnakeAt } from "./board";
import { isValidDiceValue } from "./dice";

/**
 * MOVE      → andou normalmente
 * LADDER    → parou na base de uma escada e subiu
 * SNAKE     → parou na cabeça de uma serpente e desceu
 * OVERSHOOT → o dado passaria da casa 100: o carrinho fica onde está
 */
export type MoveEffect = "MOVE" | "LADDER" | "SNAKE" | "OVERSHOOT";

export interface MoveResult {
  dice: number;
  from: number;
  /** Casas percorridas uma a uma (sem incluir "from"); vazio em OVERSHOOT. */
  path: number[];
  /** Casa onde o dado levou o carrinho (antes de escada/serpente). */
  landedOn: number;
  /** Posição final depois de escada/serpente. */
  finalPosition: number;
  effect: MoveEffect;
  /** Escada ou serpente usada, se houver. */
  jump: Jump | null;
  won: boolean;
  extraTurn: boolean;
}

export function calculateMove(from: number, dice: number): MoveResult {
  if (!isValidDiceValue(dice)) {
    throw new RangeError(`Valor de dado inválido: ${dice}`);
  }
  if (!Number.isInteger(from) || from < 1 || from > BOARD_SIZE) {
    throw new RangeError(`Posição inválida: ${from}`);
  }

  // Regra: tirou 6 joga de novo — mesmo que ultrapasse 100 ou caia numa serpente.
  // A única exceção é a vitória, que encerra a partida.
  const rolledExtraTurnFace = dice === EXTRA_TURN_FACE;
  const target = from + dice;

  if (target > BOARD_SIZE) {
    return {
      dice,
      from,
      path: [],
      landedOn: from,
      finalPosition: from,
      effect: "OVERSHOOT",
      jump: null,
      won: false,
      extraTurn: rolledExtraTurnFace,
    };
  }

  const path = Array.from({ length: dice }, (_, step) => from + step + 1);
  const ladder = findLadderAt(target);
  const snake = findSnakeAt(target);
  const jump = ladder ?? snake;
  const finalPosition = jump ? jump.to : target;
  const won = finalPosition === BOARD_SIZE;

  return {
    dice,
    from,
    path,
    landedOn: target,
    finalPosition,
    effect: ladder ? "LADDER" : snake ? "SNAKE" : "MOVE",
    jump,
    won,
    extraTurn: rolledExtraTurnFace && !won,
  };
}
