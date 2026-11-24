import { describe, expect, it } from "vitest";
import { BOARD_SIZE, LADDERS, SNAKES, describeBoard } from "../../src/game/board";
import { isValidDiceValue, secureDiceRoller } from "../../src/game/dice";
import { calculateMove } from "../../src/game/rules";

describe("Dado", () => {
  it("sorteia sempre valores inteiros entre 1 e 6 e todos aparecem", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i += 1) {
      const value = secureDiceRoller();
      expect(isValidDiceValue(value)).toBe(true);
      seen.add(value);
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("rejeita valores de dado inválidos", () => {
    for (const invalid of [0, 7, -1, 2.5, Number.NaN]) {
      expect(() => calculateMove(10, invalid)).toThrow(RangeError);
    }
  });
});

describe("Tabuleiro", () => {
  it("usa a distribuição de escadas e serpentes do enunciado", () => {
    expect(LADDERS.map(({ from, to }) => [from, to])).toEqual([
      [4, 14],
      [21, 42],
      [51, 67],
      [71, 91],
    ]);
    expect(SNAKES.map(({ from, to }) => [from, to])).toEqual([
      [17, 7],
      [54, 34],
      [87, 24],
      [98, 79],
    ]);
    expect(describeBoard()).toMatchObject({ size: 100, startPosition: 1 });
  });
});

describe("Movimentação", () => {
  it("avança a quantidade sorteada, registrando cada casa percorrida", () => {
    const move = calculateMove(5, 3);
    expect(move).toMatchObject({ from: 5, landedOn: 8, finalPosition: 8, effect: "MOVE", won: false });
    expect(move.path).toEqual([6, 7, 8]);
  });

  it.each(LADDERS.map((ladder) => [ladder.from, ladder.to]))(
    "sobe a escada da casa %i até a casa %i",
    (base, top) => {
      const move = calculateMove(base - 2, 2);
      expect(move.effect).toBe("LADDER");
      expect(move.landedOn).toBe(base);
      expect(move.finalPosition).toBe(top);
      expect(move.jump).toMatchObject({ from: base, to: top });
    },
  );

  it.each(SNAKES.map((snake) => [snake.from, snake.to]))(
    "desce a serpente da cabeça %i até a cauda %i",
    (head, tail) => {
      const move = calculateMove(head - 1, 1);
      expect(move.effect).toBe("SNAKE");
      expect(move.finalPosition).toBe(tail);
      expect(move.jump).toMatchObject({ from: head, to: tail });
    },
  );

  it("não deixa passar da casa 100: o carrinho fica onde está", () => {
    const move = calculateMove(97, 5);
    expect(move).toMatchObject({ effect: "OVERSHOOT", finalPosition: 97, landedOn: 97, won: false });
    expect(move.path).toEqual([]);
  });

  it("vence ao tirar exatamente o necessário para a casa 100", () => {
    const move = calculateMove(96, 4);
    expect(move).toMatchObject({ finalPosition: BOARD_SIZE, won: true, extraTurn: false });
  });

  it("tirar 6 dá jogada extra, inclusive quando ultrapassa 100 ou cai em serpente", () => {
    expect(calculateMove(10, 6).extraTurn).toBe(true);
    expect(calculateMove(99, 6)).toMatchObject({ effect: "OVERSHOOT", extraTurn: true });
    expect(calculateMove(11, 6)).toMatchObject({ effect: "SNAKE", finalPosition: 7, extraTurn: true });
  });

  it("6 que leva à vitória não dá jogada extra (a partida acabou)", () => {
    expect(calculateMove(94, 6)).toMatchObject({ won: true, extraTurn: false });
  });

  it("valores diferentes de 6 não dão jogada extra", () => {
    for (let dice = 1; dice <= 5; dice += 1) {
      expect(calculateMove(30, dice).extraTurn).toBe(false);
    }
  });
});
