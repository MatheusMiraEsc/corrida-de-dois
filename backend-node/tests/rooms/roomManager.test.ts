import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../src/errors/AppError";
import type { GameMatch } from "../../src/game/GameMatch";
import type { Room } from "../../src/rooms/Room";
import { RoomEvent, RoomManager } from "../../src/rooms/RoomManager";
import { interleavedWinningSequence } from "../support/scenarios";

const ANA = { id: "11111111-1111-4111-8111-111111111111", name: "Ana" };
const BIA = { id: "22222222-2222-4222-8222-222222222222", name: "Bia" };
const CAIO = { id: "33333333-3333-4333-8333-333333333333", name: "Caio" };
const GRACE_MS = 60_000;

async function expectAppError(action: () => unknown, code: string) {
  try {
    await action();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    return;
  }
  throw new Error(`Era esperado o erro ${code}`);
}

describe("RoomManager", () => {
  let recorded: GameMatch[];
  let recorderFails: boolean;
  let published: Array<{ room: Room; events: RoomEvent[] }>;
  let manager: RoomManager;

  beforeEach(() => {
    vi.useFakeTimers();
    recorded = [];
    recorderFails = false;
    published = [];
    manager = new RoomManager({
      recorder: {
        recordMatch: async (_code, match) => {
          if (recorderFails) throw new Error("banco fora do ar");
          recorded.push(match);
        },
      },
      diceRoller: () => 1,
      random: () => 0.99, // ordem de turno = ordem dos assentos (Ana começa)
      reconnectGraceMs: GRACE_MS,
    });
    manager.setPublisher((room, events) => published.push({ room, events }));
  });

  afterEach(() => {
    manager.shutdown();
    vi.useRealTimers();
  });

  const eventTypes = () => published.flatMap((p) => p.events.map((e) => e.type));

  function startedRoom(): Room {
    const room = manager.createRoom(ANA, "car");
    manager.joinRoom(room.code, BIA, "bike");
    manager.setReady(ANA.id, true);
    manager.setReady(BIA.id, true);
    manager.startGame(ANA.id);
    return room;
  }

  it("cria sala com código de 6 caracteres e o criador como anfitrião no assento 1", () => {
    const room = manager.createRoom(ANA, "pickup");
    expect(room.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(room.hostId).toBe(ANA.id);
    expect(room.snapshot().players).toEqual([
      expect.objectContaining({ playerId: ANA.id, seat: 1, vehicle: "pickup", isHost: true, position: 1 }),
    ]);
  });

  it("segundo jogador entra pelo código (sem diferenciar maiúsculas)", () => {
    const room = manager.createRoom(ANA, "car");
    manager.joinRoom(room.code.toLowerCase(), BIA, "bike");
    expect(room.seats.map((s) => [s.name, s.seat])).toEqual([
      ["Ana", 1],
      ["Bia", 2],
    ]);
    expect(eventTypes()).toContain("room:player-joined");
  });

  it("bloqueia o terceiro jogador", async () => {
    const room = manager.createRoom(ANA, "car");
    manager.joinRoom(room.code, BIA, "car");
    await expectAppError(() => manager.joinRoom(room.code, CAIO, "car"), "ROOM_FULL");
  });

  it("código inexistente e jogador já em outra sala são recusados", async () => {
    await expectAppError(() => manager.joinRoom("ZZZZZZ", ANA, "car"), "ROOM_NOT_FOUND");
    manager.createRoom(ANA, "car");
    const other = manager.createRoom(BIA, "car");
    await expectAppError(() => manager.joinRoom(other.code, ANA, "car"), "ALREADY_IN_ROOM");
  });

  it("só o anfitrião inicia, e só com os dois prontos", async () => {
    const room = manager.createRoom(ANA, "car");
    await expectAppError(() => manager.startGame(ANA.id), "PLAYERS_NOT_READY");
    manager.joinRoom(room.code, BIA, "car");
    manager.setReady(ANA.id, true);
    await expectAppError(() => manager.startGame(ANA.id), "PLAYERS_NOT_READY");
    manager.setReady(BIA.id, true);
    await expectAppError(() => manager.startGame(BIA.id), "NOT_HOST");
    manager.startGame(ANA.id);
    expect(room.status).toBe("IN_PROGRESS");
    expect(eventTypes()).toContain("game:started");
  });

  it("valida turno e jogadas duplicadas (expectedMoveCount)", async () => {
    startedRoom();
    await expectAppError(() => manager.rollDice(BIA.id, 0), "NOT_YOUR_TURN");
    await manager.rollDice(ANA.id, 0);
    // O mesmo clique repetido (ainda com expectedMoveCount 0) é recusado.
    await expectAppError(() => manager.rollDice(BIA.id, 0), "STALE_ACTION");
    await manager.rollDice(BIA.id, 1);
  });

  it("gera eventos de dado, escada, serpente e troca de turno", async () => {
    const room = startedRoom();
    manager.forceDice(room.code, [3, 1, 3]);
    await manager.rollDice(ANA.id, 0); // 1 → 4 ⇒ 14
    await manager.rollDice(BIA.id, 1);
    await manager.rollDice(ANA.id, 2); // 14 → 17 ⇒ 7
    expect(eventTypes()).toEqual(
      expect.arrayContaining(["game:dice-rolled", "game:ladder-climbed", "game:snake-bitten", "game:turn-changed"]),
    );
    expect(room.snapshot().players.map((p) => p.position)).toEqual([7, 2]);
  });

  it("vitória registra a partida, informa a pontuação e permite jogar novamente", async () => {
    const room = startedRoom();
    const sequence = interleavedWinningSequence();
    manager.forceDice(room.code, sequence);
    for (let i = 0; i < sequence.length; i += 1) {
      await manager.rollDice(room.match!.currentPlayerId!, i);
    }

    expect(room.status).toBe("FINISHED");
    expect(recorded).toHaveLength(1);
    const finished = published.flatMap((p) => p.events).find((e) => e.type === "game:finished")!;
    expect(finished.payload).toMatchObject({
      winnerId: ANA.id,
      recorded: true,
      results: [
        expect.objectContaining({ playerId: ANA.id, result: "WIN", points: 100, name: "Ana" }),
        expect.objectContaining({ playerId: BIA.id, result: "LOSS", points: 20, name: "Bia" }),
      ],
    });
    await expectAppError(() => manager.rollDice(BIA.id, sequence.length), "GAME_NOT_IN_PROGRESS");

    manager.restartGame(BIA.id);
    const snapshot = room.snapshot();
    expect(snapshot).toMatchObject({ status: "IN_PROGRESS", matchNumber: 2, moveCount: 0, history: [] });
    expect(snapshot.players.map((p) => p.position)).toEqual([1, 1]);
  });

  it("não reinicia partida que ainda está em andamento", async () => {
    startedRoom();
    await expectAppError(() => manager.restartGame(ANA.id), "GAME_NOT_FINISHED");
  });

  it("avisa quando o banco falha ao registrar (recorded: false)", async () => {
    const room = startedRoom();
    recorderFails = true;
    const sequence = interleavedWinningSequence();
    manager.forceDice(room.code, sequence);
    for (let i = 0; i < sequence.length; i += 1) await manager.rollDice(room.match!.currentPlayerId!, i);
    const finished = published.flatMap((p) => p.events).find((e) => e.type === "game:finished")!;
    expect(finished.payload).toMatchObject({ recorded: false });
  });

  it("desconexão pausa a partida e a reconexão a retoma", async () => {
    const room = startedRoom();
    manager.handleDisconnect(BIA.id);
    expect(room.paused).toBe(true);
    await expectAppError(() => manager.rollDice(ANA.id, 0), "GAME_PAUSED");

    vi.advanceTimersByTime(GRACE_MS - 1000);
    manager.handleReconnect(BIA.id);
    expect(room.paused).toBe(false);
    await manager.rollDice(ANA.id, 0);
    vi.advanceTimersByTime(5 * GRACE_MS); // o prazo antigo foi cancelado
    expect(room.seats).toHaveLength(2);
    expect(eventTypes()).toEqual(expect.arrayContaining(["room:player-disconnected", "room:player-reconnected"]));
  });

  it("se o prazo de reconexão acaba, a partida é abandonada sem pontos", async () => {
    const room = startedRoom();
    manager.handleDisconnect(BIA.id);
    await vi.advanceTimersByTimeAsync(GRACE_MS);

    expect(room.seats.map((s) => s.playerId)).toEqual([ANA.id]);
    expect(room.status).toBe("WAITING");
    expect(recorded).toHaveLength(1);
    expect(recorded[0].status).toBe("ABANDONED");
    expect(eventTypes()).toEqual(expect.arrayContaining(["game:abandoned", "room:player-left"]));
    expect(manager.findRoomOfPlayer(BIA.id)).toBeUndefined();
  });

  it("anfitrião que sai passa a função para quem ficou; sala vazia é removida", async () => {
    const room = manager.createRoom(ANA, "car");
    manager.joinRoom(room.code, BIA, "car");
    await manager.leaveRoom(ANA.id);
    expect(room.hostId).toBe(BIA.id);
    await manager.leaveRoom(BIA.id);
    expect(manager.getRoom(room.code)).toBeUndefined();
  });
});
