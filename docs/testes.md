# Testes

| Suíte | Comando | Precisa de | Testes |
|---|---|---|---:|
| Regras, salas e multiplayer (Node) | `cd backend-node; npm test` | nada | 51 |
| Ranking no PostgreSQL real (Node) | `cd backend-node; npm run test:db` | PostgreSQL do compose | 7 |
| Unitários do frontend | `cd frontend; npm test` | nada | 11 |
| Ponta a ponta com 2 navegadores | `cd frontend; npm run test:e2e` | PostgreSQL do compose | 5 |
| Smoke contra ambiente no ar | `cd frontend; $env:E2E_FRONTEND_URL="http://localhost:8081"; npx playwright test smoke` | `docker compose up` | 1 |

Antes do primeiro `test:e2e`, instale o navegador: `npx playwright install chromium`.

## O que cada suíte cobre

### Regras — `backend-node/tests/game`
Dado (sempre 1–6, todas as faces aparecem), movimento com casas percorridas,
cada escada e cada serpente, tentativa de passar de 100, vitória exata,
jogada extra com 6 (inclusive passando de 100 e caindo em serpente), 6 que vence
não dá jogada extra, alternância de turnos, jogada fora da vez, bloqueio após a
vitória, pontuação (+100/+20/0) e sorteio da ordem.

### Salas — `backend-node/tests/rooms`
Criação com código, entrada (sem diferenciar maiúsculas), terceiro jogador
bloqueado, jogador em outra sala, só o anfitrião inicia e só com os dois prontos,
`STALE_ACTION` para jogada duplicada, eventos de escada/serpente/turno, vitória
registrada e revanche, falha do banco (`recorded: false`), pausa na desconexão,
reconexão dentro do prazo, abandono após o prazo, troca de anfitrião.

### Multiplayer — `backend-node/tests/ws`
Servidor HTTP + WebSocket **reais** com clientes independentes: validação do
cadastro, homônimos com ids diferentes, troca de nome só com o próprio token,
rota de teste inexistente quando desabilitada, identificação obrigatória, JSON
inválido, sala cheia, **sincronização de posições e turnos nos dois clientes**,
jogada fora da vez, partida completa até o ranking, revanche, desconexão/pausa,
reconexão, abandono por prazo, conexão substituída (código 4001), saída durante
a partida.

### Ranking — `backend-node/tests/db`
Registro da partida (participantes, duração, vencedor), soma de pontos,
vitórias, derrotas e taxa, partidas abandonadas fora do ranking, **ordenação e
desempates**, homônimos separados, banco recusando pontuação adulterada e
**ranking preservado após reiniciar o servidor** (novo processo/conexão).

### Frontend
- Unitários: numeração em zigue-zague e posição das casas; reducer (snapshots
  atrasados ignorados, saída da sala, aviso de abandono, perda de conexão).
- E2E (Playwright, dois *contextos* de navegador = dois computadores):
  1. partida completa — sala, código, prontos, largada, **posições iguais nos
     dois navegadores após cada lance**, escada, serpente, vitória, +100/+20,
     revanche e ranking;
  2. queda de conexão pausa e a volta retoma;
  3. terceiro piloto recusado;
  4. tabuleiro cabe na tela do celular (390 px).

Os testes E2E e de banco usam o banco **`corrida_dos_dois_test`**, nunca o real.
A rota que fixa valores do dado só existe com `ENABLE_TEST_ENDPOINTS=true`.

## Equivalência entre backends
Planejada para quando o backend Java for retomado: rodar a mesma suíte (HTTP,
erros e sequência de eventos WebSocket) contra os dois servidores, e também o
E2E do frontend com `E2E_BACKEND=external E2E_BACKEND_URL=http://localhost:8080`.
**Ainda não executada.**

## Últimos resultados (24/11/2026)
- Node: 58/58 ✅
- Frontend unitários: 11/11 ✅
- E2E: 5/5 ✅ (com backend Node de teste, incluindo o smoke)
- Smoke contra `docker compose`: 1/1 ✅
