import { describe, expect, it } from "vitest";
import { AppError } from "../../src/errors/AppError";
import { GameMatch, drawTurnOrder } from "../../src/game/GameMatch";
import { summarizeMatch } from "../../src/game/scoring";
import { interleavedWinningSequence } from "../support/scenarios";

const NOW = new Date("2026-01-01T10:00:00Z");

function expectAppError(action: () => unknown, code: string) {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    return;
  }
  throw new Error(`Era esperado o erro ${code}`);
}

describe("Partida (turnos e vitória)", () => {
  it("os dois jogadores começam na casa 1 e o primeiro da ordem joga", () => {
    const match = new GameMatch(["ana", "bia"], NOW);
    expect(match.players.map((p) => p.position)).toEqual([1, 1]);
    expect(match.currentPlayerId).toBe("ana");
  });

  it("alterna o turno quando não há jogada extra", () => {
    const match = new GameMatch(["ana", "bia"], NOW);
    match.playTurn("ana", 2, NOW);
    expect(match.currentPlayerId).toBe("bia");
    match.playTurn("bia", 5, NOW);
    expect(match.currentPlayerId).toBe("ana");
  });

  it("tirar 6 mantém a vez com o mesmo jogador", () => {
    const match = new GameMatch(["ana", "bia"], NOW);
    const move = match.playTurn("ana", 6, NOW);
    expect(move.extraTurn).toBe(true);
    expect(move.nextPlayerId).toBe("ana");
    expect(match.currentPlayerId).toBe("ana");
  });

  it("recusa jogada fora da vez", () => {
    const match = new GameMatch(["ana", "bia"], NOW);
    expectAppError(() => match.playTurn("bia", 3, NOW), "NOT_YOUR_TURN");
  });

  it("conta escadas e serpentes de cada jogador", () => {
    const match = new GameMatch(["ana", "bia"], NOW);
    match.playTurn("ana", 3, NOW); // 1 → 4 ⇒ 14
    match.playTurn("bia", 1, NOW);
    match.playTurn("ana", 3, NOW); // 14 → 17 ⇒ 7
    const ana = match.findPlayer("ana")!;
    expect(ana).toMatchObject({ position: 7, laddersClimbed: 1, snakesHit: 1, rolls: 2 });
  });

  it("encerra a partida na casa 100 e bloqueia novas jogadas", () => {
    const match = new GameMatch(["ana", "bia"], NOW);
    const sequence = interleavedWinningSequence();
    sequence.forEach((dice) => match.playTurn(match.currentPlayerId!, dice, NOW));

    expect(match.status).toBe("FINISHED");
    expect(match.winnerId).toBe("ana");
    expect(match.findPlayer("ana")!.position).toBe(100);
    expect(match.currentPlayerId).toBeNull();
    expect(match.history).toHaveLength(sequence.length);

    expectAppError(() => match.playTurn("bia", 1, NOW), "GAME_NOT_IN_PROGRESS");
    expectAppError(() => match.playTurn("ana", 1, NOW), "GAME_NOT_IN_PROGRESS");
  });

  it("calcula a pontuação: vencedor +100, perdedor +20", () => {
    const match = new GameMatch(["ana", "bia"], NOW);
    interleavedWinningSequence().forEach((dice) => match.playTurn(match.currentPlayerId!, dice, NOW));
    expect(summarizeMatch(match)).toEqual([
      { playerId: "ana", turnOrder: 1, finalPosition: 100, result: "WIN", points: 100 },
      expect.objectContaining({ playerId: "bia", turnOrder: 2, result: "LOSS", points: 20 }),
    ]);
  });

  it("partida abandonada não dá pontos a ninguém", () => {
    const match = new GameMatch(["ana", "bia"], NOW);
    match.playTurn("ana", 2, NOW);
    match.abandon(NOW);
    expect(match.status).toBe("ABANDONED");
    expect(summarizeMatch(match).map((r) => [r.result, r.points])).toEqual([
      ["ABANDONED", 0],
      ["ABANDONED", 0],
    ]);
  });
});

describe("Sorteio da ordem", () => {
  it("produz as duas ordens possíveis conforme o valor aleatório", () => {
    expect(drawTurnOrder(["ana", "bia"], () => 0)).toEqual(["bia", "ana"]);
    expect(drawTurnOrder(["ana", "bia"], () => 0.99)).toEqual(["ana", "bia"]);
  });
});
