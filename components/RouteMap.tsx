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

  const color = (types: Set<string>) => {
    if (types.has("pickup") && types.has("dropoff")) return "bg-gold border-gold";
    if (types.has("pickup")) return "bg-sage border-sage";
    return "bg-gold/80 border-gold";
  };

  return (
    <div className="rounded-lg border border-elevated bg-elevated/40 p-4 mt-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-accent/50 mb-4">
        Route
      </h3>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {currentLocation && (
          <>
            <div className="flex-shrink-0 text-center w-16">
              <div className="w-8 h-8 rounded-full border-2 border-accent/30 bg-ink mx-auto flex items-center justify-center text-[10px] text-accent/60">
                You
              </div>
              <div className="text-[9px] text-accent/40 mt-1 truncate">{currentLocation}</div>
            </div>
            <div className="flex-shrink-0 text-accent/30 text-lg">→</div>
          </>
        )}
        {nodes.map((node, i) => (
          <div key={i} className="flex items-center gap-1 flex-shrink-0">
            <div className="text-center w-20">
              <div
                className={`w-9 h-9 rounded-full border-2 mx-auto flex items-center justify-center text-[10px] font-medium text-ink ${color(node.types)}`}
              >
                {node.types.has("pickup") && node.types.has("dropoff") ? "P/D" : node.types.has("pickup") ? "P" : "D"}
              </div>
              <div className="text-[10px] mt-1 truncate" title={node.location}>
                {node.location.replace(/ above .*/, "")}
              </div>
              <div className="text-[9px] text-accent/40">{node.scu} SCU</div>
            </div>
            {i < nodes.length - 1 && <div className="flex-shrink-0 text-accent/30 text-lg">→</div>}
          </div>
        ))}
      </div>
    </div>
  );
}