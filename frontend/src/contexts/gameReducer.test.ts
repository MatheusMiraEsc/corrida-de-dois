import { describe, expect, it } from "vitest";
import type { RoomSnapshot } from "../types/contract";
import { gameReducer, initialGameState } from "./gameReducer";

function snapshot(partial: Partial<RoomSnapshot>): RoomSnapshot {
  return {
    code: "ABC123",
    status: "WAITING",
    version: 1,
    hostId: "a",
    matchNumber: 0,
    paused: false,
    players: [],
    turnOrder: [],
    currentPlayerId: null,
    winnerId: null,
    moveCount: 0,
    lastMove: null,
    history: [],
    startedAt: null,
    finishedAt: null,
    ...partial,
  };
}

const server = (type: string, payload: unknown) => ({ type: "server" as const, message: { type, payload } });

describe("gameReducer", () => {
  it("aplica o snapshot do servidor e ignora snapshots atrasados", () => {
    let state = gameReducer(initialGameState, server("room:state", snapshot({ version: 5 })));
    expect(state.room?.version).toBe(5);
    state = gameReducer(state, server("room:state", snapshot({ version: 3 })));
    expect(state.room?.version).toBe(5);
    state = gameReducer(state, server("room:state", snapshot({ version: 6, status: "IN_PROGRESS" })));
    expect(state.room?.status).toBe("IN_PROGRESS");
  });

  it("sair da sala limpa o estado", () => {
    let state = gameReducer(initialGameState, server("room:state", snapshot({})));
    state = gameReducer(state, server("room:left", { code: "ABC123" }));
    expect(state.room).toBeNull();
  });

  it("partida abandonada vira aviso fixo na sala de espera", () => {
    let state = gameReducer(
      initialGameState,
      server("room:state", snapshot({ players: [{ playerId: "b", name: "Bia" } as never] })),
    );
    state = gameReducer(state, server("game:abandoned", { playerId: "b", reason: "LEFT", recorded: true }));
    expect(state.lobbyNotice).toContain("Bia saiu");
    expect(state.notices).toHaveLength(1);
  });

  it("perder a conexão desfaz a identificação", () => {
    let state = gameReducer(initialGameState, server("session:identified", { roomCode: null }));
    expect(state.identified).toBe(true);
    state = gameReducer(state, { type: "connection", status: "reconnecting" });
    expect(state.identified).toBe(false);
  });

  it("não avisa o próprio jogador sobre a própria reconexão", () => {
    let state = gameReducer(initialGameState, server("session:identified", { player: { id: "a" }, roomCode: "ABC123" }));
    state = gameReducer(state, server("room:player-reconnected", { playerId: "a" }));
    expect(state.notices).toHaveLength(0);
    state = gameReducer(state, server("room:player-reconnected", { playerId: "b" }));
    expect(state.notices).toHaveLength(1);
  });
});
