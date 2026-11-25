"use client";

import { useMemo } from "react";
import { useHaulerStore } from "@/lib/store";
import { planRoute } from "@/lib/optimizer";

type Node = {
  location: string;
  types: Set<string>;
  scu: number;
  keys: string[];
  done: boolean;
  partial: boolean;
};

export function RouteMap() {
  const { missions, selectedShip, currentLocation, completedStops } = useHaulerStore();

  const route = useMemo(
    () =>
      missions.length > 0 && selectedShip
        ? planRoute(missions, selectedShip, currentLocation)
        : null,
    [missions, selectedShip, currentLocation]
  );

  if (!route || route.stops.length === 0) return null;

  const nodes: Node[] = [];
  for (const s of route.stops) {
    const key = `${s.missionId}:${s.type}:${s.location}`;
    const last = nodes[nodes.length - 1];
    if (last && last.location === s.location) {
      last.types.add(s.type);
      last.scu += s.scu;
      last.keys.push(key);
    } else {
      nodes.push({
        location: s.location,
        types: new Set([s.type]),
        scu: s.scu,
        keys: [key],
        done: false,
        partial: false,
      });
    }
  }

  for (const n of nodes) {
    const doneCount = n.keys.filter((k) => completedStops.includes(k)).length;
    n.done = doneCount === n.keys.length;
    n.partial = doneCount > 0 && doneCount < n.keys.length;
  }

  const color = (n: Node) => {
    if (n.done) return "bg-accent/20 border-accent/30 text-accent/40";
    if (n.partial) return "bg-gold/40 border-gold/60 text-ink";
    if (n.types.has("pickup") && n.types.has("dropoff")) return "bg-gold border-gold text-ink";
    if (n.types.has("pickup")) return "bg-sage border-sage text-ink";
    return "bg-gold/80 border-gold text-ink";
  };

  const label = (n: Node) => {
    if (n.done) return "\u2713";
    if (n.types.has("pickup") && n.types.has("dropoff")) return "P/D";
    if (n.types.has("pickup")) return "P";
    return "D";
  };

  return (
    <div className="panel p-4 mt-4">
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
                className={`w-9 h-9 rounded-full border-2 mx-auto flex items-center justify-center text-[10px] font-medium transition ${color(node)}`}
              >
                {label(node)}
              </div>
              <div
                className={`text-[10px] mt-1 truncate ${node.done ? "text-accent/30 line-through" : ""}`}
                title={node.location}
              >
                {node.location.replace(/ above .*/, "")}
              </div>
              <div className={`text-[9px] ${node.done ? "text-accent/20" : "text-accent/40"}`}>
                {node.scu} SCU
              </div>
            </div>
            {i < nodes.length - 1 && (
              <div className={`flex-shrink-0 text-lg ${node.done ? "text-sage/50" : "text-accent/30"}`}>
                →
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}