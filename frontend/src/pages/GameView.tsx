/** TELA DO JOGO: tabuleiro, dado, placar, vez, histórico e resultado. */
import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { AppHeader } from "../components/AppHeader";
import { Dice } from "../components/Dice";
import { GameBoard } from "../components/GameBoard";
import { GameHistory } from "../components/GameHistory";
import { GameResultModal } from "../components/GameResultModal";
import { Modal } from "../components/Modal";
import { Scoreboard } from "../components/Scoreboard";
import { TurnIndicator } from "../components/TurnIndicator";
import { useGame } from "../contexts/GameContext";
import { useSession } from "../contexts/SessionContext";
import { useBoard } from "../hooks/useBoard";
import { useMoveAnimation, type MoveHighlight } from "../hooks/useMoveAnimation";
import type { MoveRecord, RoomSnapshot } from "../types/contract";
import { errorMessage } from "../utils/errors";
import { playerName } from "../utils/text";

export function GameView({ room }: { room: RoomSnapshot }) {
  const { player } = useSession();
  const { state, actions, notify } = useGame();
  const { board, error: boardError } = useBoard();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [dismissedResult, setDismissedResult] = useState<number | null>(null);
  const myId = player?.id ?? null;

  // Avisos sincronizados com a animação (não com a chegada da mensagem).
  const onMoveShown = useCallback(
    (move: MoveRecord, highlight: MoveHighlight | null) => {
      const who = move.playerId === myId ? "Você" : playerName(room.players, move.playerId);
      if (highlight === "ladder") notify("ladder", `${who} subiu a escada da casa ${move.landedOn} até a ${move.finalPosition}!`);
      if (highlight === "snake") notify("snake", `${who} foi atingido pela serpente na casa ${move.landedOn} e desceu até a ${move.finalPosition}.`);
      if (highlight === "overshoot") notify("info", `${who} tirou ${move.dice} e passaria da chegada. Fica na casa ${move.from}.`);
      if (highlight === "extra-turn") notify("success", `${who} tirou 6 e joga de novo!`);
    },
    [myId, notify, room.players],
  );
  const anim = useMoveAnimation(room, onMoveShown);

  const isMyTurn = room.status === "IN_PROGRESS" && room.currentPlayerId === myId && !room.paused;
  const canRoll = isMyTurn && !anim.busy && !sending;
  const showResult = room.status === "FINISHED" && !anim.busy && dismissedResult !== room.matchNumber;

  async function roll() {
    setSending(true);
    setError(null);
    try {
      await actions.rollDice(room.moveCount);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function playAgain() {
    setSending(true);
    try {
      await actions.restartGame();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function leave() {
    try {
      await actions.leaveRoom();
    } finally {
      navigate("/");
    }
  }

  return (
    <div className="page page--game">
      <AppHeader>
        <span className="room-chip">
          Sala <strong>{room.code}</strong>
        </span>
        <span className="room-chip">Partida {room.matchNumber}</span>
      </AppHeader>

      <main className="game-layout">
        <section className="game-layout__board">
          {board ? (
            <GameBoard
              board={board}
              players={room.players}
              positions={anim.positions}
              currentPlayerId={anim.busy ? anim.movingPlayerId : room.currentPlayerId}
              movingPlayerId={anim.movingPlayerId}
              jumping={anim.jumping}
            />
          ) : (
            <div className="loading">{boardError ?? "Montando a pista…"}</div>
          )}
        </section>

        <aside className="game-layout__side">
          <TurnIndicator room={room} myId={myId} animating={anim.busy} />

          <section className="panel dice-panel">
            <Dice value={anim.diceValue} rolling={anim.rolling || (sending && isMyTurn)} />
            <div className="dice-panel__actions">
              <button type="button" className="btn btn--primary btn--roll" onClick={roll} disabled={!canRoll}>
                {sending ? "Lançando…" : isMyTurn ? "Lançar dado" : "Aguarde sua vez"}
              </button>
              {anim.diceValue && !anim.rolling && <p className="dice-panel__result">Resultado: {anim.diceValue}</p>}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
            </div>
          </section>

          <Scoreboard players={room.players} positions={anim.positions} currentPlayerId={room.currentPlayerId} myId={myId} />
          <GameHistory history={room.history} players={room.players} shownMoveNumber={anim.shownMoveNumber} />

          <button type="button" className="btn btn--danger-ghost btn--block" onClick={() => setConfirmLeave(true)}>
            Sair da partida
          </button>
        </aside>
      </main>

      {showResult && (
        <GameResultModal
          room={room}
          finished={state.finished?.matchNumber === room.matchNumber ? state.finished : null}
          myId={myId}
          busy={sending}
          onPlayAgain={playAgain}
          onRanking={() => navigate("/ranking")}
          onHome={leave}
          onClose={() => setDismissedResult(room.matchNumber)}
        />
      )}

      {confirmLeave && (
        <Modal title="Sair da partida" onClose={() => setConfirmLeave(false)}>
          <h2 className="modal__title">Sair da partida?</h2>
          <p>
            {room.status === "IN_PROGRESS"
              ? "A corrida será encerrada como abandonada e ninguém marca pontos."
              : "Você vai deixar a sala."}
          </p>
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmLeave(false)}>
              Continuar jogando
            </button>
            <button type="button" className="btn btn--danger" onClick={leave}>
              Sair
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
