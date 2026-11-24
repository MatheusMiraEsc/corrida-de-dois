/** Escolha do veículo (recurso trazido do projeto original). */
import type { Vehicle } from "../types/contract";
import { VEHICLE_LABELS } from "../utils/text";
import { VehicleIcon } from "./VehicleIcon";

const VEHICLES: Vehicle[] = ["car", "pickup", "motorcycle", "bike"];

interface Props {
  value: Vehicle;
  onChange: (vehicle: Vehicle) => void;
  seat?: number;
  disabled?: boolean;
}

export function VehiclePicker({ value, onChange, seat = 1, disabled }: Props) {
  return (
    <div className={`vehicle-picker vehicle-picker--seat-${seat}`} role="radiogroup" aria-label="Escolha seu veículo">
      {VEHICLES.map((vehicle) => (
        <button
          key={vehicle}
          type="button"
          role="radio"
          aria-checked={value === vehicle}
          className={`vehicle-picker__option${value === vehicle ? " is-selected" : ""}`}
          onClick={() => onChange(vehicle)}
          disabled={disabled}
          title={VEHICLE_LABELS[vehicle]}
        >
          <VehicleIcon vehicle={vehicle} />
          <span>{VEHICLE_LABELS[vehicle]}</span>
        </button>
      ))}
    </div>
  );
}
