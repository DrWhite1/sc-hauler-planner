"use client";

import { useMemo } from "react";
import { useHaulerStore } from "@/lib/store";
import { planRoute } from "@/lib/optimizer";

export function RouteMap() {
  const { missions, selectedShip, currentLocation } = useHaulerStore();

  const route = useMemo(
    () =>
      missions.length > 0 && selectedShip
        ? planRoute(missions, selectedShip, currentLocation)
        : null,
    [missions, selectedShip, currentLocation]
  );

  if (!route || route.stops.length === 0) return null;

  // Collapse consecutive stops at the same location into one node
  const nodes: { location: string; types: Set<string>; scu: number }[] = [];
  for (const s of route.stops) {
    const last = nodes[nodes.length - 1];
    if (last && last.location === s.location) {
      last.types.add(s.type);
      last.scu += s.scu;
    } else {
      nodes.push({ location: s.location, types: new Set([s.type]), scu: s.scu });
    }
  }

  return (
    <div className="rounded-lg border border-elevated bg-elevated/50 p-4 mt-4">
      <h3 className="text-sm font-medium uppercase tracking-wider text-accent/60 mb-4">
        Route Map
      </h3>
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {currentLocation && (
          <>
            <div className="flex-shrink-0 text-center">
              <div className="w-3 h-3 rounded-full bg-accent/40 mx-auto mb-1" />
              <div className="text-[10px] text-accent/50 max-w-[80px] truncate">{currentLocation}</div>
            </div>
            <div className="flex-shrink-0 w-8 h-px bg-elevated" />
          </>
        )}
        {nodes.map((node, i) => (
          <div key={i} className="flex items-center gap-2 flex-shrink-0">
            <div className="text-center">
              <div
                className={`w-4 h-4 rounded-full mx-auto mb-1 ${
                  node.types.has("pickup") && node.types.has("dropoff")
                    ? "bg-gold"
                    : node.types.has("pickup")
                    ? "bg-sage"
                    : "bg-gold/70"
                }`}
              />
              <div className="text-[10px] max-w-[90px] truncate" title={node.location}>
                {node.location.replace(/ above .*/, "")}
              </div>
              <div className="text-[9px] text-accent/40">{node.scu} SCU</div>
            </div>
            {i < nodes.length - 1 && <div className="w-8 h-px bg-elevated" />}
          </div>
        ))}
      </div>
    </div>
  );
}