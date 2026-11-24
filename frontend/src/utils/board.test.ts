import { describe, expect, it } from "vitest";
import { squareCenter, squareToGrid, squaresInDisplayOrder } from "./board";

describe("numeração em zigue-zague", () => {
  it("1ª linha (de baixo) tem 1→10 da esquerda para a direita", () => {
    expect(squareToGrid(1)).toEqual({ row: 9, column: 0 });
    expect(squareToGrid(10)).toEqual({ row: 9, column: 9 });
  });

  it("2ª linha tem 20←11 (11 à direita, 20 à esquerda)", () => {
    expect(squareToGrid(11)).toEqual({ row: 8, column: 9 });
    expect(squareToGrid(20)).toEqual({ row: 8, column: 0 });
  });

  it("3ª linha volta a ir da esquerda para a direita (21→30)", () => {
    expect(squareToGrid(21)).toEqual({ row: 7, column: 0 });
    expect(squareToGrid(30)).toEqual({ row: 7, column: 9 });
  });

  it("a casa 100 fica no canto superior esquerdo", () => {
    expect(squareToGrid(100)).toEqual({ row: 0, column: 0 });
  });

  it("a ordem de exibição tem as 100 casas, cada uma uma vez", () => {
    const order = squaresInDisplayOrder();
    expect(order).toHaveLength(100);
    expect(new Set(order).size).toBe(100);
    expect(order.slice(0, 10)).toEqual([100, 99, 98, 97, 96, 95, 94, 93, 92, 91]);
    expect(order.slice(-10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // cada casa aparece na posição que squareToGrid diz
    order.forEach((square, index) => {
      expect(squareToGrid(square)).toEqual({ row: Math.floor(index / 10), column: index % 10 });
    });
  });

  it("calcula o centro da casa em porcentagem", () => {
    expect(squareCenter(1)).toEqual({ x: 5, y: 95 });
    expect(squareCenter(100)).toEqual({ x: 5, y: 5 });
  });
});
