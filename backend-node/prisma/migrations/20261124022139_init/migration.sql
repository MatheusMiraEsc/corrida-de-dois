-- CreateTable
CREATE TABLE "players" (
    "id" UUID NOT NULL,
    "name" VARCHAR(24) NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" UUID NOT NULL,
    "room_code" VARCHAR(6) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "finished_at" TIMESTAMPTZ(3) NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "total_moves" INTEGER NOT NULL,
    "winner_id" UUID,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_players" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "turn_order" SMALLINT NOT NULL,
    "final_position" SMALLINT NOT NULL,
    "result" VARCHAR(16) NOT NULL,
    "points" INTEGER NOT NULL,

    CONSTRAINT "game_players_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "players_token_hash_key" ON "players"("token_hash");

-- CreateIndex
CREATE INDEX "games_finished_at_idx" ON "games"("finished_at");

-- CreateIndex
CREATE INDEX "game_players_player_id_idx" ON "game_players"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_players_game_id_player_id_key" ON "game_players"("game_id", "player_id");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Regras de integridade (não expressáveis no schema.prisma)
-- ---------------------------------------------------------------------------
ALTER TABLE "games" ADD CONSTRAINT "games_status_check"
    CHECK ("status" IN ('FINISHED', 'ABANDONED'));
ALTER TABLE "games" ADD CONSTRAINT "games_winner_matches_status_check"
    CHECK (("status" = 'FINISHED' AND "winner_id" IS NOT NULL) OR ("status" = 'ABANDONED' AND "winner_id" IS NULL));
ALTER TABLE "games" ADD CONSTRAINT "games_duration_check" CHECK ("duration_seconds" >= 0 AND "total_moves" >= 0);
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_result_check"
    CHECK ("result" IN ('WIN', 'LOSS', 'ABANDONED'));
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_points_check"
    CHECK (("result" = 'WIN' AND "points" = 100) OR ("result" = 'LOSS' AND "points" = 20) OR ("result" = 'ABANDONED' AND "points" = 0));
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_position_check"
    CHECK ("final_position" BETWEEN 1 AND 100 AND "turn_order" IN (1, 2));

-- ---------------------------------------------------------------------------
-- RANKING GLOBAL — definido uma única vez, aqui, e usado pelos dois backends.
-- Só partidas FINISHED contam. Critérios de desempate, nesta ordem:
--   1. mais pontos  2. mais vitórias  3. maior taxa de vitória
--   4. menos partidas  5. jogador mais antigo  6. id (garante ordem estável)
-- ---------------------------------------------------------------------------
CREATE VIEW "player_ranking" AS
WITH stats AS (
    SELECT p."id"         AS player_id,
           p."name"       AS name,
           p."created_at" AS created_at,
           COUNT(*)::int                                     AS games_played,
           COUNT(*) FILTER (WHERE gp."result" = 'WIN')::int  AS wins,
           COUNT(*) FILTER (WHERE gp."result" = 'LOSS')::int AS losses,
           SUM(gp."points")::int                             AS points
    FROM "players" p
    JOIN "game_players" gp ON gp."player_id" = p."id"
    JOIN "games" g ON g."id" = gp."game_id" AND g."status" = 'FINISHED'
    GROUP BY p."id", p."name", p."created_at"
)
SELECT ROW_NUMBER() OVER (
           ORDER BY points DESC, wins DESC, (wins::numeric / games_played) DESC,
                    games_played ASC, created_at ASC, player_id ASC
       )::int AS rank,
       player_id,
       name,
       games_played,
       wins,
       losses,
       points,
       ROUND(wins * 100.0 / games_played, 1)::float8 AS win_rate
FROM stats;
