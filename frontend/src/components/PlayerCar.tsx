/**
 * O carrinho de um jogador sobre o tabuleiro. A posição é calculada a partir
 * da casa exibida e aplicada via estilo (left/top em %); a suavidade vem da
 * transição CSS. Nenhuma medição ou manipulação do DOM é necessária.
 */
import type { CSSProperties } from "react";
import type { Vehicle } from "../types/contract";
import { squareCenter } from "../utils/board";
import { VehicleIcon } from "./VehicleIcon";

interface Props {
  name: string;
  seat: number;
  vehicle: Vehicle;
  square: number;
  /** Os dois na mesma casa: cada um se afasta um pouco para ambos aparecerem. */
  sharingSquare: boolean;
  moving: boolean;
  jumping: "ladder" | "snake" | null;
  isCurrentTurn: boolean;
}

export function PlayerCar({ name, seat, vehicle, square, sharingSquare, moving, jumping, isCurrentTurn }: Props) {
  const { x, y } = squareCenter(square);
  const offset = sharingSquare ? (seat === 1 ? -1.8 : 1.8) : 0;
  const style: CSSProperties = { left: `${x + offset}%`, top: `${y + offset * 0.6}%` };
  const classes = [
    "player-car",
    `player-car--seat-${seat}`,
    moving && "player-car--moving",
    jumping && `player-car--${jumping}`,
    isCurrentTurn && "player-car--turn",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} style={style} aria-label={`${name} na casa ${square}`} role="img">
      <VehicleIcon vehicle={vehicle} className="player-car__icon" />
      <span className="player-car__tag">{name.slice(0, 1).toUpperCase()}</span>
    </div>
  );
}
