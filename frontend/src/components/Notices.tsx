/** Avisos rápidos (toasts) no canto da tela; somem sozinhos. */
import { useEffect } from "react";
import { useGame } from "../contexts/GameContext";
import type { Notice } from "../contexts/gameReducer";

const DURATION_MS = 4500;

function NoticeItem({ notice, onDismiss }: { notice: Notice; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(notice.id), DURATION_MS);
    return () => clearTimeout(timer);
  }, [notice.id, onDismiss]);
  return (
    <li className={`notice notice--${notice.kind}`}>
      <span>{notice.text}</span>
      <button type="button" className="notice__close" onClick={() => onDismiss(notice.id)} aria-label="Fechar aviso">
        ×
      </button>
    </li>
  );
}

export function Notices() {
  const { state, dismissNotice } = useGame();
  return (
    <ul className="notices" aria-live="polite">
      {state.notices.map((notice) => (
        <NoticeItem key={notice.id} notice={notice} onDismiss={dismissNotice} />
      ))}
    </ul>
  );
}
