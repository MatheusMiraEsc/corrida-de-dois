/** Mostra de quem é a vez (ou por que a partida está parada). */
import { useCountdown } from "../hooks/useCountdown";
import type { RoomSnapshot } from "../types/contract";
import { playerName } from "../utils/text";

interface Props {
  room: RoomSnapshot;
  myId: string | null;
  animating: boolean;
}

export function TurnIndicator({ room, myId, animating }: Props) {
  const absent = room.players.find((p) => !p.connected) ?? null;
  const remaining = useCountdown(room.paused ? absent?.reconnectDeadline ?? null : null);
  const current = room.players.find((p) => p.playerId === room.currentPlayerId);

  if (room.paused && absent) {
    return (
      <div className="turn-indicator turn-indicator--paused" role="status">
        <span className="turn-indicator__label">Partida pausada</span>
        <strong>Aguardando {absent.name} reconectar{remaining !== null ? ` (${remaining}s)` : ""}</strong>
      </div>
    );
  }
  if (room.status === "FINISHED") {
    return (
      <div className="turn-indicator turn-indicator--finished" role="status">
        <span className="turn-indicator__label">Bandeirada!</span>
        <strong>{playerName(room.players, room.winnerId)} venceu a corrida</strong>
      </div>
    );
  }
  if (!current) return null;
  const mine = current.playerId === myId;
  return (
    <div className={`turn-indicator turn-indicator--seat-${current.seat}${mine ? " turn-indicator--mine" : ""}`} role="status">
      <span className="turn-indicator__label">{animating ? "Em movimento…" : "Vez de"}</span>
      <strong>{mine ? "Sua vez! Lance o dado" : current.name}</strong>
    </div>
  );
}
