/** Textos exibidos ao jogador a partir dos dados do servidor. */
import type { MoveRecord, RoomPlayer, Vehicle } from "../types/contract";

export const VEHICLE_LABELS: Record<Vehicle, string> = {
  car: "Carro esportivo",
  pickup: "Picape",
  motorcycle: "Moto",
  bike: "Bicicleta",
};

export function describeMove(move: MoveRecord, name: string): string {
  switch (move.effect) {
    case "LADDER":
      return `${name} tirou ${move.dice}, caiu na casa ${move.landedOn} e subiu a escada até a ${move.finalPosition}!`;
    case "SNAKE":
      return `${name} tirou ${move.dice}, caiu na casa ${move.landedOn} e foi atingido pela serpente até a ${move.finalPosition}.`;
    case "OVERSHOOT":
      return `${name} tirou ${move.dice}, mas passaria da chegada: ficou na casa ${move.from}.`;
    default:
      return move.won
        ? `${name} tirou ${move.dice} e cruzou a linha de chegada!`
        : `${name} tirou ${move.dice} e avançou da casa ${move.from} para a ${move.finalPosition}.`;
  }
}

export function playerName(players: RoomPlayer[], playerId: string | null | undefined): string {
  return players.find((p) => p.playerId === playerId)?.name ?? "Jogador";
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} min ${seconds.toString().padStart(2, "0")} s` : `${seconds} s`;
}

export function formatWinRate(rate: number): string {
  return `${rate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
