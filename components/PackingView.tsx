"use client";

import { useMemo } from "react";
import { useHaulerStore } from "@/lib/store";
import { planRoute } from "@/lib/optimizer";
import { buildPackingOrder } from "@/lib/packing";
import { formatBreakdown } from "@/lib/containers";

export function PackingView() {
  const { missions, selectedShip, currentLocation } = useHaulerStore();

  const route = useMemo(
    () =>
      missions.length > 0 && selectedShip
        ? planRoute(missions, selectedShip, currentLocation)
        : null,
    [missions, selectedShip, currentLocation]
  );

  const packing = useMemo(() => {
    if (!route || !selectedShip) return [];
    return buildPackingOrder(route.stops, missions, selectedShip.maxContainer);
  }, [route, missions, selectedShip]);

  if (!route || packing.length === 0) return null;

  return (
    <div className="rounded-lg border border-elevated bg-elevated/50 p-4 mt-4">
      <h3 className="text-sm font-medium uppercase tracking-wider text-accent/60 mb-3">
        Packing Order
      </h3>
      <p className="text-[10px] text-accent/40 mb-3">
        Load last = deliver first (nearest the door)
      </p>
      <ol className="space-y-1.5 text-xs">
        {packing.map((item) => (
          <li key={`${item.missionId}-${item.loadOrder}`} className="flex justify-between gap-2">
            <span>
              <span className="text-accent/40">{item.loadOrder}.</span>{" "}
              {item.commodity || "Cargo"} from {item.location}
            </span>
            <span
              className="text-accent/50 text-right tabular-nums"
              title={`Largest box ${item.containerSize} SCU${item.containerAssumed ? " (assumed: mission max not set)" : ""}`}
            >
              {item.scu} SCU · {formatBreakdown(item.boxes)}
              {item.containerAssumed && <span className="text-accent/30">*</span>}
            </span>
          </li>
        ))}
      </ol>
      {packing.some((p) => p.containerAssumed) && (
        <p className="text-[10px] text-accent/35 mt-2">
          * max container size not set on the mission, assumed {selectedShip?.maxContainer ?? 32} SCU (ship max)
        </p>
      )}
    </div>
  );
}