/**
 * Ícones dos veículos em SVG próprio (sem CDN). A cor da carroceria vem de
 * "currentColor", então cada jogador pinta o seu veículo com a cor do assento.
 */
import type { Vehicle } from "../types/contract";

interface Props {
  vehicle: Vehicle;
  className?: string;
  title?: string;
}

export function VehicleIcon({ vehicle, className, title }: Props) {
  return (
    <svg viewBox="0 0 64 40" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      {SHAPES[vehicle]}
    </svg>
  );
}

const wheel = (cx: number, cy = 31, r = 6.5) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill="#14161f" />
    <circle cx={cx} cy={cy} r={r * 0.45} fill="#c9ced9" />
  </g>
);

const SHAPES: Record<Vehicle, React.ReactNode> = {
  car: (
    <g>
      <path
        d="M4 27c0-4 2-6 6-7l8-2 8-7c2-1.6 4-2 6.5-2H42c3 0 5 1 7 3l5 5 5 1.5c2.4.7 3.5 2.3 3.5 4.7V30H4z"
        fill="currentColor"
      />
      <path d="M27 17l5-5.2c1-.8 2-1.3 3.4-1.3H40v6.5z" fill="#d8f1ff" opacity=".9" />
      <path d="M42.5 10.5c1.8 0 3 .6 4.2 1.8l4 4.7h-8.2z" fill="#d8f1ff" opacity=".9" />
      <rect x="6" y="22" width="7" height="2.4" rx="1.2" fill="#fff6c2" />
      <path d="M20 23h36" stroke="#000" strokeOpacity=".18" strokeWidth="1.2" />
      {wheel(16)}
      {wheel(49)}
    </g>
  ),
  pickup: (
    <g>
      <path d="M3 30V20.5c0-1.4 1-2.5 2.5-2.5H34V8.5c0-1.4 1.1-2.5 2.5-2.5h9c1.6 0 3 .8 3.8 2.1L55 18l4.4 1.4c1.8.6 2.6 1.8 2.6 3.6V30z" fill="currentColor" />
      <path d="M38 9h7.3c.8 0 1.4.4 1.8 1l4.2 7H38z" fill="#d8f1ff" opacity=".9" />
      <path d="M5 18h29" stroke="#000" strokeOpacity=".25" strokeWidth="1.5" />
      <rect x="56" y="21" width="5" height="2.4" rx="1.2" fill="#fff6c2" />
      {wheel(15)}
      {wheel(48)}
    </g>
  ),
  motorcycle: (
    <g>
      <path d="M17 29l9-11h13l6-6h6l-3 5 4 6H40l-6 6z" fill="currentColor" />
      <path d="M26 18l3-5h8l2 5z" fill="currentColor" opacity=".75" />
      <path d="M45 12l5-4" stroke="#14161f" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="33" cy="9" r="4.2" fill="#14161f" />
      {wheel(13, 30, 7.5)}
      {wheel(52, 30, 7.5)}
    </g>
  ),
  bike: (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="14" cy="28" r="9" stroke="#14161f" strokeWidth="3.2" />
      <circle cx="50" cy="28" r="9" stroke="#14161f" strokeWidth="3.2" />
      <path d="M14 28l11-14h17l8 14M25 14l7 14 10-14M32 28l-2-17h-5M42 14l-2-5h6" stroke="currentColor" strokeWidth="3.4" />
    </g>
  ),
};
