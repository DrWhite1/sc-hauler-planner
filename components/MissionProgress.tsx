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
      <div className="panel p-4">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-accent/50">
          Progress
        </h3>
        <p className="text-xs text-accent/40">Add missions to track progress.</p>
      </div>
    );
  }

  const done = route.stops.filter((s) =>
    completedStops.includes(`${s.missionId}:${s.type}:${s.location}`)
  ).length;
  const total = route.stops.length;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-accent/50">
          Progress
        </h3>
        {done > 0 && (
          <button onClick={clearProgress} className="text-[10px] text-accent/40 hover:text-accent transition">
            Reset
          </button>
        )}
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-accent/70">
            {done} / {total} stops
          </span>
          <span className="text-gold font-medium">{pct}%</span>
        </div>
        <div className="h-1.5 bg-ink rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-sage to-gold transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ul className="space-y-1 text-xs max-h-52 overflow-auto pr-1">
        {route.stops.map((stop, i) => {
          const key = `${stop.missionId}:${stop.type}:${stop.location}`;
          const checked = completedStops.includes(key);
          return (
            <li key={i}>
              <label className="flex items-center gap-2 cursor-pointer py-1 px-1.5 rounded hover:bg-ink/50 transition">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleStop(key)}
                  className="accent-gold w-3.5 h-3.5"
                />
                <span className={`flex-1 ${checked ? "line-through text-accent/35" : ""}`}>
                  <span className="text-accent/40 mr-1">{i + 1}.</span>
                  <span className={stop.type === "pickup" ? "text-sage" : "text-gold/80"}>
                    {stop.type === "pickup" ? "Pickup" : "Deliver"}
                  </span>
                  <span className="text-accent/60"> · {stop.location.replace(/ above .*/, "")}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}