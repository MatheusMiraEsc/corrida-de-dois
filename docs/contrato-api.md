# Contrato HTTP

Base: `http://<servidor>:<porta>/api`. Todas as respostas são JSON (UTF-8).
Implementação de referência: `backend-node/src/routes/index.ts`.
O backend Java deve responder **exatamente** igual (mesmas rotas, campos,
códigos de status e mensagens).

## Formato de erro

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos.",
    "details": [{ "field": "name", "message": "O nome é obrigatório." }]
  }
}
```

`details` só aparece em erros de validação. `field` é `null` quando o problema é
o valor inteiro (ex.: código da sala na URL, corpo que não é objeto).

| Código | HTTP | Quando |
|---|---:|---|
| `VALIDATION_ERROR` | 400 | Dado inválido, JSON malformado, corpo > 10 KB |
| `UNAUTHORIZED` | 401 | Falta `Authorization: Bearer <token>` ou token inválido |
| `FORBIDDEN` | 403 | Token de outro jogador |
| `NOT_FOUND` | 404 | Rota inexistente (inclusive método não suportado) |
| `PLAYER_NOT_FOUND` | 404 | Jogador não existe (ou id mal formado) |
| `ROOM_NOT_FOUND` | 404 | Sala não existe |
| `RATE_LIMITED` | 429 | Mais de 30 cadastros por minuto do mesmo IP |
| `INTERNAL_ERROR` | 500 | Erro inesperado |

Regras de leitura do corpo (iguais ao `express.json()`): sem `Content-Type:
application/json` ou corpo vazio → tratado como `{}`; JSON que não seja objeto
nem lista → `VALIDATION_ERROR` "JSON inválido.".

## Regras de validação (compartilhadas com o WebSocket)

| Campo | Regra | Mensagem |
|---|---|---|
| `name` | texto; espaços das pontas removidos e espaços repetidos viram um; 1–24 caracteres; letras, números, espaço e `. _ ' -` | "O nome é obrigatório." / "O nome pode ter no máximo 24 caracteres." / "O nome contém caracteres não permitidos." |
| código da sala | texto; maiúsculas/minúsculas aceitas; 6 letras ou números | "O código da sala é obrigatório." / "O código da sala tem 6 letras ou números." |
| `limit` | só dígitos, 1–100 (padrão 50) | "limit deve ser um inteiro entre 1 e 100." |

---

## `GET /api/health`
Situação do servidor e do banco.

`200` → `{ "status": "ok", "backend": "node", "database": "up" }`
`503` → `{ "status": "degraded", "backend": "node", "database": "down" }`

`backend` é `"node"` ou `"java"` — é o único campo que difere entre os dois.

## `GET /api/board`
Configuração do tabuleiro (o frontend desenha a partir daqui).

```json
{
  "size": 100,
  "startPosition": 1,
  "ladders": [{ "id": 1, "from": 4, "to": 14 }, …],
  "snakes": [{ "id": 1, "from": 17, "to": 7 }, …]
}
```

## `POST /api/players`
Cadastra um jogador. **O token aparece só nesta resposta** — o cliente deve guardá-lo.

Corpo: `{ "name": "Ana" }`
`201` → `{ "id": "uuid", "name": "Ana", "token": "…", "createdAt": "2026-11-24T02:26:35.492Z" }`
Erros: `400 VALIDATION_ERROR`, `429 RATE_LIMITED`.

## `GET /api/players/:id`
Perfil público e estatísticas (sem token).

`200` →
```json
{
  "id": "uuid", "name": "Ana", "createdAt": "…",
  "stats": { "rank": 3, "gamesPlayed": 5, "wins": 2, "losses": 3, "points": 260, "winRate": 40 }
}
```
Sem partidas concluídas: `rank: null` e zeros. Erros: `404 PLAYER_NOT_FOUND`.

## `PATCH /api/players/:id`
Troca o nome do próprio jogador.

Cabeçalho: `Authorization: Bearer <token>` · Corpo: `{ "name": "Novo nome" }`
`200` → `{ "id": "uuid", "name": "Novo nome", "createdAt": "…" }`
Ordem das verificações: id (404) → cabeçalho (401) → corpo (400) → jogador existe (404) → token confere (403).

## `GET /api/ranking?limit=50`
Ranking global (só partidas concluídas).

```json
{
  "entries": [
    { "rank": 1, "playerId": "uuid", "name": "Ana", "gamesPlayed": 3,
      "wins": 2, "losses": 1, "points": 220, "winRate": 66.7 }
  ],
  "generatedAt": "2026-11-24T03:00:00.000Z"
}
```
`winRate` é a porcentagem de vitórias com uma casa decimal.

## `GET /api/rooms/:code`
Informações públicas de uma sala (usado pelo link de convite). Não expõe ids.

```json
{ "code": "K7Q2ZP", "status": "WAITING", "isFull": false,
  "players": [{ "name": "Ana", "seat": 1, "vehicle": "car", "connected": true }] }
```
`status`: `WAITING` · `IN_PROGRESS` · `FINISHED`. Erros: `400` (código mal formado), `404 ROOM_NOT_FOUND`.

## `POST /api/test/rooms/:code/dice` (somente testes)
Existe **apenas** com `ENABLE_TEST_ENDPOINTS=true` (o servidor se recusa a subir
com essa opção em produção). Enfileira valores para os próximos lances da sala.

Corpo: `{ "values": [3, 1, 5] }` (1–500 inteiros de 1 a 6) → `204`.
Desabilitado → `404 NOT_FOUND`.

## O que não existe de propósito
Nenhuma rota recebe resultado, posição ou pontuação do cliente. Pontos só entram
no banco quando o próprio servidor encerra uma partida.
