/**
 * Testes de integração do multiplayer: servidor HTTP + WebSocket reais,
 * dois (ou três) clientes independentes, como em computadores diferentes.
 * O banco é substituído por repositórios em memória.
 */
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RunningServer, startServer } from "../../src/server";
import { createInMemoryRepositories } from "../support/inMemoryRepositories";
import { interleavedWinningSequence } from "../support/scenarios";
import { WsTestClient } from "../support/wsTestClient";

interface TestPlayer {
  id: string;
  name: string;
  token: string;
  client: WsTestClient;
}

describe("Multiplayer via WebSocket", () => {
  let running: RunningServer;
  let baseUrl: string;
  let wsUrl: string;
  const clients: WsTestClient[] = [];

  async function boot(options: { graceSeconds?: number; testEndpoints?: boolean } = {}) {
    running = await startServer(
      {
        PORT: 0,
        CORS_ORIGINS: ["http://localhost:5173"],
        RECONNECT_GRACE_SECONDS: options.graceSeconds ?? 60,
        ENABLE_TEST_ENDPOINTS: options.testEndpoints ?? true,
      },
      createInMemoryRepositories(),
    );
    const { port } = running.server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
    wsUrl = `ws://127.0.0.1:${port}/ws`;
  }

  async function http(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  async function connect(): Promise<WsTestClient> {
    const client = await WsTestClient.connect(wsUrl);
    clients.push(client);
    return client;
  }

  async function newPlayer(name: string): Promise<TestPlayer> {
    const created = await http("POST", "/api/players", { name });
    expect(created.status).toBe(201);
    const client = await connect();
    await client.request("session:identify", { playerId: created.body.id, token: created.body.token });
    return { ...created.body, client };
  }

  /** Cria a sala com Ana, Bia entra, os dois ficam prontos e a partida começa. */
  async function startedGame() {
    const ana = await newPlayer("Ana");
    const bia = await newPlayer("Bia");
    await ana.client.request("room:create", { vehicle: "car" });
    const code = ana.client.lastState().code;
    await bia.client.request("room:join", { code, vehicle: "motorcycle" });
    await ana.client.request("room:ready", { ready: true });
    await bia.client.request("room:ready", { ready: true });
    await ana.client.request("game:start");
    const state = ana.client.lastState();
    const first = state.currentPlayerId === ana.id ? ana : bia;
    const second = first === ana ? bia : ana;
    return { ana, bia, code, first, second };
  }

  async function forceDice(code: string, values: number[]) {
    const response = await http("POST", `/api/test/rooms/${code}/dice`, { values });
    expect(response.status).toBe(204);
  }

  beforeEach(async () => {
    await boot();
  });

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.close()));
    await running.stop();
  });

  // ------------------------------------------------------------------ HTTP

  it("HTTP: health, tabuleiro e validação do cadastro de jogador", async () => {
    expect((await http("GET", "/api/health")).body).toEqual({ status: "ok", backend: "node", database: "up" });
    const board = await http("GET", "/api/board");
    expect(board.body.ladders).toHaveLength(4);
    expect(board.body.snakes).toHaveLength(4);

    const invalid = await http("POST", "/api/players", { name: "   " });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");

    const created = await http("POST", "/api/players", { name: "  Ana   Maria " });
    expect(created.body.name).toBe("Ana Maria");
    expect(created.body.token).toEqual(expect.any(String));

    const sameName = await http("POST", "/api/players", { name: "Ana Maria" });
    expect(sameName.body.id).not.toBe(created.body.id); // homônimos são pessoas diferentes

    const profile = await http("GET", `/api/players/${created.body.id}`);
    expect(profile.body).toMatchObject({ name: "Ana Maria", stats: { gamesPlayed: 0, points: 0, rank: null } });
    expect(profile.body).not.toHaveProperty("token");
  });

  it("HTTP: renomear exige o token do próprio jogador", async () => {
    const ana = (await http("POST", "/api/players", { name: "Ana" })).body;
    const bia = (await http("POST", "/api/players", { name: "Bia" })).body;
    expect((await http("PATCH", `/api/players/${ana.id}`, { name: "Aninha" })).status).toBe(401);
    const forbidden = await http("PATCH", `/api/players/${ana.id}`, { name: "X" }, { Authorization: `Bearer ${bia.token}` });
    expect(forbidden.status).toBe(403);
    const ok = await http("PATCH", `/api/players/${ana.id}`, { name: "Aninha" }, { Authorization: `Bearer ${ana.token}` });
    expect(ok.body.name).toBe("Aninha");
  });

  it("HTTP: rota de teste do dado não existe quando desabilitada", async () => {
    await running.stop();
    await boot({ testEndpoints: false });
    const response = await http("POST", "/api/test/rooms/ABCDEF/dice", { values: [1] });
    expect(response.status).toBe(404);
  });

  // ---------------------------------------------------- identificação

  it("exige identificação válida antes de qualquer ação", async () => {
    const client = await connect();
    await expect(client.request("room:create")).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });
    await expect(
      client.request("session:identify", { playerId: "11111111-1111-4111-8111-111111111111", token: "x" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(client.request("session:identify", { playerId: "nao-e-uuid" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("responde erro para JSON inválido e evento desconhecido", async () => {
    const client = await connect();
    client.socket.send("isso não é json");
    expect((await client.waitFor("error")).payload.code).toBe("INVALID_MESSAGE");
    await expect(client.request("game:fly")).rejects.toMatchObject({ code: "UNKNOWN_EVENT" });
  });

  // ------------------------------------------------------------ salas

  it("cria sala, segundo jogador entra, terceiro é bloqueado", async () => {
    const ana = await newPlayer("Ana");
    const bia = await newPlayer("Bia");
    const caio = await newPlayer("Caio");

    await ana.client.request("room:create", { vehicle: "pickup" });
    const code = ana.client.lastState().code;
    expect(code).toMatch(/^[A-Z2-9]{6}$/);

    await bia.client.request("room:join", { code: code.toLowerCase() });
    const joined = await ana.client.waitFor("room:player-joined");
    expect(joined.payload.player).toMatchObject({ name: "Bia", seat: 2 });
    expect(ana.client.lastState().players).toHaveLength(2);

    await expect(caio.client.request("room:join", { code })).rejects.toMatchObject({ code: "ROOM_FULL" });
    await expect(caio.client.request("room:join", { code: "ZZZZZZ" })).rejects.toMatchObject({
      code: "ROOM_NOT_FOUND",
    });

    const publicInfo = await http("GET", `/api/rooms/${code}`);
    expect(publicInfo.body).toMatchObject({ code, status: "WAITING", isFull: true });
    expect(JSON.stringify(publicInfo.body)).not.toContain(ana.id); // não expõe ids
  });

  it("sincroniza posições e turnos entre os dois jogadores", async () => {
    const { ana, bia, code, first, second } = await startedGame();
    const started = ana.client.messages.find((m) => m.type === "game:started")!;
    expect(started.payload.firstPlayerId).toBe(first.id);

    await forceDice(code, [3, 2]);
    await first.client.request("game:roll-dice", { expectedMoveCount: 0 });

    for (const player of [ana, bia]) {
      const rolled = await player.client.waitFor("game:dice-rolled");
      expect(rolled.payload).toMatchObject({ playerId: first.id, dice: 3, from: 1, landedOn: 4, finalPosition: 14 });
      expect((await player.client.waitFor("game:ladder-climbed")).payload.ladder).toMatchObject({ from: 4, to: 14 });
      expect((await player.client.waitFor("game:turn-changed")).payload.currentPlayerId).toBe(second.id);
    }

    // Jogar fora da vez é recusado pelo servidor
    await expect(first.client.request("game:roll-dice", { expectedMoveCount: 1 })).rejects.toMatchObject({
      code: "NOT_YOUR_TURN",
    });
    // Clique duplicado / estado velho
    await expect(second.client.request("game:roll-dice", { expectedMoveCount: 0 })).rejects.toMatchObject({
      code: "STALE_ACTION",
    });

    await second.client.request("game:roll-dice", { expectedMoveCount: 1 });
    await ana.client.waitFor((m) => m.type === "room:state" && m.payload.moveCount === 2);
    await bia.client.waitFor((m) => m.type === "room:state" && m.payload.moveCount === 2);
    const positions = (client: WsTestClient) =>
      Object.fromEntries(client.lastState().players.map((p: any) => [p.playerId, p.position]));
    expect(positions(ana.client)).toEqual({ [first.id]: 14, [second.id]: 3 });
    expect(positions(bia.client)).toEqual(positions(ana.client));
    expect(ana.client.lastState().currentPlayerId).toBe(first.id);
  });

  it("partida completa: vitória, bloqueio pós-vitória, ranking e jogar novamente", async () => {
    const { ana, code, first, second } = await startedGame();
    const sequence = interleavedWinningSequence();
    await forceDice(code, sequence);

    for (let i = 0; i < sequence.length; i += 1) {
      const current = i % 2 === 0 ? first : second;
      await current.client.request("game:roll-dice", { expectedMoveCount: i });
    }

    const finished = await ana.client.waitFor("game:finished");
    expect(finished.payload).toMatchObject({ winnerId: first.id, recorded: true, totalMoves: sequence.length });
    expect(finished.payload.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ playerId: first.id, result: "WIN", points: 100, finalPosition: 100 }),
        expect.objectContaining({ playerId: second.id, result: "LOSS", points: 20 }),
      ]),
    );
    await expect(second.client.request("game:roll-dice", { expectedMoveCount: sequence.length })).rejects.toMatchObject({
      code: "GAME_NOT_IN_PROGRESS",
    });

    const ranking = await http("GET", "/api/ranking");
    expect(ranking.body.entries.map((e: any) => [e.playerId, e.points, e.wins, e.losses])).toEqual([
      [first.id, 100, 1, 0],
      [second.id, 20, 0, 1],
    ]);

    await second.client.request("game:restart");
    await ana.client.waitFor("game:restarted");
    const state = await ana.client.waitFor((m) => m.type === "room:state" && m.payload.matchNumber === 2);
    expect(state.payload).toMatchObject({ status: "IN_PROGRESS", moveCount: 0, history: [], winnerId: null });
    expect(state.payload.players.map((p: any) => p.position)).toEqual([1, 1]);
  });

  // -------------------------------------------------- queda e retorno

  it("desconexão pausa a partida; reconexão devolve o estado e a partida continua", async () => {
    const { first, second, code } = await startedGame();
    await second.client.close();

    const disconnected = await first.client.waitFor("room:player-disconnected");
    expect(disconnected.payload.playerId).toBe(second.id);
    expect(first.client.lastState().paused).toBe(true);
    await expect(first.client.request("game:roll-dice", { expectedMoveCount: 0 })).rejects.toMatchObject({
      code: "GAME_PAUSED",
    });

    const back = await connect();
    await back.request("session:identify", { playerId: second.id, token: second.token });
    const identified = back.messages.find((m) => m.type === "session:identified")!;
    expect(identified.payload.roomCode).toBe(code);
    expect((await back.waitFor("room:state")).payload.status).toBe("IN_PROGRESS");
    await first.client.waitFor("room:player-reconnected");

    await first.client.request("game:roll-dice", { expectedMoveCount: 0 });
    await back.waitFor("game:dice-rolled");
  });

  it("após o prazo de reconexão, a partida é abandonada e o outro jogador é avisado", async () => {
    await running.stop();
    await boot({ graceSeconds: 5 });
    const { first, second } = await startedGame();
    await second.client.close();
    const abandoned = await first.client.waitFor("game:abandoned", undefined, 8000);
    expect(abandoned.payload).toMatchObject({ playerId: second.id, reason: "DISCONNECT_TIMEOUT" });
    expect(first.client.lastState()).toMatchObject({ status: "WAITING" });
  }, 12000);

  it("o mesmo jogador em outra janela substitui a conexão anterior", async () => {
    const ana = await newPlayer("Ana");
    await ana.client.request("room:create");
    const closed = ana.client.waitForClose();

    const second = await connect();
    await second.request("session:identify", { playerId: ana.id, token: ana.token });
    expect(await closed).toBe(4001);
    expect(ana.client.messages.some((m) => m.type === "error" && m.payload.code === "SESSION_REPLACED")).toBe(true);
    expect((await second.waitFor("room:state")).payload.players[0]).toMatchObject({ connected: true });
  });

  it("sair da sala durante a partida a encerra como abandonada", async () => {
    const { first, second } = await startedGame();
    await second.client.request("room:leave");
    expect(second.client.messages.some((m) => m.type === "room:left")).toBe(true);
    const abandoned = await first.client.waitFor("game:abandoned");
    expect(abandoned.payload).toMatchObject({ reason: "LEFT", recorded: true });
    expect((await http("GET", "/api/ranking")).body.entries).toEqual([]);
  });
});
