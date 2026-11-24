/** Pódio (3 primeiros) e tabela do ranking global. Dados 100% vindos do servidor. */
import type { RankingEntry } from "../types/contract";
import { formatWinRate } from "../utils/text";

export function Podium({ entries, myId }: { entries: RankingEntry[]; myId: string | null }) {
  const [first, second, third] = entries;
  const slots = [
    { entry: second, place: 2 },
    { entry: first, place: 1 },
    { entry: third, place: 3 },
  ];
  return (
    <div className="podium">
      {slots.map(({ entry, place }) => (
        <div key={place} className={`podium__slot podium__slot--${place}${entry?.playerId === myId ? " is-me" : ""}`}>
          {entry ? (
            <>
              <span className="podium__name">{entry.name}</span>
              <span className="podium__points">{entry.points} pts</span>
              <span className="podium__wins">
                {entry.wins} {entry.wins === 1 ? "vitória" : "vitórias"}
              </span>
            </>
          ) : (
            <span className="podium__empty">vaga aberta</span>
          )}
          <div className="podium__block">{place}º</div>
        </div>
      ))}
    </div>
  );
}

export function RankingTable({ entries, myId }: { entries: RankingEntry[]; myId: string | null }) {
  return (
    <div className="table-scroll">
      <table className="ranking-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Piloto</th>
            <th title="Partidas disputadas">Partidas</th>
            <th>Vitórias</th>
            <th>Derrotas</th>
            <th title="Taxa de vitória">Aproveit.</th>
            <th>Pontos</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.playerId} className={entry.playerId === myId ? "is-me" : undefined}>
              <td className="ranking-table__rank">{entry.rank}</td>
              <td>
                {entry.name}
                {entry.playerId === myId && <span className="tag">você</span>}
              </td>
              <td>{entry.gamesPlayed}</td>
              <td>{entry.wins}</td>
              <td>{entry.losses}</td>
              <td>{formatWinRate(entry.winRate)}</td>
              <td className="ranking-table__points">{entry.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
