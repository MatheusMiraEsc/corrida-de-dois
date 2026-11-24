# Deploy na nuvem

> **Situação atual:** o projeto está **preparado** para deploy, mas **ainda não
> foi publicado**. Falta criar as contas e fazer o passo a passo abaixo (exige
> login nos serviços, que só o dono da conta pode fazer).

## O que o jogo precisa de um provedor

| Requisito | Por quê |
|---|---|
| Conexões WebSocket longas | O multiplayer é em tempo real (`/ws`). |
| HTTPS/WSS | Navegadores bloqueiam `ws://` em páginas `https://`. |
| PostgreSQL **persistente** | O ranking não pode sumir. |
| Variáveis de ambiente | URLs, CORS e senha do banco ficam fora do código. |
| **Uma única instância** do backend | As salas ativas ficam na memória do servidor (ver limitações). |

## Opção recomendada (gratuita para demonstração)

| Parte | Serviço | Plano | Observações verificadas (nov/2026) |
|---|---|---|---|
| Banco | **Neon** | Free | PostgreSQL gerenciado, não expira; 1 GB por projeto; o banco "dorme" após 5 min parado e acorda sozinho na próxima conexão. |
| Backend Node | **Render** (Web Service, Docker) | Free | Suporta WebSocket. **Dorme após 15 min sem tráfego** e leva cerca de 1 min para acordar. |
| Frontend | **Render** (Web Service, Docker) | Free | Mesma imagem do `docker compose`; URLs do backend definidas por variável. |

**Não use o PostgreSQL gratuito do Render:** ele expira em 30 dias e é apagado
depois — o ranking seria perdido.

Para uma apresentação, abra o jogo alguns minutos antes para "acordar" o
backend. Um plano pago do Render (ou outro provedor com instância sempre
ligada) remove essa espera.

## Passo a passo

### 1. Banco (Neon)
1. Crie um projeto em <https://neon.com> e copie a *connection string*
   (algo como `postgresql://usuario:senha@ep-xxx.neon.tech/neondb?sslmode=require`).
2. Crie as tabelas a partir do seu computador:
   ```powershell
   cd backend-node
   $env:DATABASE_URL="<connection string do Neon>"; npx prisma migrate deploy; Remove-Item Env:DATABASE_URL
   ```

### 2. Backend e frontend (Render)
1. No Render, **New → Blueprint** e escolha este repositório. O arquivo
   [`render.yaml`](../render.yaml) cria os dois serviços.
2. Preencha as variáveis pedidas:
   - `corrida-backend-node`
     - `DATABASE_URL` = connection string do Neon
     - `CORS_ORIGINS` = URL do frontend no Render (ex.: `https://corrida-frontend.onrender.com`)
   - `corrida-frontend`
     - `API_URL` = URL do backend (ex.: `https://corrida-backend-node.onrender.com`)
     - `WS_URL` = mesma URL com `wss://` e `/ws` no final
3. Aguarde os dois serviços ficarem "Live" e confira
   `https://<backend>/api/health` → `{"status":"ok",...,"database":"up"}`.
4. Teste com dois dispositivos diferentes (ex.: computador e celular no 4G).

Como as URLs só são conhecidas depois de criar os serviços, talvez seja preciso
ajustar `CORS_ORIGINS`, `API_URL` e `WS_URL` e reiniciar os serviços uma vez.

### 3. Conferir com o teste automatizado
```powershell
cd frontend
$env:E2E_FRONTEND_URL="https://<frontend>"; npx playwright test smoke; Remove-Item Env:E2E_FRONTEND_URL
```

## Alternativas
- **Uma máquina virtual com Docker** (qualquer provedor): `docker compose up -d --build`
  já sobe tudo; coloque um proxy com HTTPS (ex.: Caddy) na frente das portas 3000 e 8081.
- **Outros PaaS** (Railway, Fly.io, Koyeb…): servem desde que aceitem imagem Docker,
  WebSocket e variáveis de ambiente. Os planos e limites mudam com frequência —
  confira a página de preços antes de escolher.

## Reconexão em produção
O frontend reconecta sozinho (1 s, 2 s, 4 s… até 10 s) e se identifica de novo
com o token salvo; o servidor devolve o estado da sala. Se o backend for
reiniciado (deploy ou "sono" do plano gratuito), **as salas em andamento são
perdidas** (ficam em memória), mas jogadores e ranking continuam no banco.

## Limitações conhecidas
- Salas ativas vivem na memória de **uma** instância. Escalar para várias
  instâncias exigiria guardar as salas em um armazenamento compartilhado
  (ex.: Redis) e distribuir os eventos entre instâncias.
- O limite de requisições por IP também é em memória (por instância).
