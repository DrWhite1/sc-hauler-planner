"use client";

import { useMemo } from "react";
import { useHaulerStore } from "@/lib/store";
import { planRoute } from "@/lib/optimizer";
import { hasExternalPort } from "@/lib/locations";
import { isValidOrder } from "@/lib/routeValidity";
import { groupStopsWithBoxes, formatBreakdown, type BoxCount } from "@/lib/containers";

function BoxChips({ boxes }: { boxes: BoxCount[] }) {
  if (boxes.length === 0) return <span className="text-accent/30">no boxes</span>;
  return (
    <>
      {boxes.map((b) => (
        <span
          key={b.size}
          className="px-1.5 py-0.5 rounded bg-ink/70 border border-elevated text-accent/70 tabular-nums"
        >
          {b.count}×<span className="text-accent/90">{b.size}</span>
        </span>
      ))}
    </>
  );
}

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
  // Same rule the optimizer uses: never unload cargo before it is loaded. Grouping below only
  // merges neighbouring stops, it never reorders them, so the box counts follow this order.
  const validOrder = isValidOrder(route.stops);
  const groups = groupStopsWithBoxes(route.stops, missions, selectedShip.maxContainer);
  const missionLabel = (id: string) => {
    const m = missions.find((x) => x.id === id);
    return m ? `${m.pickup} → ${m.dropoff}` : "Mission";
  };

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
        {groups.map((g, i) => {
          const ext = hasExternalPort(g.location);
          const multi = g.perMission.length > 1;
          const detail = g.perMission
            .map(
              (pm) =>
                `${missionLabel(pm.missionId)}: ${pm.scu} SCU = ${formatBreakdown(pm.boxes)} (max ${pm.maxSize}${pm.assumed ? ", assumed" : ""})`
            )
            .join("\n");
          return (
            <li
              key={i}
              className="text-sm py-1.5 px-2 rounded-md hover:bg-ink/40 transition"
            >
              <div className="flex items-center gap-3">
                <span className="w-5 text-[11px] text-accent/30 tabular-nums">{i + 1}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    g.type === "pickup" ? "bg-sage" : "bg-gold"
                  }`}
                />
                <span className={g.type === "pickup" ? "text-sage" : "text-gold/90"}>
                  {g.type === "pickup" ? "Pickup" : "Deliver"}
                </span>
                <span className="text-accent/70 truncate">{g.location}</span>
                {ext && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-sage/20 text-sage border border-sage/30">
                    EXT
                  </span>
                )}
                {multi && (
                  <span className="text-[9px] text-accent/40 whitespace-nowrap">{g.perMission.length} missions</span>
                )}
                <span className="ml-auto text-[11px] text-accent/40 tabular-nums whitespace-nowrap">
                  <span
                    title={g.estimated ? "Amount per pickup is not stated in the contract: the delivery is split evenly over its pickups" : undefined}
                  >
                    {g.type === "pickup" ? "+" : "−"}{g.estimated ? "≈" : ""}{g.scu}
                  </span>{" "}
                  → {g.cargoAfter}
                </span>
              </div>
              <div
                className="ml-[2.375rem] mt-1 flex flex-wrap items-center gap-1 text-[10px]"
                title={detail}
              >
                <span className="text-accent/35 mr-0.5">{g.type === "pickup" ? "Load" : "Unload"}</span>
                <BoxChips boxes={g.boxes} />
                {g.assumed && (
                  <span
                    className="text-accent/35 italic"
                    title="At least one mission has no max container size set; using the ship's max container size (or 32 SCU)"
                  >
                    assumed max
                  </span>
                )}
              </div>
              {multi && (
                <details className="ml-[2.375rem] mt-1 text-[10px] text-accent/50">
                  <summary className="cursor-pointer text-accent/35 hover:text-accent/60">Per mission</summary>
                  <ul className="mt-1 space-y-0.5">
                    {g.perMission.map((pm) => (
                      <li key={pm.missionId} className="flex flex-wrap gap-x-2">
                        <span className="truncate max-w-[16rem]">{missionLabel(pm.missionId)}</span>
                        <span className="tabular-nums">
                          {pm.scu} SCU = {formatBreakdown(pm.boxes)}
                        </span>
                        <span className="text-accent/30">
                          max {pm.maxSize}
                          {pm.assumed ? " (assumed)" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ol>

      {!validOrder && (
        <p className="mt-4 text-xs text-red-400 bg-red-950/30 rounded px-3 py-2">
          No valid order found: a delivery comes before its cargo is loaded. Check the mission legs (SCU per commodity).
        </p>
      )}

      {overPeak && (
        <p className="mt-4 text-xs text-red-400 bg-red-950/30 rounded px-3 py-2">
          Peak cargo ({route.peakScu} SCU) exceeds ship capacity. Deliver earlier or split the run.
        </p>
      )}
    </div>
  );
}