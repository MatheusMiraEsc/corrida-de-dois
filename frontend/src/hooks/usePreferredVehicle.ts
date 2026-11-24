/** Último veículo escolhido neste navegador (só preferência visual). */
import { useCallback, useState } from "react";
import type { Vehicle } from "../types/contract";

const KEY = "corrida-dos-dois:veiculo";
const VALID: Vehicle[] = ["car", "pickup", "motorcycle", "bike"];

export function usePreferredVehicle(): [Vehicle, (vehicle: Vehicle) => void] {
  const [vehicle, setVehicle] = useState<Vehicle>(() => {
    const saved = localStorage.getItem(KEY) as Vehicle | null;
    return saved && VALID.includes(saved) ? saved : "car";
  });
  const update = useCallback((next: Vehicle) => {
    localStorage.setItem(KEY, next);
    setVehicle(next);
  }, []);
  return [vehicle, update];
}
