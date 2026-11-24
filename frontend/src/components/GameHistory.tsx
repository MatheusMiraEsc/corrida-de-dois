/**
 * Histórico de acontecimentos da partida (mais recente no topo). Mostra só as
 * jogadas já animadas, para o texto não "adiantar" o que o tabuleiro mostra.
 */
import type { MoveRecord, RoomPlayer } from "../types/contract";
import { describeMove, playerName } from "../utils/text";

interface Props {
  history: MoveRecord[];
  players: RoomPlayer[];
  shownMoveNumber: number;
}

const ICONS: Record<MoveRecord["effect"], string> = {
  MOVE: "➜",
  LADDER: "▲",
  SNAKE: "▼",
  OVERSHOOT: "■",
};

export function GameHistory({ history, players, shownMoveNumber }: Props) {
  const visible = history.filter((move) => move.moveNumber <= shownMoveNumber).reverse();
  const seatOf = (playerId: string) => players.find((p) => p.playerId === playerId)?.seat ?? 1;

  return (
    <section className="panel history" aria-labelledby="history-title">
      <h2 id="history-title" className="panel__title">
        Histórico
      </h2>
      {visible.length === 0 ? (
        <p className="history__empty">A largada foi dada. Os lances aparecem aqui.</p>
      ) : (
        <ol className="history__list">
          {visible.map((move) => (
            <li key={move.moveNumber} className={`history__item history__item--${move.effect.toLowerCase()}`}>
              <span className={`history__badge history__badge--seat-${seatOf(move.playerId)}`}>{move.dice}</span>
              <span className="history__text">
                <span className="history__icon" aria-hidden="true">
                  {move.won ? "🏁" : ICONS[move.effect]}
                </span>{" "}
                {describeMove(move, playerName(players, move.playerId))}
                {move.extraTurn && <em className="history__extra"> Tirou 6: joga de novo!</em>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
