/** SALA DE ESPERA: código da sala, jogadores, "pronto" e início da partida. */
import { useState } from "react";
import { useNavigate } from "react-router";
import { AppHeader } from "../components/AppHeader";
import { VehicleIcon } from "../components/VehicleIcon";
import { VehiclePicker } from "../components/VehiclePicker";
import { useGame } from "../contexts/GameContext";
import { useSession } from "../contexts/SessionContext";
import { useCountdown } from "../hooks/useCountdown";
import type { RoomPlayer, RoomSnapshot, Vehicle } from "../types/contract";
import { errorMessage } from "../utils/errors";
import { VEHICLE_LABELS } from "../utils/text";

export function LobbyView({ room }: { room: RoomSnapshot }) {
  const { player } = useSession();
  const { state, actions, clearLobbyNotice } = useGame();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const me = room.players.find((p) => p.playerId === player?.id);
  const isHost = room.hostId === player?.id;
  const bothReady = room.players.length === 2 && room.players.every((p) => p.ready && p.connected);
  const shareLink = `${window.location.origin}/sala/${room.code}`;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(`Copie o link: ${shareLink}`);
    }
  }

  async function leave() {
    await run(actions.leaveRoom);
    navigate("/");
  }

  const seats = [1, 2].map((seat) => room.players.find((p) => p.seat === seat) ?? null);

  return (
    <div className="page">
      <AppHeader />
      <main className="page__content lobby">
        <section className="lobby__invite panel">
          <p className="eyebrow">Código da sala</p>
          <h1 className="room-code room-code--large" aria-label={`Código da sala ${room.code.split("").join(" ")}`}>
            {room.code}
          </h1>
          <p className="muted">Passe o código (ou o link) para o outro piloto entrar pelo computador dele.</p>
          <button type="button" className="btn btn--secondary" onClick={copyInvite}>
            {copied ? "Link copiado!" : "Copiar link de convite"}
          </button>
        </section>

        {state.lobbyNotice && (
          <div className="banner banner--danger">
            {state.lobbyNotice}
            <button type="button" className="banner__close" onClick={clearLobbyNotice} aria-label="Fechar">
              ×
            </button>
          </div>
        )}

        <section className="lobby__grid" aria-label="Pilotos na sala">
          {seats.map((seatPlayer, index) => (
            <SeatCard key={index} seat={index + 1} player={seatPlayer} isMe={seatPlayer?.playerId === player?.id} />
          ))}
        </section>

        {me && (
          <section className="lobby__controls panel">
            <div className="field">
              <span className="field__label">Seu veículo</span>
              <VehiclePicker
                value={me.vehicle}
                seat={me.seat}
                onChange={(vehicle: Vehicle) => run(() => actions.setVehicle(vehicle))}
                disabled={busy}
              />
            </div>
            <div className="lobby__buttons">
              <button
                type="button"
                className={`btn ${me.ready ? "btn--ghost" : "btn--secondary"}`}
                onClick={() => run(() => actions.setReady(!me.ready))}
                disabled={busy}
              >
                {me.ready ? "Não estou pronto" : "Estou pronto!"}
              </button>
              {isHost ? (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => run(actions.startGame)}
                  disabled={busy || !bothReady}
                >
                  Dar a largada
                </button>
              ) : (
                <span className="muted">Quem criou a sala dá a largada.</span>
              )}
              <button type="button" className="btn btn--danger-ghost" onClick={leave} disabled={busy}>
                Sair da sala
              </button>
            </div>
            {isHost && !bothReady && (
              <p className="muted">
                {room.players.length < 2
                  ? "Aguardando o segundo piloto entrar…"
                  : "A largada libera quando os dois estiverem prontos."}
              </p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function SeatCard({ seat, player, isMe }: { seat: number; player: RoomPlayer | null; isMe: boolean }) {
  const remaining = useCountdown(player && !player.connected ? player.reconnectDeadline : null);
  if (!player) {
    return (
      <article className={`seat-card seat-card--seat-${seat} seat-card--empty`}>
        <div className="seat-card__vehicle seat-card__vehicle--empty" />
        <strong>Vaga livre</strong>
        <span className="muted">esperando piloto…</span>
      </article>
    );
  }
  return (
    <article className={`seat-card seat-card--seat-${seat}${player.ready ? " is-ready" : ""}`}>
      <VehicleIcon vehicle={player.vehicle} className="seat-card__vehicle" title={VEHICLE_LABELS[player.vehicle]} />
      <strong>
        {player.name}
        {isMe && <span className="tag">você</span>}
        {player.isHost && <span className="tag tag--host">anfitrião</span>}
      </strong>
      <span className={`status-dot${player.connected ? " status-dot--on" : ""}`}>
        {player.connected ? "conectado" : `desconectado${remaining !== null ? ` · ${remaining}s` : ""}`}
      </span>
      <span className={`ready-badge${player.ready ? " ready-badge--on" : ""}`}>
        {player.ready ? "Pronto" : "Ainda não está pronto"}
      </span>
    </article>
  );
}
