/** RANKING GLOBAL: pódio, demais pilotos e destaque para o jogador atual. */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { AppHeader } from "../components/AppHeader";
import { Podium, RankingTable } from "../components/Ranking";
import { useSession } from "../contexts/SessionContext";
import { api } from "../services/api";
import type { PlayerProfile, RankingResponse } from "../types/contract";
import { errorMessage } from "../utils/errors";
import { formatWinRate } from "../utils/text";

export function RankingPage() {
  const { player } = useSession();
  const [ranking, setRanking] = useState<RankingResponse | null>(null);
  const [me, setMe] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, profile] = await Promise.all([
        api.getRanking(50),
        player ? api.getPlayer(player.id).catch(() => null) : Promise.resolve(null),
      ]);
      setRanking(list);
      setMe(profile);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [player]);

  useEffect(() => {
    void load();
  }, [load]);

  const entries = ranking?.entries ?? [];
  const myId = player?.id ?? null;

  return (
    <div className="page">
      <AppHeader />
      <main className="page__content ranking">
        <header className="ranking__header">
          <div>
            <p className="eyebrow">Todos os pilotos, todas as máquinas</p>
            <h1>Ranking global</h1>
            <p className="muted">Vitória +100 · derrota +20 · desempate por vitórias e aproveitamento.</p>
          </div>
          <button type="button" className="btn btn--secondary" onClick={load} disabled={loading}>
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
        </header>

        {error && <div className="banner banner--danger">{error}</div>}

        {me && me.stats.rank !== null && (
          <div className="ranking__me panel">
            <span>Sua posição</span>
            <strong>{me.stats.rank}º</strong>
            <span>
              {me.stats.points} pts · {me.stats.wins} {me.stats.wins === 1 ? "vitória" : "vitórias"} ·{" "}
              {formatWinRate(me.stats.winRate)}
            </span>
          </div>
        )}

        {!loading && entries.length === 0 && !error ? (
          <section className="panel center-panel">
            <h2 className="panel__title">Nenhuma corrida terminada ainda</h2>
            <p>O ranking aparece assim que a primeira partida chegar à casa 100.</p>
            <Link to="/" className="btn btn--primary">
              Criar uma sala
            </Link>
          </section>
        ) : (
          <>
            <Podium entries={entries.slice(0, 3)} myId={myId} />
            {entries.length > 3 && (
              <section className="panel">
                <RankingTable entries={entries.slice(3)} myId={myId} />
              </section>
            )}
          </>
        )}
        {ranking && <p className="muted ranking__updated">Atualizado em {new Date(ranking.generatedAt).toLocaleString("pt-BR")}</p>}
      </main>
    </div>
  );
}
