/**
 * Sequências de dado que levam um jogador da casa 1 à casa 100 sem tirar 6:
 *  1 →(3) 4 ⇒ escada 14 →(5) 19 →(2) 21 ⇒ escada 42 →(5) 47 →(4) 51 ⇒ escada 67
 *    →(4) 71 ⇒ escada 91 →(5) 96 →(4) 100
 * O adversário tira sempre 1 nas jogadas intermediárias (sem atingir escadas
 * que mudem o resultado esperado do teste).
 */
export const WINNING_ROLLS = [3, 5, 2, 5, 4, 4, 5, 4];
export const OPPONENT_ROLL = 1;

/** Intercala as jogadas do vencedor (que começa) com as do adversário. */
export function interleavedWinningSequence(): number[] {
  const sequence: number[] = [];
  WINNING_ROLLS.forEach((roll, index) => {
    sequence.push(roll);
    if (index < WINNING_ROLLS.length - 1) sequence.push(OPPONENT_ROLL);
  });
  return sequence;
}
