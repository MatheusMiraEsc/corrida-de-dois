/** Placar da partida: posição, jogadas, escadas e serpentes de cada jogador. */
import type { RoomPlayer } from "../types/contract";
import { VehicleIcon } from "./VehicleIcon";

interface Props {
  players: RoomPlayer[];
  positions: Record<string, number>;
  currentPlayerId: string | null;
  myId: string | null;
}

export function Scoreboard({ players, positions, currentPlayerId, myId }: Props) {
  const ordered = [...players].sort((a, b) => (a.turnOrder ?? a.seat) - (b.turnOrder ?? b.seat));
  return (
    <section className="scoreboard" aria-label="Placar da partida">
      {ordered.map((player) => {
        const position = positions[player.playerId] ?? player.position;
        const isTurn = currentPlayerId === player.playerId;
        return (
          <article
            key={player.playerId}
            className={`score-card score-card--seat-${player.seat}${isTurn ? " score-card--turn" : ""}`}
          >
            <header className="score-card__header">
              <VehicleIcon vehicle={player.vehicle} className="score-card__vehicle" />
              <div className="score-card__who">
                <strong>
                  {player.name}
                  {player.playerId === myId && <span className="tag">você</span>}
                </strong>
                <span className={`status-dot${player.connected ? " status-dot--on" : ""}`}>
                  {player.connected ? "conectado" : "desconectado"}
                </span>
              </div>
              {player.turnOrder && <span className="score-card__order">{player.turnOrder}º</span>}
            </header>
            <div className="score-card__position">
              <span>casa</span>
              <strong>{position}</strong>
            </div>
            <div className="score-card__progress" aria-hidden="true">
              <span style={{ width: `${position}%` }} />
            </div>
            <dl className="score-card__stats">
              <div>
                <dt>Jogadas</dt>
                <dd>{player.rolls}</dd>
              </div>
              <div>
                <dt>Escadas</dt>
                <dd>{player.laddersClimbed}</dd>
              </div>
              <div>
                <dt>Serpentes</dt>
                <dd>{player.snakesHit}</dd>
              </div>
            </dl>
          </article>
        );
      })}
    </section>
  );
}
