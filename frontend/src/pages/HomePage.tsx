/** TELA INICIAL: nome, veículo, criar sala ou entrar com código. */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Brand } from "../components/Brand";
import { RulesModal } from "../components/RulesModal";
import { VehiclePicker } from "../components/VehiclePicker";
import { useGame } from "../contexts/GameContext";
import { normalizeName, useSession } from "../contexts/SessionContext";
import { usePreferredVehicle } from "../hooks/usePreferredVehicle";
import { errorMessage } from "../utils/errors";

export function HomePage() {
  const { player, ensurePlayer } = useSession();
  const { state, actions } = useGame();
  const navigate = useNavigate();
  const [name, setName] = useState(player?.name ?? "");
  const [code, setCode] = useState("");
  const [vehicle, setVehicle] = usePreferredVehicle();
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [goToRoom, setGoToRoom] = useState(false);

  // Depois de criar a sala, navega assim que o snapshot dela chegar.
  useEffect(() => {
    if (goToRoom && state.room) navigate(`/sala/${state.room.code}`);
  }, [goToRoom, state.room, navigate]);

  function validateName(): boolean {
    if (!normalizeName(name)) {
      setError("Digite seu nome de piloto.");
      return false;
    }
    return true;
  }

  async function createRoom() {
    if (!validateName()) return;
    setBusy("create");
    setError(null);
    try {
      await ensurePlayer(name);
      await actions.createRoom(vehicle);
      setGoToRoom(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    if (!validateName()) return;
    const roomCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
      setError("O código da sala tem 6 letras ou números.");
      return;
    }
    setBusy("join");
    setError(null);
    try {
      await ensurePlayer(name);
      await actions.joinRoom(roomCode, vehicle);
      navigate(`/sala/${roomCode}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="home">
      <section className="home__hero">
        <Brand size="large" />
        <p className="home__tagline">
          Corrida de carrinhos num tabuleiro de 100 casas. Suba nas <span className="text-ladder">escadas</span>, fuja
          das <span className="text-snake">serpentes</span> e cruze a chegada primeiro — cada piloto no seu computador.
        </p>
        <div className="home__links">
          <button type="button" className="btn btn--ghost" onClick={() => setShowRules(true)}>
            Como jogar
          </button>
          <Link to="/ranking" className="btn btn--ghost">
            Ranking global
          </Link>
        </div>
        <div className="home__track" aria-hidden="true">
          <span className="home__track-car home__track-car--1" />
          <span className="home__track-car home__track-car--2" />
        </div>
      </section>

      <section className="home__card panel">
        {state.room && (
          <div className="banner banner--info">
            Você está na sala <strong>{state.room.code}</strong>.{" "}
            <Link to={`/sala/${state.room.code}`}>Voltar para a sala</Link>
          </div>
        )}

        <label className="field">
          <span className="field__label">Seu nome de piloto</span>
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={24}
            placeholder="Ex.: Ana Veloz"
            autoComplete="nickname"
          />
        </label>

        <div className="field">
          <span className="field__label">Seu veículo</span>
          <VehiclePicker value={vehicle} onChange={setVehicle} />
        </div>

        <button type="button" className="btn btn--primary btn--block" onClick={createRoom} disabled={busy !== null}>
          {busy === "create" ? "Criando sala…" : "Criar nova sala"}
        </button>

        <div className="divider">
          <span>ou entre em uma sala</span>
        </div>

        <form className="join-form" onSubmit={joinRoom}>
          <input
            className="input input--code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            maxLength={6}
            placeholder="CÓDIGO"
            aria-label="Código da sala"
            autoCapitalize="characters"
          />
          <button type="submit" className="btn btn--secondary" disabled={busy !== null}>
            {busy === "join" ? "Entrando…" : "Entrar"}
          </button>
        </form>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {player && <p className="home__identity">Jogando como {player.name} neste navegador.</p>}
      </section>

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </main>
  );
}
