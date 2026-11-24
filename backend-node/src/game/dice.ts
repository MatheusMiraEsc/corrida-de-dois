import { randomInt } from "node:crypto";
import { DICE_FACES } from "./board";

/** Função que devolve um valor de dado entre 1 e 6. */
export type DiceRoller = () => number;

/**
 * Dado oficial: usa o gerador criptográfico do Node, que não é previsível
 * como Math.random(). O valor é sorteado SOMENTE no servidor.
 */
export const secureDiceRoller: DiceRoller = () => randomInt(1, DICE_FACES + 1);

export function isValidDiceValue(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= DICE_FACES;
}
