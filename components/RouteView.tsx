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
      <div className="rounded-lg border border-dashed border-elevated p-8 text-center text-accent/40">
        Select a ship to calculate routes
      </div>
    );
  }

  if (!route) {
    return (
      <div className="rounded-lg border border-dashed border-elevated p-8 text-center text-accent/40">
        Add missions to see an optimized route
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-elevated bg-elevated/50 p-4">
      <h2 className="text-lg font-semibold mb-4">
        Optimized Route
        {currentLocation && (
          <span className="text-sm font-normal text-accent/50 ml-2">
            from {currentLocation}
          </span>
        )}
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
        <div>
          <div className="text-accent/50 text-xs">Total Profit</div>
          <div className="text-gold font-medium">{route.totalReward.toLocaleString()} aUEC</div>
        </div>
        <div>
          <div className="text-accent/50 text-xs">Total SCU</div>
          <div className={route.totalScu > selectedShip.scu ? "text-red-400" : "text-sage"}>
            {route.totalScu} / {selectedShip.scu}
          </div>
        </div>
        <div>
          <div className="text-accent/50 text-xs">Stops</div>
          <div>{route.stops.length}</div>
        </div>
        <div>
          <div className="text-accent/50 text-xs">Est. aUEC/hr</div>
          <div className="text-gold">{Math.round(route.auecPerHour).toLocaleString()}</div>
        </div>
      </div>

      <ol className="space-y-2 text-sm">
        {route.stops.map((stop, i) => (
          <li key={i} className="flex gap-3">
            <span className="w-6 text-accent/40">{i + 1}.</span>
            <span className={stop.type === "pickup" ? "text-sage" : "text-gold"}>
              {stop.type === "pickup" ? "Pickup" : "Deliver"} · {stop.location}
            </span>
            <span className="ml-auto text-xs text-accent/50">{stop.scu} SCU</span>
          </li>
        ))}
      </ol>

      {route.totalScu > selectedShip.scu && (
        <p className="mt-4 text-sm text-red-400">
          Warning: Combined cargo exceeds ship capacity. Split the run.
        </p>
      )}
    </div>
  );
}