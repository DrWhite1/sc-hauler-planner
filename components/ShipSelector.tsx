"use client";

import { SHIPS } from "@/lib/ships";
import { useHaulerStore } from "@/lib/store";

export function ShipSelector() {
  const { selectedShip, setShip } = useHaulerStore();

  return (
    <div className="rounded-lg border border-elevated bg-elevated/30 p-4">
      <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-accent/60">
        Ship
      </h3>
      <select
        value={selectedShip?.id ?? ""}
        onChange={(e) => {
          const ship = SHIPS.find((s) => s.id === e.target.value) ?? null;
          setShip(ship);
        }}
        className="w-full rounded bg-ink border border-elevated px-3 py-2 text-sm focus:outline-none focus:border-gold"
      >
        <option value="">Select a ship...</option>
        {SHIPS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.scu.toLocaleString()} SCU){s.concept ? " · concept" : ""}
          </option>
        ))}
      </select>
      {selectedShip && (
        <p className="mt-2 text-xs text-sage">
          Capacity: {selectedShip.scu.toLocaleString()} SCU · Max container: {selectedShip.maxContainer} SCU
          {selectedShip.concept && <span className="text-accent/40"> · concept ship, numbers may change</span>}
        </p>
      )}
    </div>
  );
}