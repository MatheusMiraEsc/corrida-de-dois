# 🏁 Corrida dos Dois

Corrida de carrinhos em um tabuleiro de **Serpentes e Escadas**, para **dois
jogadores em computadores diferentes**, em tempo real.

Cada piloto escolhe um veículo, entra na mesma sala pelo código e, na sua vez,
lança o dado: escadas levam para cima, serpentes derrubam, e quem chegar
**exatamente** à casa 100 primeiro vence. Os resultados alimentam um **ranking
global** salvo em banco de dados.

> Evolução do projeto da Unidade 1 (HTML/CSS/JS puro), preservado em
> [`projeto-original/`](projeto-original/). Análise e planejamento em
> [`docs/planejamento.md`](docs/planejamento.md).

## Situação

| Parte | Situação |
|---|---|
| Backend Node.js (regras, salas, WebSocket, ranking) | ✅ pronto e testado |
| Frontend React | ✅ pronto e testado (inclusive com 2 navegadores) |
| Docker / Docker Compose | ✅ funcionando (Node + frontend + PostgreSQL) |
| Deploy na nuvem | 🟡 preparado e documentado, **ainda não publicado** |
| Backend Java (Spring Boot) | 🟠 em desenvolvimento (compila; sem testes ainda; fora do compose) |

## Como funciona o jogo
- 100 casas em zigue-zague; escadas 4→14, 21→42, 51→67, 71→91; serpentes 17→7, 54→34, 87→24, 98→79.
- Ordem de largada sorteada; os dois começam na casa 1.
- Tirou 6 → joga de novo. Passou de 100 → fica onde está.
- Vitória +100 pontos, derrota +20 no ranking global.
- Queda de conexão pausa a partida (60 s para voltar); quem sai faz a partida ser abandonada, sem pontos.

Regras completas: [`docs/regras-do-jogo.md`](docs/regras-do-jogo.md).

## Tecnologias
- **Frontend:** React 19, TypeScript, Vite, React Router, CSS puro (sem framework de UI), SVG.
- **Backend:** Node.js 22, TypeScript, Express 5, `ws` (WebSocket), Zod, Prisma 6.
- **Banco:** PostgreSQL 17.
- **Testes:** Vitest, Playwright.
- **Infra:** Docker, Docker Compose, Nginx.
- **Backend alternativo (em andamento):** Java 21, Spring Boot 4, Spring WebSocket, JPA.

## Estrutura

```
corrida-de-dois/
├── frontend/            React (telas, tabuleiro, animações, cliente HTTP/WebSocket)
├── backend-node/        Backend principal: regras, salas, WebSocket, ranking, testes
│   └── prisma/          Schema e migrations do banco (fonte oficial do schema)
├── backend-java/        Backend alternativo em Spring Boot (em andamento)
├── database/init/       Script que cria o banco de testes no PostgreSQL
├── docs/                Documentação
├── projeto-original/    Versão da Unidade 1
├── docker-compose.yml   Ambiente completo
└── render.yaml          Configuração de deploy (Render)
```

Mapa "onde está cada coisa": [`docs/arquitetura.md`](docs/arquitetura.md).

## Pré-requisitos
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (para o banco e/ou tudo).
- [Node.js 22](https://nodejs.org/) (só para rodar sem Docker ou executar os testes).

## Rodar com Docker (mais simples)

```powershell
copy .env.example .env      # e troque POSTGRES_PASSWORD
docker compose up --build
```

- Jogo: <http://localhost:8081>
- Backend: <http://localhost:3000/api/health>

Para parar: `Ctrl+C` ou `docker compose down` (os dados continuam no volume;
`docker compose down -v` apaga também o banco).

## Rodar em modo de desenvolvimento

```powershell
copy .env.example .env
docker compose up -d postgres                 # só o banco

cd backend-node
copy .env.example .env                        # ajuste a senha igual à do .env da raiz
npm install
npx prisma migrate deploy
npm run dev                                   # http://localhost:3000

cd ..\frontend                                # em outro terminal
npm install
npm run dev                                   # http://localhost:5173
```

## Variáveis de ambiente

| Arquivo | Variável | Para quê |
|---|---|---|
| `.env` (raiz) | `POSTGRES_USER/PASSWORD/DB/PORT` | Banco do docker compose (porta padrão 5433) |
| | `CORS_ORIGINS` | De onde o frontend é aberto |
| | `FRONTEND_API_URL`, `FRONTEND_WS_URL` | Backend que o navegador usa |
| `backend-node/.env` | `DATABASE_URL`, `TEST_DATABASE_URL` | Conexões com o banco (app e testes) |
| | `PORT`, `CORS_ORIGINS`, `RECONNECT_GRACE_SECONDS`, `LOG_LEVEL` | Servidor |
| | `ENABLE_TEST_ENDPOINTS` | **Só para testes**; o servidor recusa em produção |
| `frontend/.env` | `VITE_API_URL`, `VITE_WS_URL` | Backend usado no `npm run dev` |

Nenhuma senha fica no código: só nos arquivos `.env`, que não vão para o Git.

## Como escolher o backend
O frontend só conhece **duas URLs**. Nada mais muda:

- Desenvolvimento: `VITE_API_URL` e `VITE_WS_URL` em `frontend/.env`.
- Docker / nuvem: `FRONTEND_API_URL` e `FRONTEND_WS_URL` no `.env` (ou `API_URL`/`WS_URL`
  do container), que geram o `/config.js` na subida — sem rebuild.

Exemplo para o backend Java (quando estiver pronto): `http://localhost:8080` e `ws://localhost:8080/ws`.

## Como testar o multiplayer
1. Abra o jogo em dois navegadores **diferentes** (ou um normal e uma janela anônima —
   cada um precisa da sua própria identidade).
2. No primeiro, informe o nome e clique em **Criar nova sala**; copie o código ou o link.
3. No segundo, informe o nome e o código e clique em **Entrar**.
4. Os dois clicam em **Estou pronto!**; quem criou a sala clica em **Dar a largada**.

Em **outro computador da mesma rede**: use o IP da máquina que roda o servidor nas
URLs (`FRONTEND_API_URL=http://192.168.0.10:3000`, `FRONTEND_WS_URL=ws://192.168.0.10:3000/ws`),
inclua `http://192.168.0.10:8081` em `CORS_ORIGINS` e libere as portas no firewall.

## Ranking
Botão **Ranking** no topo de qualquer tela, ou <http://localhost:8081/ranking>.
Mostra pódio, demais pilotos, partidas, vitórias, derrotas, aproveitamento e
pontos, com destaque para você. Detalhes: [`docs/banco-de-dados.md`](docs/banco-de-dados.md).

## Testes

```powershell
cd backend-node; npm test; npm run test:db       # 58 testes (test:db precisa do PostgreSQL)
cd ..\frontend; npm test                         # 11 testes
npx playwright install chromium                  # só na primeira vez
npm run test:e2e                                 # 2 navegadores jogando de verdade
```

Detalhes e cobertura: [`docs/testes.md`](docs/testes.md).

## Documentação
| Documento | Conteúdo |
|---|---|
| [arquitetura.md](docs/arquitetura.md) | Visão geral, onde está cada coisa, decisões técnicas |
| [regras-do-jogo.md](docs/regras-do-jogo.md) | Regras completas |
| [contrato-api.md](docs/contrato-api.md) | Rotas HTTP, corpos, respostas e erros |
| [eventos-websocket.md](docs/eventos-websocket.md) | Protocolo em tempo real |
| [banco-de-dados.md](docs/banco-de-dados.md) | Tabelas, ranking, identificação dos jogadores |
| [testes.md](docs/testes.md) | Como rodar e o que é testado |
| [deploy.md](docs/deploy.md) | Como publicar na nuvem e limitações |
| [planejamento.md](docs/planejamento.md) | Análise do projeto original e planejamento |
