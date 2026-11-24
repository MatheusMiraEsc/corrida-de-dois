/**
 * Tela de comemoração: vencedor, resultado final e pontos ganhos.
 * Os pontos vêm do evento game:finished (calculados pelo servidor).
 */
import type { GameFinishedPayload, RoomSnapshot } from "../types/contract";
import { formatDuration } from "../utils/text";
import { Modal } from "./Modal";
import { VehicleIcon } from "./VehicleIcon";

interface Props {
  room: RoomSnapshot;
  finished: GameFinishedPayload | null;
  myId: string | null;
  busy: boolean;
  onPlayAgain: () => void;
  onRanking: () => void;
  onHome: () => void;
  onClose: () => void;
}

const CONFETTI = Array.from({ length: 28 }, (_, i) => i);

export function GameResultModal({ room, finished, myId, busy, onPlayAgain, onRanking, onHome, onClose }: Props) {
  const winner = room.players.find((p) => p.playerId === room.winnerId);
  const iWon = room.winnerId === myId;
  const opponentAway = room.players.length < 2 || room.players.some((p) => !p.connected);
  const ordered = [...room.players].sort((a, b) => (a.playerId === room.winnerId ? -1 : b.playerId === room.winnerId ? 1 : 0));

  return (
    <Modal title="Resultado da corrida" onClose={onClose} className="result">
      <div className="confetti" aria-hidden="true">
        {CONFETTI.map((i) => (
          <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.18}s` }} />
        ))}
      </div>
      <p className="result__kicker">{iWon ? "Você venceu!" : "Fim de corrida"}</p>
      {winner && (
        <div className={`result__winner result__winner--seat-${winner.seat}`}>
          <VehicleIcon vehicle={winner.vehicle} className="result__vehicle" />
          <h2>{winner.name}</h2>
          <p>cruzou a linha de chegada em 1º lugar</p>
        </div>
      )}

      <table className="result__table">
        <thead>
          <tr>
            <th>Piloto</th>
            <th>Casa final</th>
            <th>Jogadas</th>
            <th>Pontos</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((player) => {
            const result = finished?.results.find((r) => r.playerId === player.playerId);
            return (
              <tr key={player.playerId} className={player.playerId === room.winnerId ? "is-winner" : undefined}>
                <td>
                  {player.playerId === room.winnerId ? "🏆 " : ""}
                  {player.name}
                  {player.playerId === myId && <span className="tag">você</span>}
                </td>
                <td>{result?.finalPosition ?? player.position}</td>
                <td>{player.rolls}</td>
                <td className="result__points">{result ? `+${result.points}` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {finished && (
        <p className="result__meta">
          {finished.totalMoves} lances em {formatDuration(finished.durationSeconds)}
          {finished.recorded ? " · resultado salvo no ranking global" : " · não foi possível salvar no ranking"}
        </p>
      )}

      <div className="result__actions">
        <button type="button" className="btn btn--primary" onClick={onPlayAgain} disabled={busy || opponentAway}>
          Jogar novamente
        </button>
        <button type="button" className="btn btn--ghost" onClick={onRanking}>
          Ver ranking
        </button>
        <button type="button" className="btn btn--ghost" onClick={onHome}>
          Início
        </button>
      </div>
      {opponentAway && <p className="result__hint">O outro jogador saiu ou está desconectado.</p>}
    </Modal>
  );
}
