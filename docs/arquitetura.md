# Arquitetura

```
           Navegador do jogador 1              Navegador do jogador 2
          ┌────────────────────────┐          ┌────────────────────────┐
          │  Frontend React (SPA)  │          │  Frontend React (SPA)  │
          └───────┬──────────┬─────┘          └─────┬──────────┬───────┘
          HTTP /api│     WebSocket /ws          /ws │          │ /api
                   ▼          ▼                     ▼          ▼
          ┌──────────────────────────────────────────────────────────┐
          │ Backend (Node — ou Java, com o MESMO contrato)           │
          │  regras · salas em memória · validação · ranking         │
          └──────────────────────────┬───────────────────────────────┘
                                     ▼
                         PostgreSQL (jogadores, partidas, ranking)
```

## Princípios
1. **O servidor é a fonte da verdade.** Dado, movimento, turno, vitória e pontos
   são decididos no backend. O frontend envia *pedidos* ("quero lançar o dado") e
   mostra o estado que o servidor devolve.
2. **Estado em memória × persistido.** Salas e partidas em andamento vivem na
   memória do backend (rápidas e efêmeras). Jogadores, partidas encerradas e o
   ranking vão para o PostgreSQL.
3. **Contrato único.** HTTP ([contrato-api.md](contrato-api.md)) e WebSocket
   ([eventos-websocket.md](eventos-websocket.md)) são iguais nos dois backends; o
   frontend escolhe o backend só pela URL.
4. **Simples e didático.** Poucas camadas, cada uma com um papel claro.

## Backend Node (`backend-node/src`)

| Pergunta | Onde |
|---|---|
| Onde estão as regras do jogo? | `game/board.ts`, `game/rules.ts`, `game/GameMatch.ts`, `game/scoring.ts` (funções e classes puras, sem I/O) |
| Onde está o controle dos jogadores e salas? | `rooms/Room.ts` (uma sala: assentos, pronto, permissões) e `rooms/RoomManager.ts` (todas as salas, desconexão/reconexão) |
| Onde acontece a movimentação? | `game/rules.ts → calculateMove()` e `GameMatch.playTurn()` |
| Onde está a comunicação WebSocket? | `ws/protocol.ts` (formato e validação) e `ws/gateway.ts` (conexões, identificação, envio) |
| Onde estão as requisições HTTP? | `routes/index.ts` → `controllers/*.ts` |
| Onde está o acesso ao banco? | `repositories/` (Prisma) — interfaces em `repositories/types.ts` |
| Onde está a lógica do ranking? | `services/rankingService.ts` (leitura), `services/gameRecordService.ts` (gravação), view SQL `player_ranking` (cálculo) |
| Onde está a configuração? | `config/env.ts` (variáveis validadas), `server.ts` (monta tudo) |
| Validação e erros | `schemas/common.ts`, `middlewares/validate.ts`, `errors/AppError.ts` |

Fluxo de um lance:
```
cliente ──game:roll-dice──▶ gateway (valida JSON e payload)
                              └▶ RoomManager.rollDice
                                   └▶ Room.roll (sala, pausa, turno, expectedMoveCount)
                                        └▶ GameMatch.playTurn ─▶ rules.calculateMove
                                   └▶ (se venceu) GameRecordService ─▶ PostgreSQL
                              ◀── eventos + room:state para os 2 jogadores
```

Concorrência: o Node executa uma mensagem por vez; o estado da sala muda de
forma síncrona antes de qualquer `await`, então dois lances simultâneos nunca
são aplicados juntos. O `expectedMoveCount` recusa cliques repetidos.

## Frontend (`frontend/src`)

| Pasta | Papel |
|---|---|
| `pages/` | Telas: `HomePage`, `RoomPage` (decide entre `LobbyView` e `GameView`), `RankingPage` |
| `components/` | Peças reutilizáveis: `GameBoard`, `BoardCell`, `Ladder`, `Snake`, `PlayerCar`, `Dice`, `Scoreboard`, `TurnIndicator`, `GameHistory`, `GameResultModal`, `RulesModal`, `Podium/RankingTable`… |
| `contexts/` | `SessionContext` (identidade salva no navegador), `GameContext` + `gameReducer` (conexão e estado da sala) |
| `hooks/` | `useMoveAnimation` (anima os lances já decididos pelo servidor), `useBoard`, `useCountdown` |
| `services/` | `api.ts` (HTTP) e `gameSocket.ts` (WebSocket com reconexão automática) |
| `utils/` | Geometria do tabuleiro (só para desenhar) e textos |
| `config.ts` | Escolha do backend (URLs) |

Sem manipulação direta do DOM: toda a tela é derivada do estado. A animação usa
estado React + transições CSS; posições dos carrinhos são calculadas em %.

A única leitura de elemento é `document.getElementById("root")` em `main.tsx`,
onde o React é montado.

## Backend Java (`backend-java`) — em desenvolvimento
Mesma organização em pacotes (`game`, `rooms`, `ws`, `controller`, `service`,
`repository`, `entity`, `validation`, `error`, `config`). Compila e responde às
rotas HTTP, mas ainda não tem testes nem passou pela suíte de equivalência — por
isso não faz parte da entrega atual nem do `docker compose`.

## Decisões técnicas
| Decisão | Motivo |
|---|---|
| WebSocket puro + JSON (não Socket.IO) | Mesmo protocolo nos dois backends; ver `eventos-websocket.md`. |
| Ranking como *view* SQL | Um único cálculo, compartilhado pelos backends; impossível dessincronizar. |
| Prisma 6 (não 7/8) | Versão estável com a API clássica; as mais novas mudaram a forma de conexão. |
| Token + hash em vez de login | Identidade persistente sem sistema de contas (limitações em `banco-de-dados.md`). |
| `/config.js` em tempo de execução | A mesma imagem do frontend funciona com qualquer backend. |
| Salas em memória | Simples e rápido para uma instância; limitação documentada em `deploy.md`. |
