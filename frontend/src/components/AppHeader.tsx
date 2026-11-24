/** Cabeçalho comum: marca, estado da conexão, regras e ranking. */
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useGame } from "../contexts/GameContext";
import { Brand } from "./Brand";
import { RulesModal } from "./RulesModal";

const CONNECTION_LABELS = {
  connecting: "conectando…",
  open: "online",
  reconnecting: "reconectando…",
  replaced: "aberto em outra janela",
  closed: "offline",
} as const;

export function AppHeader({ children }: { children?: ReactNode }) {
  const { state } = useGame();
  const [showRules, setShowRules] = useState(false);

  return (
    <header className="app-header">
      <Brand />
      <div className="app-header__middle">{children}</div>
      <nav className="app-header__nav">
        <span className={`connection connection--${state.connection}`} title="Conexão em tempo real">
          {CONNECTION_LABELS[state.connection]}
        </span>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => setShowRules(true)}>
          Regras
        </button>
        <Link to="/ranking" className="btn btn--ghost btn--small">
          Ranking
        </Link>
      </nav>
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </header>
  );
}
