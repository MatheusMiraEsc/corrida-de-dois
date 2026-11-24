# Banco de dados e ranking

PostgreSQL 17. O schema é definido em `backend-node/prisma/schema.prisma` e
criado pelas **migrations** em `backend-node/prisma/migrations/` (SQL puro,
versionado). Elas são a fonte oficial do banco; o backend Java só **confere**
o schema (`ddl-auto=validate`) e nunca o altera.

## Tabelas

```
players                       games                              game_players
─────────────────────         ──────────────────────────         ───────────────────────────
id          uuid  PK          id               uuid  PK          id             uuid  PK
name        varchar(24)       room_code        varchar(6)        game_id        uuid  FK → games (cascade)
token_hash  char(64) UNIQUE   status           FINISHED|ABANDONED player_id     uuid  FK → players
created_at  timestamptz       started_at       timestamptz       turn_order     smallint (1|2)
                              finished_at      timestamptz       final_position smallint (1–100)
                              duration_seconds integer           result         WIN|LOSS|ABANDONED
                              total_moves      integer           points         integer
                              winner_id        uuid FK → players UNIQUE (game_id, player_id)
```

- **players**: um jogador identificado (ver "Identificação" abaixo).
- **games**: uma partida **encerrada**. Partidas em andamento não vão para o banco.
- **game_players**: a participação de cada jogador numa partida e os pontos ganhos.

### Regras garantidas pelo próprio banco (CHECK)
- `status` só pode ser `FINISHED` ou `ABANDONED`; partida `FINISHED` tem vencedor, `ABANDONED` não.
- Pontos coerentes com o resultado: `WIN = 100`, `LOSS = 20`, `ABANDONED = 0`.
- Posição final entre 1 e 100; ordem de turno 1 ou 2; duração e lances ≥ 0.

Assim, mesmo um erro de programação não consegue gravar uma "vitória de 9999 pontos".

## Ranking (`player_ranking`)

O ranking **não é armazenado**: é uma *view* SQL calculada a partir das
partidas `FINISHED`. Vantagens: não há totais para dessincronizar, e não existe
nenhum caminho para alguém "editar a pontuação" sem que exista uma partida real.

| Coluna | Cálculo |
|---|---|
| `games_played` | partidas concluídas |
| `wins` / `losses` | contagem por resultado |
| `points` | soma dos pontos (100 por vitória, 20 por derrota) |
| `win_rate` | `wins / games_played × 100`, uma casa decimal |
| `rank` | posição, pelos critérios abaixo |

**Critérios de ordenação e desempate** (nessa ordem):
1. mais pontos;
2. mais vitórias;
3. maior taxa de vitória;
4. menos partidas;
5. jogador cadastrado há mais tempo;
6. id (só para a ordem ser sempre estável).

Partidas abandonadas ficam registradas em `games` (histórico), mas **não contam**
no ranking.

## Quando os pontos são gravados
Somente o servidor grava, em um único lugar (`GameRecordService`), quando:
- alguém chega à casa 100 → partida `FINISHED` (+100 vencedor, +20 perdedor);
- alguém sai ou não volta a tempo → partida `ABANDONED` (0 pontos).

Partida e participações são gravadas na **mesma transação**.

## Identificação dos jogadores (sem login)
- Ao informar o nome pela primeira vez, o navegador chama `POST /api/players` e
  recebe `id` (UUID) + `token` secreto (32 bytes aleatórios).
- O banco guarda só o **SHA-256** do token. O navegador guarda `{id, name, token}`
  no `localStorage`.
- Toda conexão WebSocket prova a identidade com `session:identify {playerId, token}`.
- Dois jogadores chamados "Ana" têm ids diferentes e aparecem separados no ranking.

**Limitações** (aceitas para esta versão, sem sistema de contas):
- limpar os dados do navegador, usar janela anônima ou outro dispositivo cria um
  **novo** jogador (o histórico antigo continua no ranking, mas não é recuperável);
- não há recuperação de "conta" nem troca de dispositivo;
- o nome exibido no ranking é o atual do jogador.

## Ambientes
| Banco | Uso |
|---|---|
| `corrida_dos_dois` | aplicação (docker compose, `npm run dev`) |
| `corrida_dos_dois_test` | testes automatizados (é **apagado** a cada `npm run test:db`) |

O banco de teste é criado pelo script `database/init/01-create-test-database.sql`
na primeira subida do container do PostgreSQL.

## Comandos úteis
```powershell
cd backend-node
npx prisma migrate deploy          # aplica migrations no DATABASE_URL atual
npx prisma migrate dev --name xxx  # cria uma nova migration (desenvolvimento)
docker compose exec postgres psql -U corrida -d corrida_dos_dois   # console SQL
```
