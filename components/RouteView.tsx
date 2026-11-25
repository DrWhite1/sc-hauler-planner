"use client";

import { useMemo } from "react";
import { useHaulerStore } from "@/lib/store";
import { planRoute } from "@/lib/optimizer";

export function RouteView() {
  const { missions, selectedShip, currentLocation } = useHaulerStore();

  const route = useMemo(
    () =>
      missions.length > 0 && selectedShip
        ? planRoute(missions, selectedShip, currentLocation)
        : null,
    [missions, selectedShip, currentLocation]
  );

  if (!selectedShip) {
    return (
      <div className="panel p-8 text-center text-accent/40 text-sm">
        Select a ship to calculate routes
      </div>
    );
  }

  if (!route) {
    return (
      <div className="panel p-8 text-center text-accent/40 text-sm">
        Add missions to see an optimized route
      </div>
    );
  }

  const overPeak = route.peakScu > selectedShip.scu;

  return (
    <div className="panel p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-base font-semibold tracking-tight">
          Optimized Route
        </h2>
        {currentLocation && (
          <span className="text-xs text-accent/40">from {currentLocation}</span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        <div className="stat">
          <div className="text-[10px] uppercase tracking-wider text-accent/40">Profit</div>
          <div className="text-gold font-semibold mt-0.5">{route.totalReward.toLocaleString()}</div>
          <div className="text-[9px] text-accent/30">aUEC</div>
        </div>
        <div className="stat">
          <div className="text-[10px] uppercase tracking-wider text-accent/40">Peak Cargo</div>
          <div className={`font-semibold mt-0.5 ${overPeak ? "text-red-400" : "text-sage"}`}>
            {route.peakScu} <span className="text-accent/40 font-normal">/ {selectedShip.scu}</span>
          </div>
          <div className="text-[9px] text-accent/30">SCU</div>
        </div>
        <div className="stat">
          <div className="text-[10px] uppercase tracking-wider text-accent/40">Stops</div>
          <div className="font-semibold mt-0.5">{route.stops.length}</div>
        </div>
        <div className="stat">
          <div className="text-[10px] uppercase tracking-wider text-accent/40">aUEC/hr</div>
          <div className="text-gold font-semibold mt-0.5">{Math.round(route.auecPerHour).toLocaleString()}</div>
          <div className="text-[9px] text-accent/30">~{Math.round(route.estimatedMinutes)} min</div>
        </div>
      </div>

      <ol className="space-y-1">
        {route.stops.map((stop, i) => (
          <li
            key={i}
            className="flex items-center gap-3 text-sm py-1.5 px-2 rounded-md hover:bg-ink/40 transition"
          >
            <span className="w-5 text-[11px] text-accent/30 tabular-nums">{i + 1}</span>
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                stop.type === "pickup" ? "bg-sage" : "bg-gold"
              }`}
            />
            <span className={stop.type === "pickup" ? "text-sage" : "text-gold/90"}>
              {stop.type === "pickup" ? "Pickup" : "Deliver"}
            </span>
            <span className="text-accent/70 truncate">{stop.location}</span>
            <span className="ml-auto text-[11px] text-accent/40 tabular-nums">
              {stop.type === "pickup" ? "+" : "−"}{stop.scu} → {stop.cargoAfter}
            </span>
          </li>
        ))}
      </ol>

      {overPeak && (
        <p className="mt-4 text-xs text-red-400 bg-red-950/30 rounded px-3 py-2">
          Peak cargo ({route.peakScu} SCU) exceeds ship capacity. Deliver earlier or split the run.
        </p>
      )}
    </div>
  );
}