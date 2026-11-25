"use client";

import { useMemo } from "react";
import { useHaulerStore } from "@/lib/store";
import { planRoute } from "@/lib/optimizer";

export function MissionProgress() {
  const { missions, selectedShip, currentLocation, completedStops, toggleStop, clearProgress } =
    useHaulerStore();

  const route = useMemo(
    () =>
      missions.length > 0 && selectedShip
        ? planRoute(missions, selectedShip, currentLocation)
        : null,
    [missions, selectedShip, currentLocation]
  );

  if (!route || route.stops.length === 0) {
    return (
      <div className="rounded-lg border border-elevated bg-elevated/30 p-4">
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wider text-accent/60">
          Mission Progress
        </h3>
        <p className="text-xs text-accent/50">Add missions to track progress.</p>
      </div>
    );
  }

  const done = route.stops.filter((s) =>
    completedStops.includes(`${s.missionId}:${s.type}:${s.location}`)
  ).length;
  const total = route.stops.length;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="rounded-lg border border-elevated bg-elevated/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium uppercase tracking-wider text-accent/60">
          Mission Progress
        </h3>
        {done > 0 && (
          <button onClick={clearProgress} className="text-[10px] text-accent/40 hover:text-accent">
            Reset
          </button>
        )}
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span>
            {done} / {total} stops
          </span>
          <span className="text-gold">{pct}%</span>
        </div>
        <div className="h-1.5 bg-ink rounded-full overflow-hidden">
          <div className="h-full bg-sage transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ul className="space-y-1.5 text-xs max-h-48 overflow-auto">
        {route.stops.map((stop, i) => {
          const key = `${stop.missionId}:${stop.type}:${stop.location}`;
          const checked = completedStops.includes(key);
          return (
            <li key={i}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleStop(key)}
                  className="accent-gold"
                />
                <span className={checked ? "line-through text-accent/40" : ""}>
                  {i + 1}. {stop.type === "pickup" ? "Pickup" : "Deliver"} · {stop.location}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}