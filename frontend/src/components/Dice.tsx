/**
 * Dado animado. Enquanto gira, mostra faces aleatórias PURAMENTE DECORATIVAS
 * (como no projeto original); o valor que vale é sempre o do servidor.
 */
import { useEffect, useState } from "react";

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function Dice({ value, rolling }: { value: number | null; rolling: boolean }) {
  const [decorativeFace, setDecorativeFace] = useState(1);

  useEffect(() => {
    if (!rolling) return;
    const timer = setInterval(() => setDecorativeFace(1 + Math.floor(Math.random() * 6)), 90);
    return () => clearInterval(timer);
  }, [rolling]);

  const face = rolling ? decorativeFace : value;
  const label = rolling ? "Dado girando" : value ? `Dado: ${value}` : "Dado ainda não lançado";

  return (
    <div className={`dice${rolling ? " dice--rolling" : ""}${!face ? " dice--empty" : ""}`} role="img" aria-label={label}>
      {face ? (
        <div className="dice__face">
          {Array.from({ length: 9 }, (_, index) => (
            <span key={index} className={`dice__pip${PIPS[face].includes(index) ? " dice__pip--on" : ""}`} />
          ))}
        </div>
      ) : (
        <span className="dice__placeholder">?</span>
      )}
    </div>
  );
}
