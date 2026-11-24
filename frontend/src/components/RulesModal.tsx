/** Regras do jogo (texto). Escadas e serpentes vêm do servidor. */
import { useBoard } from "../hooks/useBoard";
import { Modal } from "./Modal";

export function RulesModal({ onClose }: { onClose: () => void }) {
  const { board } = useBoard();
  return (
    <Modal title="Regras do jogo" onClose={onClose} className="rules">
      <h2 className="modal__title">Como se joga</h2>
      <ol className="rules__list">
        <li>Dois pilotos, cada um em uma máquina, entram na mesma sala pelo código.</li>
        <li>A ordem de largada é sorteada. Os dois começam na casa 1.</li>
        <li>Na sua vez, lance o dado: o carrinho anda o número de casas sorteado.</li>
        <li>
          Parou na base de uma <strong className="text-ladder">escada</strong>? Sobe na hora.
        </li>
        <li>
          Parou na cabeça de uma <strong className="text-snake">serpente</strong>? Desce até a cauda.
        </li>
        <li>
          Tirou <strong>6</strong>? Joga de novo.
        </li>
        <li>
          A chegada é a casa <strong>100</strong> e precisa ser exata: se o dado passar, o carrinho fica onde está.
        </li>
        <li>
          Ranking global: vitória vale <strong>+100</strong> pontos e derrota <strong>+20</strong>. Partidas
          abandonadas não pontuam.
        </li>
      </ol>
      {board && (
        <div className="rules__jumps">
          <div>
            <h3 className="text-ladder">Escadas</h3>
            <p>{board.ladders.map((l) => `${l.from} → ${l.to}`).join(" · ")}</p>
          </div>
          <div>
            <h3 className="text-snake">Serpentes</h3>
            <p>{board.snakes.map((s) => `${s.from} → ${s.to}`).join(" · ")}</p>
          </div>
        </div>
      )}
    </Modal>
  );
}
