/** Escada desenhada em SVG entre o centro de duas casas (coordenadas em %). */
import { squareCenter } from "../utils/board";

export function Ladder({ from, to, active }: { from: number; to: number; active: boolean }) {
  const a = squareCenter(from);
  const b = squareCenter(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  // Vetor perpendicular para separar os dois trilhos.
  const px = (-dy / length) * 1.9;
  const py = (dx / length) * 1.9;
  const rungs = Math.max(3, Math.floor(length / 3.2));

  return (
    <g className={`ladder${active ? " ladder--active" : ""}`}>
      <line className="ladder__rail" x1={a.x + px} y1={a.y + py} x2={b.x + px} y2={b.y + py} />
      <line className="ladder__rail" x1={a.x - px} y1={a.y - py} x2={b.x - px} y2={b.y - py} />
      {Array.from({ length: rungs }, (_, i) => {
        const t = (i + 0.5) / rungs;
        const cx = a.x + dx * t;
        const cy = a.y + dy * t;
        return <line key={i} className="ladder__rung" x1={cx + px} y1={cy + py} x2={cx - px} y2={cy - py} />;
      })}
    </g>
  );
}
