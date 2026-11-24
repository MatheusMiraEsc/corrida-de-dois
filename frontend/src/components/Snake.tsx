/**
 * Serpente desenhada em SVG da cabeça (from) até a cauda (to): um corpo
 * ondulado (curva de Bézier) com listras, cabeça com olhos e língua.
 */
import { squareCenter } from "../utils/board";

export function Snake({ id, from, to, active }: { id: number; from: number; to: number; active: boolean }) {
  const head = squareCenter(from);
  const tail = squareCenter(to);
  const dx = tail.x - head.x;
  const dy = tail.y - head.y;
  const length = Math.hypot(dx, dy);
  const nx = -dy / length;
  const ny = dx / length;
  const wave = Math.min(7, length / 5);

  // Dois pontos de controle de lados opostos formam o "S" do corpo.
  const c1 = { x: head.x + dx * 0.33 + nx * wave, y: head.y + dy * 0.33 + ny * wave };
  const c2 = { x: head.x + dx * 0.66 - nx * wave, y: head.y + dy * 0.66 - ny * wave };
  const body = `M ${head.x} ${head.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${tail.x} ${tail.y}`;
  const angle = (Math.atan2(head.y - c1.y, head.x - c1.x) * 180) / Math.PI;
  const palette = SNAKE_COLORS[(id - 1) % SNAKE_COLORS.length];

  return (
    <g className={`snake${active ? " snake--active" : ""}`}>
      <path d={body} className="snake__body" stroke={palette.body} />
      <path d={body} className="snake__stripes" stroke={palette.stripe} />
      <g transform={`translate(${head.x} ${head.y}) rotate(${angle})`}>
        <path d="M 2.6 0 L 4.6 -0.7 M 2.6 0 L 4.6 0.7" className="snake__tongue" />
        <ellipse rx="2.9" ry="2.2" fill={palette.body} />
        <circle cx="1" cy="-0.95" r="0.55" fill="#fff" />
        <circle cx="1" cy="0.95" r="0.55" fill="#fff" />
        <circle cx="1.2" cy="-0.95" r="0.25" fill="#111" />
        <circle cx="1.2" cy="0.95" r="0.25" fill="#111" />
      </g>
    </g>
  );
}

const SNAKE_COLORS = [
  { body: "#7c3aed", stripe: "#c4b5fd" },
  { body: "#16a34a", stripe: "#bbf7d0" },
  { body: "#db2777", stripe: "#fbcfe8" },
  { body: "#ea580c", stripe: "#fed7aa" },
];
