/**
 * Geometria do tabuleiro — SÓ para desenhar. Nenhuma regra de jogo aqui:
 * quem decide posições, escadas e serpentes é o servidor.
 *
 * Numeração em zigue-zague (de baixo para cima):
 *   linha de baixo: 1 → 10, a de cima: 20 ← 11, depois 21 → 30, e assim por diante.
 */
export const BOARD_COLUMNS = 10;
export const BOARD_ROWS = 10;
export const BOARD_SQUARES = BOARD_COLUMNS * BOARD_ROWS;

export interface GridPosition {
  /** 0 = linha de cima da tela. */
  row: number;
  /** 0 = coluna da esquerda. */
  column: number;
}

export function squareToGrid(square: number): GridPosition {
  const index = square - 1;
  const rowFromBottom = Math.floor(index / BOARD_COLUMNS);
  const offset = index % BOARD_COLUMNS;
  const column = rowFromBottom % 2 === 0 ? offset : BOARD_COLUMNS - 1 - offset;
  return { row: BOARD_ROWS - 1 - rowFromBottom, column };
}

/** Centro da casa em porcentagem do tabuleiro (0–100), usado pelo SVG e pelos carrinhos. */
export function squareCenter(square: number): { x: number; y: number } {
  const { row, column } = squareToGrid(square);
  return { x: (column + 0.5) * (100 / BOARD_COLUMNS), y: (row + 0.5) * (100 / BOARD_ROWS) };
}

/** Casas na ordem em que aparecem na tela (da esquerda p/ direita, de cima p/ baixo). */
export function squaresInDisplayOrder(): number[] {
  const squares: number[] = [];
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    const rowFromBottom = BOARD_ROWS - 1 - row;
    const start = rowFromBottom * BOARD_COLUMNS + 1;
    const line = Array.from({ length: BOARD_COLUMNS }, (_, i) => start + i);
    squares.push(...(rowFromBottom % 2 === 0 ? line : line.reverse()));
  }
  return squares;
}
