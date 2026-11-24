# Corrida dos Dois — Análise e Planejamento (Fases 1 e 2)

> Documento de trabalho. Ao longo das próximas fases ele será desdobrado nos
> documentos definitivos (`arquitetura.md`, `contrato-api.md`,
> `eventos-websocket.md`, `banco-de-dados.md`, `testes.md`, `deploy.md`).

---

## FASE 1 — Análise do repositório original

### 1.1 O que existe hoje

```
projeto/
├── index.html            tela de configuração (nomes dos 2 jogadores)
├── jogo.html             pista, placar, dado, histórico, modais
├── css/estilo.css        ~900 linhas, tema escuro, variáveis CSS
└── js/
    ├── jogador.js        classe Jogador (nome, id, posicao, pontuacao, numeroDeJogadas)
    ├── carrinho.js       classe Carrinho (translateX proporcional à pista)
    ├── jogo.js           classe Jogo (turno, dado, vitória, reinício)
    ├── configuracao.js   valida nomes e redireciona via querystring
    ├── modal-regras.js   abre/fecha modal de regras
    └── main.js           "cola": DOM, eventos, histórico, lista de eventos
```

Fluxo atual: `index.html` → nomes na URL → `jogo.html` instancia `Jogador` ×2,
`Carrinho` ×2 e `Jogo`; cada clique sorteia o dado **no navegador**, anima o
dado (`animationend`), move o carrinho (`transition` CSS), registra histórico
e evento, verifica vitória (`posicao >= 20`) e troca o turno.

### 1.2 O que será reaproveitado

| Original | Destino na nova versão |
|---|---|
| Separação `Jogador` (estado) × `Carrinho` (visual) × `Jogo` (regras) | Mantida, mas agora com fronteira **servidor × cliente**: estado e regras no backend (`PlayerState`, `GameEngine`), visual no React (`PlayerCar`, `GameBoard`) |
| `Jogo.trocarTurno`, `verificarVencedor`, `reiniciarPartida` | Viram funções puras do motor de regras (Node e Java), agora com escadas, serpentes, chegada exata e jogada extra |
| Animação do dado (giro + faces decorativas + valor real definido antes) | Mesmo conceito no componente `Dice`: as faces durante o giro são decorativas; o valor real vem do servidor |
| Animação do carrinho com `transition` | Mantida; agora o carrinho anda casa a casa pelo tabuleiro (posição em % — sem medir o DOM) |
| Histórico de jogadas (tabela) + "Últimos acontecimentos" (lista) | `GameHistory` (tabela) + feed de eventos/notificações |
| Destaque do jogador da vez (`.vez-atual`) | `TurnIndicator` + destaque no `Scoreboard` |
| Modal de vitória e modal de regras | `GameResultModal` e `RulesModal` |
| Identidade visual: fundo escuro, amarelo-destaque, vermelho (J1) e azul (J2), bandeira quadriculada, carrinhos | Base do novo design system, ampliado com elementos de pista (asfalto, zebras, bandeira de chegada na casa 100) |

### 1.3 Problemas identificados no original

1. **Regras no cliente** — o dado é sorteado no navegador; qualquer um pode alterar o resultado pelo console. Incompatível com multiplayer.
2. **Manipulação direta do DOM** (`getElementById`, `innerHTML`, `insertRow`, `classList`, `addEventListener`) — proibida na Unidade 2.
3. **Vitória com `>=`** — a nova regra exige tirar exatamente o valor para a casa 100.
4. **Início na casa 0 e ordem fixa** — agora começa na casa 1 e a ordem é sorteada.
5. **Nomes pela URL** — sem identificação persistente; nada impede dois jogadores homônimos de se confundirem.
6. **Posicionamento por pixels + listener de `resize`** — frágil; será substituído por coordenadas percentuais calculadas de forma declarativa.
7. **Dependência de CDN** (Font Awesome) — será substituída por ícones SVG próprios (sem dependência externa em tempo de execução).
8. **Comentários de etapas do desenvolvimento** ("será adicionado na Etapa 7") — não serão levados adiante.
9. Arquivo `FLUXO DE CAIXA ALBUQUERQUE.pdf` não rastreado na raiz — não pertence ao projeto; **não será tocado nem commitado**.

**Decisão:** a pasta `projeto/` será preservada como referência histórica
(renomeada para `projeto-original/` com `git mv`, sem perder histórico) e o
README explicará a evolução.

---

## FASE 2 — Planejamento

### 2.1 Arquitetura geral

```
                 ┌───────────────────────────┐
                 │  Frontend React (Vite+TS) │  VITE_API_URL / VITE_WS_URL
                 └──────────┬────────────────┘
             HTTP (REST)    │    WebSocket (JSON)
          ┌─────────────────┴──────────────────┐
          ▼  (um OU outro, escolhido pela URL)  ▼
┌──────────────────────┐          ┌──────────────────────────┐
│ backend-node         │          │ backend-java             │
│ Express + ws + Prisma│          │ Spring Boot + WebSocket  │
│ Zod                  │          │ + JPA + Bean Validation  │
└─────────┬────────────┘          └────────────┬─────────────┘
          └──────────────► PostgreSQL ◄─────────┘
                    (mesmo schema, mesmas regras)
```

- **Servidor é a fonte da verdade**: dado, movimento, turno, vitória, pontuação.
- **Salas e partidas em andamento ficam em memória** do backend ativo (são efêmeras); **jogadores, partidas concluídas e ranking ficam no PostgreSQL**. Limitação documentada: reiniciar o servidor encerra partidas em andamento, mas não afeta o ranking.
- Os dois backends **não rodam ao mesmo tempo para o mesmo frontend**; são alternativas.

### 2.2 Decisão importante: WebSocket puro em vez de Socket.IO

O enunciado sugere Socket.IO, mas também exige que o **mesmo frontend** funcione
com o backend Java alterando só a URL. O Socket.IO usa um protocolo próprio
(Engine.IO) que o Spring WebSocket não fala; as bibliotecas Java que o imitam
(netty-socketio) têm suporte incompleto ao Socket.IO v4 e rodariam fora do
Spring.

**Escolha:** WebSocket padrão (RFC 6455) com mensagens JSON em um envelope único,
implementado com `ws` no Node e `TextWebSocketHandler` no Spring. O cliente
React tem um pequeno serviço com reconexão automática. Isso garante contrato
idêntico, é mais simples de explicar e de testar nos dois backends.

```json
{ "type": "game:roll-dice", "requestId": "c1f…", "payload": { "expectedVersion": 12 } }
```

### 2.3 Estrutura de pastas

```
corrida-de-dois/
├── frontend/                 React + Vite + TypeScript
│   └── src/{components,pages,hooks,services,contexts,styles,utils,types}
├── backend-node/             Node 22 + TypeScript
│   ├── prisma/               schema.prisma + migrations (SQL oficial do banco)
│   └── src/
│       ├── config/           env (validado com Zod), logger
│       ├── game/             ★ REGRAS: board.ts, rules.ts, dice.ts (puras, sem I/O)
│       ├── rooms/            ★ SALAS/JOGADORES: Room, RoomManager (assentos, turnos, reconexão)
│       ├── ws/               ★ WEBSOCKET: gateway, schemas das mensagens, broadcast
│       ├── routes/ + controllers/   ★ HTTP
│       ├── services/         playerService, rankingService, gameRecordService
│       ├── repositories/     ★ BANCO (Prisma)
│       ├── middlewares/      erros, validação, CORS
│       └── errors/           AppError + códigos padronizados
├── backend-java/             Spring Boot 3 + Java 21 + Maven
│   └── src/main/java/br/.../corrida/{config,game,rooms,ws,controller,service,repository,entity,dto,error}
├── contract-tests/           mesma suíte executada contra os dois backends
├── docs/
├── docker-compose.yml
├── .env.example
└── README.md
```

As pastas marcadas com ★ respondem diretamente às perguntas "onde está…?" do
item 14 do enunciado. O Java espelha os mesmos nomes de pacote.

### 2.4 Regras centralizadas (idênticas nos dois backends)

Constantes: 100 casas; escadas `4→14, 21→42, 51→67, 71→91`; serpentes
`17→7, 54→34, 87→24, 98→79`; início na casa 1.

Algoritmo de uma jogada (`applyRoll(state, playerId, dice)`):

1. Rejeita se partida não está `IN_PROGRESS` → `GAME_NOT_IN_PROGRESS`.
2. Rejeita se não é o jogador da vez → `NOT_YOUR_TURN`.
3. Rejeita se `expectedVersion` ≠ versão atual → `STALE_ACTION` (impede clique duplo/jogada duplicada).
4. `alvo = posição + dado`. Se `alvo > 100`: permanece (evento `OVERSHOOT`).
5. Senão percorre casa a casa (`path` para animação); se cair em escada sobe, se cair em serpente desce.
6. Se posição final = 100 → `FINISHED`, vencedor definido, partida persistida.
7. Se dado = 6 e não venceu → **jogada extra** (mesmo jogador). Vale também se o 6 ultrapassou 100 ou caiu numa serpente (regra literal do enunciado; documentada).
8. Caso contrário, troca o turno. `version++`.

O dado usa gerador criptográfico (`crypto.randomInt` / `SecureRandom`). Para
testes, existe uma fila de valores por sala, **disponível somente quando
`ENABLE_TEST_ENDPOINTS=true`** (nunca em produção).

### 2.5 Identificação dos jogadores (sem login)

- `POST /api/players {name}` cria um jogador com `id` (UUID) e devolve um **token secreto** aleatório (256 bits), mostrado uma única vez.
- O banco guarda apenas o **hash SHA-256** do token.
- O frontend guarda `{id, token, name}` no `localStorage`; ao conectar o WebSocket, envia `session:identify {playerId, token}`.
- Dois "Ana" diferentes têm IDs diferentes → nunca se misturam no ranking.
- **Limitações** (documentadas): limpar o navegador ou trocar de dispositivo cria um novo jogador; não há recuperação de conta. É o mínimo viável sem um sistema de autenticação.

### 2.6 Modelo de dados

```
players                      games                           game_players
──────────────               ───────────────────────         ─────────────────────────
id          uuid PK          id            uuid PK           id            uuid PK
name        varchar(24)      room_code     varchar(6)        game_id       uuid FK→games
token_hash  char(64) UNIQUE  status        FINISHED|ABANDONED player_id    uuid FK→players
created_at  timestamptz      started_at    timestamptz       seat          smallint (1|2)
                             finished_at   timestamptz       turn_order    smallint (1|2)
                             winner_id     uuid FK→players   final_position smallint
                             duration_sec  integer           result        WIN|LOSS|ABANDONED
                             total_rolls   integer           points        integer
                                                             UNIQUE(game_id, player_id)
```

- **Ranking não é armazenado**: é calculado por consulta agregada sobre `game_players` de partidas `FINISHED`. Assim é impossível "editar a pontuação" sem que exista uma partida real, e não há totais dessincronizados.
- Pontuação: vitória **+100**, derrota **+20**, abandonada **0** (não conta).
- Ordenação: pontos ↓, vitórias ↓, taxa de vitória ↓, partidas ↑, data de criação ↑ (quem chegou antes).
- **Migrations:** Prisma Migrate (SQL versionado em `backend-node/prisma/migrations`) é a fonte oficial do schema. O backend Java usa JPA com `ddl-auto=validate` (só confere, nunca altera). No Docker Compose um serviço `migrate` aplica as migrations antes de qualquer backend subir.

### 2.7 Contrato HTTP (resumo)

Erros sempre no formato `{ "error": { "code": "…", "message": "…", "details": [...]? } }`.

| Método | Rota | Corpo / Parâmetros | Resposta |
|---|---|---|---|
| GET | `/api/health` | — | `200 {status:"ok", backend:"node"\|"java", database:"up"}` |
| GET | `/api/board` | — | `200 {size:100, ladders:[{from,to}], snakes:[{from,to}]}` |
| POST | `/api/players` | `{name}` (1–24 chars, trim) | `201 {id, name, token, createdAt}` · `400 VALIDATION_ERROR` |
| GET | `/api/players/:id` | — | `200 {id, name, createdAt, stats}` · `404 PLAYER_NOT_FOUND` |
| PATCH | `/api/players/:id` | `Authorization: Bearer <token>`, `{name}` | `200` · `401` · `403` |
| GET | `/api/ranking` | `?limit=1..100` (padrão 50) | `200 {entries:[{rank, playerId, name, gamesPlayed, wins, losses, points, winRate}], generatedAt}` |
| GET | `/api/rooms/:code` | — | `200 {code, status, players:[{name, connected}], isFull}` · `404 ROOM_NOT_FOUND` |
| POST | `/api/test/rooms/:code/dice` | `{values:[1..6]}` | Só com `ENABLE_TEST_ENDPOINTS=true`; caso contrário `404` |

O que **não** existe de propósito: nenhuma rota recebe pontuação ou resultado do cliente.

### 2.8 Contrato WebSocket (resumo)

Envelope: `{type, requestId?, payload}`. Respostas a um pedido ecoam o `requestId`.

**Cliente → servidor**

| Evento | Payload | Observação |
|---|---|---|
| `session:identify` | `{playerId, token}` | Obrigatório antes de qualquer outro; reconecta automaticamente à sala anterior |
| `room:create` | `{}` | Cria sala, criador ocupa assento 1 |
| `room:join` | `{code}` | `ROOM_NOT_FOUND`, `ROOM_FULL`, `ALREADY_IN_ROOM` |
| `room:ready` | `{ready:boolean}` | Sala de espera |
| `room:leave` | `{}` | Sai da sala (se em partida → partida abandonada) |
| `game:start` | `{}` | Só o anfitrião, só com 2 jogadores prontos e conectados |
| `game:roll-dice` | `{expectedVersion}` | Só o jogador da vez |
| `game:restart` | `{}` | Só após `FINISHED`; zera posições/histórico, sorteia nova ordem |

**Servidor → cliente**

| Evento | Quando |
|---|---|
| `session:identified` | Identificação aceita (`{player, roomCode?}`) |
| `room:state` | **Snapshot completo** após qualquer mudança (fonte única para a tela) |
| `room:player-joined` / `room:player-left` | Entrada/saída |
| `room:player-disconnected` / `room:player-reconnected` | Queda e retorno (com prazo de reconexão) |
| `game:started` | Início, com quem começa (sorteio) |
| `game:dice-rolled` | `{playerId, dice, from, path, to, finalPosition, effect, extraTurn, version}` |
| `game:ladder-climbed` / `game:snake-bitten` | Efeitos especiais (histórico/notificação) |
| `game:turn-changed` | Novo jogador da vez |
| `game:finished` | Vencedor, posições finais, pontos ganhos |
| `game:restarted` | Nova partida na mesma sala |
| `error` | `{code, message, requestId?}` |

Sincronização da animação: o snapshot `room:state` traz `version` e `lastMove`.
O frontend enfileira os movimentos e anima casa a casa; o botão do dado só é
habilitado quando a animação local termina **e** o servidor diz que é a vez
daquele jogador. Se o cliente ficar para trás (ex.: reconexão), ele pula direto
para o estado do snapshot.

### 2.9 Desconexões e reconexões

- Queda de conexão → jogador marcado `connected:false`, o adversário é avisado e a partida **pausa** (ninguém joga).
- Prazo de **60 s** (configurável) para voltar: ao reconectar e se identificar, o servidor devolve o snapshot e a partida continua.
- Esgotado o prazo durante a partida → partida `ABANDONED` (registrada, **sem pontos para ninguém**, para não premiar quem derruba a conexão do outro nem punir quedas de rede). Na sala de espera → o assento é liberado.
- Uma segunda aba do mesmo jogador substitui a conexão anterior (que recebe `error SESSION_REPLACED`).

### 2.10 Frontend React

- **Vite + React + TypeScript**, CSS puro com variáveis (sem framework de UI), `react-router-dom` (links compartilháveis `/sala/ABC123`). Nenhuma outra dependência de interface.
- Telas: `HomePage`, `LobbyPage`, `GamePage`, `RankingPage`; modais `RulesModal` e `GameResultModal`.
- Componentes: `GameBoard`, `BoardCell`, `BoardOverlay` (escadas e serpentes em SVG), `PlayerCar`, `Dice`, `Scoreboard`, `TurnIndicator`, `GameHistory`, `EventFeed`, `Podium`, `RankingTable`, `RoomCodeBadge`, `ConnectionStatus`.
- Estado: `SessionContext` (jogador local + token), `GameConnectionContext` (WebSocket + snapshot da sala via `useReducer`), hook `useMoveAnimation` (fila de animação).
- O tabuleiro calcula a posição de cada casa (zigue-zague) **só para desenhar**; nenhuma regra mora no frontend. Escadas e serpentes vêm de `GET /api/board`.
- Alternância de backend: **apenas** `VITE_API_URL` e `VITE_WS_URL`.

### 2.11 Testes previstos

| Camada | Ferramenta | Cobertura |
|---|---|---|
| Regras (Node) | Vitest | dado 1–6, movimento, turnos, 6 = jogada extra, escadas, serpentes, ultrapassar 100, vitória, bloqueio pós-vitória |
| Salas/WebSocket (Node) | Vitest + cliente `ws` | criar/entrar, 3º jogador bloqueado, sincronização posições/turnos, jogar fora da vez, desconexão, reconexão |
| Ranking (Node) | Vitest + PostgreSQL real | registro de partida, pontos, vitórias/derrotas, ordenação, persistência após recriar o servidor |
| Regras/Salas (Java) | JUnit 5 + Spring Boot Test | os mesmos casos |
| **Equivalência** | `contract-tests/` (Vitest) | a mesma suíte rodada com `TARGET=node` e `TARGET=java`, comparando HTTP, códigos de erro e sequência de eventos WebSocket (dados determinísticos pela fila de teste) |

### 2.12 Infraestrutura

`docker-compose.yml` com `postgres` (volume persistente + healthcheck),
`migrate` (one-shot), `backend-node`, `backend-java` e `frontend` (build Vite
servido por Nginx). A escolha do backend é feita por **profiles** do Compose e
pela variável que alimenta o build do frontend, por exemplo:

```bash
docker compose --profile node up --build     # frontend → Node (porta 3000)
docker compose --profile java up --build     # frontend → Java (porta 8080)
```

Deploy: preparado e documentado (serviços com suporte real a WebSocket e
PostgreSQL persistente serão verificados na Fase 6 antes de recomendados). Nada
será dado como publicado sem credenciais e sem publicação efetiva.

---

## Pontos de atenção no ambiente atual

- **Docker Desktop está instalado, mas o daemon não está em execução.** É necessário para o PostgreSQL e para os testes de ranking/equivalência.
- **Não há JDK nem Maven instalados.** O backend Java pode ser compilado e testado dentro de um container `maven:3-eclipse-temurin-21` (sem instalar nada), ou você pode instalar o JDK 21 localmente.
