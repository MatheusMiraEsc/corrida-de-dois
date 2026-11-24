# Contrato WebSocket

Endereço: `ws://<servidor>:<porta>/ws` (em produção, `wss://`).
Implementação de referência: `backend-node/src/ws/` (gateway e protocolo).

## Por que WebSocket puro e não Socket.IO
O enunciado sugeria Socket.IO, mas o **mesmo frontend** precisa funcionar com o
backend Java mudando só a URL. O Socket.IO usa um protocolo próprio que o
Spring não implementa. Com WebSocket padrão + JSON, os dois backends falam
exatamente o mesmo protocolo.

## Envelope

Toda mensagem, nos dois sentidos:

```json
{ "type": "game:roll-dice", "requestId": "c1f0…", "payload": { "expectedMoveCount": 4 } }
```

- `type`: nome do evento (1–64 caracteres).
- `requestId` (opcional, 1–64 caracteres): se o cliente enviar, o servidor
  responde com **`ack`** (sucesso) ou **`error`** com o mesmo `requestId`.
- `payload`: objeto. Ausente ou `null` vale como `{}`.

## Regras gerais
1. A primeira ação precisa ser `session:identify`; antes disso, qualquer outra
   ação recebe `NOT_AUTHENTICATED`.
2. O servidor é a fonte da verdade. Depois de **qualquer** mudança, todos os
   jogadores conectados na sala recebem os eventos específicos e, por último,
   um `room:state` com o estado completo.
3. Limites: mensagem de até 16 KB (acima disso a conexão é fechada, código 1009);
   até 20 mensagens por segundo por conexão (`RATE_LIMITED`); ping a cada 30 s
   (conexões que não respondem são encerradas).
4. Mensagem que não é JSON, ou sem `type` válido → `error INVALID_MESSAGE`.
   `type` desconhecido → `error UNKNOWN_EVENT`.

---

## Cliente → servidor

| Evento | Payload | Efeito / erros possíveis |
|---|---|---|
| `session:identify` | `{ playerId, token }` | Identifica a conexão. `UNAUTHORIZED`, `FORBIDDEN` (conexão já identificada com outro jogador). Se o jogador já tinha conexão aberta, a antiga recebe `error SESSION_REPLACED` e é fechada com código **4001**. |
| `room:create` | `{ vehicle? }` | Cria sala; criador no assento 1 e anfitrião. `ALREADY_IN_ROOM`. |
| `room:join` | `{ code, vehicle? }` | Entra na sala. `ROOM_NOT_FOUND`, `ROOM_FULL`, `ALREADY_IN_ROOM`, `GAME_ALREADY_STARTED`. Entrar de novo na própria sala não é erro. |
| `room:leave` | `{}` | Sai da sala; responde `room:left`. Se havia partida em andamento, ela é **abandonada**. `NOT_IN_ROOM`. |
| `room:ready` | `{ ready: boolean }` | Marca pronto/não pronto (só na espera). `GAME_ALREADY_STARTED`, `NOT_IN_ROOM`. |
| `room:set-vehicle` | `{ vehicle }` | Troca o veículo (só na espera). |
| `game:start` | `{}` | Só o anfitrião (`NOT_HOST`), com 2 jogadores conectados e prontos (`PLAYERS_NOT_READY`). Sorteia a ordem. |
| `game:roll-dice` | `{ expectedMoveCount }` | Lança o dado. Verificações **nesta ordem**: `NOT_IN_ROOM` → `GAME_NOT_IN_PROGRESS` → `GAME_PAUSED` → `NOT_YOUR_TURN` → `STALE_ACTION`. |
| `game:restart` | `{}` | "Jogar novamente" após o fim: posições na casa 1, histórico vazio, nova ordem sorteada. `GAME_NOT_FINISHED`, `PLAYERS_NOT_READY`. |

`vehicle`: `"car"` · `"pickup"` · `"motorcycle"` · `"bike"` (padrão `"car"`).

`expectedMoveCount` é o `moveCount` do último `room:state` que o cliente viu.
Se outra jogada já foi processada (clique duplo, mensagem atrasada), o servidor
recusa com `STALE_ACTION` — **nenhuma jogada é aplicada duas vezes**.

Mensagens de validação dos campos: ver tabela em [contrato-api.md](contrato-api.md).
Campos inválidos geram `error VALIDATION_ERROR` com `details`.

---

## Servidor → cliente

| Evento | Payload | Quando |
|---|---|---|
| `ack` | `{ type }` | Resposta de sucesso a um pedido com `requestId`. |
| `error` | `{ code, message, details? }` | Ação recusada (com `requestId`, se o pedido tinha). |
| `session:identified` | `{ player: { id, name }, roomCode }` | Identificação aceita. `roomCode` ≠ `null` → o jogador já estava numa sala (reconexão) e um `room:state` vem em seguida. |
| `room:state` | *snapshot* (abaixo) | Após toda mudança na sala. |
| `room:left` | `{ code }` | Só para quem saiu. |
| `room:player-joined` | `{ player }` (formato de `players[]`) | Alguém entrou. |
| `room:player-left` | `{ playerId, reason: "LEFT" \| "DISCONNECT_TIMEOUT", hostId }` | Alguém saiu (ou não voltou a tempo). |
| `room:player-disconnected` | `{ playerId, reconnectDeadline }` | Conexão caiu; partida pausa até o prazo (ISO). |
| `room:player-reconnected` | `{ playerId }` | Voltou dentro do prazo. |
| `game:started` | `{ matchNumber, turnOrder, firstPlayerId }` | Largada (também após o reinício). |
| `game:restarted` | `{ matchNumber, requestedBy }` | "Jogar novamente". |
| `game:dice-rolled` | *MoveRecord* (abaixo) | Cada lance. |
| `game:ladder-climbed` | `{ playerId, moveNumber, ladder: { id, from, to } }` | Parou na base de uma escada. |
| `game:snake-bitten` | `{ playerId, moveNumber, snake: { id, from, to } }` | Parou na cabeça de uma serpente. |
| `game:turn-changed` | `{ currentPlayerId, previousPlayerId, extraTurn }` | Após lance sem vitória (`extraTurn: true` = mesmo jogador de novo). |
| `game:finished` | `{ matchNumber, winnerId, totalMoves, durationSeconds, results[], recorded }` | Alguém chegou à casa 100. `results[]`: `{ playerId, name, turnOrder, finalPosition, result: "WIN"\|"LOSS", points }`. `recorded` diz se foi salvo no banco. |
| `game:abandoned` | `{ playerId, reason, recorded }` | Partida encerrada sem vencedor (ninguém pontua). |

Ordem num lance: `game:dice-rolled` → (`game:ladder-climbed` \| `game:snake-bitten`) →
(`game:finished` \| `game:turn-changed`) → `room:state`.

### MoveRecord
```json
{
  "moveNumber": 5, "playerId": "uuid", "dice": 3, "from": 1,
  "path": [2, 3, 4], "landedOn": 4, "finalPosition": 14,
  "effect": "LADDER", "jump": { "id": 1, "from": 4, "to": 14 },
  "won": false, "extraTurn": false, "nextPlayerId": "uuid-do-outro",
  "at": "2026-11-24T03:00:00.000Z"
}
```
`effect`: `MOVE` · `LADDER` · `SNAKE` · `OVERSHOOT` (passaria de 100: `path` vazio
e posição mantida). `path` é usado pelo frontend para animar casa a casa.

### Snapshot (`room:state`)
```json
{
  "code": "K7Q2ZP", "status": "IN_PROGRESS", "version": 12, "hostId": "uuid",
  "matchNumber": 1, "paused": false,
  "players": [{
    "playerId": "uuid", "name": "Ana", "seat": 1, "vehicle": "pickup",
    "ready": true, "connected": true, "reconnectDeadline": null, "isHost": true,
    "turnOrder": 2, "position": 14, "rolls": 3, "laddersClimbed": 1, "snakesHit": 0
  }],
  "turnOrder": ["uuid-bia", "uuid-ana"], "currentPlayerId": "uuid-bia",
  "winnerId": null, "moveCount": 5, "lastMove": { …MoveRecord },
  "history": [ …até 50 MoveRecords ], "startedAt": "…", "finishedAt": null
}
```
- `version` cresce a cada mudança; o cliente ignora snapshots com versão menor.
- `paused: true` quando a partida está em andamento e alguém está desconectado.
- Datas sempre no formato `AAAA-MM-DDTHH:mm:ss.sssZ`.

## Desconexão e reconexão
1. Conexão cai → `room:player-disconnected` para o outro jogador; partida pausa.
2. O jogador tem `RECONNECT_GRACE_SECONDS` (padrão 60) para abrir nova conexão
   e enviar `session:identify` com o mesmo id/token. Ele recebe
   `session:identified` + `room:state` e o outro recebe `room:player-reconnected`.
3. Prazo esgotado → durante a partida: `game:abandoned` (sem pontos) e
   `room:player-left`; na espera: só `room:player-left`.
