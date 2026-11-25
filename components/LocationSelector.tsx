"use client";

import { LOCATIONS } from "@/lib/locations";
import { useHaulerStore } from "@/lib/store";

export function LocationSelector() {
  const { currentLocation, setCurrentLocation } = useHaulerStore();

  return (
    <div className="rounded-lg border border-elevated bg-elevated/30 p-4">
      <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-accent/60">
        Current Location
      </h3>
      <select
        value={currentLocation}
        onChange={(e) => setCurrentLocation(e.target.value)}
        className="w-full rounded bg-ink border border-elevated px-3 py-2 text-sm focus:outline-none focus:border-gold"
      >
        <option value="">Select station...</option>
        {LOCATIONS.map((loc) => (
          <option key={loc} value={loc}>
            {loc}
          </option>
        ))}
      </select>
      {currentLocation && (
        <p className="mt-2 text-xs text-sage">Starting from {currentLocation}</p>
      )}
    </div>
  );
}