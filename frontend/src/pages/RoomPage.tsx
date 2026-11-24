/**
 * /sala/:code — decide o que mostrar a partir do estado vindo do servidor:
 *  - ainda conectando → carregando;
 *  - não está nesta sala → painel para entrar (link compartilhado);
 *  - sala em espera → LobbyView; partida em andamento/encerrada → GameView.
 */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { AppHeader } from "../components/AppHeader";
import { VehiclePicker } from "../components/VehiclePicker";
import { useGame } from "../contexts/GameContext";
import { useSession } from "../contexts/SessionContext";
import { usePreferredVehicle } from "../hooks/usePreferredVehicle";
import { api } from "../services/api";
import type { RoomInfo } from "../types/contract";
import { errorMessage } from "../utils/errors";
import { GameView } from "./GameView";
import { LobbyView } from "./LobbyView";

export function RoomPage() {
  const code = (useParams().code ?? "").toUpperCase();
  const { player } = useSession();
  const { state } = useGame();

  if (player && !state.identified && state.connection !== "replaced") {
    return (
      <Shell>
        <div className="loading">
          <span className="loading__flag" />
          {state.connection === "reconnecting" ? "Reconectando ao servidor…" : "Conectando ao servidor…"}
        </div>
      </Shell>
    );
  }
  if (state.connection === "replaced") return <Shell><ReplacedPanel /></Shell>;

  const room = state.room;
  if (!player || !room || room.code !== code) {
    return (
      <Shell>
        <JoinPanel code={code} otherRoom={room && room.code !== code ? room.code : null} />
      </Shell>
    );
  }
  return room.status === "WAITING" ? <LobbyView room={room} /> : <GameView room={room} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="page">
      <AppHeader />
      <main className="page__content page__content--narrow">{children}</main>
    </div>
  );
}

function ReplacedPanel() {
  const { actions } = useGame();
  return (
    <section className="panel center-panel">
      <h1 className="panel__title">Jogo aberto em outra janela</h1>
      <p>Você só pode jogar em uma janela por vez. Quer continuar por aqui?</p>
      <button type="button" className="btn btn--primary" onClick={actions.reconnectHere}>
        Jogar nesta janela
      </button>
    </section>
  );
}

/** Painel para quem abriu o link de uma sala em que ainda não está. */
function JoinPanel({ code, otherRoom }: { code: string; otherRoom: string | null }) {
  const { player, ensurePlayer } = useSession();
  const { actions } = useGame();
  const [name, setName] = useState(player?.name ?? "");
  const [vehicle, setVehicle] = usePreferredVehicle();
  const [info, setInfo] = useState<RoomInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .getRoom(code)
      .then(setInfo)
      .catch((err) => setError(errorMessage(err)));
  }, [code]);

  async function join(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await ensurePlayer(name);
      await actions.joinRoom(code, vehicle);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (otherRoom) {
    return (
      <section className="panel center-panel">
        <h1 className="panel__title">Você já está em outra sala</h1>
        <p>
          Sua sala atual é a <strong>{otherRoom}</strong>. Saia dela para entrar na {code}.
        </p>
        <Link className="btn btn--primary" to={`/sala/${otherRoom}`}>
          Voltar para {otherRoom}
        </Link>
      </section>
    );
  }

  return (
    <form className="panel center-panel" onSubmit={join}>
      <p className="eyebrow">Convite para a sala</p>
      <h1 className="room-code room-code--large">{code}</h1>
      {info && (
        <p className="muted">
          {info.players.map((p) => p.name).join(" e ") || "Ninguém"} na sala ·{" "}
          {info.isFull ? "sala cheia" : info.status === "WAITING" ? "esperando piloto" : "partida em andamento"}
        </p>
      )}
      <label className="field">
        <span className="field__label">Seu nome de piloto</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} required />
      </label>
      <div className="field">
        <span className="field__label">Seu veículo</span>
        <VehiclePicker value={vehicle} onChange={setVehicle} seat={2} />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn--primary btn--block" disabled={busy || !name.trim() || info?.isFull}>
        {busy ? "Entrando…" : "Entrar na corrida"}
      </button>
      <Link to="/" className="btn btn--ghost btn--block">
        Voltar ao início
      </Link>
    </form>
  );
}
